# Image Knowledge Base 增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复图像知识库"刷新消失"bug,并增加上传后即时显示、向量化进度、OCR 文本识别、文字搜图(用户默认文本向量模型 + CLIP 跨模态路 RRF 融合)等能力。

**Architecture:** 后端在现有 `chayuan/server/image_source/` 模块上扩展:item 元数据加 state/progress/ocr 字段,store 加第二张文本向量索引,upload 改成同步占位 + FastAPI BackgroundTasks 异步流水线(OCR ‖ CLIP 并行 → 文本向量软降级),新增 status / search_by_text 路由,RRF 融合在新 fusion.py。前端在 `ImageKbDetail.tsx` 增占位卡片 + React Query 轮询 + 双模式搜索 tab。

**Tech Stack:** Python 3 / FastAPI / asyncio / numpy / Pillow / RapidOCR / TypeScript / React / @tanstack/react-query

**Spec:** `docs/superpowers/specs/2026-05-16-image-kb-enhancement-design.md`

---

## File Structure

### chayuan-server

| 文件 | 责任 | 性质 |
|---|---|---|
| `libs/chayuan-server/chayuan/server/image_source/store.py` | 元数据 schema 扩展(state/progress/ocr/text_vector_id) + 文本向量并行矩阵 + 老数据迁移 | 改 |
| `libs/chayuan-server/chayuan/server/image_source/ocr_client.py` | 异步调 rapidocr sidecar `/v1/ocr` 的瘦客户端 | 新增 |
| `libs/chayuan-server/chayuan/server/image_source/text_embed_client.py` | 异步调"用户配置的默认文本向量模型"(经 `utils.get_default_embedding` + `get_model_info` 解析)的 OpenAI 兼容 `/v1/embeddings` 端点 | 新增 |
| `libs/chayuan-server/chayuan/server/image_source/pipeline.py` | `process_item()`:OCR ‖ CLIP 并行 → 文本向量软降级 → 状态机推进 | 新增 |
| `libs/chayuan-server/chayuan/server/image_source/fusion.py` | RRF 融合 + ImageHit dataclass | 新增 |
| `libs/chayuan-server/chayuan/server/image_source/text_search.py` | 两路并行文字搜图,返 hits + diagnostics | 新增 |
| `libs/chayuan-server/chayuan/server/image_source/connector.py` | 暴露 `source_name` 属性,统一 `add_image()` 入参 schema | 改 |
| `libs/chayuan-server/chayuan/server/api_server/image_routes.py` | upload 改流水线 + 新增 `/status` `/search_by_text` 端点 | 改 |
| `libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py` | 修 list endpoint source_name 解析 + 返回 state/progress 字段 | 改 |

### chayuan-client

| 文件 | 责任 | 性质 |
|---|---|---|
| `packages/api/src/kbUniverse.ts` | `ImageItem` 类型扩展(state/progress/has_text_vector/ocr_text)、`itemStatus()` `searchByText()` 方法 | 改 |
| `packages/app/src/features/kb/detail/ImageKbDetail.tsx` | upload 后立即写缓存、聚合状态轮询、卡片状态可视化、按文字/按图搜索 tab、diagnostics banner | 改 |

### 测试

| 文件 | 范围 |
|---|---|
| `libs/chayuan-server/tests/unit_tests/test_image_store_schema.py` | metadata schema 迁移 + 双索引 add/remove 联动 |
| `libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py` | OCR 客户端 happy / 503 / 超时 |
| `libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py` | 文本向量客户端 happy / 不可用 / URL 规范化 |
| `libs/chayuan-server/tests/unit_tests/test_image_pipeline.py` | OCR ‖ CLIP 并行;OCR 失败 ≠ fatal;CLIP 失败 → failed;默认文本向量模型不可用 → has_text_vector=false |
| `libs/chayuan-server/tests/unit_tests/test_image_fusion.py` | RRF 公式 + 单路降级 + 双路空 |
| `libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py` | upload 同步返 queued + BackgroundTasks 调用 |
| `libs/chayuan-server/tests/unit_tests/test_image_routes_status.py` | `/status` 返回字段;404 |
| `libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py` | `/search_by_text` 两路 ok / 单路 unavail / 双路 unavail 三个分支 |

---

## 现状要点(实现前必读)

- `chayuan/server/image_source/store.py` 的 `get_store(source_name)` 已经是进程级单例(`_STORES` + `threading.Lock`);**真正的 bug 是 source_name 解析不一致**:`ImageConnector` 用 `spec.options.source_name or spec.database or "src_{id}"`,而 `image_routes.py` 列表端点 + `knowledge_universe_routes.py:400` 用 `src["name"] or "src_{raw}"`。两边解析到不同 key → 不同 ImageStore 实例 → 上传写一个、详情读另一个 → "刷新消失"。
- 存储底层是 **numpy 矩阵** + `meta.json`(不是 FAISS)。本 plan 沿用 numpy,**不引入 FAISS**(YAGNI;10 万图以下足够,与现状一致)。
- 现有 `ImageConnector.add_image()` 元数据写入 `embedder_model` `embedder_dim` `embedder_capabilities` 等字段。新字段(`state`, `progress`, `ocr_text`, `text_vector_id`)向后兼容追加。
- 路由前缀 `/knowledge_source/{source_id}/image/...` 是真路径(不是 spec 4.2 写的 `/api/v1/image-kb/...`)。**所有新端点遵循现有前缀。**
- RapidOCR sidecar:`POST /v1/ocr` body `{"image": "<base64>"}` 返 `{boxes:[{box,text,score}], elapsed_ms}`;port 通过 `SidecarRuntimeManager.get_runtime("ocr").info.port` 拿。
- **文本向量必须用用户配置的默认文本向量模型,不能写死某个模型**。解析入口:
  - `chayuan.server.utils.get_default_embedding()` → str (e.g. "bge-m3" / "text-embedding-3-small" / 用户在"默认模型选择 → 文本嵌入"配的任意名字)
  - `chayuan.server.utils.get_model_info(model_name=...)` → dict 含 `api_base_url` / `api_key` / `platform_name`
  - 端点是 OpenAI 兼容的 `/v1/embeddings`,body `{"model": "<name>", "input": ["<text>"]}`,返 `{"data":[{"embedding":[...]}]}`
  - api_base_url 可能带 `/v1` 也可能不带,客户端必须 normalize

---

## Task 1: Store metadata schema 扩展 + 文本向量矩阵 + 迁移

**Files:**
- Modify: `libs/chayuan-server/chayuan/server/image_source/store.py:44-162`
- Test: `libs/chayuan-server/tests/unit_tests/test_image_store_schema.py`

- [ ] **Step 1: 写失败测试**

```python
# tests/unit_tests/test_image_store_schema.py
"""ImageStore schema 扩展 + 文本向量索引 + 老数据迁移。"""
from __future__ import annotations

import json
import os
import tempfile
import numpy as np
import pytest


@pytest.fixture(autouse=True)
def _tmp_root(monkeypatch):
    d = tempfile.mkdtemp(prefix="chayuan_test_")
    monkeypatch.setenv("CHAYUAN_ROOT", d)
    # 清掉单例缓存
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    yield d


def _new_store(name="kb1"):
    from chayuan.server.image_source.store import ImageStore
    return ImageStore(name)


def test_insert_placeholder_writes_state_queued():
    store = _new_store()
    item = store.insert_placeholder(
        item_id="img_abc", filename="a.png", mime_type="image/png",
        size_bytes=100, path="/tmp/a.png",
    )
    assert item["state"] == "queued"
    assert item["progress"] == 0
    assert item["has_text_vector"] is False
    assert item["ocr_text"] is None


def test_update_state_persists_and_reads_back():
    store = _new_store()
    store.insert_placeholder(
        item_id="img_abc", filename="a.png", mime_type="image/png",
        size_bytes=100, path="/tmp/a.png",
    )
    store.update("img_abc", state="ready", progress=100, ocr_text="hello")
    rec = store.get("img_abc")
    assert rec["state"] == "ready"
    assert rec["progress"] == 100
    assert rec["ocr_text"] == "hello"


def test_add_image_vector_and_search():
    store = _new_store()
    store.insert_placeholder(
        item_id="img_a", filename="a.png", mime_type="image/png",
        size_bytes=1, path="/tmp/a",
    )
    store.add_image_vector("img_a", np.array([1.0, 0.0, 0.0], dtype="float32"))
    hits = store.search_image(np.array([0.99, 0.01, 0.0], dtype="float32"), top_k=5)
    assert len(hits) == 1
    assert hits[0][0]["id"] == "img_a"


def test_add_text_vector_separate_from_image_vector():
    store = _new_store()
    store.insert_placeholder(
        item_id="img_a", filename="a.png", mime_type="image/png",
        size_bytes=1, path="/tmp/a",
    )
    # CLIP 512 维
    store.add_image_vector("img_a", np.ones(512, dtype="float32") / np.sqrt(512))
    # 用户默认文本向量模型(测试用 1024 维示例)
    store.add_text_vector("img_a", np.ones(1024, dtype="float32") / np.sqrt(1024))
    rec = store.get("img_a")
    assert rec["has_text_vector"] is True
    text_hits = store.search_text(np.ones(1024, dtype="float32") / np.sqrt(1024), top_k=5)
    assert len(text_hits) == 1
    assert text_hits[0][0]["id"] == "img_a"


def test_remove_clears_both_indices():
    store = _new_store()
    store.insert_placeholder(
        item_id="img_a", filename="a.png", mime_type="image/png",
        size_bytes=1, path="/tmp/a",
    )
    store.add_image_vector("img_a", np.ones(3, dtype="float32"))
    store.add_text_vector("img_a", np.ones(4, dtype="float32"))
    assert store.remove("img_a") is True
    assert store.get("img_a") is None
    assert store.search_image(np.ones(3, dtype="float32"), top_k=5) == []
    assert store.search_text(np.ones(4, dtype="float32"), top_k=5) == []


def test_legacy_metadata_migration(tmp_path, monkeypatch):
    """老 meta.json 没有 state/progress 字段,_load 时填默认 ready。"""
    from chayuan.server.image_source.store import _image_indexes_root
    root = _image_indexes_root() / "legacy_kb"
    root.mkdir(parents=True, exist_ok=True)
    legacy = [{
        "id": "img_legacy_1",
        "path": "/old/a.png",
        "md5": "deadbeef",
        "size_bytes": 100,
        "created_at": 1700000000.0,
    }]
    (root / "meta.json").write_text(json.dumps(legacy), encoding="utf-8")
    # 清单例,强制重新加载
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    store = _new_store("legacy_kb")
    rec = store.get("img_legacy_1")
    assert rec["state"] == "ready"
    assert rec["progress"] == 100
    assert rec["has_text_vector"] is False
    assert rec["ocr_text"] is None
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_store_schema.py -v`
Expected: FAIL — `insert_placeholder` / `update` / `get` / `add_image_vector` / `add_text_vector` / `search_image` / `search_text` 不存在

- [ ] **Step 3: 实现 store.py 改造**

完整替换 `libs/chayuan-server/chayuan/server/image_source/store.py` 内容:

