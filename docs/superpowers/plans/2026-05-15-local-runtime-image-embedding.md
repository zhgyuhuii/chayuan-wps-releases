# 本地 Runtime Image Embedding 实施计划 (Plan 3D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SidecarRuntimeManager` 加第 3 个 engine `'infinity'`,通过 `sys.executable + -m chayuan.server.image_source.infinity_server` 拉 Python sidecar(不需 vendor 二进制),`LocalRuntimeRegistry` 加第 5 个 capability `image-embedding`(port_offset=4,端口 62586);新建 `infinity_server.py` HTTP wrapper 内部用现有 image_source loader 包装,端点 `POST /embeddings` 兼容 michaelf34/infinity 协议;`image_source.embedder.get_embedder()` 改 sidecar 首选 + in-process fallback。

**Architecture:** 复用 Plan 3C 的 SidecarRuntimeManager 主流程,仅在 `find_server_exe` / `_resolve_args_for` 加 infinity 分支(spawn Python module 而非二进制);infinity_server.py 跟 Plan 1 的 funasr_server.py 同套路用 `_runtime_server_base.make_runtime_app`;facade `get_embedder` 顶部插 sidecar 优先探测,在现有 `_try_http_backed_embedder` 之前;PyInstaller frozen 模式作为 known risk,fallback in-process 兜底。

**Tech Stack:** Python 3.10+,FastAPI,uvicorn,httpx,pytest,TypeScript / React,zustand,michaelf34/infinity-0.0.75+ 协议(自 wrap)。

**Spec 关联:** `docs/superpowers/specs/2026-05-15-local-runtime-image-embedding-design.md` (commit `8f96696`)

**Plan 1+2+3A+3B+3C 关联:** 已 ship 的 105 commits 全保留,Plan 3C `SidecarRuntimeManager(engine, capability, port_offset)` 接口零改动。

---

## File Structure

### 新建文件

| 文件 | 责任 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/image_source/infinity_server.py` | Python sidecar HTTP wrapper,复用 `_runtime_server_base` |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py` | `resolve_infinity_args` 单测(~3 case) |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_infinity_server.py` | `infinity_server.py` 端点 contract 测试(~3 case) |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py` | `get_embedder` sidecar 优先 + fallback 测试(~3 case) |

### 修改文件

| 文件 | 改什么 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py` | 新增 `resolve_infinity_args(capability='image-embedding')` + 模块常量 |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` | `SidecarRuntimeManager.find_server_exe` 加 infinity 分支(返 sys.executable);`_resolve_args_for` 加 infinity 分支 |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py` | `CAPABILITIES` 扩 5 项,`_CAP_ENGINE` 加 image-embedding→infinity |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` (LocalRuntimeSettings) | 加 `preload_image_embedding: bool = False` + `default_image_embedding_model: str = ""` |
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` | `_VALID_CAPABILITIES` 加 `'image-embedding'` |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py` | `preload_map` 加 image-embedding |
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py` | `run_all_checks` 加第 14 项 `runtime.llama.image-embedding.status` |
| `chayuan-server/libs/chayuan-server/chayuan/server/image_source/embedder.py` | `get_embedder` 顶部加 sidecar 优先探测 + 抽 `_get_inproc_embedder` |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py` | 加 SidecarRuntimeManager(engine='infinity') / find_server_exe sys.executable / _resolve_args_for infinity 派发测试 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py` | CAPABILITIES 5 项测试 + image-embedding engine='infinity' port_offset=4 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py` | fixture 加 image-embedding manager + 2 个新路由测试 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py` | run_all_checks 长度 13→14 + asr-ready style 加 image-embedding ready case |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py` | 长度断言 13→14 |
| `chayuan-client/packages/api/src/localRuntime.ts` | `LocalRuntimeCapability` 加 `'image-embedding'` |
| `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts` | 加 3 个 image-embedding 路由契约测试 |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx` | `CAPABILITY_LABEL` 加 `'image-embedding': '图像嵌入'` |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx` | capability 数组 4 项 → 5 项 |
| `chayuan-client/packages/app/src/store/localRuntime.ts` | `statuses` / `pendingFor` 初始 4 项 → 5 项 |
| `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts` | mock 数据同步加 image-embedding 项 |
| `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx` | localCap mapping 加 image-embedding |
| `docs/RUNBOOK-local-runtime-diagnose.md` | 加 image-embedding 排错条目 + 5 cards UI 描述 |

---

## Sprint 5D-1: 后端 sidecar 基础 (Task 1-7)

### Task 1: `resolve_infinity_args` + 测试

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py`

- [ ] **Step 1: 写测试**

新建 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py`:

```python
"""resolve_infinity_args 分支测试 (Plan 3D)。"""
from __future__ import annotations

import pytest

from chayuan.server.model_registry import process_args


def _fake_entry(model_id, fmt, path):
    return type("Entry", (), {
        "model_id": model_id,
        "format": fmt,
        "path": path,
        "capability": "image",
    })()


def test_resolve_infinity_args_image_embedding_default(monkeypatch):
    """capability=image-embedding(默认)走 image default,args 含 -m + 模块名 + --model。"""
    e = _fake_entry("openai/clip-vit-base-patch32", "transformers", "/tmp/clip")
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_infinity_args()
    assert r.process == "infinity"
    assert "-m" in r.args
    assert "chayuan.server.image_source.infinity_server" in r.args
    assert "--model" in r.args
    assert "openai/clip-vit-base-patch32" in r.args
    assert r.resolved_models["image-embedding"] == "openai/clip-vit-base-patch32"


def test_resolve_infinity_args_unknown_capability_raises():
    """非 image-embedding 的 capability 抛 ValueError。"""
    with pytest.raises(ValueError, match="capability"):
        process_args.resolve_infinity_args(capability="chat")  # type: ignore[arg-type]


def test_resolve_infinity_args_missing_model_reports_image_embedding(monkeypatch):
    """模型未解到时 missing 列表里是 'image-embedding'(不是硬编码 chat)。"""
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (None, "no image candidate"))
    r = process_args.resolve_infinity_args()
    assert "image-embedding" in r.missing
    assert r.reason == "no image candidate"
```

- [ ] **Step 2: 跑测试,确认 3 fail**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py -v
```

Expected: 3 fail(AttributeError: no attribute 'resolve_infinity_args')。

- [ ] **Step 3: 加 resolve_infinity_args 到 process_args.py**

打开 `process_args.py`,在 `resolve_whisper_args` 函数(Plan 3C 加的)之后追加:

```python
_INFINITY_CAPABILITIES = ("image-embedding",)
_INFINITY_LOCAL_CAP_MAP = {
    "image-embedding": "image",
}


