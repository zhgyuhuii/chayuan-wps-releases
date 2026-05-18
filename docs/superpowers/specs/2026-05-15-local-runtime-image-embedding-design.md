# 本地 Runtime Image Embedding (Plan 3D) — 设计文档

> 上承 Plan 1 (chat sidecar) + Plan 2 (前端整合) + Plan 3A (诊断) + Plan 3B (多 capability) + Plan 3C (ASR)。
> Plan 3D 加第五 capability `image-embedding`,引擎 `'infinity'`,通过 `python -m chayuan.server.image_source.infinity_server` 拉 Python sidecar(不是 vendor 二进制),HTTP `/embeddings` 兼容 michaelf34/infinity 协议。

**作者:** zhgyuhui  
**日期:** 2026-05-15  
**状态:** 待 user 审阅 → writing-plans

---

## 1. 背景

Chayuan 桌面侧目前图像嵌入跑在 `chayuan-server/.../image_source/embedder.py` in-process,通过 loader 家族(SigLIP2 / CLIP / Chinese-CLIP / DINOv2 / timm / JinaCLIP / EVA-CLIP / OpenCLIP)。主进程 chayuan-server 启动后,首次 `get_embedder()` 触发模型加载 ~1.5 GB,主进程内存常驻;无法独立启停,不能跟 chat / asr 一样在 LocalRuntimePanel 里管。

`embedder_clients/infinity_http.py` 已经存在 Plan 1 时期就有的客户端,面向 michaelf34/infinity 0.0.75+ 协议(`POST /embeddings`,接 text + image base64),但需要用户自己跑 infinity 容器;Plan 3D 让 chayuan-server 自己 wrap + 自管理这个 sidecar,统一进 Plan 3B 的 `LocalRuntimeRegistry`。

## 2. 范围

**In scope(本 plan):**

- `SidecarRuntimeManager.find_server_exe()` 加 `engine='infinity'` 分支:返 `sys.executable`(Python 解释器),用 `python -m chayuan.server.image_source.infinity_server` 启动 sidecar。
- `process_args.resolve_infinity_args(*, capability='image-embedding', n_threads=None)` 新函数:返回 `args = ["-m", "chayuan.server.image_source.infinity_server", "--host", ..., "--port", ..., "--model", ...]`、`process="infinity"`。
- `_resolve_args_for(capability, *, engine)` 加 `engine='infinity'` 分支。
- `LocalRuntimeRegistry.CAPABILITIES` 从 4 项扩到 5 项,加 `'image-embedding'`(`engine='infinity'`, `port_offset=4`, 默认端口 62586),`_CAP_ENGINE` 加映射。
- 新建 `chayuan/server/image_source/infinity_server.py`:Python HTTP wrapper,复用 `_runtime_server_base.make_runtime_app`,端点 `POST /embeddings` 兼容 michaelf34/infinity 协议,内部调 `image_source.embedder.get_embedder().encode_*`。
- `image_source/embedder.py` `get_embedder()` 工厂顶部加 sidecar 优先探测:registry.get('image-embedding').state == ready 时返 `InfinityHttpClient(base_url=...)`,否则 fallback 现有 in-process loader。
- `LocalRuntimeSettings` 加 2 字段:`preload_image_embedding: bool = False`、`default_image_embedding_model: str = ""`,yaml round-trip 兼容旧版本。
- API `_VALID_CAPABILITIES` 加 `'image-embedding'`(白名单)。
- `first_launch` preload_map 加 `'image-embedding': settings.preload_image_embedding`。
- `diagnose` check 从 13 项扩到 14 项,加 `runtime.llama.image-embedding.status`。
- 前端 `LocalRuntimeCapability` type union 加 `'image-embedding'`;`CAPABILITY_LABEL` 加 `'image-embedding': '图像嵌入'`;`LocalRuntimePanel` cap 数组 4 → 5;store `statuses` / `pendingFor` 初始 5 项;`CapabilityCenter` 的 image-embedding tab(如已存在)加 localCap mapping。
- 后端单测:`test_process_args_infinity`(新 ~3 case)、`test_local_runtime` (+3)、`test_local_runtime_registry` (+1)、`test_runtime_routes_llama_multi_cap` (+2)、`test_diagnose_checks` / `test_runtime_route_diagnose` 长度断言 13→14、`test_infinity_server`(新 ~3 case)、`test_image_embedder_sidecar_fallback`(新 ~3 case)。前端单测 +3。
- runbook 加 image-embedding 排错条目 + 5 cards UI 描述。