```python
"""图像向量存储(state-aware + 双索引)。

变更点(2026-05-16):
- 元数据 schema 加 state/progress/ocr_text/ocr_lang/ocr_confidence/has_text_vector/
  image_vector_id/text_vector_id 字段
- 双向量矩阵:image_matrix (CLIP, 512 dim) + text_matrix (用户默认文本向量模型,维度由首条向量决定)
- 老 meta.json 缺字段时,_load 自动补默认值
- insert_placeholder / update / get / add_image_vector / add_text_vector /
  search_image / search_text 替代老 add / search
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("chayuan.image_source.store")


def _image_indexes_root() -> Path:
    base = os.environ.get("CHAYUAN_ROOT")
    p = Path(base) if base else Path.home() / "chayuan_data"
    root = p / "data" / "image_indexes"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _md5_of(path: str) -> str:
    try:
        h = hashlib.md5()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except Exception:  # noqa: BLE001
        return ""


_LEGACY_DEFAULTS = {
    "state": "ready",
    "progress": 100,
    "error": None,
    "ocr_text": None,
    "ocr_lang": None,
    "ocr_confidence": None,
    "has_text_vector": False,
    "image_vector_id": None,
    "text_vector_id": None,
}


class ImageStore:
    """一个 source 的图像索引。numpy brute-force(<= 10 万图)。

    持久化文件(<CHAYUAN_ROOT>/data/image_indexes/<source_name>/):
        meta.json        ← items 列表
        vectors.npy      ← CLIP image 向量矩阵(N_img, 512)
        text_vectors.npy ← 用户默认文本向量模型矩阵(N_text, 维度由首条向量决定)
    """

    def __init__(self, source_name: str):
        self.source_name = source_name
        self.root = _image_indexes_root() / source_name
        self.root.mkdir(parents=True, exist_ok=True)
        self._meta_path = self.root / "meta.json"
        self._vec_path = self.root / "vectors.npy"
        self._text_vec_path = self.root / "text_vectors.npy"
        self._meta: List[Dict[str, Any]] = []
        self._matrix = None       # np.ndarray (N_img, dim_img)
        self._text_matrix = None  # np.ndarray (N_text, dim_text)
        self._dim = 0
        self._text_dim = 0
        self._lock = threading.Lock()
        self._load()

    # ---- 持久化 ----

    def _load(self) -> None:
        try:
            if self._meta_path.exists():
                raw = json.loads(self._meta_path.read_text(encoding="utf-8"))
                # 老数据迁移:每条 item 缺字段补默认
                self._meta = [self._migrate_record(r) for r in raw]
        except Exception as e:  # noqa: BLE001
            logger.warning("读取 meta 失败:%r", e)
            self._meta = []
        import numpy as np
        try:
            if self._vec_path.exists():
                self._matrix = np.load(str(self._vec_path))
                if self._matrix is not None and self._matrix.shape:
                    self._dim = int(self._matrix.shape[1])
        except Exception as e:  # noqa: BLE001
            logger.warning("读取 image vectors 失败:%r", e)
            self._matrix = None
        try:
            if self._text_vec_path.exists():
                self._text_matrix = np.load(str(self._text_vec_path))
                if self._text_matrix is not None and self._text_matrix.shape:
                    self._text_dim = int(self._text_matrix.shape[1])
        except Exception as e:  # noqa: BLE001
            logger.warning("读取 text vectors 失败:%r", e)
            self._text_matrix = None

    @staticmethod
    def _migrate_record(rec: Dict[str, Any]) -> Dict[str, Any]:
        for k, v in _LEGACY_DEFAULTS.items():
            rec.setdefault(k, v)
        # 老数据有 path 没 image_vector_id;给个默认推断
        if rec.get("image_vector_id") is None and "path" in rec:
            # 老数据按 _meta 顺序对应 _matrix 行,不再用 image_vector_id 索引,
            # 留 None 表示"按行号匹配的老布局",新数据才填整型 id。
            pass
        return rec

    def _save(self) -> None:
        import numpy as np
        self._meta_path.write_text(
            json.dumps(self._meta, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
        if self._matrix is not None:
            np.save(str(self._vec_path), self._matrix)
        if self._text_matrix is not None:
            np.save(str(self._text_vec_path), self._text_matrix)

    def flush(self) -> None:
        with self._lock:
            self._save()

    # ---- 元数据 CRUD ----

    def insert_placeholder(
        self, *, item_id: str, filename: str, mime_type: str,
        size_bytes: int, path: str, thumbnail_path: str = "",
        md5: str = "", tags: str = "",
    ) -> Dict[str, Any]:
        """插入一条占位 item(state=queued)。返回完整 record。"""
        with self._lock:
            for existing in self._meta:
                if existing.get("id") == item_id:
                    return existing
            rec: Dict[str, Any] = {
                "id": item_id,
                "filename": filename,
                "mime_type": mime_type,
                "size_bytes": int(size_bytes),
                "path": path,
                "thumbnail_path": thumbnail_path,
                "md5": md5 or (_md5_of(path) if os.path.isfile(path) else ""),
                "tags": tags or "",
                "created_at": time.time(),
                "updated_at": time.time(),
                **dict(_LEGACY_DEFAULTS),
                "state": "queued",
                "progress": 0,
            }
            self._meta.append(rec)
            self._save()
            return rec

    def update(self, item_id: str, **fields) -> Optional[Dict[str, Any]]:
        """部分更新 item 字段;不存在返 None。自动 bump updated_at。"""
        with self._lock:
            for rec in self._meta:
                if rec.get("id") == item_id:
                    rec.update(fields)
                    rec["updated_at"] = time.time()
                    self._save()
                    return rec
            return None

    def get(self, item_id: str) -> Optional[Dict[str, Any]]:
        for rec in self._meta:
            if rec.get("id") == item_id:
                return rec
        return None

    def remove(self, item_id: str) -> bool:
        """删 item + 同步两个向量矩阵。"""
        import numpy as np
        with self._lock:
            idx = next(
                (i for i, r in enumerate(self._meta) if r.get("id") == item_id),
                None,
            )
            if idx is None:
                return False
            rec = self._meta.pop(idx)
            img_vid = rec.get("image_vector_id")
            txt_vid = rec.get("text_vector_id")
            if isinstance(img_vid, int) and self._matrix is not None:
                self._matrix = np.delete(self._matrix, img_vid, axis=0)
                # 后续行的 image_vector_id 减 1
                for r in self._meta:
                    v = r.get("image_vector_id")
                    if isinstance(v, int) and v > img_vid:
                        r["image_vector_id"] = v - 1
            elif self._matrix is not None and idx < self._matrix.shape[0]:
                # 老布局:按 _meta 行号对应 _matrix 行
                self._matrix = np.delete(self._matrix, idx, axis=0)
            if isinstance(txt_vid, int) and self._text_matrix is not None:
                self._text_matrix = np.delete(self._text_matrix, txt_vid, axis=0)
                for r in self._meta:
                    v = r.get("text_vector_id")
                    if isinstance(v, int) and v > txt_vid:
                        r["text_vector_id"] = v - 1
            self._save()
            return True

    # ---- 向量 ----

    def add_image_vector(self, item_id: str, vector) -> int:
        import numpy as np
        with self._lock:
            vec = np.asarray(vector, dtype="float32").reshape(-1)
            if self._matrix is None:
                self._matrix = vec.reshape(1, -1)
                self._dim = int(vec.shape[0])
            else:
                if int(vec.shape[0]) != self._dim:
                    raise ValueError(
                        f"image 向量维度不一致:{self._dim} vs {vec.shape[0]}"
                    )
                self._matrix = np.vstack([self._matrix, vec.reshape(1, -1)])
            new_id = int(self._matrix.shape[0]) - 1
            for rec in self._meta:
                if rec.get("id") == item_id:
                    rec["image_vector_id"] = new_id
                    rec["updated_at"] = time.time()
                    break
            self._save()
            return new_id

    def add_text_vector(self, item_id: str, vector) -> int:
        import numpy as np
        with self._lock:
            vec = np.asarray(vector, dtype="float32").reshape(-1)
            if self._text_matrix is None:
                self._text_matrix = vec.reshape(1, -1)
                self._text_dim = int(vec.shape[0])
            else:
                if int(vec.shape[0]) != self._text_dim:
                    raise ValueError(
                        f"text 向量维度不一致:{self._text_dim} vs {vec.shape[0]}"
                    )
                self._text_matrix = np.vstack([self._text_matrix, vec.reshape(1, -1)])
            new_id = int(self._text_matrix.shape[0]) - 1
            for rec in self._meta:
                if rec.get("id") == item_id:
                    rec["text_vector_id"] = new_id
                    rec["has_text_vector"] = True
                    rec["updated_at"] = time.time()
                    break
            self._save()
            return new_id

    # ---- 检索 ----

    def search_image(self, query_vec, top_k: int = 5) -> List[Tuple[Dict[str, Any], float]]:
        return self._search_generic(
            self._matrix, query_vec, top_k,
            row_id_field="image_vector_id",
        )

    def search_text(self, query_vec, top_k: int = 5) -> List[Tuple[Dict[str, Any], float]]:
        return self._search_generic(
            self._text_matrix, query_vec, top_k,
            row_id_field="text_vector_id",
        )

    def _search_generic(
        self, matrix, query_vec, top_k, row_id_field: str,
    ) -> List[Tuple[Dict[str, Any], float]]:
        import numpy as np
        if matrix is None or not len(self._meta):
            return []
        q = np.asarray(query_vec, dtype="float32").reshape(-1)
        qn = float(np.linalg.norm(q)) or 1.0
        q = q / qn
        sims = matrix @ q
        order = np.argsort(-sims)
        out: List[Tuple[Dict[str, Any], float]] = []
        # 反向映射:row → item
        row_to_item: Dict[int, Dict[str, Any]] = {}
        for i, rec in enumerate(self._meta):
            v = rec.get(row_id_field)
            if isinstance(v, int):
                row_to_item[v] = rec
            elif row_id_field == "image_vector_id" and i < matrix.shape[0]:
                # 老布局:行号 == _meta 下标
                row_to_item.setdefault(i, rec)
        for row in order[: int(top_k)]:
            rec = row_to_item.get(int(row))
            if rec is None:
                continue
            out.append((rec, float(sims[int(row)])))
        return out

    # ---- 兼容旧 API ----

    def count(self) -> int:
        return len(self._meta)

    def dim(self) -> int:
        return int(self._dim)

    def text_dim(self) -> int:
        return int(self._text_dim)

    def all_paths(self) -> List[str]:
        return [m.get("path") or "" for m in self._meta]

    def list_items(self, limit: int = 200) -> List[Dict[str, Any]]:
        return list(self._meta[-int(limit):])


# ---- 单例 per source ----

_STORES: Dict[str, ImageStore] = {}
_STORE_LOCK = threading.Lock()


def get_store(source_name: str) -> ImageStore:
    with _STORE_LOCK:
        if source_name not in _STORES:
            _STORES[source_name] = ImageStore(source_name)
        return _STORES[source_name]


def invalidate(source_name: str = "") -> None:
    with _STORE_LOCK:
        if source_name:
            _STORES.pop(source_name, None)
        else:
            _STORES.clear()
```

- [ ] **Step 4: 跑测试确认全过**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_store_schema.py -v`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/image_source/store.py \
        libs/chayuan-server/tests/unit_tests/test_image_store_schema.py
git commit -m "feat(image-kb): extend store with state/progress + dual vector index"
```

---

## Task 2: 修 source_name 解析不一致(bug 根因)

**Files:**
- Modify: `libs/chayuan-server/chayuan/server/image_source/connector.py:32-78` (暴露 `source_name` 属性)
- Modify: `libs/chayuan-server/chayuan/server/api_server/image_routes.py:209-258` (list / delete / file endpoints 改用 connector 的 source_name)
- Modify: `libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py:396-420` (详情 endpoint 同上)

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py
"""上传后列表能立刻读到 item:验证 source_name 解析两端一致。"""
from __future__ import annotations

import io
import tempfile
import pytest


@pytest.fixture(autouse=True)
def _tmp_root(monkeypatch):
    d = tempfile.mkdtemp(prefix="chayuan_test_src_")
    monkeypatch.setenv("CHAYUAN_ROOT", d)
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    yield d


def test_connector_source_name_matches_routes(monkeypatch):
    """ImageConnector.source_name 应与 src['name'] 一致。"""
    from chayuan.server.image_source.connector import ImageConnector
    from chayuan.server.knowledge_source.base import ConnectionSpec

    spec = ConnectionSpec(
        dialect="image", host="", port=0, user="", password="",
        database="kb_legacy_name",
        options={"source_name": "explicit_name"},
    )
    conn = ImageConnector(spec=spec, source_id=42)
    # 必须暴露 public attr
    assert hasattr(conn, "source_name")
    assert conn.source_name == "explicit_name"

    spec2 = ConnectionSpec(
        dialect="image", host="", port=0, user="", password="",
        database="db_value", options={},
    )
    conn2 = ImageConnector(spec=spec2, source_id=43)
    assert conn2.source_name == "db_value"