def resolve_infinity_args(
    *,
    capability: str = "image-embedding",
    n_threads: Optional[int] = None,
) -> Resolution:
    """``infinity_server`` (Python sidecar) 启动 args。

    capability:
      * ``image-embedding`` → image default + transformers / safetensors 模型 + --model
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

    # Python sidecar: 用 `-m <module>` 而非 binary 直跑
    r.args.extend([
        "-m", "chayuan.server.image_source.infinity_server",
        "--model", entry.model_id,
    ])
    if n_threads is not None:
        r.args.extend(["--threads", str(int(n_threads))])
    r.resolved_models[capability] = entry.model_id
    r.reason = reason
    return r
```

也在 `__all__`(如有)加上 `'resolve_infinity_args'`。

- [ ] **Step 4: 跑测试,确认 3 passed**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py -v
```

- [ ] **Step 5: 跑 Plan 3B/3C 现有 process_args 测试确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_capability.py libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py -v 2>&1 | tail -5
```

Expected: 9 passed(Plan 3B 5 + Plan 3C 4)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py
git commit -m "feat(process_args): resolve_infinity_args + image-embedding capability (Plan 3D)"
```

---

### Task 2: `find_server_exe` 加 infinity 分支(返 sys.executable)

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

在 `test_local_runtime.py` 末尾追加:

```python
def test_find_server_exe_infinity_engine_returns_python(tmp_path, monkeypatch):
    """engine='infinity' find_server_exe 返 sys.executable(Python 解释器)。"""
    import sys
    from chayuan.server.model_registry.local_runtime import SidecarRuntimeManager
    m = SidecarRuntimeManager(
        chayuan_root=tmp_path, engine="infinity", capability="image-embedding", port_offset=4
    )
    exe = m.find_server_exe()
    assert exe is not None
    assert exe == Path(sys.executable)


def test_find_server_exe_infinity_not_affected_by_install_dirs(tmp_path, monkeypatch):
    """engine='infinity' 不查 _INSTALL_SERVICES_DIRS,直接用 sys.executable。"""
    from chayuan.server.model_registry import local_runtime as lr
    # 即使 install dirs 为空,infinity 也能返 python.exe
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "nonexistent"])
    m = lr.SidecarRuntimeManager(chayuan_root=tmp_path, engine="infinity", port_offset=4)
    exe = m.find_server_exe()
    assert exe is not None  # 不该返 None(sys.executable 始终存在)
```

注意:如果文件顶部还没 import `Path`,从 pathlib import(Plan 1 通常已有)。

- [ ] **Step 2: 跑测试,确认 2 fail(目前 engine='infinity' 仍走 binary 查找路径返 None)**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "infinity_engine_returns_python or infinity_not_affected_by_install_dirs"
```

- [ ] **Step 3: 改 find_server_exe**

打开 `local_runtime.py`,找到 `def find_server_exe(self)`(Plan 3C 已改造)。在方法体开头加 infinity 分支:

```python
    def find_server_exe(self) -> Optional[Path]:
        """在 install 目录树里找 sidecar binary。

        Plan 3C 起按 self.engine 选 binary:
          * engine='llama'     → 子目录 services/llama-server/,binary llama-server[.exe]
          * engine='whisper'   → 子目录 services/whisper-server/,binary whisper-server[.exe]
          * engine='infinity'  → Python 解释器 sys.executable(Python -m 拉 sidecar)
        """
        import sys as _sys  # noqa
        if self.engine == "infinity":
            # Python sidecar:直接用当前解释器拉 `-m chayuan.server.image_source.infinity_server`
            return Path(_sys.executable)

        # Plan 3B/3C 原有逻辑(查 vendor/services/{engine}-server/)
        global _INSTALL_SERVICES_DIRS
        dirs = _INSTALL_SERVICES_DIRS if _INSTALL_SERVICES_DIRS is not None else _default_install_services_dirs()
        bin_name = f"{self.engine}-server"
        names = [f"{bin_name}.exe", bin_name]
        # ... (Plan 3C 已有,保留所有跨平台查找逻辑)
```

如果 `sys` 已在文件顶部 import,直接用顶部的;否则方法体内 `import sys`。看现有顶部 import 决定。

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "find_server_exe" 2>&1 | tail -10
```

Expected: Plan 3C find_server_exe 4 个测试 + 2 新 = 6 passed。

- [ ] **Step 5: 跑全套 local_runtime 测试无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -q 2>&1 | tail -3
```

Expected: 全过(Plan 3C 39 + 2 新 = 41 估)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): find_server_exe(engine='infinity') 返 sys.executable (Plan 3D)"
```

---

### Task 3: `_resolve_args_for` 加 infinity 分支

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

在 `test_local_runtime.py` 末尾追加:

```python
@pytest.mark.asyncio
async def test_sidecar_infinity_start_uses_infinity_resolver(tmp_path, monkeypatch):
    """engine='infinity' 启动时调 resolve_infinity_args(capability='image-embedding')。"""
    from chayuan.server.model_registry import local_runtime as lr
    from chayuan.server.model_registry import process_args

    captured = []

    def fake_infinity_resolve(**kw):
        captured.append(("infinity", kw.get("capability", "<missing>")))
        return process_args.Resolution(
            process="infinity",
            args=["-m", "chayuan.server.image_source.infinity_server", "--model", "siglip2-base"],
            resolved_models={"image-embedding": "siglip2-base"},
        )

    monkeypatch.setattr(lr.process_args, "resolve_infinity_args", fake_infinity_resolve)

    fake_proc = mock.MagicMock(pid=555, poll=mock.MagicMock(return_value=None))
    monkeypatch.setattr(lr.subprocess, "Popen", mock.MagicMock(return_value=fake_proc))
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(lr, "_probe_health", fake_health)

    m = lr.SidecarRuntimeManager(
        chayuan_root=tmp_path, engine="infinity", capability="image-embedding", port_offset=4
    )
    status = await m.start()
    assert status.state == "ready"
    assert captured == [("infinity", "image-embedding")]
```

- [ ] **Step 2: 跑测试,确认 1 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "infinity_start_uses_infinity_resolver"
```

Expected: fail with `ValueError: Unknown engine: 'infinity'`(Plan 3C _resolve_args_for 只认 llama/whisper)。

- [ ] **Step 3: 改 _resolve_args_for**

打开 `local_runtime.py`,找到 Plan 3C 加的 `_resolve_args_for` 函数:

```python
def _resolve_args_for(
    capability: str,
    *,
    engine: str = "llama",
    n_ctx: int | None = None,
    n_threads: int | None = None,
):
    """调对应 engine 的 process_args.resolve_*,返回 (resolution, model_path)。"""
    if engine == "llama":
        ... (Plan 3B 已有)
    elif engine == "whisper":
        ... (Plan 3C 已有)
    else:
        raise ValueError(f"Unknown engine: {engine!r}")
    ...
```

加 infinity 分支(在 whisper 之后,else 之前):

```python
def _resolve_args_for(
    capability: str,
    *,
    engine: str = "llama",
    n_ctx: int | None = None,
    n_threads: int | None = None,
):
    """调对应 engine 的 process_args.resolve_*,返回 (resolution, model_path)。

    Plan 3D 起 engine 派发:
      * engine='llama'     → resolve_llamacpp_args(透传 n_ctx/n_threads)
      * engine='whisper'   → resolve_whisper_args(透传 n_threads)
      * engine='infinity'  → resolve_infinity_args(透传 n_threads)
    """
    if engine == "llama":
        kwargs: dict = {"capability": capability}
        if n_ctx is not None:
            kwargs["n_ctx"] = n_ctx
        if n_threads is not None:
            kwargs["n_threads"] = n_threads
        r = process_args.resolve_llamacpp_args(**kwargs)
    elif engine == "whisper":
        kwargs = {"capability": capability}
        if n_threads is not None:
            kwargs["n_threads"] = n_threads
        r = process_args.resolve_whisper_args(**kwargs)
    elif engine == "infinity":
        kwargs = {"capability": capability}
        if n_threads is not None:
            kwargs["n_threads"] = n_threads
        r = process_args.resolve_infinity_args(**kwargs)
    else:
        raise ValueError(f"Unknown engine: {engine!r}")

    if r.missing:
        return r, None
    try:
        i = r.args.index("--model")
        return r, r.args[i + 1]
    except (ValueError, IndexError):
        return r, None
```

(注:Plan 3C 已有 `_resolve_chat_args` alias 不动。)

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v 2>&1 | tail -10
```

Expected: 42 passed(41 + 1 新)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): _resolve_args_for 加 infinity 分支 (Plan 3D)"
```

---

### Task 4: `LocalRuntimeRegistry` 加 image-embedding capability

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py`

- [ ] **Step 1: 改测试 4-cap → 5-cap**

打开 `test_local_runtime_registry.py`。把 Plan 3C 的 `test_registry_constructs_four_managers` 和 `test_registry_all_statuses_four_caps` **删掉**,新加 5-cap 版:

```python
def test_registry_constructs_five_managers(tmp_path):
    """Plan 3D: registry 含 chat/embedding/rerank/asr/image-embedding 5 个 manager。"""
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    assert set(reg._managers.keys()) == {"chat", "embedding", "rerank", "asr", "image-embedding"}
    assert reg.get("chat").engine == "llama"
    assert reg.get("chat").port_offset == 0
    assert reg.get("embedding").engine == "llama"
    assert reg.get("embedding").port_offset == 1
    assert reg.get("rerank").engine == "llama"
    assert reg.get("rerank").port_offset == 2
    assert reg.get("asr").engine == "whisper"
    assert reg.get("asr").port_offset == 3
    assert reg.get("image-embedding").engine == "infinity"
    assert reg.get("image-embedding").port_offset == 4


def test_registry_all_statuses_five_caps(tmp_path):
    """all_statuses() 返 5 项,image-embedding 初始 stopped。"""
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    sts = reg.all_statuses()
    assert set(sts.keys()) == {"chat", "embedding", "rerank", "asr", "image-embedding"}
    for cap, st in sts.items():
        assert st.state == "stopped"
```

其它 4 个 registry 测试(get_unknown_raises / stop_all_calls_each_stop / stop_all_continues_when_one_raises / get_registry_singleton)保留不动。

- [ ] **Step 2: 跑测试,确认 2 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py -v 2>&1 | tail -10
```

- [ ] **Step 3: 改 LocalRuntimeRegistry**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py`,找到 Plan 3C 加的 `_CAP_ENGINE` 和 `CAPABILITIES`:

```python
_CAP_ENGINE: Dict[str, str] = {
    "chat": "llama",
    "embedding": "llama",
    "rerank": "llama",
    "asr": "whisper",
}


class LocalRuntimeRegistry:
    CAPABILITIES = ("chat", "embedding", "rerank", "asr")
    ...
```

改成:

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

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py -v
```

Expected: 6 passed(Plan 3C 6 - 2 替换 + 2 新 = 6)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py
git commit -m "feat(registry): LocalRuntimeRegistry 加 image-embedding (engine='infinity') (Plan 3D)"
```

---

### Task 5: 路由 `_VALID_CAPABILITIES` 加 image-embedding

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py`

- [ ] **Step 1: 改 fixture + 加 image-embedding 测试**

打开 `test_runtime_routes_llama_multi_cap.py`,把 fixture 的 `caps = ("chat", "embedding", "rerank", "asr")` 改成 `caps = ("chat", "embedding", "rerank", "asr", "image-embedding")`。

把 `test_llama_registry_returns_four_caps` 改名 + 断言改 5:

```python
def test_llama_registry_returns_five_caps(client):
    c, _ = client
    r = c.get("/runtime/llama/registry")
    assert r.status_code == 200
    data = r.json()["data"]
    assert set(data.keys()) == {"chat", "embedding", "rerank", "asr", "image-embedding"}
```

文件末尾追加 2 个 image-embedding 测试:

```python
def test_llama_capability_status_image_embedding(client):
    c, fms = client
    fms["image-embedding"].status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62586", pid=88)
    r = c.get("/runtime/llama/image-embedding/status")
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "ready"
    assert r.json()["data"]["endpoint"] == "http://127.0.0.1:62586"


def test_llama_capability_start_image_embedding(client):
    c, fms = client
    r = c.post("/runtime/llama/image-embedding/start")
    assert r.status_code == 200
    fms["image-embedding"].start.assert_awaited_once()
    fms["chat"].start.assert_not_called()
```

- [ ] **Step 2: 跑测试,确认 image-embedding 路由 400**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py -v 2>&1 | tail -10
```

Expected: 2 个新测试 fail(404 或 400)。

- [ ] **Step 3: 改 runtime_routes.py**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`,找到 Plan 3C 加的:

```python
_VALID_CAPABILITIES = {"chat", "embedding", "rerank", "asr"}
```

改成:

```python
_VALID_CAPABILITIES = {"chat", "embedding", "rerank", "asr", "image-embedding"}
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py -v 2>&1 | tail -10
```

Expected: 11 passed(Plan 3C 9 + 2 新)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py
git commit -m "feat(api): _VALID_CAPABILITIES 加 image-embedding (Plan 3D)"
```

---

### Task 6: `LocalRuntimeSettings` 加 preload_image_embedding + default_image_embedding_model

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

在 `test_local_runtime.py` 末尾追加:

```python
def test_local_runtime_settings_image_embedding_fields_defaults():
    """Plan 3D: preload_image_embedding / default_image_embedding_model 默认值。"""
    s = LocalRuntimeSettings()
    assert s.preload_image_embedding is False
    assert s.default_image_embedding_model == ""


def test_local_runtime_settings_image_embedding_round_trip(tmp_path):
    """Plan 3D: image-embedding 字段 yaml round-trip。"""
    yaml_path = tmp_path / "lr.yaml"
    s = LocalRuntimeSettings(
        preload_image_embedding=True,
        default_image_embedding_model="siglip2-base",
    )
    s.save(yaml_path)
    s2 = LocalRuntimeSettings.load(yaml_path)
    assert s2.preload_image_embedding is True
    assert s2.default_image_embedding_model == "siglip2-base"


def test_local_runtime_settings_old_yaml_no_image_embedding_field(tmp_path):
    """Plan 3C 写的 yaml(无 image-embedding 字段)加载时取默认值。"""
    yaml_path = tmp_path / "lr.yaml"
    yaml_path.write_text(
        "preload_on_startup: true\nhost: 127.0.0.1\nport: 62582\n"
        "preload_embedding: false\npreload_rerank: false\npreload_asr: false\n",
        encoding="utf-8",
    )
    s = LocalRuntimeSettings.load(yaml_path)
    assert s.preload_image_embedding is False
    assert s.default_image_embedding_model == ""
```

- [ ] **Step 2: 跑测试,确认 3 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "image_embedding_fields_defaults or image_embedding_round_trip or old_yaml_no_image_embedding_field"
```

- [ ] **Step 3: 加 2 字段到 LocalRuntimeSettings**

打开 `local_runtime.py`,找到 LocalRuntimeSettings dataclass,末尾追加:

```python
@dataclasses.dataclass
class LocalRuntimeSettings:
    """本地 runtime 用户可配项,持久化到 local_runtime.yaml"""
    preload_on_startup: bool = True
    host: str = "127.0.0.1"
    port: int = 62582
    api_key: str = ""
    expose_lan: bool = False
    default_chat_model: str = ""
    # Plan 3B 多 capability:
    preload_embedding: bool = False
    preload_rerank: bool = False
    default_embedding_model: str = ""
    default_rerank_model: str = ""
    # Plan 3C ASR:
    preload_asr: bool = False
    default_asr_model: str = ""
    # Plan 3D 图像嵌入:
    preload_image_embedding: bool = False
    default_image_embedding_model: str = ""
```

(load/save 的过滤未知 key 机制 Plan 1 已有,旧 yaml 兼容。)

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v 2>&1 | tail -5
```

Expected: 45 passed(42 + 3 新)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): LocalRuntimeSettings 加 preload_image_embedding + default_image_embedding_model (Plan 3D)"
```

---

### Task 7: first_launch + diagnose 接 image-embedding

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py`

- [ ] **Step 1: 改 first_launch preload_map**

打开 `first_launch.py`,找到 Plan 3C 加的 preload_map:

```python
            preload_map = {
                "chat": settings.preload_on_startup,
                "embedding": settings.preload_embedding,
                "rerank": settings.preload_rerank,
                "asr": settings.preload_asr,
            }
```

加 image-embedding 一行:

```python
            preload_map = {
                "chat": settings.preload_on_startup,
                "embedding": settings.preload_embedding,
                "rerank": settings.preload_rerank,
                "asr": settings.preload_asr,
                "image-embedding": settings.preload_image_embedding,
            }
```

- [ ] **Step 2: 改 diagnose run_all_checks 加 image-embedding check**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`,找到 Plan 3C 末尾:

```python
        _checks._safe_call("runtime.llama.chat.status", ...),
        _checks._safe_call("runtime.llama.embedding.status", ...),
        _checks._safe_call("runtime.llama.rerank.status", ...),
        _checks._safe_call("runtime.llama.asr.status",
                           lambda: _checks.check_runtime_llama_status_for("asr")),
    ]
```

加 image-embedding:

```python
        _checks._safe_call("runtime.llama.chat.status", ...),
        _checks._safe_call("runtime.llama.embedding.status", ...),
        _checks._safe_call("runtime.llama.rerank.status", ...),
        _checks._safe_call("runtime.llama.asr.status",
                           lambda: _checks.check_runtime_llama_status_for("asr")),
        _checks._safe_call("runtime.llama.image-embedding.status",
                           lambda: _checks.check_runtime_llama_status_for("image-embedding")),
    ]
```

- [ ] **Step 3: 改测试断言长度 13→14**

打开 `test_diagnose_checks.py`,找到 `test_run_all_checks_returns_report_with_summary`,把:

```python
    assert len(report.checks) == 13  # Plan 3C
    ...
    assert s["ok"] + s["warn"] + s["fail"] == 13
```

改成 14。

加 asr-ready style 的 image-embedding ready case 测试,在 `test_check_runtime_llama_status_for_asr_ready` 之后:

```python
def test_check_runtime_llama_status_for_image_embedding_ready(monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status_for
    from chayuan.server.model_registry import local_runtime as lr
    _patch_registry_status(monkeypatch, {
        "image-embedding": lr.RuntimeStatus(
            state="ready", endpoint="http://127.0.0.1:62586", pid=88, model_id="siglip2-base"
        ),
    })
    c = check_runtime_llama_status_for("image-embedding")
    assert c.name == "runtime.llama.image-embedding.status"
    assert c.severity == "ok"
    assert "siglip2-base" in c.detail
```

(注:`_patch_registry_status` 是 Plan 3B Task 8 加的 helper,Plan 3C 已扩到含 asr;此处需要确认它能注入 image-embedding key。看现有 helper signature,如果传 dict 自由 key 就 work,无需改。)

打开 `test_runtime_route_diagnose.py`,找到 `test_runtime_diagnose_returns_ok_envelope`,把 13 改 14(两处)。

- [ ] **Step 4: 跑测试**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py -v 2>&1 | tail -10
```

Expected: 25 passed(Plan 3C 24 + 1 新 image-embedding)。

- [ ] **Step 5: 跑全套确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest \
  libs/chayuan-server/tests/unit_tests/test_local_runtime.py \
  libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py \
  libs/chayuan-server/tests/unit_tests/test_process_args_capability.py \
  libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py \
  libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py \
  libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py \
  libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py \
  libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py \
  libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py \
  -q 2>&1 | tail -3
```

Expected: 全过(~110 passed)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py
git commit -m "feat(local-runtime): first_launch + diagnose 接 image-embedding (Plan 3D)"
```

---

## Sprint 5D-2: infinity_server + facade 改造 (Task 8-11)

### Task 8: `infinity_server.py` 新建 + contract 测试

**Files:**
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/image_source/infinity_server.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_infinity_server.py`

- [ ] **Step 1: 写 infinity_server.py**

新建 `chayuan-server/libs/chayuan-server/chayuan/server/image_source/infinity_server.py`:

```python
"""image_source 的 HTTP sidecar wrapper (Plan 3D)。

