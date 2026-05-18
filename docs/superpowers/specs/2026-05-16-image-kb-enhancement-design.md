# Image Knowledge Base 增强:即时显示 + 进度 + OCR + 混合检索

**Status**: Draft (2026-05-16)
**Scope**: chayuan-server (image_source 模块、image_routes、knowledge_universe_routes) + chayuan-client (kb/detail/ImageKbDetail、packages/api)
**Related**: Plan 3D 本地 runtime image-embedding (2026-05-15) — CLIP via infinity sidecar 已就绪;本 spec 在其上构建上层业务能力。

---

## 1. 背景与问题

知识中心的"图像类型"知识库当前实现存在 4 个问题:

1. **Bug — 上传后刷新消失**:上传接口写盘 (`conn.add_image()` → `store._save()`) 与详情接口读盘 (`get_store()._load()`) 没有共享内存实例,也没有写锁。并发或读时序边界条件下,详情端看到的是上一份快照,刷新后 item 消失。
2. **缺失 — 没有即时反馈**:上传是同步阻塞处理,CLIP embed 完成才返回。用户在大文件 / 多文件场景看不到任何中间状态。
3. **缺失 — 没有 OCR**:`ImageConnector.add_image()` 已经预留 `ocr_text` 参数,但 `image_routes.py` upload 路径从来不调 RapidOCR,文字图像无法被搜到。
4. **缺失 — 文字搜索只能按图**:`_search_sync()` 只走 CLIP embedding 余弦相似度,query 必须是图像。

## 2. 目标

- (G1) 修复上传后刷新消失 bug。
- (G2) 上传后图像立刻显示在列表(占位卡片),并展示向量化进度。
- (G3) 上传图像并行做 OCR 文本提取,文本作为 metadata 保留。
- (G4) 文字搜索:OCR 文本语义检索(走用户配置的默认文本向量模型) + CLIP 跨模态视觉检索,两路 RRF 融合。
- (G5) 按图搜索保留现有行为不变。
- (G6) 任一子能力(OCR / 默认文本向量模型 / CLIP)不可用时降级而非整体失败。

非目标:OCR 文本的 BM25/关键词高亮、多模态查询(图+文同时)、老 item 的自动回填 OCR/文本向量。

## 3. 架构总览

```
┌────────────────────────────────────────────────────────────────────┐
│  Frontend (kb/detail/ImageKbDetail.tsx)                            │
│                                                                    │
│  Upload → 立即占位卡片 → 轮询 /status → 状态更新                    │
│  Search:                                                           │
│    ├ [按文字] → POST /image-kb/{kb}/search → RRF 融合结果           │
│    └ [按图]   → POST /image-kb/{kb}/search-by-image (现有)          │
└────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴────────────────────────────────────┐
│  Server (chayuan-server)                                           │
│                                                                    │
│  api_server/image_routes.py                                        │
│    POST /upload                  → 同步插占位 + BackgroundTasks     │
│    GET  /items/{id}/status       → 单 item 状态                     │
│    POST /search                  → 文字搜索 (RRF)                    │
│    POST /search-by-image         → 按图搜索 (现有)                   │
│                                                                    │
│  image_source/                                                     │
│    registry.py  (新增) — 进程级 ImageStore 单例 + asyncio.Lock      │
│    store.py     — 双 FAISS 索引 (image.faiss + text.faiss)         │
│    connector.py — pipeline:OCR ‖ CLIP 并行 → 默认文本向量模型 → flush         │
│    fusion.py    (新增) — RRF 实现                                   │
│                                                                    │
│  外部依赖(已有,本 spec 只调用):                                   │
│    modality/rapidocr_server.py  — RapidOCR 文字识别                  │
│    image_source/embedder.py     — CLIP via infinity sidecar         │
│    utils.get_default_embedding  — 用户配置的默认文本向量模型(任何       │
│        OpenAI 兼容 /v1/embeddings 端点;本地 sidecar / OpenAI / 其它)│
└────────────────────────────────────────────────────────────────────┘
```