def test_routes_use_connector_source_name(monkeypatch):
    """list/detail 端点必须通过 connector 解析 source_name,而不是直接读 src['name']。"""
    from chayuan.server.api_server import image_routes as ir
    # 用现有 helper 拿到 connector 后,读 .source_name
    # _resolve_store_name(source_id) 应该返回 ImageConnector(spec).source_name
    assert hasattr(ir, "_resolve_store_name")
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py -v`
Expected: FAIL — `source_name` 不是 public attr / `_resolve_store_name` 不存在

- [ ] **Step 3: 改 connector.py 暴露 source_name**

在 `libs/chayuan-server/chayuan/server/image_source/connector.py` 第 44-47 行替换 `__init__`:

```python
    def __init__(self, spec: ConnectionSpec, source_id: int = 0):
        super().__init__(spec, source_id)
        self._model_name = (self.spec.options or {}).get("embedder_model") or default_model_name()
        # 与列表 / 详情端点一致的解析顺序:
        #   options.source_name → spec.database → "src_{id}"
        self.source_name = (
            (self.spec.options or {}).get("source_name")
            or self.spec.database
            or f"src_{self.source_id}"
        )
        # 老内部代号保留,避免一次性大改
        self._source_name = self.source_name
```

- [ ] **Step 4: 在 image_routes.py 加 `_resolve_store_name` helper**

在 `libs/chayuan-server/chayuan/server/api_server/image_routes.py` 第 47 行(`_build_image_connector` 后面)新增:

```python
def _resolve_store_name(source_id: int) -> str:
    """统一 store 名解析,与 ImageConnector 完全同源。"""
    return _build_image_connector(int(source_id)).source_name
```

并把第 218 / 240 / 254 行的 `get_store((src.get("name") or f"src_{source_id}"))` 全部改成 `get_store(_resolve_store_name(source_id))`。

- [ ] **Step 5: 改 knowledge_universe_routes.py**

`libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py` 第 400 行:

```python
                from chayuan.server.image_source.store import get_store
                from chayuan.server.api_server.image_routes import _resolve_store_name
                store = get_store(_resolve_store_name(int(raw)))
```

- [ ] **Step 6: 跑测试确认全过**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py -v`
Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/image_source/connector.py \
        libs/chayuan-server/chayuan/server/api_server/image_routes.py \
        libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py \
        libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py
git commit -m "fix(image-kb): unify source_name resolution to fix 'refresh disappears' bug"
```

---

## Task 3: OCR 异步客户端

**Files:**
- Create: `libs/chayuan-server/chayuan/server/image_source/ocr_client.py`
- Test: `libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py`

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py
"""OCR 客户端:成功 / sidecar 不可用 / 超时。"""
from __future__ import annotations

import base64
import pytest


class _FakeResp:
    def __init__(self, status=200, payload=None):
        self.status_code = status
        self._payload = payload or {}
    def json(self): return self._payload
    def raise_for_status(self):
        if self.status_code >= 400:
            import httpx
            raise httpx.HTTPStatusError("bad", request=None, response=self)


@pytest.mark.asyncio
async def test_ocr_happy(monkeypatch):
    from chayuan.server.image_source import ocr_client

    async def _fake_post(self, url, json, timeout):
        assert "/v1/ocr" in url
        assert "image" in json
        return _FakeResp(200, {
            "boxes": [
                {"box": [[0, 0], [100, 0], [100, 30], [0, 30]],
                 "text": "hello", "score": 0.98},
                {"box": [[0, 40], [100, 40], [100, 70], [0, 70]],
                 "text": "world", "score": 0.95},
            ],
            "elapsed_ms": 120,
        })
    import httpx
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await ocr_client.run_ocr(b"\x89PNG fake-bytes", port=18380)
    assert result.text == "hello\nworld"
    assert result.lang in ("ch", "en", "unknown")
    assert 0.9 <= result.confidence <= 1.0


@pytest.mark.asyncio
async def test_ocr_sidecar_unavailable(monkeypatch):
    from chayuan.server.image_source import ocr_client

    async def _fake_post(self, url, json, timeout):
        return _FakeResp(503, {"detail": "rapidocr 未安装"})
    import httpx
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await ocr_client.run_ocr(b"x", port=18380)
    assert result.text == ""
    assert result.error and "503" in result.error


@pytest.mark.asyncio
async def test_ocr_timeout(monkeypatch):
    from chayuan.server.image_source import ocr_client
    import httpx

    async def _fake_post(self, url, json, timeout):
        raise httpx.ReadTimeout("timeout")
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await ocr_client.run_ocr(b"x", port=18380)
    assert result.text == ""
    assert "timeout" in (result.error or "").lower()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py -v`
Expected: FAIL — module `ocr_client` 不存在

- [ ] **Step 3: 实现 ocr_client.py**

```python
# libs/chayuan-server/chayuan/server/image_source/ocr_client.py
"""调 rapidocr sidecar 的异步瘦客户端。

sidecar 协议见 chayuan/server/modality/rapidocr_server.py:
    POST /v1/ocr {"image": "<base64>"}
    → {"boxes": [{"box":[...], "text":"...", "score":0.x}, ...], "elapsed_ms": N}

端口通过 SidecarRuntimeManager.get_runtime("ocr").info.port 拿;
本模块只接受 port,**不直接耦合 manager**(方便单测)。
"""
from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger("chayuan.image_source.ocr_client")

_CN_RE = re.compile(r"[一-鿿]")


@dataclass
class OCRResult:
    text: str = ""
    lang: str = "unknown"
    confidence: float = 0.0
    box_count: int = 0
    elapsed_ms: int = 0
    error: Optional[str] = None
    raw_boxes: list = field(default_factory=list)


async def run_ocr(image_bytes: bytes, *, port: int, timeout: float = 30.0) -> OCRResult:
    """对一张图调 rapidocr,返 OCRResult。永不抛异常,失败信息写 .error。"""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    url = f"http://127.0.0.1:{int(port)}/v1/ocr"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json={"image": b64}, timeout=timeout)
        if resp.status_code >= 400:
            return OCRResult(error=f"{resp.status_code} {resp.text[:200]}")
        data = resp.json() or {}
    except httpx.TimeoutException as e:
        return OCRResult(error=f"timeout: {e}")
    except Exception as e:  # noqa: BLE001
        return OCRResult(error=f"http error: {e}")

    boxes = data.get("boxes") or []
    texts = []
    scores = []
    for b in boxes:
        t = (b.get("text") or "").strip()
        if t:
            texts.append(t)
            try:
                scores.append(float(b.get("score") or 0.0))
            except (TypeError, ValueError):
                pass
    full_text = "\n".join(texts)
    lang = "ch" if _CN_RE.search(full_text) else ("en" if full_text else "unknown")
    confidence = (sum(scores) / len(scores)) if scores else 0.0
    return OCRResult(
        text=full_text, lang=lang, confidence=confidence,
        box_count=len(boxes),
        elapsed_ms=int(data.get("elapsed_ms") or 0),
        raw_boxes=boxes,
    )


def resolve_port() -> Optional[int]:
    """从 SidecarRuntimeManager 查 ocr 端口;不可用返 None。"""
    try:
        from chayuan.server.model_registry.local_runtime import (
            SidecarRuntimeManager,
        )
        mgr = SidecarRuntimeManager.singleton()
        rt = mgr.get_runtime("ocr")
        if rt and rt.info and rt.info.port:
            return int(rt.info.port)
    except Exception as e:  # noqa: BLE001
        logger.debug("resolve OCR port failed: %r", e)
    return None
```

- [ ] **Step 4: 跑测试确认全过**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/image_source/ocr_client.py \
        libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py
git commit -m "feat(image-kb): add async OCR client wrapping rapidocr sidecar"
```

---

## Task 4: 文本向量异步客户端(用户配置的默认文本向量模型)

**Files:**
- Create: `libs/chayuan-server/chayuan/server/image_source/text_embed_client.py`
- Test: `libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py`

**关键约束**:**不能写死某个模型(如 bge-m3)**。用户在"默认模型选择 → 文本嵌入"配什么,就用什么。`resolve_endpoint()` 必须经 `utils.get_default_embedding()` + `utils.get_model_info()` 解析。

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py
"""文本向量客户端 — 跟随用户配置的默认文本向量模型,不绑定特定模型。"""
from __future__ import annotations

import pytest


class _FakeResp:
    def __init__(self, status=200, payload=None):
        self.status_code = status
        self._payload = payload or {}
        self.text = ""
    def json(self): return self._payload


@pytest.mark.asyncio
async def test_embed_text_happy(monkeypatch):
    from chayuan.server.image_source import text_embed_client
    import httpx

    captured = {}
    async def _fake_post(self, url, json, headers=None, timeout=30.0):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        assert json["input"] == ["hello"]
        return _FakeResp(200, {"data": [{"embedding": [0.1] * 1024}]})
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await text_embed_client.embed_text(
        "hello", base_url="http://127.0.0.1:62581",
        model="any-text-embed-model",
    )
    assert result.vector is not None
    assert len(result.vector) == 1024
    assert result.error is None
    assert result.model == "any-text-embed-model"


@pytest.mark.asyncio
async def test_embed_text_normalizes_url_with_or_without_v1(monkeypatch):
    """base_url 带不带 /v1 都应该 POST 到 /v1/embeddings。"""
    from chayuan.server.image_source import text_embed_client
    import httpx

    seen_urls = []
    async def _fake_post(self, url, json, headers=None, timeout=30.0):
        seen_urls.append(url)
        return _FakeResp(200, {"data": [{"embedding": [0.0]}]})
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    await text_embed_client.embed_text(
        "x", base_url="http://127.0.0.1:62581", model="m",
    )
    await text_embed_client.embed_text(
        "x", base_url="http://127.0.0.1:62581/v1", model="m",
    )
    await text_embed_client.embed_text(
        "x", base_url="http://127.0.0.1:62581/v1/", model="m",
    )
    assert all(u.endswith("/v1/embeddings") for u in seen_urls)
    assert all(u.count("/v1") == 1 for u in seen_urls)


@pytest.mark.asyncio
async def test_embed_text_passes_api_key_in_header(monkeypatch):
    from chayuan.server.image_source import text_embed_client
    import httpx

    captured = {}
    async def _fake_post(self, url, json, headers=None, timeout=30.0):
        captured["headers"] = dict(headers or {})
        return _FakeResp(200, {"data": [{"embedding": [0.0]}]})
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    await text_embed_client.embed_text(
        "x", base_url="http://x", model="m", api_key="sk-secret",
    )
    assert captured["headers"].get("Authorization") == "Bearer sk-secret"


@pytest.mark.asyncio
async def test_embed_text_service_unavailable(monkeypatch):
    from chayuan.server.image_source import text_embed_client
    import httpx

    async def _fake_post(self, url, json, headers=None, timeout=30.0):
        return _FakeResp(503, {"detail": "model not loaded"})
    monkeypatch.setattr(httpx.AsyncClient, "post", _fake_post)

    result = await text_embed_client.embed_text(
        "hello", base_url="http://127.0.0.1:62581", model="m",
    )
    assert result.vector is None
    assert "503" in (result.error or "")


@pytest.mark.asyncio
async def test_embed_text_empty_input():
    from chayuan.server.image_source import text_embed_client
    result = await text_embed_client.embed_text(
        "", base_url="http://127.0.0.1:62581", model="m",
    )
    assert result.vector is None
    assert "empty" in (result.error or "").lower()


def test_resolve_endpoint_uses_user_default(monkeypatch):
    """resolve_endpoint 必须读 utils.get_default_embedding + get_model_info,
    用户配什么模型就用什么。"""
    from chayuan.server.image_source import text_embed_client

    monkeypatch.setattr(
        "chayuan.server.utils.get_default_embedding",
        lambda: "user-picked-embed-model",
    )
    monkeypatch.setattr(
        "chayuan.server.utils.get_model_info",
        lambda model_name=None, **kw: {
            "api_base_url": "https://api.openai.com/v1",
            "api_key": "sk-xx",
            "platform_name": "openai",
        },
    )
    base_url, model, api_key = text_embed_client.resolve_endpoint()
    assert model == "user-picked-embed-model"
    assert base_url == "https://api.openai.com/v1"
    assert api_key == "sk-xx"


def test_resolve_endpoint_returns_none_when_unconfigured(monkeypatch):
    from chayuan.server.image_source import text_embed_client

    def _raise():
        raise RuntimeError("no model configured")
    monkeypatch.setattr(
        "chayuan.server.utils.get_default_embedding", _raise,
    )
    base_url, model, api_key = text_embed_client.resolve_endpoint()
    assert (base_url, model) == (None, None)
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=chayuan-server/libs/chayuan-server pytest -q chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py -v`
Expected: FAIL — module `text_embed_client` 不存在