**Out of scope(后续 plan):**

- 真正 michaelf34/infinity package 集成:本 plan 自 wrap,不引入 `infinity_emb` 第三方依赖。
- Multimodal LLM(LLaVA 等)集成,另起 plan。
- Streaming embedding 客户端 batching,另起 plan。
- 模型仓库 in-app 下载 / 切换 UI,本 plan 沿用现有 CapabilityCenter「已安装 / 推荐 / 自定义」3 栏。
- E2E 真机 smoke test 自动化,沿 Plan 3A 真机装机手测哲学。
- 删 in-process image loader 路径(YAGNI,sidecar 不 ready 时仍要 fallback)。

## 3. 架构

### 3.1 顶层结构

```
┌─────────────────────────────────────────────────────────────────┐
│  LocalRuntimeRegistry(singleton)                                │
│    CAPABILITIES = (                                             │
│        'chat',            engine='llama',  port=62582          │
│        'embedding',       engine='llama',  port=62583          │
│        'rerank',          engine='llama',  port=62584          │
│        'asr',             engine='whisper', port=62585         │
│        'image-embedding', engine='infinity', port=62586  ← 本 plan│
│    )                                                            │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┬─────────────────┐
            ▼               ▼               ▼                 ▼
        llama-server   whisper-server   sys.executable        ...
                                        + -m chayuan.server
                                          .image_source
                                          .infinity_server
```

### 3.2 SidecarRuntimeManager 加 infinity 分支

`find_server_exe` 改成:

```python
def find_server_exe(self) -> Optional[Path]:
    if self.engine == "infinity":
        # PyInstaller frozen 环境: sys.executable 是 chayuan-server.exe;
        # 用 --sidecar-mode 自我转化或 sys._MEIPASS 解 Python(由 sub-task 决定)
        return Path(sys.executable)
    # Plan 3B/3C 原有逻辑(查 vendor/services/{engine}-server/)
    bin_name = f"{self.engine}-server"
    ...
```

### 3.3 process_args.resolve_infinity_args

```python
_INFINITY_CAPABILITIES = ("image-embedding",)
_INFINITY_LOCAL_CAP_MAP = {"image-embedding": "image"}


def resolve_infinity_args(
    *,
    capability: str = "image-embedding",
    n_threads: Optional[int] = None,
) -> Resolution:
    """infinity_server (Python sidecar) 启动 args。

    capability:
      * 'image-embedding' → image default + clip/siglip 模型 + 默认端点
    """
    if capability not in _INFINITY_CAPABILITIES:
        raise ValueError(f"Unknown capability for infinity: {capability!r}")

    local_cap = _INFINITY_LOCAL_CAP_MAP[capability]
    r = Resolution(process="infinity")
    entry, reason = _resolve(capability, local_cap=local_cap)
    if entry is None:
        r.missing.append(capability)
        r.reason = reason
        return r

    # Python sidecar:用 `-m <module>` 而非 binary 直跑
    r.args.extend([
        "-m", "chayuan.server.image_source.infinity_server",
        "--model", entry.model_id,
    ])
    # Host / port 由 SidecarRuntimeManager.start() 注入(port_offset 已经处理)
    r.resolved_models[capability] = entry.model_id
    r.reason = reason
    return r
```

### 3.4 _resolve_args_for engine 分支

```python
def _resolve_args_for(capability, *, engine='llama', n_ctx=None, n_threads=None):
    if engine == 'llama':
        ... (Plan 3B 已有)
    elif engine == 'whisper':
        ... (Plan 3C 已有)
    elif engine == 'infinity':
        kwargs = {'capability': capability}
        if n_threads is not None:
            kwargs['n_threads'] = n_threads
        r = process_args.resolve_infinity_args(**kwargs)
    else:
        raise ValueError(f"Unknown engine: {engine!r}")
    # 余下与 Plan 3C 相同
```

### 3.5 LocalRuntimeRegistry 5-cap