调用方式:
    python -m chayuan.server.image_source.infinity_server \\
        --host 127.0.0.1 --port 62586

配置文件: <CHAYUAN_ROOT>/runtime/infinity.yaml(首次启动自动生成默认配置)。

懒加载:启动时不预加载模型(避免秒级启动变成几十秒),首次 POST /embeddings
       才调 image_source.embedder.get_embedder 加载模型。

端点:
  * POST /embeddings — michaelf34/infinity 兼容签名
      body: {"input": [str | {"image": "data:image/...;base64,..."}], "model": str}
      ←: {"data": [{"index": int, "embedding": [float, ...]}], "model": str}
"""
from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any, Dict, List, Optional

from chayuan.server.modality._runtime_server_base import (
    make_runtime_app, parse_serve_args, serve,
)

logger = logging.getLogger("chayuan.image_source.infinity_server")


_DEFAULT_CONFIG: Dict[str, Any] = {
    "model": "openai/clip-vit-base-patch32",  # bundled 默认
    "device": "cpu",
    "max_batch_size": 16,
}


def _decode_data_url(s: str) -> bytes:
    """``data:image/...;base64,xxx`` → bytes。"""
    if not s.startswith("data:"):
        # 兼容裸 base64
        return base64.b64decode(s)
    try:
        _hdr, b64 = s.split(",", 1)
        return base64.b64decode(b64)
    except Exception as e:
        raise ValueError(f"invalid data url: {e!r}") from e


def _register_routes(app: Any, cfg: Dict[str, Any]) -> None:
    """挂 /embeddings 端点。"""
    from fastapi import HTTPException, Request

    def _ensure_loaded() -> Any:
        """懒加载 embedder;失败抛 HTTP 503。"""
        if app.state.lib_loaded and app.state.lib_handle is not None:
            return app.state.lib_handle
        try:
            from chayuan.server.image_source.embedder import get_embedder
            handle = get_embedder(cfg.get("model", "openai/clip-vit-base-patch32"))
        except Exception as e:
            app.state.lib_error = f"image embedder 加载失败: {e}"
            logger.exception("image embedder init failed")
            raise HTTPException(status_code=503, detail=app.state.lib_error) from e
        app.state.lib_handle = handle
        app.state.lib_loaded = True
        app.state.lib_error = ""
        return handle

    @app.post("/embeddings")
    async def embeddings(request: Request) -> Dict[str, Any]:
        """OpenAI / infinity 兼容 embedding 端点。"""
        body = await request.json()
        embedder = _ensure_loaded()
        inputs = body.get("input", [])
        if not isinstance(inputs, list) or not inputs:
            raise HTTPException(status_code=400, detail="`input` 必须是非空 list")

        # 分离 text / image
        texts: List[str] = []
        text_idx: List[int] = []
        images: List[bytes] = []
        image_idx: List[int] = []
        for i, item in enumerate(inputs):
            if isinstance(item, dict) and "image" in item:
                try:
                    images.append(_decode_data_url(item["image"]))
                    image_idx.append(i)
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"input[{i}] image 解码失败: {e}") from e
            elif isinstance(item, str):
                texts.append(item)
                text_idx.append(i)
            else:
                raise HTTPException(status_code=400, detail=f"input[{i}] 不是 str 或 {{image}}")

        # 调 embedder 同步方法(在 thread pool 跑避免阻塞事件循环)
        out: List[Dict[str, Any]] = [None] * len(inputs)
        loop = asyncio.get_running_loop()
        if texts:
            # 现有 embedder 接口:encode_text(texts)?or encode_texts?
            # 看 BaseImageEmbedder 实际签名 (Plan 1 已有)
            vecs = await loop.run_in_executor(None, lambda: embedder.encode_texts(texts))
            for i, v in zip(text_idx, vecs):
                out[i] = {"index": i, "embedding": list(v)}
        if images:
            vecs = await loop.run_in_executor(None, lambda: embedder.encode_images(images))
            for i, v in zip(image_idx, vecs):
                out[i] = {"index": i, "embedding": list(v)}

        return {
            "data": out,
            "model": cfg.get("model", "unknown"),
        }


if __name__ == "__main__":
    args = parse_serve_args(default_port=62586)
    app = make_runtime_app(
        framework="infinity",
        title="Chayuan Image Embedding Sidecar",
        default_config=_DEFAULT_CONFIG,
        register_routes=_register_routes,
    )
    serve(app, host=args.host, port=args.port)
```

注意:`embedder.encode_texts` / `embedder.encode_images` 方法名要跟 `BaseImageEmbedder` 实际签名对齐。看 `embedder_base.py` 实际方法名(可能是 `encode_text(texts: List[str])` / `encode_image(blobs: List[bytes])` 单数,看现有代码)。如果实际单数 + List[bytes],改 endpoint 代码用单数。

- [ ] **Step 2: 写 contract 测试**

新建 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_infinity_server.py`:

```python
"""infinity_server.py 端点 contract 测试 (Plan 3D)。"""
from __future__ import annotations

import base64
from unittest import mock

import pytest
from fastapi.testclient import TestClient

from chayuan.server.image_source.infinity_server import (
    _DEFAULT_CONFIG, _register_routes,
)
from chayuan.server.modality._runtime_server_base import make_runtime_app


@pytest.fixture
def app(monkeypatch):
    """构造测试 app + mock get_embedder。"""
    fake_embedder = mock.MagicMock()
    fake_embedder.encode_texts = mock.MagicMock(return_value=[[0.1, 0.2], [0.3, 0.4]])
    fake_embedder.encode_images = mock.MagicMock(return_value=[[0.5, 0.6]])

    monkeypatch.setattr(
        "chayuan.server.image_source.embedder.get_embedder",
        lambda *a, **kw: fake_embedder,
    )

    a = make_runtime_app(
        framework="infinity",
        title="test",
        default_config=dict(_DEFAULT_CONFIG),
        register_routes=_register_routes,
    )
    return a, fake_embedder


def test_embeddings_text_input(app):
    a, fake = app
    c = TestClient(a)
    r = c.post("/embeddings", json={"input": ["hello", "world"], "model": "siglip2-base"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["data"]) == 2
    assert body["data"][0]["embedding"] == [0.1, 0.2]
    assert body["data"][1]["embedding"] == [0.3, 0.4]


def test_embeddings_image_input(app):
    a, fake = app
    c = TestClient(a)
    b64 = base64.b64encode(b"\xff\xd8\xff fake jpeg").decode("ascii")
    r = c.post("/embeddings", json={
        "input": [{"image": f"data:image/jpeg;base64,{b64}"}],
        "model": "clip-vit-base",
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["data"]) == 1
    assert body["data"][0]["embedding"] == [0.5, 0.6]


def test_embeddings_lazy_load_failure_returns_503(monkeypatch):
    """get_embedder 抛异常时 /embeddings 返 503。"""
    monkeypatch.setattr(
        "chayuan.server.image_source.embedder.get_embedder",
        mock.MagicMock(side_effect=RuntimeError("model 缺失")),
    )
    a = make_runtime_app(
        framework="infinity",
        title="test",
        default_config=dict(_DEFAULT_CONFIG),
        register_routes=_register_routes,
    )
    c = TestClient(a)
    r = c.post("/embeddings", json={"input": ["x"], "model": "x"})
    assert r.status_code == 503
    assert "image embedder 加载失败" in r.json()["detail"]
```

- [ ] **Step 3: 跑测试,确认 3 fail(module 不存在)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_infinity_server.py -v
```

- [ ] **Step 4: 看 BaseImageEmbedder 实际 encode 方法名**

```bash
grep -n "def encode\|def __init__" /work/chayuan-desktop/chayuan-server/libs/chayuan-server/chayuan/server/image_source/embedder_base.py | head -10
```

如果方法是 `encode_text(texts: List[str])` / `encode_image(blobs: List[bytes])` 单数 — 改 infinity_server.py 端点代码:

```python
        if texts:
            vecs = await loop.run_in_executor(None, lambda: embedder.encode_text(texts))
        if images:
            vecs = await loop.run_in_executor(None, lambda: embedder.encode_image(images))
```

且测试 fixture 的 fake_embedder mock 也要对应 `encode_text` / `encode_image`。

- [ ] **Step 5: 跑测试,确认 3 passed**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_infinity_server.py -v
```

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/image_source/infinity_server.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_infinity_server.py
git commit -m "feat(image): infinity_server.py Python sidecar wrapper + contract 测试 (Plan 3D)"
```

---

### Task 9: `image_source.embedder.get_embedder` sidecar 优先 + fallback 测试

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/image_source/embedder.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py`

- [ ] **Step 1: 写测试**

新建 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py`:

```python
"""image_source.embedder.get_embedder sidecar 优先 + fallback 测试 (Plan 3D)。"""
from __future__ import annotations

from unittest import mock

import pytest


def test_get_embedder_uses_sidecar_when_ready(monkeypatch):
    """sidecar image-embedding ready 时 get_embedder 返 InfinityHttpClient。"""
    from chayuan.server.image_source import embedder as emb
    from chayuan.server.model_registry import local_runtime as lr

    fake_mgr = mock.MagicMock()
    fake_mgr.status = lr.RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62586", pid=88)

    fake_registry = mock.MagicMock()
    fake_registry.get = mock.MagicMock(return_value=fake_mgr)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    # mock InfinityHttpClient
    fake_client = mock.MagicMock()
    fake_client.base_url = "http://127.0.0.1:62586"
    monkeypatch.setattr(
        "chayuan.server.image_source.embedder_clients.infinity_http.InfinityHttpClient",
        mock.MagicMock(return_value=fake_client),
    )

    result = emb.get_embedder("siglip2-base")
    # sidecar 优先 → 返 InfinityHttpClient(或它的 wrapper)
    assert result is fake_client or hasattr(result, "_client")  # 不同 wrap 方式都可


def test_get_embedder_falls_back_to_inproc_when_sidecar_stopped(monkeypatch):
    """sidecar stopped 时 get_embedder fallback in-process。"""
    from chayuan.server.image_source import embedder as emb
    from chayuan.server.model_registry import local_runtime as lr

    fake_mgr = mock.MagicMock()
    fake_mgr.status = lr.RuntimeStatus(state="stopped")

    fake_registry = mock.MagicMock()
    fake_registry.get = mock.MagicMock(return_value=fake_mgr)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    # mock in-process loader 路径 — 用 _get_inproc_embedder 或现有 fallback
    fake_inproc = mock.MagicMock()
    fake_inproc.name = "inproc-siglip2"
    monkeypatch.setattr(emb, "_get_inproc_embedder", mock.MagicMock(return_value=fake_inproc))

    result = emb.get_embedder("siglip2-base")
    assert result is fake_inproc


def test_get_embedder_falls_back_when_registry_exception(monkeypatch):
    """registry.get 抛异常时 fallback in-process(不抛)。"""
    from chayuan.server.image_source import embedder as emb

    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        mock.MagicMock(side_effect=RuntimeError("registry crash")),
    )

    fake_inproc = mock.MagicMock()
    monkeypatch.setattr(emb, "_get_inproc_embedder", mock.MagicMock(return_value=fake_inproc))

    result = emb.get_embedder("clip-vit-base")
    assert result is fake_inproc
```

- [ ] **Step 2: 跑测试,确认 3 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py -v
```

Expected: 3 fail(`_get_inproc_embedder` 不存在 / sidecar 路径未加)。

- [ ] **Step 3: 改 embedder.py**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/image_source/embedder.py`,找到现有 `def get_embedder(model_name)` 函数(大约 line 847)。

把现有函数体抽出来命名为 `_get_inproc_embedder(model_name)`,然后在原位 `get_embedder` 加 sidecar 优先 + fallback:

```python
def _get_inproc_embedder(model_name: Optional[str] = None) -> BaseImageEmbedder:
    """Plan 3D 起内部 helper:Plan 1 时期的 in-process loader 路径(原 get_embedder 逻辑)。

    新代码请用 :func:`get_embedder`;它会先探 sidecar(Plan 3D),sidecar 不 ready
    时落回这里。
    """
    # ... (Plan 1 原 get_embedder 全部函数体,不改逻辑)


def get_embedder(model_name: Optional[str] = None) -> BaseImageEmbedder:
    """Plan 3D: sidecar 首选 + in-process fallback。

    流程:
      1. 试 ``local_runtime_registry.get('image-embedding').status``,若 state=ready
         返回 ``InfinityHttpClient(base_url=endpoint, model_id=model_name or default)``
      2. registry 不可用 / state != ready → fallback _get_inproc_embedder
    """
    # 1) sidecar 优先
    try:
        from chayuan.server.model_registry.local_runtime_registry import get_registry
        mgr = get_registry().get("image-embedding")
        if mgr.status.state == "ready" and mgr.status.endpoint:
            from chayuan.server.image_source.embedder_clients.infinity_http import InfinityHttpClient
            name = (model_name or default_model_name()).strip()
            client = InfinityHttpClient(
                base_url=mgr.status.endpoint,
                model_id=name,
            )
            logger.info("get_embedder: sidecar 命中 %s @ %s", name, mgr.status.endpoint)
            return client
    except Exception as e:  # noqa: BLE001
        logger.debug("[get_embedder] sidecar 路径不可用,fallback in-process: %r", e)

    # 2) in-process fallback
    return _get_inproc_embedder(model_name)
```

注意:
- 把现有 `get_embedder` 整段函数体(line 847+)复制到 `_get_inproc_embedder`,然后用新的 wrapper 调它。
- `default_model_name()` 是 Plan 1 已有的辅助函数(用于 in-process 路径),看现有 import 是不是顶部已有。
- InfinityHttpClient 直接返(它实现 `ImageEmbedderClient`,跟 `BaseImageEmbedder` 接口对齐 — 看 Plan 1 是否有 wrapper class `_HttpBackedEmbedder` 在使用,如果有,改成 `_HttpBackedEmbedder(client, model_name)` 包一层)。

如果实际有 `_HttpBackedEmbedder` 包装(Plan 1 时期为 HTTP 桥接做的),用它:

```python
            from chayuan.server.image_source.embedder import _HttpBackedEmbedder  # 看现有
            return _HttpBackedEmbedder(client, name)
```

否则直接返 `client`。看现有 `_try_http_backed_embedder` 怎么处理(Plan 1 的 line 825+ 附近)。

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py -v 2>&1 | tail -10
```

Expected: 3 passed。

- [ ] **Step 5: 跑全套 image_source 测试无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/ -k "image or embed" -q 2>&1 | tail -5
```

Expected: 全过(Plan 1 已有的 image_source 测试 + 3 新)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/image_source/embedder.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py
git commit -m "feat(image): get_embedder sidecar 优先 + in-process fallback (Plan 3D)"
```

---

### Task 10: PyInstaller frozen 兜底(可选)

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py`

> **说明:** 本 Task 处理 PyInstaller frozen 模式下 `sys.executable` 指向 chayuan-server.exe(不是 python.exe)的边角。本 Task 仅做"detect frozen + 不同 args"的接入,真正"chayuan-server.exe 主入口认识 --sidecar-mode 参数"留给后续 plan;frozen 模式 sidecar 起不来时自动 fallback in-process(Task 9 facade 已处理)。

- [ ] **Step 1: 加测试**

在 `test_process_args_infinity.py` 末尾追加:

```python
def test_resolve_infinity_args_frozen_mode(monkeypatch):
    """PyInstaller frozen 模式:args 不带 '-m',改用 --sidecar-mode。"""
    from chayuan.server.model_registry import process_args
    monkeypatch.setattr("sys.frozen", True, raising=False)

    e = type("Entry", (), {
        "model_id": "siglip2-base", "format": "transformers", "path": "/tmp",
        "capability": "image",
    })()
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_infinity_args()
    # frozen: 不能 -m,改 --sidecar-mode 参数(让 chayuan-server.exe 自我转化)
    assert "-m" not in r.args
    assert "--sidecar-mode" in r.args
    assert "image-embedding" in r.args
    assert "--model" in r.args
    assert "siglip2-base" in r.args


def test_resolve_infinity_args_dev_mode_uses_m(monkeypatch):
    """非 frozen(开发模式):args 用 '-m module'。"""
    from chayuan.server.model_registry import process_args
    monkeypatch.delattr("sys.frozen", raising=False)

    e = type("Entry", (), {
        "model_id": "siglip2-base", "format": "transformers", "path": "/tmp",
        "capability": "image",
    })()
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_infinity_args()
    assert "-m" in r.args
    assert "chayuan.server.image_source.infinity_server" in r.args
    assert "--sidecar-mode" not in r.args
```

- [ ] **Step 2: 跑测试,确认 2 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py -v -k "frozen_mode or dev_mode_uses_m"
```

- [ ] **Step 3: 改 resolve_infinity_args 加 frozen 探测**

打开 `process_args.py`,找到 Task 1 加的 `resolve_infinity_args`。改成:

```python
def resolve_infinity_args(
    *,
    capability: str = "image-embedding",
    n_threads: Optional[int] = None,
) -> Resolution:
    """``infinity_server`` (Python sidecar) 启动 args。

    capability:
      * ``image-embedding`` → image default + transformers / safetensors 模型 + --model

    PyInstaller frozen 模式:`sys.executable` 是 chayuan-server.exe,不能 `-m`;
    改返 `--sidecar-mode=image-embedding` 让 chayuan-server.exe 自我转化(后续 plan
    实现入口分支后生效;本 plan 期间 frozen 模式 sidecar 起不来时 facade 自动
    fallback in-process)。
    """
    import sys
    if capability not in _INFINITY_CAPABILITIES:
        raise ValueError(f"Unknown capability for infinity: {capability!r}")

    local_cap = _INFINITY_LOCAL_CAP_MAP[capability]
    r = Resolution(process="infinity")
    entry, reason = _resolve(capability, local_cap=local_cap)
    if entry is None:
        r.missing.append(capability)
        r.reason = reason
        return r

    frozen = getattr(sys, "frozen", False)
    if frozen:
        # PyInstaller: chayuan-server.exe 自我转化 sidecar(主入口需实现 --sidecar-mode)
        r.args.extend([
            "--sidecar-mode", capability,
            "--model", entry.model_id,
        ])
    else:
        # 开发模式: sys.executable 是 python(.exe),直接 -m
        r.args.extend([
            "-m", "chayuan.server.image_source.infinity_server",
            "--model", entry.model_id,
        ])

    if n_threads is not None:
        r.args.extend(["--threads", str(int(n_threads))])
    r.resolved_models[capability] = entry.model_id
    r.reason = reason
    return r
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py -v 2>&1 | tail -10
```

Expected: 5 passed(3 + 2 新 frozen/dev)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py
git commit -m "feat(process_args): resolve_infinity_args 加 PyInstaller frozen 探测 (Plan 3D)"
```

---

### Task 11: 跑全套后端测试 / install-bundled-models 默认模型确认

**Files:**
- 仅验证,无新建 / 修改文件

- [ ] **Step 1: 跑全套后端 Plan 3D-touched 测试**

```bash
cd /work/chayuan-desktop
PYTHONPATH=chayuan-server/libs/chayuan-server python3 -m pytest \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_capability.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_infinity_server.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py \
  -q 2>&1 | tail -3
```

Expected: ~120 passed(Plan 3C 100 + Plan 3D 新约 20)。

- [ ] **Step 2: 验 install-bundled-models manifest "image" cap**

```bash
grep -A 12 '"image":' /work/chayuan-desktop/scripts/install-bundled-models.py | head -20
```

Expected: 含 `openai/clip-vit-base-patch32` 候选(Plan 1 已加)。本 Task 不动 manifest;若 install-bundled-models 现已能下 image 模型,sidecar 启动后能加载即可。

- [ ] **Step 3: Commit(空 commit 用于切分,或者跳过)**

本 Task 无文件改动,直接跳到 Sprint 5D-3。

---

## Sprint 5D-3: 前端 + 收尾 (Task 12-15)

### Task 12: `@chayuan/api` LocalRuntimeCapability 加 image-embedding

**Files:**
- Modify: `chayuan-client/packages/api/src/localRuntime.ts`
- Modify: `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts`

- [ ] **Step 1: 改 type**

打开 `chayuan-client/packages/api/src/localRuntime.ts`,找到 Plan 3C:

```typescript
export type LocalRuntimeCapability = 'chat' | 'embedding' | 'rerank' | 'asr';
```

改成:

```typescript
export type LocalRuntimeCapability = 'chat' | 'embedding' | 'rerank' | 'asr' | 'image-embedding';
```

- [ ] **Step 2: 加 3 测试**

在 `__tests__/localRuntime.test.ts` 末尾 describe 块内追加:

```typescript
  it('getStatusFor(image-embedding) 命中 GET /runtime/llama/image-embedding/status', async () => {
    response = () =>
      new Response(
        JSON.stringify({ code: 0, data: { state: 'ready', endpoint: 'http://127.0.0.1:62586' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const s = await localRuntime.getStatusFor('image-embedding');
    expect(s.state).toBe('ready');
    expect(s.endpoint).toBe('http://127.0.0.1:62586');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/image-embedding\/status$/);
  });

  it('startFor(image-embedding) 命中 POST /runtime/llama/image-embedding/start', async () => {
    response = () =>
      new Response(JSON.stringify({ code: 0, data: { state: 'ready' } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    await localRuntime.startFor('image-embedding');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/image-embedding\/start$/);
  });

  it('getRegistry() 返五个 capability(含 image-embedding)', async () => {
    response = () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            chat: { state: 'ready' },
            embedding: { state: 'stopped' },
            rerank: { state: 'stopped' },
            asr: { state: 'stopped' },
            'image-embedding': { state: 'stopped' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const reg = await localRuntime.getRegistry();
    expect(reg['image-embedding'].state).toBe('stopped');
  });
```

- [ ] **Step 3: 跑测试 + typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/localRuntime.test.ts 2>&1 | tail -10
pnpm --filter @chayuan/api run typecheck
```

Expected: 15 passed(Plan 3C 12 + 3 新);typecheck 无错。

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/api/src/localRuntime.ts
git add chayuan-client/packages/api/src/__tests__/localRuntime.test.ts
git commit -m "feat(api): LocalRuntimeCapability 加 image-embedding (Plan 3D)"
```

---

### Task 13: `LocalRuntimePanel` + `LocalRuntimeCapabilityCard` + store 加 image-embedding

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx`
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx`
- Modify: `chayuan-client/packages/app/src/store/localRuntime.ts`
- Modify: `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts`

- [ ] **Step 1: 改 LocalRuntimeCapabilityCard CAPABILITY_LABEL**

打开 `LocalRuntimeCapabilityCard.tsx`,找到 Plan 3C:

```typescript
const CAPABILITY_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '聊天',
  embedding: '文本嵌入',
  rerank: '重排',
  asr: '语音识别',
};
```

改成:

```typescript
const CAPABILITY_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '聊天',
  embedding: '文本嵌入',
  rerank: '重排',
  asr: '语音识别',
  'image-embedding': '图像嵌入',
};
```

- [ ] **Step 2: 改 LocalRuntimePanel cap 数组**

打开 `LocalRuntimePanel.tsx`,找到:

```typescript
{(['chat', 'embedding', 'rerank', 'asr'] as LocalRuntimeCapability[]).map((cap) => (
```

改成:

```typescript
{(['chat', 'embedding', 'rerank', 'asr', 'image-embedding'] as LocalRuntimeCapability[]).map((cap) => (
```

- [ ] **Step 3: 改 store 初始 state**

打开 `chayuan-client/packages/app/src/store/localRuntime.ts`,找到 Plan 3C:

```typescript
  statuses: { chat: null, embedding: null, rerank: null, asr: null },
  pendingFor: { chat: null, embedding: null, rerank: null, asr: null },
```

改成:

```typescript
  statuses: { chat: null, embedding: null, rerank: null, asr: null, 'image-embedding': null },
  pendingFor: { chat: null, embedding: null, rerank: null, asr: null, 'image-embedding': null },
```

- [ ] **Step 4: 改 store 测试 mock 数据**

打开 `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts`,找到 `beforeEach` 内 reset 的 mock statuses / pendingFor:

```typescript
        statuses: { chat: null, embedding: null, rerank: null, asr: null },
        pendingFor: { chat: null, embedding: null, rerank: null, asr: null },
```

改成 5 项含 'image-embedding': null。

- [ ] **Step 5: typecheck + 跑 store 测试**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck 2>&1 | tail -5
pnpm exec vitest run packages/app/src/store/__tests__/localRuntime.test.ts 2>&1 | tail -5
```

Expected: typecheck 无错,store 测试 9 passed(Plan 3C 9)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx
git add chayuan-client/packages/app/src/store/localRuntime.ts
git add chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts
git commit -m "feat(ui): LocalRuntimePanel 加 image-embedding 卡 + store + 测试 5-cap (Plan 3D)"
```

---

### Task 14: `CapabilityCenter` image-embedding tab localCap mapping

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx`

- [ ] **Step 1: 改 localCap 派生**

打开 `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx`,找到 Plan 3C:

```typescript
const localCap: LocalRuntimeCapability | null =
  activeCap === 'text-embedding' ? 'embedding' :
  activeCap === 'rerank' ? 'rerank' :
  activeCap === 'asr' ? 'asr' :
  null;
```

改成(在 asr 之后插一行 image-embedding):

```typescript
const localCap: LocalRuntimeCapability | null =
  activeCap === 'text-embedding' ? 'embedding' :
  activeCap === 'rerank' ? 'rerank' :
  activeCap === 'asr' ? 'asr' :
  activeCap === 'image-embedding' ? 'image-embedding' :
  null;
```

(注意:`activeCap` 是 panel cap 字符串,可能是 `'image-embedding'` 或 `'image'`。看 CapabilityCenter 现有 capabilities list:

```bash
grep -n "'image-embedding'\|\"image-embedding\"\|'image'\|\"image\"" /work/chayuan-desktop/chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx | head -5
```

如果实际 activeCap 串是 `'image'` 不是 `'image-embedding'`,改:

```typescript
  activeCap === 'image' ? 'image-embedding' :
```

按现状定。)

- [ ] **Step 2: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck 2>&1 | tail -5
```

Expected: 无错。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx
git commit -m "feat(ui): CapabilityCenter image-embedding tab localCap mapping (Plan 3D)"
```

---

### Task 15: 总验证 + RUNBOOK 更新

**Files:**
- Modify: `docs/RUNBOOK-local-runtime-diagnose.md`

- [ ] **Step 1: 跑全套后端 Plan 3D-touched 测试**

```bash
cd /work/chayuan-desktop
PYTHONPATH=chayuan-server/libs/chayuan-server python3 -m pytest \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_capability.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_infinity.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_infinity_server.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_embedder_sidecar.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py \
  -q 2>&1 | tail -3
```

Expected: ~125 passed(Plan 3C 100 + Plan 3D 新增 20-25)。

- [ ] **Step 2: 跑全套前端测试**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/localRuntime.test.ts packages/api/src/__tests__/diagnose.test.ts packages/app/src/store/__tests__/localRuntime.test.ts 2>&1 | tail -5
```

Expected: ~26 passed(Plan 3C 23 + Plan 3D 3)。

- [ ] **Step 3: 全仓 typecheck**

```bash
pnpm -r run typecheck 2>&1 | grep -E "error TS|Failed" | head -5
```

Expected: 无 error。

- [ ] **Step 4: 改 RUNBOOK §3 / §4**

打开 `docs/RUNBOOK-local-runtime-diagnose.md`,找到 §3 「UI 按钮」:

```markdown
Plan 3C 后该页显示 4 个 capability 卡片(chat / 文本嵌入 / 重排 / 语音识别),每个独立启停;
「生成诊断报告」按钮在 4 个卡片下方。
```

改成:

```markdown
Plan 3D 后该页显示 5 个 capability 卡片(chat / 文本嵌入 / 重排 / 语音识别 / 图像嵌入),每个独立启停;
「生成诊断报告」按钮在 5 个卡片下方。
```

§4 「常见问题排查」表末尾加 3 行(image-embedding 场景):

```markdown
| `runtime.llama.image-embedding.status fail` | infinity sidecar 启动崩 / 模型加载 OOM | 装机或运行环境 RAM 不足;减小模型(SigLIP2-base / CLIP-vit-base 等) |
| Image-embedding sidecar PyInstaller frozen 启动失败 | chayuan-server.exe 主入口未实现 --sidecar-mode 分支(本 plan 留给后续 plan) | facade 自动 fallback in-process,功能正常但失局部进程隔离 |
| sidecar 启动 60s 超时 | 模型权重加载慢(首次 PyTorch 编译 / 网盘 IO) | 重试启动;持续超时检查 `model.from_pretrained` 错误 |
```

- [ ] **Step 5: Commit RUNBOOK**

```bash
cd /work/chayuan-desktop
git add docs/RUNBOOK-local-runtime-diagnose.md
git commit -m "docs(runbook): Plan 3D image-embedding 排错条目 + 5 cards UI 描述更新"
```

---

## Sprint 5D 完成标志

跑通后用户能做:

1. ✅ 设置 → AI 平台 → 本地模型 显示 5 张 capability card(chat / 文本嵌入 / 重排 / 语音识别 / 图像嵌入),image-embedding 卡可独立启停
2. ✅ `curl POST /runtime/llama/image-embedding/start` 拉起 infinity sidecar(开发模式)
3. ✅ `curl POST http://127.0.0.1:62586/embeddings -d '{"input":["hello"],"model":"siglip2-base"}'` 走通(text 端到端)
4. ✅ `curl POST http://127.0.0.1:62586/embeddings -d '{"input":[{"image":"data:image/jpeg;base64,..."}],"model":"clip-vit-base"}'` 走通(image 端到端)
5. ✅ KB 索引 / multimodal chat 调 `embedder.get_embedder()` 自动用 sidecar(ready 时);不 ready fallback in-process
6. ✅ `curl /runtime/llama/registry` 一次返 5 个 capability 状态
7. ✅ Plan 3A 诊断报告 14 项 check,含 `runtime.llama.image-embedding.status`
8. ✅ 退桌面 sidecar 时 `registry.stop_all()` 关 5 个子进程
9. ✅ 后端单测全过(Plan 3C 100 + Plan 3D ~20 = ~120),前端单测 26,全仓 typecheck 0 error
10. ✅ Plan 1+2+3A+3B+3C 105 commits 不破坏(`SidecarRuntimeManager` / `LlamaRuntimeManager` alias / `find_llama_server_exe` alias / `_resolve_chat_args` alias / Plan 3C `engine='whisper'` 测试 / Plan 3B 4-cap 测试全保留)

**后续不在本 Plan:**
- PyInstaller frozen 模式真正 `--sidecar-mode` 主入口实现 — 留给后续 plan(本 plan 仅 detect frozen,frozen 启不来 facade fallback)
- 真正 michaelf34/infinity 包集成(本 plan 自 wrap)
- Multimodal LLM(LLaVA 等)集成,另起 plan
- Streaming embedding 客户端 batching,另起 plan
- E2E 真机 smoke test 自动化,沿 Plan 3A 真机装机手测哲学

---

## 跨平台兼容矩阵

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| Python 解释器(`sys.executable`) | 开发模式 = python.exe;frozen = chayuan-server.exe | 同 | 同 |
| `python -m chayuan.server.image_source.infinity_server` | 开发模式 work;frozen 需 chayuan-server.exe --sidecar-mode | 同 | 同 |
| 端口(62586) | psutil 跨平台 | 同 | 同 |
| 模型路径 | `<chayuan_root>/models/bundled/image/openai/clip-vit-base-patch32/` | 同 | 同 |
| 关停 | terminate→5s→kill(Plan 1 已有);Python child 无 grandchildren 无遗留 | 同 | 同 |
| 内存(默认 preload=False) | CLIP-base ~1.5 GB,sidecar 单独占;关掉立即释放 | 同 | 同 |
| 防火墙 / AV | Defender 通常放过 sys.executable spawn | n/a(Mac sandbox) | n/a |
| settings.yaml | Plan 3C 旧版无 image-embedding 字段时取默认值,无破坏 | 同 | 同 |

---