- [ ] **Step 3: 实现 text_embed_client.py**

```python
# libs/chayuan-server/chayuan/server/image_source/text_embed_client.py
"""文本向量化客户端 — 调"用户配置的默认文本向量模型"的 OpenAI 兼容端点。

模型选择真源:
    chayuan.server.utils.get_default_embedding()  → str (model name)
    chayuan.server.utils.get_model_info(name)     → {api_base_url, api_key, platform_name}

API 契约(OpenAI /v1/embeddings):
    POST {base_url}/v1/embeddings
    body: {"model": "<name>", "input": ["<text>"]}
    resp: {"data": [{"embedding": [float, ...]}, ...]}

base_url 可能带 /v1 也可能不带,本模块负责 normalize。
本模块不写死任何模型名 — 用户改"默认文本向量模型"后立即生效。
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import httpx

logger = logging.getLogger("chayuan.image_source.text_embed_client")


@dataclass
class EmbedResult:
    vector: Optional[List[float]] = None
    error: Optional[str] = None
    model: str = ""


def _normalize_embeddings_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/v1"):
        return base + "/embeddings"
    if "/v1/" in base + "/":
        # 已经带 /v1/something,直接拼 /embeddings(罕见情况)
        return base + "/embeddings"
    return base + "/v1/embeddings"


async def embed_text(
    text: str, *, base_url: str, model: str,
    api_key: Optional[str] = None, timeout: float = 30.0,
) -> EmbedResult:
    """对一段文本拿向量,失败时返 .error 而非抛异常。

    base_url + model 由调用方解析好,本函数纯粹 HTTP。
    """
    if not text or not text.strip():
        return EmbedResult(error="empty input")
    if not base_url or not model:
        return EmbedResult(error="missing base_url or model")

    url = _normalize_embeddings_url(base_url)
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {"model": model, "input": [text]}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, headers=headers,
                                       timeout=timeout)
        if resp.status_code >= 400:
            return EmbedResult(
                error=f"{resp.status_code} {resp.text[:200]}", model=model,
            )
        data = resp.json() or {}
    except httpx.TimeoutException as e:
        return EmbedResult(error=f"timeout: {e}", model=model)
    except Exception as e:  # noqa: BLE001
        return EmbedResult(error=f"http error: {e}", model=model)

    items = data.get("data") or []
    if not items or "embedding" not in items[0]:
        return EmbedResult(
            error=f"bad response shape: {str(data)[:200]}", model=model,
        )
    vec = items[0]["embedding"]
    if not isinstance(vec, list) or not vec:
        return EmbedResult(error="empty embedding", model=model)
    return EmbedResult(vector=vec, model=model)


def resolve_endpoint() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """读取用户配置的默认文本向量模型 → (base_url, model_name, api_key)。

    解析路径:
        1. chayuan.server.utils.get_default_embedding()  → 模型名
        2. chayuan.server.utils.get_model_info(name)     → 平台连接信息

    任一步失败或不存在配置 → (None, None, None),pipeline 自动软降级。
    """
    try:
        from chayuan.server.utils import (
            get_default_embedding, get_model_info,
        )
    except Exception as e:  # noqa: BLE001
        logger.debug("import utils failed: %r", e)
        return None, None, None
    try:
        model = get_default_embedding()
    except Exception as e:  # noqa: BLE001
        logger.debug("get_default_embedding failed: %r", e)
        return None, None, None
    if not model:
        return None, None, None
    try:
        info = get_model_info(model_name=model) or {}
    except Exception as e:  # noqa: BLE001
        logger.debug("get_model_info(%s) failed: %r", model, e)
        return None, None, None
    base_url = info.get("api_base_url") or ""
    api_key = info.get("api_key") or None
    if not base_url:
        return None, None, None
    return base_url, model, api_key
```

- [ ] **Step 4: 跑测试确认全过**

Run: `cd /work/chayuan-desktop && PYTHONPATH=chayuan-server/libs/chayuan-server pytest -q chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py -v`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/image_source/text_embed_client.py \
        chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py
git commit -m "feat(image-kb): text-embed client follows user default text embedding model"
```

---

## Task 5: Pipeline — OCR ‖ CLIP 并行 + 文本向量软降级

**Files:**
- Create: `libs/chayuan-server/chayuan/server/image_source/pipeline.py`
- Test: `libs/chayuan-server/tests/unit_tests/test_image_pipeline.py`

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_pipeline.py
"""Pipeline:OCR ‖ CLIP 并行;OCR 失败不阻 ready;CLIP 失败 → failed;
默认文本向量模型不可用 → has_text_vector=false。"""
from __future__ import annotations

import asyncio
import tempfile
import pytest
import numpy as np

from chayuan.server.image_source.ocr_client import OCRResult
from chayuan.server.image_source.text_embed_client import EmbedResult


@pytest.fixture(autouse=True)
def _tmp_root(monkeypatch):
    d = tempfile.mkdtemp(prefix="chayuan_test_pipe_")
    monkeypatch.setenv("CHAYUAN_ROOT", d)
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    yield d


class _Ctx:
    def __init__(self, store_name="kb_pipe"):
        from chayuan.server.image_source.store import get_store
        self.store = get_store(store_name)
        self.store_name = store_name
        self.store.insert_placeholder(
            item_id="img_p1", filename="a.png", mime_type="image/png",
            size_bytes=10, path="/tmp/a.png",
        )


@pytest.mark.asyncio
async def test_pipeline_happy_all_three(monkeypatch):
    """OCR + CLIP + 默认文本向量模型 都成功 → state=ready, has_text_vector=True。"""
    from chayuan.server.image_source import pipeline

    async def _ocr(b, *, port, timeout=30.0):
        return OCRResult(text="hello world", lang="en", confidence=0.95,
                          box_count=2)
    async def _clip(b):
        return np.ones(512, dtype="float32") / np.sqrt(512)
    async def _text(t, *, base_url, model, api_key=None, timeout=30.0):
        return EmbedResult(vector=[0.1] * 1024, model=model)

    ctx = _Ctx()
    monkeypatch.setattr(pipeline, "_run_ocr", _ocr)
    monkeypatch.setattr(pipeline, "_run_clip_embed", _clip)
    monkeypatch.setattr(pipeline, "_run_text_embed", _text)
    monkeypatch.setattr(pipeline, "_resolve_ocr_port", lambda: 18380)
    monkeypatch.setattr(pipeline, "_resolve_text_embed_endpoint",
                        lambda: ("http://x", "user-default-embed", None))

    await pipeline.process_item(ctx.store_name, "img_p1", b"fakepng",
                                 model_name="clip-test")
    rec = ctx.store.get("img_p1")
    assert rec["state"] == "ready"
    assert rec["progress"] == 100
    assert rec["ocr_text"] == "hello world"
    assert rec["has_text_vector"] is True
    assert rec["image_vector_id"] == 0


@pytest.mark.asyncio
async def test_pipeline_ocr_fails_still_ready(monkeypatch):
    """OCR 抛错 → 仍然 ready, ocr_text=None, has_text_vector=False。"""
    from chayuan.server.image_source import pipeline

    async def _ocr(b, *, port, timeout=30.0):
        return OCRResult(error="503 rapidocr 未安装")
    async def _clip(b):
        return np.ones(512, dtype="float32") / np.sqrt(512)
    async def _text(t, *, base_url, model, api_key=None, timeout=30.0):
        return EmbedResult(error="should not be called")

    ctx = _Ctx()
    monkeypatch.setattr(pipeline, "_run_ocr", _ocr)
    monkeypatch.setattr(pipeline, "_run_clip_embed", _clip)
    monkeypatch.setattr(pipeline, "_run_text_embed", _text)
    monkeypatch.setattr(pipeline, "_resolve_ocr_port", lambda: 18380)
    monkeypatch.setattr(pipeline, "_resolve_text_embed_endpoint",
                        lambda: ("http://x", "user-default-embed", None))

    await pipeline.process_item(ctx.store_name, "img_p1", b"fakepng",
                                 model_name="clip-test")
    rec = ctx.store.get("img_p1")
    assert rec["state"] == "ready"
    assert rec["ocr_text"] is None
    assert rec["has_text_vector"] is False


@pytest.mark.asyncio
async def test_pipeline_clip_fails_state_failed(monkeypatch):
    """CLIP 失败 → fatal,state=failed。"""
    from chayuan.server.image_source import pipeline

    async def _ocr(b, *, port, timeout=30.0):
        return OCRResult(text="x", lang="en", confidence=0.9, box_count=1)
    async def _clip(b):
        raise RuntimeError("CLIP sidecar dead")
    async def _text(t, *, base_url, model, api_key=None, timeout=30.0):
        return EmbedResult(vector=[0.1] * 1024, model=model)

    ctx = _Ctx()
    monkeypatch.setattr(pipeline, "_run_ocr", _ocr)
    monkeypatch.setattr(pipeline, "_run_clip_embed", _clip)
    monkeypatch.setattr(pipeline, "_run_text_embed", _text)
    monkeypatch.setattr(pipeline, "_resolve_ocr_port", lambda: 18380)
    monkeypatch.setattr(pipeline, "_resolve_text_embed_endpoint",
                        lambda: ("http://x", "user-default-embed", None))

    await pipeline.process_item(ctx.store_name, "img_p1", b"fakepng",
                                 model_name="clip-test")
    rec = ctx.store.get("img_p1")
    assert rec["state"] == "failed"
    assert "CLIP sidecar dead" in (rec["error"] or "")


@pytest.mark.asyncio
async def test_pipeline_text_embed_unavailable_soft_degrade(monkeypatch):
    """默认文本向量模型不可用 → 仍 ready,has_text_vector=False。"""
    from chayuan.server.image_source import pipeline

    async def _ocr(b, *, port, timeout=30.0):
        return OCRResult(text="hi", lang="en", confidence=0.9, box_count=1)
    async def _clip(b):
        return np.ones(512, dtype="float32") / np.sqrt(512)

    ctx = _Ctx()
    monkeypatch.setattr(pipeline, "_run_ocr", _ocr)
    monkeypatch.setattr(pipeline, "_run_clip_embed", _clip)
    monkeypatch.setattr(pipeline, "_resolve_ocr_port", lambda: 18380)
    monkeypatch.setattr(pipeline, "_resolve_text_embed_endpoint",
                        lambda: (None, None, None))

    await pipeline.process_item(ctx.store_name, "img_p1", b"fakepng",
                                 model_name="clip-test")
    rec = ctx.store.get("img_p1")
    assert rec["state"] == "ready"
    assert rec["ocr_text"] == "hi"
    assert rec["has_text_vector"] is False
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_pipeline.py -v`
Expected: FAIL — module `pipeline` 不存在

- [ ] **Step 3: 实现 pipeline.py**