## 4. 设计

### 4.1 存储层:registry + 写锁 + 双索引

**新增 `image_source/registry.py`**:

```python
# 进程级单例,按 kb_id 缓存 ImageStore。所有 image_source 调用走它。
class ImageStoreRegistry:
    _instances: dict[str, ImageStore] = {}
    _locks: dict[str, asyncio.Lock] = {}
    _global_lock = asyncio.Lock()

    @classmethod
    async def get(cls, kb_id: str) -> ImageStore:
        async with cls._global_lock:
            if kb_id not in cls._instances:
                cls._instances[kb_id] = ImageStore.load_from_disk(kb_id)
                cls._locks[kb_id] = asyncio.Lock()
            return cls._instances[kb_id]

    @classmethod
    def lock_for(cls, kb_id: str) -> asyncio.Lock:
        return cls._locks[kb_id]
```

**`image_source/store.py` 改造**:

- 拆出两个 FAISS 索引:`image.faiss` (CLIP 512 dim) 与 `text.faiss` (默认文本向量模型的输出维度,由首条插入向量决定),均使用 `IndexIDMap2` 绑定整型 vector_id。
- `ImageStore` 持久化路径:`<kb_root>/image.faiss`, `<kb_root>/text.faiss`, `<kb_root>/metadata.json`。
- 不再每次 `get_store()` 重新 `_load()`;`load_from_disk()` 只在 registry 首次创建实例时调用。
- 所有 mutation 方法假定调用方已持有 `registry.lock_for(kb_id)`。
- 内存为真源,`flush()` 显式持久化(由 pipeline 在状态变更后调用)。

**元数据 schema(向后兼容)**:

```json
{
  "id": "img_<sha1_prefix_12>",
  "filename": "screenshot.png",
  "mime_type": "image/png",
  "size_bytes": 12345,
  "thumbnail_path": "thumbs/img_xxx.jpg",
  "state": "queued | ocr_and_embedding | ready | failed",
  "progress": 0,
  "error": null,
  "ocr_text": null,
  "ocr_lang": null,
  "ocr_confidence": null,
  "has_text_vector": false,
  "image_vector_id": 12,
  "text_vector_id": null,
  "created_at": "2026-05-16T12:34:56Z",
  "updated_at": "2026-05-16T12:34:56Z"
}
```

老数据(无 `state` 字段)迁移:`load_from_disk()` 检测到缺字段时填默认 `state="ready", progress=100, has_text_vector=False`。不主动回填 OCR/文本向量。

### 4.2 Upload pipeline:同步占位 + 异步处理

**`POST /api/v1/image-kb/{kb_id}/upload`**(multipart `files[]`):

```python
async def upload_endpoint(kb_id, files, background_tasks: BackgroundTasks):
    store = await ImageStoreRegistry.get(kb_id)
    items_resp = []
    async with ImageStoreRegistry.lock_for(kb_id):
        for f in files:
            image_bytes = await f.read()
            item_id = "img_" + sha1(image_bytes).hexdigest()[:12]
            if store.has(item_id):
                items_resp.append(store.get(item_id))  # 去重
                continue
            thumb_path = save_thumbnail(image_bytes)
            item = store.insert_placeholder(
                id=item_id, filename=f.filename, mime_type=f.content_type,
                size_bytes=len(image_bytes), thumbnail_path=thumb_path,
                state="queued", progress=0,
            )
            store.flush()
            items_resp.append(item)
            background_tasks.add_task(_process_item, kb_id, item_id, image_bytes)
    return {"items": items_resp}
```

**Pipeline `_process_item(kb_id, item_id, image_bytes)`**(由 BackgroundTasks 并发执行):