```python
_CAP_ENGINE: Dict[str, str] = {
    "chat": "llama",
    "embedding": "llama",
    "rerank": "llama",
    "asr": "whisper",
    "image-embedding": "infinity",
}


class LocalRuntimeRegistry:
    CAPABILITIES = ("chat", "embedding", "rerank", "asr", "image-embedding")
    ...
```

### 3.6 infinity_server.py(Python HTTP wrapper)

```python
"""image_source 的 HTTP sidecar wrapper(Plan 3D)。

调用方式:
    python -m chayuan.server.image_source.infinity_server \\
        --host 127.0.0.1 --port 62586 --model siglip2-base

懒加载:启动时不预加载,首次 POST /embeddings 才调 image_source.embedder.get_embedder。
"""
from chayuan.server.modality._runtime_server_base import (
    make_runtime_app, parse_serve_args, serve,
)


_DEFAULT_CONFIG = {
    "model": "siglip2-base",  # 或 clip-vit-base 等
    "device": "cpu",
    "max_batch_size": 16,
}


def _register_routes(app, cfg):
    from fastapi import HTTPException, Request

    def _ensure_loaded():
        if app.state.lib_loaded and app.state.lib_handle is not None:
            return app.state.lib_handle
        try:
            from chayuan.server.image_source.embedder import get_embedder
            handle = get_embedder(cfg["model"])
        except Exception as e:
            app.state.lib_error = f"image embedder 加载失败: {e}"
            raise HTTPException(status_code=503, detail=app.state.lib_error) from e
        app.state.lib_handle = handle
        app.state.lib_loaded = True
        app.state.lib_error = ""
        return handle

    @app.post("/embeddings")
    async def embeddings(request: Request):
        """OpenAI / infinity 兼容 embedding 端点。"""
        body = await request.json()
        embedder = _ensure_loaded()
        inputs = body.get("input", [])
        # 分离 text / image
        texts, images = [], []
        for item in inputs:
            if isinstance(item, dict) and "image" in item:
                images.append(_decode_data_url(item["image"]))
            elif isinstance(item, str):
                texts.append(item)
        out = []
        if texts:
            vecs = embedder.encode_texts(texts)
            out.extend([{"index": i, "embedding": v.tolist()} for i, v in enumerate(vecs)])
        if images:
            vecs = embedder.encode_images(images)
            out.extend([{"index": len(texts) + i, "embedding": v.tolist()} for i, v in enumerate(vecs)])
        return {"data": out, "model": cfg["model"]}


if __name__ == "__main__":
    args = parse_serve_args(framework="infinity", default_port=62586, default_config=_DEFAULT_CONFIG)
    app = make_runtime_app(framework="infinity", default_config=_DEFAULT_CONFIG, register_routes=_register_routes)
    serve(app, args)
```

### 3.7 image_source/embedder.py 改造

`get_embedder(name=None)` 工厂改造:

```python
def get_embedder(name: Optional[str] = None) -> BaseImageEmbedder:
    """Plan 3D: sidecar 首选 + in-process fallback。"""
    # 1) 本地 sidecar 优先
    try:
        from chayuan.server.model_registry.local_runtime_registry import get_registry
        mgr = get_registry().get("image-embedding")
        if mgr.status.state == "ready" and mgr.status.endpoint:
            from chayuan.server.image_source.embedder_clients.infinity_http import InfinityHttpClient
            return InfinityHttpClient(base_url=mgr.status.endpoint)
    except Exception:
        pass  # registry 不可用 → 走 in-process
    # 2) Plan 1 in-process loader(原有逻辑)
    return _get_inproc_embedder(name)
```

`_get_inproc_embedder` 是 Plan 1 已有的工厂体抽出来(rename 原 `get_embedder` 内部成它,无逻辑变化)。

### 3.8 API 路径(零新增)

Plan 3B `/runtime/llama/{cap}/*` 已是 capability-scoped。Plan 3D 只在 `_VALID_CAPABILITIES` 集合加 `'image-embedding'`:

```python
_VALID_CAPABILITIES = {"chat", "embedding", "rerank", "asr", "image-embedding"}
```

`curl POST /runtime/llama/image-embedding/start` 自动 work,`localRuntime.startFor('image-embedding')` 自动 work。

### 3.9 端口约定

| Capability | Engine | Port |
|---|---|---|
| chat | llama | 62582 |
| embedding | llama | 62583 |
| rerank | llama | 62584 |
| asr | whisper | 62585 |
| image-embedding | infinity | 62586 |