```python
# libs/chayuan-server/chayuan/server/image_source/pipeline.py
"""图像 KB upload 流水线:OCR ‖ CLIP 并行,默认文本向量模型软降级,状态机推进。

输入:store_name + item_id + image_bytes。流程:
    1. state=queued → state=ocr_and_embedding, progress=10
    2. asyncio.gather(OCR, CLIP)
    3. CLIP 失败 → state=failed, return
    4. 写 image vector, progress=70
    5. OCR 成功且 text 非空 → 写 ocr_*, progress=85;再调用户默认文本向量模型
       - 文本向量成功 → 写 text vector, has_text_vector=True
       - 文本向量失败/未配置 → has_text_vector=False(软降级)
    6. state=ready, progress=100, flush
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional, Tuple

import numpy as np

from chayuan.server.image_source.ocr_client import OCRResult, run_ocr
from chayuan.server.image_source.ocr_client import (
    resolve_port as _resolve_ocr_port_impl,
)
from chayuan.server.image_source.store import get_store
from chayuan.server.image_source.text_embed_client import (
    EmbedResult, embed_text,
)
from chayuan.server.image_source.text_embed_client import (
    resolve_endpoint as _resolve_text_embed_endpoint_impl,
)

logger = logging.getLogger("chayuan.image_source.pipeline")

_OCR_SEMAPHORE = asyncio.Semaphore(2)


# ---- 可 monkeypatch 的 seam ----

async def _run_ocr(image_bytes: bytes, *, port: int, timeout: float = 30.0) -> OCRResult:
    async with _OCR_SEMAPHORE:
        return await run_ocr(image_bytes, port=port, timeout=timeout)


async def _run_clip_embed(image_bytes: bytes, *, model_name: str = ""):
    """同步 BaseImageEmbedder.embed_image 放线程池跑。"""
    from chayuan.server.image_source.embedder import get_embedder

    def _sync():
        emb = get_embedder(model_name) if model_name else get_embedder(None)
        return np.asarray(emb.embed_image(image_bytes), dtype="float32").reshape(-1)
    return await asyncio.to_thread(_sync)


async def _run_text_embed(
    text: str, *, base_url: str, model: str,
    api_key: Optional[str] = None, timeout: float = 30.0,
) -> EmbedResult:
    return await embed_text(text, base_url=base_url, model=model,
                              api_key=api_key, timeout=timeout)


def _resolve_ocr_port() -> Optional[int]:
    return _resolve_ocr_port_impl()


def _resolve_text_embed_endpoint() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """(base_url, model, api_key) 由 text_embed_client 用 utils.get_default_embedding 解析。"""
    return _resolve_text_embed_endpoint_impl()


# ---- 主流程 ----

async def process_item(
    store_name: str, item_id: str, image_bytes: bytes,
    *, model_name: str = "",
) -> None:
    """处理一个 upload item。永不抛异常,失败信息写到 item.state/error。"""
    store = get_store(store_name)

    store.update(item_id, state="ocr_and_embedding", progress=10)

    ocr_port = _resolve_ocr_port()
    ocr_coro = (
        _run_ocr(image_bytes, port=ocr_port)
        if ocr_port else _ocr_unavailable()
    )
    clip_coro = _run_clip_embed_safe(image_bytes, model_name=model_name)
    ocr_res, clip_res = await asyncio.gather(ocr_coro, clip_coro)

    if clip_res.error or clip_res.vector is None:
        store.update(item_id, state="failed",
                     error=f"embedding failed: {clip_res.error or 'no vector'}",
                     progress=0)
        store.flush()
        return

    store.add_image_vector(item_id, clip_res.vector)
    store.update(item_id, progress=70)

    if ocr_res.text:
        store.update(
            item_id,
            ocr_text=ocr_res.text,
            ocr_lang=ocr_res.lang,
            ocr_confidence=ocr_res.confidence,
            progress=85,
        )
        base_url, model, api_key = _resolve_text_embed_endpoint()
        if base_url and model:
            txt_res = await _run_text_embed(
                ocr_res.text, base_url=base_url, model=model, api_key=api_key,
            )
            if txt_res.vector is not None:
                store.add_text_vector(item_id, txt_res.vector)
                store.update(item_id, progress=95)
            else:
                logger.info("text embed failed for %s (%s): %s",
                            item_id, model, txt_res.error)
                store.update(item_id, has_text_vector=False)
        else:
            logger.info(
                "default text embedding model unresolved;"
                " soft-degrade %s (user must configure 默认模型选择 → 文本嵌入)",
                item_id,
            )
            store.update(item_id, has_text_vector=False)
    else:
        store.update(item_id, has_text_vector=False)
        if ocr_res.error:
            logger.info("OCR failed for %s: %s", item_id, ocr_res.error)

    store.update(item_id, state="ready", progress=100, error=None)
    store.flush()


async def _ocr_unavailable() -> OCRResult:
    return OCRResult(error="ocr sidecar port unresolved")


class _ClipResult:
    __slots__ = ("vector", "error")
    def __init__(self, vector=None, error=None):
        self.vector = vector
        self.error = error


async def _run_clip_embed_safe(image_bytes: bytes, *, model_name: str) -> _ClipResult:
    try:
        vec = await _run_clip_embed(image_bytes, model_name=model_name)
        return _ClipResult(vector=vec)
    except Exception as e:  # noqa: BLE001
        logger.exception("CLIP embed failed")
        return _ClipResult(error=str(e))
```

- [ ] **Step 4: 装 pytest-asyncio 并跑测试**

Run:
```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_pipeline.py -v
```
Expected: 4 passed
若装不上 pytest-asyncio,在测试文件顶部加 `pytestmark = pytest.mark.asyncio` 不一定够,需 `pip install pytest-asyncio` 并 `asyncio_mode = "auto"` 在 `tests/conftest.py` 配。**先确认是否已配**:`grep -r asyncio_mode libs/chayuan-server/tests/conftest.py libs/chayuan-server/pytest.ini libs/chayuan-server/pyproject.toml 2>/dev/null`

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/image_source/pipeline.py \
        libs/chayuan-server/tests/unit_tests/test_image_pipeline.py
git commit -m "feat(image-kb): pipeline orchestrates OCR/CLIP parallel + text-embed soft-degrade"
```

---

## Task 6: Refactor upload endpoint + 加 `/status` 端点

**Files:**
- Modify: `libs/chayuan-server/chayuan/server/api_server/image_routes.py:53-152` (upload) + 新增 status 端点
- Test: `libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py`

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py
"""upload 端点改造:同步插占位,BackgroundTasks 异步处理。"""
from __future__ import annotations

import tempfile
import pytest
from fastapi import BackgroundTasks


@pytest.fixture(autouse=True)
def _tmp_root(monkeypatch):
    d = tempfile.mkdtemp(prefix="chayuan_test_upload_")
    monkeypatch.setenv("CHAYUAN_ROOT", d)
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    yield d


class _FakeFile:
    def __init__(self, name="a.png", content=b"\x89PNG-fake", content_type="image/png"):
        self.filename = name
        self.content_type = content_type
        self._content = content
    async def read(self):
        return self._content


def _stub_source(monkeypatch, source_id=42, store_name="kb1"):
    from chayuan.server.api_server import image_routes as ir
    monkeypatch.setattr(ir, "_get_source_or_404",
                        lambda sid: {"id": sid, "kind": "image", "name": store_name})
    class _Conn:
        source_name = store_name
        _source_name = store_name
        def add_image(self, *a, **kw): raise NotImplementedError
    monkeypatch.setattr(ir, "_build_image_connector", lambda sid: _Conn())
    monkeypatch.setattr(ir, "_resolve_store_name", lambda sid: store_name)


@pytest.mark.asyncio
async def test_upload_returns_queued_items_synchronously(monkeypatch):
    from chayuan.server.api_server import image_routes as ir
    _stub_source(monkeypatch)

    scheduled = []
    class _BG:
        def add_task(self, fn, *a, **kw):
            scheduled.append((fn, a, kw))

    resp = await ir.upload_image_endpoint(
        source_id=42, files=[_FakeFile("a.png"), _FakeFile("b.png")],
        tags="", background_tasks=_BG(), user={"id": 1, "role": "admin"},
    )
    items = resp["data"]["added"]
    assert len(items) == 2
    for it in items:
        assert it["state"] == "queued"
        assert it["progress"] == 0
        assert it["image_id"]  # 已分配
    assert len(scheduled) == 2  # 每张图一个后台任务


@pytest.mark.asyncio
async def test_upload_dedup_same_content(monkeypatch):
    from chayuan.server.api_server import image_routes as ir
    _stub_source(monkeypatch)

    scheduled = []
    class _BG:
        def add_task(self, fn, *a, **kw):
            scheduled.append((fn, a, kw))

    same = _FakeFile("a.png", content=b"AAA")
    same2 = _FakeFile("dup.png", content=b"AAA")
    resp = await ir.upload_image_endpoint(
        source_id=42, files=[same, same2],
        tags="", background_tasks=_BG(), user={"id": 1, "role": "admin"},
    )
    items = resp["data"]["added"]
    # 同 hash 去重:返两条但 image_id 相同;且后台只调度一次
    assert items[0]["image_id"] == items[1]["image_id"]
    assert len(scheduled) == 1


def test_status_endpoint_returns_ready_fields(monkeypatch):
    from chayuan.server.api_server import image_routes as ir
    _stub_source(monkeypatch)
    from chayuan.server.image_source.store import get_store
    store = get_store("kb1")
    store.insert_placeholder(
        item_id="img_x", filename="x.png", mime_type="image/png",
        size_bytes=1, path="/tmp/x",
    )
    store.update("img_x", state="ready", progress=100,
                  has_text_vector=True, ocr_text="hello world")

    resp = ir.item_status_endpoint(
        source_id=42, image_id="img_x", user={"id": 1, "role": "admin"},
    )
    data = resp["data"]
    assert data["state"] == "ready"
    assert data["progress"] == 100
    assert data["has_text_vector"] is True
    assert data["ocr_text"] == "hello world"


def test_status_endpoint_404(monkeypatch):
    from chayuan.server.api_server import image_routes as ir
    from fastapi import HTTPException
    _stub_source(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        ir.item_status_endpoint(
            source_id=42, image_id="img_nope", user={"id": 1, "role": "admin"},
        )
    assert exc.value.status_code == 404
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py -v`
Expected: FAIL — 签名不匹配 / `item_status_endpoint` 不存在

- [ ] **Step 3: 改 upload_image_endpoint + 加 status 端点**

替换 `libs/chayuan-server/chayuan/server/api_server/image_routes.py` 第 53-152 行(upload 函数)为下面新实现,并在第 207 行(`@image_router.get("/{source_id}/image/list"` 上面)插入 status 端点。

完整 upload 替换:

```python
@image_router.post("/{source_id}/image/upload", summary="上传图像到知识源(即时占位 + 异步流水线)")
async def upload_image_endpoint(
    source_id: int,
    files: List[UploadFile] = File(...),
    tags: str = Form(""),
    background_tasks: "BackgroundTasks" = None,
    user=Depends(require_auth_enabled()),
):
    """同步阶段:落盘 + 插占位(state=queued)。异步阶段:OCR ‖ CLIP + 默认文本向量模型。

    返回每张图的 ``state="queued"`` item;前端立即渲染占位卡片,然后轮询
    ``/image/{image_id}/status`` 拿状态更新。
    """
    from fastapi import BackgroundTasks as _BG
    if background_tasks is None:
        background_tasks = _BG()
    if not can_write(user, int(source_id)):
        raise HTTPException(403, "no write permission")
    _get_source_or_404(int(source_id))
    conn = _build_image_connector(int(source_id))
    store_name = conn.source_name

    from chayuan.server.image_source.store import _image_indexes_root, get_store
    from chayuan.server.image_source.pipeline import process_item
    import hashlib

    store = get_store(store_name)
    img_dir = _image_indexes_root() / f"{int(source_id)}_files"
    img_dir.mkdir(parents=True, exist_ok=True)

    try:
        from chayuan.server.file_storage import NS, get_storage
        storage = get_storage()
    except Exception:  # noqa: BLE001
        storage = None

    added: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    for f in files:
        data = await f.read()
        if not data:
            errors.append({"filename": f.filename or "?", "error": "empty file"})
            continue
        md5_full = hashlib.md5(data).hexdigest()
        md5 = md5_full[:8]
        fname = os.path.basename(f.filename or "upload.bin")
        out = img_dir / f"{md5}_{fname}"
        item_id = f"img_{md5_full[:12]}"

        # 同 hash 去重:已存在的 item 直接返回,不再走 pipeline
        existing = store.get(item_id)
        if existing is not None:
            added.append(_item_to_wire(existing, int(source_id)))
            continue

        # 落盘(永不阻断主流程;失败也算 error 但不抛)
        try:
            out.write_bytes(data)
        except Exception as e:  # noqa: BLE001
            logger.warning("upload_image 落盘失败 %s: %r", fname, e)
            errors.append({"filename": fname, "error": f"落盘失败: {e}"})
            continue
        if storage is not None:
            try:
                storage.put(
                    NS.IMAGE_FILES, f"{int(source_id)}/{md5}_{fname}",
                    data, content_type=f.content_type or "image/jpeg",
                )
            except Exception as _e:  # noqa: BLE001
                logger.debug("image_files 存储同步失败(忽略):%r", _e)

        rec = store.insert_placeholder(
            item_id=item_id, filename=fname,
            mime_type=f.content_type or "image/octet-stream",
            size_bytes=len(data), path=str(out),
            md5=md5_full, tags=tags or "",
        )
        added.append(_item_to_wire(rec, int(source_id)))
        background_tasks.add_task(
            process_item, store_name, item_id, data,
            model_name=conn._model_name,
        )

    return {
        "code": 0,
        "data": {"added": added, "errors": errors},
    }


def _item_to_wire(rec: Dict[str, Any], source_id: int) -> Dict[str, Any]:
    """统一前端契约:image_id / state / progress / preview url / has_text_vector。"""
    img_id = rec.get("id")
    return {
        "filename": rec.get("filename"),
        "image_id": img_id,
        "path": rec.get("path"),
        "state": rec.get("state", "ready"),
        "progress": int(rec.get("progress") or 0),
        "error": rec.get("error"),
        "has_text_vector": bool(rec.get("has_text_vector")),
        "ocr_text": rec.get("ocr_text"),
        "preview_url": f"/knowledge_source/{int(source_id)}/image/{img_id}",
        # 老字段保留
        "vector_status": (
            "indexed" if rec.get("image_vector_id") is not None
            else ("queued" if rec.get("state") == "queued" else "missing")
        ),
    }
```