```python
async def _process_item(kb_id, item_id, image_bytes):
    store = await ImageStoreRegistry.get(kb_id)
    lock = ImageStoreRegistry.lock_for(kb_id)

    async with lock:
        store.update(item_id, state="ocr_and_embedding", progress=10)
        store.flush()

    # 两路并行,失败不影响另一路
    ocr_task = asyncio.create_task(_run_ocr_safe(image_bytes))
    embed_task = asyncio.create_task(_run_clip_embed_safe(image_bytes))
    ocr_result, embed_result = await asyncio.gather(
        ocr_task, embed_task, return_exceptions=False
    )
    # _run_*_safe 内部已 catch,返回 result 或 None + 错误信息

    async with lock:
        if embed_result.vector is None:
            # CLIP 失败 = fatal,没有图像向量不能算 ready
            store.update(item_id, state="failed",
                         error=f"embedding failed: {embed_result.error}")
            store.flush()
            return

        store.add_image_vector(item_id, embed_result.vector)
        store.update(item_id, progress=70)

        if ocr_result.text:
            store.update(item_id,
                         ocr_text=ocr_result.text,
                         ocr_lang=ocr_result.lang,
                         ocr_confidence=ocr_result.confidence,
                         progress=85)
            # 软降级:默认文本向量模型 不可用就跳过文本向量
            text_vec_result = await _embed_text_default_safe(ocr_result.text)
            if text_vec_result.vector is not None:
                store.add_text_vector(item_id, text_vec_result.vector)
                store.update(item_id, has_text_vector=True, progress=95)
            else:
                store.update(item_id, has_text_vector=False)
        else:
            # 图上没字或 OCR 失败,不算 fatal
            store.update(item_id, has_text_vector=False)

        store.update(item_id, state="ready", progress=100)
        store.flush()
```

**新增端点**:

```text
GET /api/v1/image-kb/{kb_id}/items/{item_id}/status
  → { id, state, progress, error, has_text_vector,
      ocr_text (optional, 仅 ready 时返回, 限长 500 字) }
```

`GET /items` 列表端点(若现有路径名是 `/items` 则沿用,否则在 `knowledge_universe_routes.py` 现有详情端点上扩展)必须返回包含 `state, progress, has_text_vector` 等字段。

### 4.3 检索层:RRF 两路融合

**新增 `image_source/fusion.py`**:

```python
@dataclass
class ImageHit:
    id: str
    filename: str
    thumbnail_url: str
    score: float
    source_path: str  # "text_vec" | "clip_text" | "clip_image" | "fused"
    fused: bool = False
    ocr_snippet: str | None = None
    has_text_vector: bool = True

def rrf_fuse(rankings: list[list[ImageHit]], k: int = 60) -> list[ImageHit]:
    scores: dict[str, float] = defaultdict(float)
    payload: dict[str, ImageHit] = {}
    for ranked in rankings:
        for rank, hit in enumerate(ranked):
            scores[hit.id] += 1.0 / (k + rank + 1)
            payload.setdefault(hit.id, hit)
    return [
        replace(payload[iid], score=s, source_path="fused", fused=True)
        for iid, s in sorted(scores.items(), key=lambda x: -x[1])
    ]
```

**新增 `POST /api/v1/image-kb/{kb_id}/search`**:

```python
{
  "query": "发票 2024",
  "top_k": 20,
  "k_rrf": 60
}
```

实现:

```python
async def text_search(kb_id, query, top_k=20, k_rrf=60):
    store = await ImageStoreRegistry.get(kb_id)
    bge_task = asyncio.create_task(_search_text_vec_safe(store, query, top_k))
    clip_task = asyncio.create_task(_search_clip_text_safe(store, query, top_k))
    text_hits, image_hits = await asyncio.gather(bge_task, clip_task)

    rankings = []
    diagnostics = {"text_path": "ok", "image_path": "ok"}
    if text_hits.error:
        diagnostics["text_path"] = f"unavailable: {text_hits.error}"
    elif text_hits.results:
        rankings.append(text_hits.results)
    if image_hits.error:
        diagnostics["image_path"] = f"unavailable: {image_hits.error}"
    elif image_hits.results:
        rankings.append(image_hits.results)

    if not rankings:
        return {"hits": [], "diagnostics": diagnostics}
    fused = rrf_fuse(rankings, k=k_rrf)[:top_k]
    return {"hits": fused, "diagnostics": diagnostics}
```