## 4. 数据流(典型一次 image embedding 请求)

```
KB 索引 / chat multimodal → image_source.embedder.get_embedder("siglip2-base").encode_images([blob, ...])
    │
    ▼ get_embedder()  Plan 3D 改造
    │
    ├─ 1) registry.get('image-embedding').status
    │      state == ready  → InfinityHttpClient(base_url=http://127.0.0.1:62586)
    │      state != ready  → fallback _get_inproc_embedder
    │
    ▼ 命中 sidecar:
    InfinityHttpClient.encode_images([blob, ...])
        → POST http://127.0.0.1:62586/embeddings
           {"input": [{"image": "data:image/jpeg;base64,..."}, ...],
            "model": "siglip2-base"}
        ← 200 {"data": [{"embedding": [...]}], "model": "siglip2-base"}
        → np.ndarray (N, dim)
```

sidecar 首次启动时 lazy load model,health probe 期间(60s timeout for `engine='infinity'`,比 llama 30s 长)等模型加载完才返 ready。

## 5. 错误处理

| 失败场景 | 表现 | 处理 |
|---|---|---|
| `sys.executable` 拿不到 Python 解释器 | start() 抛 RuntimeUnavailable | diagnose 报 `runtime.llama.image-embedding.status fail`,detail 含路径 |
| `image_source.embedder` import 失败 | sidecar /embeddings 返 503 | facade 退到 in-process loader(infinity client `EmbedderUnavailable`) |
| 模型未装(`_resolve` 返 None) | start() 拒绝,missing.append('image-embedding') | diagnose 报 vendor.bundled_models.image fail(Plan 3A 已有) |
| 模型加载 OOM | sidecar 进程 OOM kill → poll() 返非 None | _persist_status state=failed,facade fallback in-process |
| Health 60s 超时 | state→failed | 同上 |
| `/embeddings` 收到不合法 image bytes | sidecar 返 400 | client 抛 `EmbedderUnavailable`,facade fallback in-process(在线上短期 fail-safe) |
| Port 62586 占用 | `_allocate_port` 自动 bump 62587+ | 透明 |
| sidecar 关停时 client 在调 | InfinityHttpClient.health_check 100ms 超时 → 抛 `EmbedderUnavailable` → facade fallback | 自然安全 |

## 6. 测试

参见 brainstorm section 3。要点:

- 后端 +~16 case(`test_process_args_infinity` 3 + `test_local_runtime` 3 + `test_local_runtime_registry` 1 + `test_runtime_routes_llama_multi_cap` 2 + diagnose 改断言 + 1 case + `test_infinity_server` 3 + `test_image_embedder_sidecar_fallback` 3)
- 前端 +3 case(`localRuntime.test.ts` 加 image-embedding 路由测试)
- 集成验证:真机装机 → smoke test image embedding(沿 Plan 3A 真机哲学)

## 7. 配置 / 持久化

```yaml
# local_runtime.yaml (Plan 3B + 3C + 3D)
preload_on_startup: true
host: 127.0.0.1
port: 62582
api_key: ""
expose_lan: false
default_chat_model: ""
preload_embedding: false
preload_rerank: false
default_embedding_model: ""
default_rerank_model: ""
preload_asr: false
default_asr_model: ""
preload_image_embedding: false          # Plan 3D 新增
default_image_embedding_model: ""       # Plan 3D 新增
```

```json
// runtime.json (Plan 3B + 3C + 3D)
{
  "llama": {
    "chat":            { "state": "ready", "endpoint": "http://127.0.0.1:62582", "pid": 1, ... },
    "embedding":       { "state": "stopped" },
    "rerank":          { "state": "stopped" },
    "asr":             { "state": "ready", "endpoint": "http://127.0.0.1:62585", "pid": 2, ... },
    "image-embedding": { "state": "ready", "endpoint": "http://127.0.0.1:62586", "pid": 3, ... }
  }
}
```

(JSON 顶层 key 仍叫 "llama" 是 Plan 3B back-compat。)

## 8. 前端 UI

### 8.1 LocalRuntimePanel(设置 → AI 平台 → 本地模型)