在第 207 行前插入 status 端点:

```python
@image_router.get(
    "/{source_id}/image/{image_id}/status",
    summary="单条图像 item 处理状态(供前端轮询)",
)
def item_status_endpoint(
    source_id: int, image_id: str,
    user=Depends(require_auth_enabled()),
):
    if not can_read(user, int(source_id)):
        raise HTTPException(403, "no read permission")
    _get_source_or_404(int(source_id))
    from chayuan.server.image_source.store import get_store
    store = get_store(_resolve_store_name(int(source_id)))
    rec = store.get(image_id)
    if rec is None:
        raise HTTPException(404, f"image {image_id} not found")
    return {
        "code": 0,
        "data": {
            "id": image_id,
            "state": rec.get("state", "ready"),
            "progress": int(rec.get("progress") or 0),
            "error": rec.get("error"),
            "has_text_vector": bool(rec.get("has_text_vector")),
            "ocr_text": (rec.get("ocr_text") or "")[:500] or None,
        },
    }
```

(注:`item_status_endpoint` 必须放在 `image_file_endpoint`(`GET /{source_id}/image/{image_id}` 第 244 行)**之前**,否则 FastAPI 会按注册顺序优先匹配 `/{image_id}` 把 `/status` 当成 image_id。把整个 status endpoint 块插入到 list endpoint **之后**、delete endpoint **之前** 第 230 行附近即可。)

并把第 209-228 行的 `list_images_endpoint` 改成:

```python
@image_router.get("/{source_id}/image/list", summary="列出图像索引条目")
def list_images_endpoint(
    source_id: int, limit: int = Query(200),
    user=Depends(require_auth_enabled()),
):
    if not can_read(user, int(source_id)):
        raise HTTPException(403, "no read permission")
    _get_source_or_404(int(source_id))
    from chayuan.server.image_source.store import get_store
    store = get_store(_resolve_store_name(int(source_id)))
    items = []
    for m in store.list_items(int(limit)):
        items.append(_item_to_wire(m, int(source_id)))
    return {
        "code": 0,
        "data": {"count": store.count(), "dim": store.dim(), "items": items},
    }
```

- [ ] **Step 4: 跑测试确认全过**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/api_server/image_routes.py \
        libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py
git commit -m "feat(image-kb): upload returns placeholders immediately; add status endpoint"
```

---

## Task 7: RRF 融合

**Files:**
- Create: `libs/chayuan-server/chayuan/server/image_source/fusion.py`
- Test: `libs/chayuan-server/tests/unit_tests/test_image_fusion.py`

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_fusion.py
"""RRF 融合 + 单路退化。"""
from __future__ import annotations

import pytest


def _hit(id_, src="text_vec"):
    from chayuan.server.image_source.fusion import ImageHit
    return ImageHit(id=id_, filename=f"{id_}.png",
                     thumbnail_url=f"/{id_}", score=0.0, source_path=src)


def test_rrf_two_paths_same_id_promoted():
    from chayuan.server.image_source.fusion import rrf_fuse
    path_a = [_hit("a", "text_vec"), _hit("b", "text_vec"), _hit("c", "text_vec")]
    path_b = [_hit("b", "clip_text"), _hit("a", "clip_text"), _hit("d", "clip_text")]
    fused = rrf_fuse([path_a, path_b], k=60)
    ids = [h.id for h in fused]
    # a (rank0+rank1) 与 b (rank1+rank0) 分数相同 → 排在前;c/d 各只一路
    assert set(ids[:2]) == {"a", "b"}
    assert "c" in ids and "d" in ids
    for h in fused:
        assert h.fused is True
        assert h.source_path == "fused"


def test_rrf_single_path_only():
    from chayuan.server.image_source.fusion import rrf_fuse
    only_a = [_hit("a", "text_vec"), _hit("b", "text_vec")]
    fused = rrf_fuse([only_a], k=60)
    assert [h.id for h in fused] == ["a", "b"]


def test_rrf_empty_returns_empty():
    from chayuan.server.image_source.fusion import rrf_fuse
    assert rrf_fuse([], k=60) == []
    assert rrf_fuse([[], []], k=60) == []


def test_rrf_score_formula():
    """k=60, rank=0 → 1/61; rank=1 → 1/62。"""
    from chayuan.server.image_source.fusion import rrf_fuse
    fused = rrf_fuse([[_hit("a", "text_vec"), _hit("b", "text_vec")]], k=60)
    assert abs(fused[0].score - 1/61) < 1e-9
    assert abs(fused[1].score - 1/62) < 1e-9
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_fusion.py -v`
Expected: FAIL — module `fusion` 不存在

- [ ] **Step 3: 实现 fusion.py**

```python
# libs/chayuan-server/chayuan/server/image_source/fusion.py
"""Reciprocal Rank Fusion(Cormack et al., 2009)。

适用:多路独立排序的结果归一融合,例如 默认文本向量模型路 + CLIP 跨模态路。
公式:score(d) = Σ_path  1 / (k + rank_in_path(d) + 1)
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field, replace
from typing import List, Optional


@dataclass
class ImageHit:
    id: str
    filename: str
    thumbnail_url: str
    score: float
    source_path: str  # "text_vec" | "clip_text" | "clip_image" | "fused"
    fused: bool = False
    ocr_snippet: Optional[str] = None
    has_text_vector: bool = True
    meta: dict = field(default_factory=dict)


def rrf_fuse(rankings: List[List[ImageHit]], k: int = 60) -> List[ImageHit]:
    """对多路 ranking 做 RRF 融合。各路内已按相关性降序。

    返回按融合分数降序的 ImageHit 列表,source_path='fused', fused=True。
    """
    scores: defaultdict[str, float] = defaultdict(float)
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

- [ ] **Step 4: 跑测试确认全过**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_fusion.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/image_source/fusion.py \
        libs/chayuan-server/tests/unit_tests/test_image_fusion.py
git commit -m "feat(image-kb): add RRF fusion utility for hybrid search"
```

---

## Task 8: 文字搜图 service + 端点

**Files:**
- Create: `libs/chayuan-server/chayuan/server/image_source/text_search.py`
- Modify: `libs/chayuan-server/chayuan/server/api_server/image_routes.py` 加 `/search_by_text` 端点
- Test: `libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py`

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py
"""文字搜图:两路 RRF + 单路降级 + 双路不可用。"""
from __future__ import annotations

import tempfile
import pytest
import numpy as np

from chayuan.server.image_source.text_embed_client import EmbedResult


@pytest.fixture(autouse=True)
def _tmp_root(monkeypatch):
    d = tempfile.mkdtemp(prefix="chayuan_test_search_")
    monkeypatch.setenv("CHAYUAN_ROOT", d)
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    yield d


def _seed_store(name="kb_search"):
    from chayuan.server.image_source.store import get_store
    s = get_store(name)
    for i, txt in enumerate(["发票", "猫", "山"]):
        iid = f"img_t{i}"
        s.insert_placeholder(
            item_id=iid, filename=f"{iid}.png", mime_type="image/png",
            size_bytes=1, path=f"/tmp/{iid}",
        )
        # 不同 CLIP 向量
        v_img = np.zeros(512, dtype="float32")
        v_img[i] = 1.0
        s.add_image_vector(iid, v_img)
        # 不同文本向量
        v_txt = np.zeros(1024, dtype="float32")
        v_txt[i] = 1.0
        s.add_text_vector(iid, v_txt)
        s.update(iid, state="ready", progress=100, ocr_text=txt,
                  has_text_vector=True)
    return s, name


@pytest.mark.asyncio
async def test_search_two_paths_returns_diagnostics_ok(monkeypatch):
    from chayuan.server.image_source import text_search as ts
    _, name = _seed_store()

    async def _clip_text(q):
        v = np.zeros(512, dtype="float32"); v[0] = 1.0
        return v
    async def _text(q, *, base_url, model, api_key=None, timeout=30.0):
        v = [0.0] * 1024; v[1] = 1.0
        return EmbedResult(vector=v, model=model)

    monkeypatch.setattr(ts, "_clip_embed_text", _clip_text)
    monkeypatch.setattr(ts, "_text_embed", _text)
    monkeypatch.setattr(ts, "_resolve_text_embed_endpoint",
                        lambda: ("http://x", "user-default-embed", None))

    out = await ts.text_search(name, "发票", top_k=20)
    assert out["diagnostics"]["text_path"] == "ok"
    assert out["diagnostics"]["image_path"] == "ok"
    ids = [h["id"] for h in out["hits"]]
    assert "img_t1" in ids[:2]
    assert "img_t0" in ids[:2]
    for h in out["hits"]:
        assert h["source_path"] == "fused"


@pytest.mark.asyncio
async def test_search_text_embed_unavail_falls_back_to_clip_only(monkeypatch):
    from chayuan.server.image_source import text_search as ts
    _, name = _seed_store()

    async def _clip_text(q):
        v = np.zeros(512, dtype="float32"); v[2] = 1.0
        return v

    monkeypatch.setattr(ts, "_clip_embed_text", _clip_text)
    monkeypatch.setattr(ts, "_resolve_text_embed_endpoint",
                        lambda: (None, None, None))

    out = await ts.text_search(name, "山", top_k=20)
    assert "unavailable" in out["diagnostics"]["text_path"]
    assert out["diagnostics"]["image_path"] == "ok"
    assert out["hits"][0]["id"] == "img_t2"