- 路 A `_search_text_vec`:`bge_m3.embed_text(query)` → `store.text_index.search(vec, top_k)` → 取 metadata 组 `ImageHit(source_path="text_vec")`。
- 路 B `_search_clip_text`:`clip.embed_text(query)` → `store.image_index.search(vec, top_k)` → 取 metadata 组 `ImageHit(source_path="clip_text")`。
- 任一路抛异常 / sidecar 不可用 → result 为空 + error 字段。RRF 退化为单路通过(直接返回另一路)。
- 两路都不可用 → 返回空 hits + 双 unavailable diagnostics,前端 banner 提示。

**`/search-by-image` 保留**,只走 CLIP image→image,不进 RRF。后续若要 "按图 + OCR query 文本" 两路融合,可直接复用 `fusion.rrf_fuse()`。

### 4.4 前端:即时显示 + 轮询 + 双模式搜索

**`packages/api/src/kbUniverse.ts`** 扩展:

```ts
export interface ImageItem {
  id: string;
  filename: string;
  thumbnail_url: string;
  state: "queued" | "ocr_and_embedding" | "ready" | "failed";
  progress: number;
  error: string | null;
  has_text_vector: boolean;
  ocr_text: string | null;
  created_at: string;
}

export interface ImageItemStatus {
  id: string;
  state: ImageItem["state"];
  progress: number;
  error: string | null;
  has_text_vector: boolean;
}

export interface ImageSearchResponse {
  hits: ImageHit[];
  diagnostics: { text_path: string; image_path: string };
}

imageSource: {
  upload(kbId, files): Promise<{ items: ImageItem[] }>;
  list(kbId): Promise<{ items: ImageItem[] }>;
  itemStatus(kbId, itemId): Promise<ImageItemStatus>;
  searchByImage(kbId, file, topK): Promise<ImageHit[]>;
  searchByText(kbId, query, topK): Promise<ImageSearchResponse>;
  remove(kbId, itemId): Promise<void>;
}
```

**`ImageKbDetail.tsx` 改造点**:

1. **上传后立即渲染** — upload mutation 的 `onSuccess` 把返回 `items` 立即写入 `queryClient.setQueryData(['image-kb-items', kbId], ...)`,grid 出现占位卡片。

2. **状态轮询** — 聚合 useQuery,只对 `state !== "ready" && state !== "failed"` 的 item id 集合发起:

```tsx
const pendingIds = items
  .filter(i => i.state !== "ready" && i.state !== "failed")
  .map(i => i.id);
useQuery({
  queryKey: ["image-kb-status", kbId, pendingIds.sort().join(",")],
  queryFn: async () => Promise.all(
    pendingIds.map(id => api.imageSource.itemStatus(kbId, id))
  ),
  enabled: pendingIds.length > 0,
  refetchInterval: 2500,
  onSuccess: statuses => {
    queryClient.setQueryData(["image-kb-items", kbId], old =>
      mergeStatuses(old, statuses)
    );
  },
});
```

`enabled` 在没有 pending item 时关闭,自动停止轮询。

3. **卡片状态可视化**:
   - `queued` → spinner + "排队中"
   - `ocr_and_embedding` → 进度条 + "向量化中" / "OCR 中"(依 `progress` 阶段切文案)
   - `ready` + `ocr_text` → badge "含文字"
   - `ready` + `!has_text_vector` → badge "仅图搜"(title:"文本向量服务未就绪")
   - `failed` → red badge,hover 显示 `error`

4. **搜索框双 Tab**:
   - "按文字搜索" → `searchByText()` → 渲染 `hits` + 如 `diagnostics` 任一路 unavailable 顶部 banner 提示。
   - "按图搜索" → 现有 `searchByImage()`,不变。
   - 结果卡片右下角小 badge `[文本] [视觉] [融合]` 对应 `source_path`,帮助用户理解命中原因。

## 5. 复用与依赖