```
┌─────────────────────────────────────────────────────────────┐
│ ▶ 聊天          [Ready] http://127.0.0.1:62582 pid 1234     │
│   model: Qwen3-4B                                           │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 文本嵌入       [Stopped]                                   │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 重排           [Failed] no model                           │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 语音识别        [Stopped]                                  │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 图像嵌入        [Stopped]              ← Plan 3D 新增      │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ [生成诊断报告]                                                │
├─────────────────────────────────────────────────────────────┤
│ 配置 (host / port / API key / preload 开关)                  │
├─────────────────────────────────────────────────────────────┤
│ 装机路径                                                      │
└─────────────────────────────────────────────────────────────┘
```

`LocalRuntimeCapabilityCard` 本身 cap-agnostic,只需:
1. `LocalRuntimeCapability` type union 加 `'image-embedding'`(在 `@chayuan/api`)
2. `CAPABILITY_LABEL` map 加 `'image-embedding': '图像嵌入'`
3. `LocalRuntimePanel` 数组 `['chat','embedding','rerank','asr']` → `['chat','embedding','rerank','asr','image-embedding']`
4. store `statuses` / `pendingFor` 初始 4 项 → 5 项

### 8.2 CapabilityCenter image-embedding tab

如 `activeCap === 'image-embedding'` 已是现有 tab,加 localCap mapping:

```typescript
const localCap: LocalRuntimeCapability | null =
  activeCap === 'text-embedding' ? 'embedding' :
  activeCap === 'rerank' ? 'rerank' :
  activeCap === 'asr' ? 'asr' :
  activeCap === 'image-embedding' ? 'image-embedding' :
  null;
```

(若 CapabilityCenter 当前 capability list 不含 image-embedding tab,看现有 Plan 1/3B 的 capabilities array,加入即可。本 plan 不动 capability list 结构,仅 mapping。)

## 9. 跨平台兼容矩阵

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| Python 解释器(`sys.executable`) | PyInstaller frozen 时是 chayuan-server.exe | 同 | 同 |
| `-m chayuan.server.image_source.infinity_server` | PyInstaller frozen 模式需"sidecar mode"入口或 sys._MEIPASS;开发模式直跑 | 同 | 同 |
| 端口 (62586) | psutil 跨平台 | 同 | 同 |
| 模型路径 | `<chayuan_root>/models/bundled/image/<model>/` | 同 | 同 |
| 关停 | terminate→5s→kill,Python child 无 grandchildren 无遗留 | 同 | 同 |
| 内存(默认 preload=False) | CLIP-base ~1.5 GB,sidecar 不预热 | 同 | 同 |
| 防火墙 / AV | Defender 通常放过 sys.executable | n/a | n/a |

## 10. 已知风险 + 兜底

1. **PyInstaller frozen `sys.executable` 不能 `-m` 跑** — chayuan-server.exe 不支持 `chayuan-server.exe -m chayuan.server.image_source.infinity_server` 直跑。
   - 兜底 A:让 chayuan-server entrypoint 检测 `--sidecar-mode=image-embedding` 参数,自我转化为 sidecar runtime(`chayuan-server.exe --sidecar-mode=image-embedding --host ... --port ...`)
   - 兜底 B:`sys._MEIPASS` 解 PyInstaller 内嵌 Python,直接 exec(不稳)
   - 兜底 C:install-bundled python(独立打包 python-embed.exe)
   - 决定:本 plan 实施时优先方案 A,失败时记录 last_error 让用户重装;不阻塞 fallback in-process

2. **infinity client 协议** — `InfinityHttpClient` 实现按 michaelf34/infinity 0.0.75+,本 plan `infinity_server.py` 严格 mirror。Plan 加 `test_infinity_server.py` contract 验证。

3. **大模型 OOM** — CLIP-large ~5 GB / SigLIP2-so400m ~3.7 GB。sidecar 进程隔离让父进程不挂,但 state=failed 时 facade fallback in-process,如果 in-process 也 OOM,主进程也挂 — 这是 Plan 1 已有行为,本 plan 不改。

4. **embedder facade 单例 cache invalidation** — `InfinityHttpClient` 自带 health check(100ms 超时),sidecar 关停后 client 调失败抛 `EmbedderUnavailable`,facade 顶层 try/except 捕获 fallback in-process,自然安全;不需要手动 cache invalidate。