@pytest.mark.asyncio
async def test_search_both_unavail(monkeypatch):
    from chayuan.server.image_source import text_search as ts
    _, name = _seed_store()

    async def _clip_text(q):
        raise RuntimeError("clip dead")

    monkeypatch.setattr(ts, "_clip_embed_text", _clip_text)
    monkeypatch.setattr(ts, "_resolve_text_embed_endpoint",
                        lambda: (None, None, None))

    out = await ts.text_search(name, "x", top_k=20)
    assert out["hits"] == []
    assert "unavailable" in out["diagnostics"]["text_path"]
    assert "unavailable" in out["diagnostics"]["image_path"]
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py -v`
Expected: FAIL — module `text_search` 不存在

- [ ] **Step 3: 实现 text_search.py**

```python
# libs/chayuan-server/chayuan/server/image_source/text_search.py
"""文字搜图 service:两路并行(用户默认文本向量模型 + CLIP 跨模态) + RRF 融合。"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from chayuan.server.image_source.text_embed_client import (
    EmbedResult, embed_text as _text_embed_impl,
    resolve_endpoint as _resolve_text_embed_endpoint_impl,
)
from chayuan.server.image_source.fusion import ImageHit, rrf_fuse
from chayuan.server.image_source.store import get_store

logger = logging.getLogger("chayuan.image_source.text_search")


@dataclass
class _PathResult:
    hits: List[ImageHit]
    error: Optional[str] = None


# ---- seams(可 monkeypatch) ----

async def _clip_embed_text(query: str, *, model_name: str = ""):
    """CLIP 文本编码器把 query 文本映到图像向量空间。"""
    from chayuan.server.image_source.embedder import get_embedder

    def _sync():
        emb = get_embedder(model_name) if model_name else get_embedder(None)
        return np.asarray(emb.embed_text(query), dtype="float32").reshape(-1)
    return await asyncio.to_thread(_sync)


async def _text_embed(query: str, *, base_url: str, model: str,
                      api_key: Optional[str] = None,
                      timeout: float = 30.0) -> EmbedResult:
    return await _text_embed_impl(
        query, base_url=base_url, model=model,
        api_key=api_key, timeout=timeout,
    )


def _resolve_text_embed_endpoint() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    return _resolve_text_embed_endpoint_impl()


# ---- 主流程 ----

async def text_search(
    store_name: str, query: str, *, top_k: int = 20, k_rrf: int = 60,
    source_id: int = 0, model_name: str = "",
) -> Dict[str, Any]:
    """两路文字搜图。返 {"hits": [..], "diagnostics": {..}}。"""
    store = get_store(store_name)
    diagnostics = {"text_path": "ok", "image_path": "ok"}

    text_task = asyncio.create_task(
        _run_text_vec_path(store, query, top_k, source_id)
    )
    clip_task = asyncio.create_task(
        _run_clip_text_path(store, query, top_k, source_id, model_name)
    )
    text_res, image_res = await asyncio.gather(text_task, clip_task)

    rankings: List[List[ImageHit]] = []
    if text_res.error:
        diagnostics["text_path"] = f"unavailable: {text_res.error}"
    elif text_res.hits:
        rankings.append(text_res.hits)
    if image_res.error:
        diagnostics["image_path"] = f"unavailable: {image_res.error}"
    elif image_res.hits:
        rankings.append(image_res.hits)

    if not rankings:
        return {"hits": [], "diagnostics": diagnostics}
    fused = rrf_fuse(rankings, k=k_rrf)[:top_k]
    return {
        "hits": [_hit_to_wire(h) for h in fused],
        "diagnostics": diagnostics,
    }


async def _run_text_vec_path(store, query, top_k, source_id) -> _PathResult:
    base_url, model, api_key = _resolve_text_embed_endpoint()
    if not base_url or not model:
        return _PathResult(
            hits=[],
            error="default text embedding model not configured",
        )
    res = await _text_embed(query, base_url=base_url, model=model,
                              api_key=api_key)
    if res.vector is None:
        return _PathResult(hits=[], error=res.error or "no vector")
    hits = store.search_text(res.vector, top_k=top_k)
    return _PathResult(
        hits=[_rec_to_hit(rec, score, "text_vec", source_id)
              for rec, score in hits],
    )


async def _run_clip_text_path(store, query, top_k, source_id, model_name) -> _PathResult:
    try:
        vec = await _clip_embed_text(query, model_name=model_name)
    except Exception as e:  # noqa: BLE001
        logger.info("CLIP text encode failed: %r", e)
        return _PathResult(hits=[], error=f"clip text encode failed: {e}")
    hits = store.search_image(vec, top_k=top_k)
    return _PathResult(
        hits=[_rec_to_hit(rec, score, "clip_text", source_id)
              for rec, score in hits],
    )


def _rec_to_hit(rec: Dict[str, Any], score: float, source_path: str,
                 source_id: int) -> ImageHit:
    iid = rec.get("id") or ""
    fname = rec.get("filename") or (
        os.path.basename(rec.get("path") or "") or iid
    )
    thumb = (
        f"/knowledge_source/{int(source_id)}/image/{iid}"
        if source_id else f"/{iid}"
    )
    return ImageHit(
        id=iid, filename=fname, thumbnail_url=thumb, score=float(score),
        source_path=source_path,
        ocr_snippet=(rec.get("ocr_text") or "")[:200] or None,
        has_text_vector=bool(rec.get("has_text_vector")),
        meta={
            "path": rec.get("path"),
            "md5": rec.get("md5"),
            "size_bytes": rec.get("size_bytes"),
            "created_at": rec.get("created_at"),
        },
    )


def _hit_to_wire(h: ImageHit) -> Dict[str, Any]:
    return {
        "id": h.id, "filename": h.filename,
        "thumbnail_url": h.thumbnail_url, "score": h.score,
        "source_path": h.source_path, "fused": h.fused,
        "ocr_snippet": h.ocr_snippet,
        "has_text_vector": h.has_text_vector,
        "meta": h.meta,
    }
```

- [ ] **Step 4: 加 `/search_by_text` 端点**

在 `libs/chayuan-server/chayuan/server/api_server/image_routes.py` 第 287 行(`@image_router.post("/{source_id}/image/search_by_image"` 上面)插入:

```python
@image_router.post(
    "/{source_id}/image/search_by_text",
    summary="按文字搜图(用户默认文本向量模型 + CLIP 跨模态路 RRF 融合)",
)
async def search_by_text_endpoint(
    source_id: int,
    payload: Dict[str, Any] = Body(...),
    user=Depends(require_auth_enabled()),
):
    if not can_read(user, int(source_id)):
        raise HTTPException(403, "no read permission")
    _get_source_or_404(int(source_id))
    query = str(payload.get("query") or "").strip()
    if not query:
        raise HTTPException(400, "query required")
    top_k = int(payload.get("top_k") or 20)
    k_rrf = int(payload.get("k_rrf") or 60)

    conn = _build_image_connector(int(source_id))
    from chayuan.server.image_source.text_search import text_search
    out = await text_search(
        conn.source_name, query,
        top_k=top_k, k_rrf=k_rrf,
        source_id=int(source_id),
        model_name=conn._model_name,
    )
    return {"code": 0, "data": out}
```

- [ ] **Step 5: 跑测试确认全过**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py -v`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/image_source/text_search.py \
        libs/chayuan-server/chayuan/server/api_server/image_routes.py \
        libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py
git commit -m "feat(image-kb): hybrid text→image search with RRF fusion + degradation"
```

---

## Task 9: knowledge_universe detail 端点返回新字段

**Files:**
- Modify: `libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py:396-420`

- [ ] **Step 1: 写失败测试**

```python
# libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py
"""universe detail image 子节点应返 state/progress/has_text_vector 字段。"""
from __future__ import annotations

import tempfile
import pytest


@pytest.fixture(autouse=True)
def _tmp_root(monkeypatch):
    d = tempfile.mkdtemp(prefix="chayuan_test_univ_")
    monkeypatch.setenv("CHAYUAN_ROOT", d)
    from chayuan.server.image_source import store as s
    s._STORES.clear()
    yield d


def test_universe_detail_returns_state_fields(monkeypatch):
    from chayuan.server.image_source.store import get_store
    s = get_store("univ_kb")
    s.insert_placeholder(
        item_id="img_u1", filename="x.png", mime_type="image/png",
        size_bytes=1, path="/tmp/x",
    )
    s.update("img_u1", state="ocr_and_embedding", progress=42)

    from chayuan.server.api_server import knowledge_universe_routes as kur
    monkeypatch.setattr(kur, "_resolve_store_name_for_image",
                        lambda raw: "univ_kb")

    payload = {"kind": "image", "sub_kind": "image", "ku_id": "src:7", "meta": {}}
    items = kur._image_items_for_universe(7, payload)
    assert items
    it = next(i for i in items if i["id"] == "img_u1")
    assert it["state"] == "ocr_and_embedding"
    assert it["progress"] == 42
    assert "has_text_vector" in it
```

- [ ] **Step 2: 跑测试确认失败**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py -v`
Expected: FAIL — helper 不存在

- [ ] **Step 3: 重构 knowledge_universe_routes.py image 分支**

把 `libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py` 第 396-420 行替换为:

```python
        if sub_kind == "image":
            try:
                items = _image_items_for_universe(int(raw), payload)
                payload["items"] = items
            except Exception as e:  # noqa: BLE001
                logger.warning("image source list failed: %r", e)
                payload["items"] = []
```

并在同一文件顶层(`def _source_to_universe` 上面)新增 helper:

```python
def _resolve_store_name_for_image(raw: int) -> str:
    """与 image_routes._resolve_store_name 同源。"""
    from chayuan.server.api_server.image_routes import _resolve_store_name
    return _resolve_store_name(int(raw))


def _image_items_for_universe(raw: int, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    from chayuan.server.image_source.store import get_store
    store_name = _resolve_store_name_for_image(int(raw))
    store = get_store(store_name)
    items: List[Dict[str, Any]] = []
    for m in store.list_items(200):
        img_id = m.get("id")
        items.append({
            "id": img_id,
            "url": f"/knowledge_source/{int(raw)}/image/{img_id}",
            "thumb_url": f"/knowledge_source/{int(raw)}/image/{img_id}",
            "caption": m.get("tags") or "",
            "state": m.get("state", "ready"),
            "progress": int(m.get("progress") or 0),
            "error": m.get("error"),
            "has_text_vector": bool(m.get("has_text_vector")),
            "ocr_text": (m.get("ocr_text") or "")[:200] or None,
            "meta": {
                "size_bytes": m.get("size_bytes"),
                "md5": m.get("md5"),
                "embedder_model": m.get("embedder_model"),
                "created_at": m.get("created_at"),
            },
        })
    return items
```

- [ ] **Step 4: 跑测试**

Run: `PYTHONPATH=libs/chayuan-server pytest -q libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py -v`
Expected: 1 passed

- [ ] **Step 5: 跑整批后端测试确认无回归**

Run:
```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server pytest -q \
  libs/chayuan-server/tests/unit_tests/test_image_store_schema.py \
  libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py \
  libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py \
  libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py \
  libs/chayuan-server/tests/unit_tests/test_image_pipeline.py \
  libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py \
  libs/chayuan-server/tests/unit_tests/test_image_fusion.py \
  libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py \
  libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py
```
Expected: 30 passed (6+2+3+3+4+4+4+3+1 — 实际以测试数为准)

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop/chayuan-server
git add libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py \
        libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py
git commit -m "feat(image-kb): universe detail surfaces state/progress/has_text_vector"
```

---

## Task 10: 前端 API 客户端扩展

**Files:**
- Modify: `chayuan-client/packages/api/src/kbUniverse.ts`

- [ ] **Step 1: 读现有 imageSource 定义**

Run: `grep -n "imageSource\|searchByImage\|upload" /work/chayuan-desktop/chayuan-client/packages/api/src/kbUniverse.ts | head -30`
确认现有 ts 类型/方法签名,本任务扩展不破坏。

- [ ] **Step 2: 在 kbUniverse.ts 加类型 + 方法**

在文件中找到 `imageSource` 命名空间或对象,在其类型定义处加:

```ts
export type ImageItemState =
  | "queued"
  | "ocr_and_embedding"
  | "ready"
  | "failed";

export interface ImageItem {
  filename: string;
  image_id: string;
  path: string;
  state: ImageItemState;
  progress: number;
  error: string | null;
  has_text_vector: boolean;
  ocr_text: string | null;
  preview_url: string;
  vector_status: string;
}

export interface ImageItemStatus {
  id: string;
  state: ImageItemState;
  progress: number;
  error: string | null;
  has_text_vector: boolean;
  ocr_text: string | null;
}

export interface ImageHit {
  id: string;
  filename: string;
  thumbnail_url: string;
  score: number;
  source_path: "text_vec" | "clip_text" | "clip_image" | "fused";
  fused: boolean;
  ocr_snippet: string | null;
  has_text_vector: boolean;
  meta: Record<string, unknown>;
}

export interface ImageSearchDiagnostics {
  text_path: string;
  image_path: string;
}

export interface ImageSearchResponse {
  hits: ImageHit[];
  diagnostics: ImageSearchDiagnostics;
}
```

在 `imageSource` 对象/类的方法集合里追加:

```ts
async itemStatus(sourceId: number, imageId: string): Promise<ImageItemStatus> {
  const resp = await api.get(
    `/knowledge_source/${sourceId}/image/${encodeURIComponent(imageId)}/status`,
  );
  return resp.data as ImageItemStatus;
},

async searchByText(
  sourceId: number,
  query: string,
  topK = 20,
): Promise<ImageSearchResponse> {
  const resp = await api.post(
    `/knowledge_source/${sourceId}/image/search_by_text`,
    { query, top_k: topK },
  );
  return resp.data as ImageSearchResponse;
},
```

(`api` 是文件内现有的 axios/fetch 客户端 — 跟随文件原本风格。)

- [ ] **Step 3: 跑 typecheck**

Run:
```bash
cd /work/chayuan-desktop/chayuan-client
npm run typecheck
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop/chayuan-client
git add packages/api/src/kbUniverse.ts
git commit -m "feat(image-kb): extend imageSource API with itemStatus + searchByText"
```

---

## Task 11: 前端占位卡片 + 轮询

**Files:**
- Modify: `chayuan-client/packages/app/src/features/kb/detail/ImageKbDetail.tsx`

- [ ] **Step 1: 读现有 ImageKbDetail.tsx**

Run: `wc -l /work/chayuan-desktop/chayuan-client/packages/app/src/features/kb/detail/ImageKbDetail.tsx`
预期 ~420 行,主体含 grid / upload / search。

- [ ] **Step 2: 在 import 区加新类型**

```tsx
import {
  imageSource,
  type ImageItem,
  type ImageItemStatus,
  type ImageHit,
  type ImageSearchResponse,
} from "@chayuan/api/kbUniverse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
```

- [ ] **Step 3: upload 后立即写缓存**

定位现有 upload `mutation` / `onSuccess`,把返回的 `items` 立即合并到列表 query 缓存:

```tsx
const queryClient = useQueryClient();
const listQueryKey = ["image-kb-items", sourceId] as const;

const uploadMutation = useMutation({
  mutationFn: (files: File[]) => imageSource.upload(sourceId, files),
  onSuccess: (resp) => {
    const newItems = resp?.data?.added ?? [];
    queryClient.setQueryData<{ items: ImageItem[] } | undefined>(
      listQueryKey,
      (old) => {
        const existing = old?.items ?? [];
        const existingIds = new Set(existing.map((i) => i.image_id));
        const merged = [
          ...existing,
          ...newItems.filter((n: ImageItem) => !existingIds.has(n.image_id)),
        ];
        return { items: merged };
      },
    );
  },
});
```

- [ ] **Step 4: 加聚合轮询**

在主组件函数体里:

```tsx
const items = (listQuery.data?.items ?? []) as ImageItem[];
const pendingIds = items
  .filter((i) => i.state !== "ready" && i.state !== "failed")
  .map((i) => i.image_id);
const pendingKey = pendingIds.slice().sort().join(",");

useQuery({
  queryKey: ["image-kb-status", sourceId, pendingKey],
  queryFn: async () => {
    const statuses = await Promise.all(
      pendingIds.map((id) => imageSource.itemStatus(sourceId, id)),
    );
    queryClient.setQueryData<{ items: ImageItem[] } | undefined>(
      listQueryKey,
      (old) => {
        if (!old) return old;
        const byId = new Map(statuses.map((s) => [s.id, s]));
        const next = old.items.map((it) => {
          const s = byId.get(it.image_id);
          if (!s) return it;
          return {
            ...it,
            state: s.state,
            progress: s.progress,
            error: s.error,
            has_text_vector: s.has_text_vector,
            ocr_text: s.ocr_text,
          };
        });
        return { items: next };
      },
    );
    return statuses;
  },
  enabled: pendingIds.length > 0,
  refetchInterval: 2500,
});
```

- [ ] **Step 5: 卡片状态可视化**

在渲染单卡片的地方,根据 state 加 badge / progress bar(沿用现有 UI 组件库,常见 `<Badge>` `<Progress>`):

```tsx
{item.state === "queued" && (
  <Badge variant="secondary">排队中</Badge>
)}
{item.state === "ocr_and_embedding" && (
  <div className="flex flex-col gap-1">
    <Progress value={item.progress} />
    <span className="text-xs text-muted-foreground">
      {item.progress < 70 ? "视觉向量化中" :
       item.progress < 95 ? "OCR 提取中" :
       "文本向量化中"}
    </span>
  </div>
)}
{item.state === "failed" && (
  <Badge variant="destructive" title={item.error ?? ""}>失败</Badge>
)}
{item.state === "ready" && item.ocr_text && (
  <Badge variant="outline" title={item.ocr_text}>含文字</Badge>
)}
{item.state === "ready" && !item.has_text_vector && (
  <Badge
    variant="outline"
    title="默认文本向量模型未就绪,本图仅按视觉检索"
  >仅图搜</Badge>
)}
```

- [ ] **Step 6: 跑 typecheck + dev server smoke test**

```bash
cd /work/chayuan-desktop/chayuan-client
npm run typecheck
```
Expected: 0 errors。

Dev server 烟测(手动):
1. `pnpm dev:web`(或 chayuan-desktop 启动脚本)
2. 打开图像 KB 详情页
3. 上传一张图,确认 grid 立即显示带 spinner 的占位卡
4. 等 ~5-15s,卡片切到 ready
5. 刷新页面,item 仍在(验证 Task 2 bug 已修)

- [ ] **Step 7: Commit**

```bash
cd /work/chayuan-desktop/chayuan-client
git add packages/app/src/features/kb/detail/ImageKbDetail.tsx
git commit -m "feat(image-kb): placeholder cards + status polling + state badges"
```

---

## Task 12: 前端双模式搜索 tab + diagnostics banner

**Files:**
- Modify: `chayuan-client/packages/app/src/features/kb/detail/ImageKbDetail.tsx`

- [ ] **Step 1: 找到现有搜索 UI**

文件里现已有 search-by-image。引入 Tabs / 双输入框,默认 tab = "text"。

- [ ] **Step 2: 加搜索 state + 双 mutation**

```tsx
const [searchMode, setSearchMode] = useState<"text" | "image">("text");
const [textQuery, setTextQuery] = useState("");
const [textResult, setTextResult] = useState<ImageSearchResponse | null>(null);

const searchByTextMutation = useMutation({
  mutationFn: (q: string) => imageSource.searchByText(sourceId, q, 20),
  onSuccess: (data) => setTextResult(data),
});
```

- [ ] **Step 3: 渲染 tab 切换 + 输入 + diagnostics banner**

```tsx
<Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as "text" | "image")}>
  <TabsList>
    <TabsTrigger value="text">按文字搜索</TabsTrigger>
    <TabsTrigger value="image">按图搜索</TabsTrigger>
  </TabsList>
  <TabsContent value="text">
    <div className="flex gap-2">
      <Input
        value={textQuery}
        onChange={(e) => setTextQuery(e.target.value)}
        placeholder="例如:发票 2024 / 红色汽车 / 山水画"
      />
      <Button
        onClick={() => searchByTextMutation.mutate(textQuery)}
        disabled={!textQuery.trim() || searchByTextMutation.isPending}
      >搜索</Button>
    </div>
    {textResult && (
      <>
        {(textResult.diagnostics.text_path !== "ok" ||
          textResult.diagnostics.image_path !== "ok") && (
          <Alert variant="default" className="mt-2">
            <AlertDescription>
              {textResult.diagnostics.text_path !== "ok" &&
                `文本向量路不可用(${textResult.diagnostics.text_path})。`}
              {textResult.diagnostics.image_path !== "ok" &&
                `视觉跨模态路不可用(${textResult.diagnostics.image_path})。`}
              本次结果可能不完整。
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-4 gap-2 mt-2">
          {textResult.hits.map((h) => (
            <div key={h.id} className="relative">
              <img src={h.thumbnail_url} alt={h.filename}
                   className="w-full aspect-square object-cover rounded" />
              <Badge className="absolute top-1 left-1"
                     variant="secondary">
                {h.source_path === "fused" ? "融合" :
                 h.source_path === "text_vec" ? "文本" :
                 h.source_path === "clip_text" ? "视觉" : "图"}
              </Badge>
              {h.ocr_snippet && (
                <div className="text-xs mt-1 line-clamp-2"
                     title={h.ocr_snippet}>
                  {h.ocr_snippet}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    )}
  </TabsContent>
  <TabsContent value="image">
    {/* 保留现有 search-by-image UI 原样 */}
  </TabsContent>
</Tabs>
```

- [ ] **Step 4: 跑 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
npm run typecheck
```
Expected: 0 errors

- [ ] **Step 5: 手动验收**

1. 启动后端 + 桌面端
2. 上传 3-5 张包含不同文字的图(发票截图、海报、纯风景)
3. 等所有 ready
4. 按文字"发票"搜 → 含发票文字的图分数高
5. 按文字"风景"搜 → 风景图(无文字,纯 CLIP 跨模态)分数高
6. 关掉默认文本向量模型 sidecar,重新搜 → banner 显示 "文本向量路不可用"
7. 切到"按图搜索" → 现有功能不变

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop/chayuan-client
git add packages/app/src/features/kb/detail/ImageKbDetail.tsx
git commit -m "feat(image-kb): dual-mode search UI with RRF results + diagnostics banner"
```

---

## 收尾

- [ ] **后端整体 smoke**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python -m py_compile \
  libs/chayuan-server/chayuan/server/image_source/store.py \
  libs/chayuan-server/chayuan/server/image_source/connector.py \
  libs/chayuan-server/chayuan/server/image_source/ocr_client.py \
  libs/chayuan-server/chayuan.server.image_source.text_embed_client.py \
  libs/chayuan-server/chayuan/server/image_source/pipeline.py \
  libs/chayuan-server/chayuan/server/image_source/fusion.py \
  libs/chayuan-server/chayuan/server/image_source/text_search.py \
  libs/chayuan-server/chayuan/server/api_server/image_routes.py \
  libs/chayuan-server/chayuan/server/api_server/knowledge_universe_routes.py
```
Expected: 0 输出(语法 OK)

- [ ] **前端 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
npm run typecheck
```
Expected: 0 errors

- [ ] **git status 三仓库核对**

```bash
git -C /work/chayuan-desktop/chayuan-server status --short
git -C /work/chayuan-desktop/chayuan-client status --short
```
Expected: 工作区干净(所有改动已 commit)

- [ ] **不要 push**:本任务 CLAUDE.md 要求"只有在用户明确要求 push 或当前任务明确声明 auto-push=true 时,才 push"。完成后等用户确认。

---

## 验收对照(覆盖 spec 目标)

| Spec 目标 | 实现 Task |
|---|---|
| G1 修复刷新消失 bug | Task 2 |
| G2 上传后立即显示 + 进度 | Task 6(后端占位)+ Task 11(前端占位 + 轮询) |
| G3 OCR 文本识别 | Task 3 + Task 5 |
| G4 文字搜图 RRF 融合 | Task 4 + Task 7 + Task 8 + Task 12 |
| G5 按图搜索保持 | 无改动(回归:Task 9 测试覆盖列表显示) |
| G6 子能力降级 | Task 5 / Task 8 软降级路径 |

## 风险与缓解

- **pytest-asyncio 未配**:若 `tests/conftest.py` 没设 `asyncio_mode = auto`,async 测试不执行。Task 5 Step 4 显式检查。
- **BackgroundTasks 没 await**:FastAPI 在请求返回后调度 BackgroundTasks。单测里我们 stub 掉 `add_task` 不真跑,集成测试需要别的策略(本 plan 不覆盖集成测试)。
- **frontend 现有 UI 组件命名**:`<Tabs/>` `<Badge/>` `<Progress/>` `<Alert/>` 等需匹配现有 design system 实际命名,Task 11/12 实施时按文件 import 区现有组件用法替换。