| 组件 | 来源 | 状态 |
|---|---|---|
| CLIP image/text embed | `image_source/embedder.py` 经 infinity sidecar (Plan 3D) | 已就绪 |
| RapidOCR | `modality/rapidocr_server.py` 或进程内 import | 已就绪,本 spec 接入 |
| 默认文本向量模型 文本向量 | llama-server (chat platform 已注册) `/v1/embeddings` | 已就绪 |
| FAISS | 现有 `image_source/store.py` 已用 | 复用 |
| BackgroundTasks | FastAPI 内置 | 内置 |
| React Query 轮询 | 现有 `LocalRuntimeServicesSection` 已用 5s 轮询模式 | 模式复用 |

## 6. 错误处理与降级

| 场景 | 行为 |
|---|---|
| CLIP sidecar 挂 | item → `state=failed, error="embedding failed: ..."`。前端展示 retry 按钮(MVP 可只展示失败,retry 留作后续) |
| RapidOCR 抛异常 | 当作"图上没字",item 仍 ready,只是 `ocr_text=null` |
| OCR 结果为空 | `has_text_vector=false`,搜索 RRF 自动退化单路 |
| 默认文本向量模型 sidecar 不可用 | `has_text_vector=false`;搜索时路 A diagnostic 报 unavailable;前端 banner |
| 同一 hash 重复上传 | 同步阶段去重,返回已有 item,不再走 pipeline |
| 上传时 store 锁等待 > 30s | 极端并发场景,FastAPI 默认 timeout 由前端兜底,无特殊处理 |
| 老数据无 state 字段 | `load_from_disk` 迁移填默认 ready;不回填 OCR/文本向量 |
| FAISS 索引文件不存在 | `load_from_disk` 创建空索引 |

## 7. 测试

| 范围 | 测试 |
|---|---|
| Registry | 并发 get 同一 kb_id 只创建一个实例;lock 互斥写;flush 后内存与磁盘一致 |
| Store | 双索引 add/search/remove 联动;元数据迁移老 schema → 新 schema |
| Pipeline | OCR + CLIP 并行 happy path;OCR 抛错不影响 CLIP;CLIP 抛错 → failed;默认文本向量模型 不可用 → has_text_vector=false |
| RRF | 两路 hits 按公式融合;只单路有结果时直接返回;两路都空时返回空 + diag |
| Upload 端点 | 返回值含 queued items;BackgroundTasks 真正被调度 |
| Status 端点 | 路径 404 行为;ready 后字段完整 |
| Text search 端点 | 两路 ok / 单路 unavail / 双路 unavail 三个分支的 diagnostics |
| 前端 | 占位卡片立即渲染;轮询在 pending=0 时停;banner 在 diagnostics 异常时显示;source_path badge 正确 |

回归:`search_by_image` 行为与现状一致;已有 image kb 数据加载后仍能搜出。

## 8. 风险

- **RapidOCR 大图推理 1-3s**:并发上传时争 CPU。MVP 通过 `asyncio.Semaphore(2)` 限制 OCR 并发即可。
- **默认文本向量模型 首次加载 ~10s**:首批上传可能集中 `has_text_vector=false`;前端 badge 提示用户,可不重试。
- **BackgroundTasks 进程重启丢任务**:若服务在 pipeline 中途崩,留下 `state=ocr_and_embedding` 的 item。MVP 不做 resume,启动时 sweeper 把这种 item 标记 `failed, error="interrupted, please re-upload"`。
- **FAISS `IndexIDMap2.remove_ids` 在某些 index type 上不支持**:目前使用 `IndexFlatIP` 包 `IndexIDMap2`,支持。需在测试覆盖。

## 9. 实施顺序(由 plan 决定细节)

一个计划包含 4 个 commit-able 节奏:
1. 存储层 registry + 双索引 + 锁 + 迁移
2. Upload pipeline + status 端点
3. RRF 融合 + text search 端点
4. 前端占位卡片 + 轮询 + 双模式搜索

每个节奏自带单测,可独立 review。