5. **模型 manifest 选择** — 现 manifest 是 `openai/clip-vit-base-patch32`(605 MB)。本 plan 沿用,后续如换 SigLIP2 / Chinese-CLIP 另起 plan。

## 11. 验收

实施完后,用户能做:

1. ✅ 设置 → AI 平台 → 本地模型 显示 5 张 capability card,image-embedding 卡可独立启停
2. ✅ `curl POST /runtime/llama/image-embedding/start` 拉起 infinity sidecar
3. ✅ `curl POST http://127.0.0.1:62586/embeddings -d '{"input":["hello"],"model":"siglip2-base"}'` 走通(text 端到端)
4. ✅ `curl POST http://127.0.0.1:62586/embeddings -d '{"input":[{"image":"data:image/jpeg;base64,..."}],"model":"clip-vit-base"}'` 走通(image 端到端)
5. ✅ KB 索引 / multimodal chat 调 `embedder.get_embedder()` 自动用 sidecar(ready 时);不 ready fallback in-process
6. ✅ `curl /runtime/llama/registry` 一次返 5 个 capability 状态
7. ✅ Plan 3A 诊断报告 14 项 check,含 `runtime.llama.image-embedding.status`
8. ✅ 退桌面 sidecar 时 `registry.stop_all()` 关 5 个子进程
9. ✅ 后端单测全过(Plan 3C 100 + Plan 3D ~16 = ~116),前端单测全过(Plan 3C 23 + Plan 3D 3 = 26),全仓 typecheck 0 error
10. ✅ Plan 1+2+3A+3B+3C 105 commits 不破坏

---

## 附录 A:与 Plan 3C 的差异速查

| 维度 | Plan 3C(已 ship) | Plan 3D(本 plan) |
|---|---|---|
| Engine 类型 | `llama` / `whisper` | + `infinity` |
| Sidecar 类型 | vendor binary(.exe) | Python `-m module`(`sys.executable`) |
| Registry capabilities | 4 (chat/embedding/rerank/asr) | 5 (+ image-embedding) |
| 端口范围 | 62582-62585 | + 62586 |
| Install script | install-{llama,whisper}-server.{ps1,sh} | 不需要(Python module 即装即用) |
| LocalRuntimeSettings 字段 | 12 | 14 (+ preload_image_embedding / default_image_embedding_model) |
| Diagnose check 数 | 13 | 14 (+ runtime.llama.image-embedding.status) |
| Frontend cards | 4 | 5 (自动) |
| Facade 改造 | audio.py sidecar 首选 | image_source/embedder.py 同模式 |
| Sub-process spawn | Popen(binary) | Popen(sys.executable, "-m", ...) |
| PyInstaller frozen 特殊 | 无 | sidecar-mode 入口或 sys._MEIPASS |

## 附录 B:实施顺序提示(供 writing-plans 参考)

建议 14-16 task,3 sprint:

**Sprint 5D-1 后端 sidecar 基础(~7 task):**
1. `resolve_infinity_args` + 测试
2. `SidecarRuntimeManager.find_server_exe` 加 infinity 分支(返 sys.executable)
3. `_resolve_args_for` 加 infinity 分支
4. `LocalRuntimeRegistry` 加 image-embedding capability(_CAP_ENGINE 加映射)
5. `_VALID_CAPABILITIES` 加 image-embedding + 路由测试
6. `LocalRuntimeSettings` 加 preload_image_embedding + default_image_embedding_model
7. `first_launch` + `diagnose` 接 image-embedding

**Sprint 5D-2 infinity_server + facade 改造(~5 task):**
8. `infinity_server.py`(新)+ contract 测试
9. `image_source.embedder.get_embedder()` sidecar 优先 + fallback 测试
10. PyInstaller frozen `sys.executable` 兜底(sidecar-mode 入口实现)
11. install-bundled-models 模型 manifest 适配(选 SigLIP2 / CLIP)
12. `embedder_clients/infinity_http.py` 调试 contract(若有 protocol gap)

**Sprint 5D-3 前端 + 收尾(~3-4 task):**
13. `@chayuan/api` LocalRuntimeCapability 加 image-embedding
14. `LocalRuntimePanel` 加 image-embedding 卡 + store + CapabilityCenter mapping
15. 总验证 + RUNBOOK 更新
