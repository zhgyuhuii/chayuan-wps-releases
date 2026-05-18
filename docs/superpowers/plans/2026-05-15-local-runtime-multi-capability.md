# 本地 Runtime 多 Capability 扩展 实施计划 (Plan 3B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chayuan-server `LlamaRuntimeManager` 从 chat-only 单例扩到 `LocalRuntimeRegistry` 多 capability(chat / embedding / rerank);前端 `LocalRuntimePanel` 显示 3 个 capability card;CapabilityCenter 加「启动本地 runtime」按钮。

**Architecture:** Registry on top — Plan 1 `LlamaRuntimeManager` 加 `capability` + `port_offset` 参数,新增 `LocalRuntimeRegistry` 单例持有 3 个 manager 实例;`get_manager()` 别名 `registry.get("chat")` 保持向后兼容;API 新增 `/runtime/llama/{capability}/*` 路由,旧 `/runtime/llama/status` 仍指 chat。

**Tech Stack:** Python 3.10+, FastAPI, pytest, TypeScript / React, zustand, llama.cpp `llama-server.exe` (CPU build 已在 Plan 1 vendor),GGUF embedding + rerank 模型。

**Spec 关联:** `docs/superpowers/specs/2026-05-15-local-runtime-multi-capability-design.md` (commit `273a651`)

**Plan 1+2+3A 关联:** 已 ship 的全部 67 commits 都保留不动 (除了显式 backward-compat 调整)。Plan 3A 的 `runtime.llama.status` 单一 check 在本 Plan 拆成 3 条 (Task 15)。

---

## File Structure

### 新建文件

| 文件 | 责任 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py` | `LocalRuntimeRegistry` 单例 + `get_registry()` accessor |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py` | Registry 单测 (~5 case) |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py` | 多 capability 路由集成测试 (~6 case) |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx` | 单个 capability 的状态 + 按钮卡片,LocalRuntimePanel 复用 3 次 |

### 修改文件

| 文件 | 改什么 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py` | `resolve_llamacpp_args` 加 `capability` 参数 + embedding/rerank 分支 |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` | `LlamaRuntimeManager` 构造器加 `capability` + `port_offset`;`_resolve_args_for` 派发函数;`_persist_status` per-cap key;`get_manager()` 改成 registry alias;`LocalRuntimeSettings` 加 4 字段 |
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` | 加 `/runtime/llama/registry` + `/runtime/llama/{capability}/{status,start,stop,restart}` 5 个新路由 |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py` | preload 加 embedding / rerank 分支 (按 `preload_embedding` / `preload_rerank` 各自决定) |
| `chayuan-server/libs/chayuan-server/chayuan/startup.py` | lifespan shutdown 调 `registry.stop_all()` 替代 `get_manager().stop()` |
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py` | `check_runtime_llama_status` 拆 per-cap,3 条 check |
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py` | `run_all_checks` 列表从 10 项加到 12 项 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py` | 现有 `runtime_llama_status` test 拆 per-cap;`run_all_checks` 长度断言改 12 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py` | diagnose 路由测试 check 长度断言改 12 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py` | `LlamaRuntimeManager` 构造器加 capability 默认值后,现有 16 测试保持绿 |
| `chayuan-client/packages/api/src/localRuntime.ts` | 加 capability-scoped 方法 (`getStatusFor` / `startFor` / `stopFor` / `restartFor` / `getRegistry`) |
| `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts` | 加 capability-scoped API 契约测试 (~3 case) |
| `chayuan-client/packages/app/src/store/localRuntime.ts` | 加 `statuses` / `pendingFor` 字典 + `startCapability` / `stopCapability` / `restartCapability` / `refreshRegistry` actions |
| `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts` | 加 capability-scoped action + pending 隔离 test (~3 case) |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx` | 改成 3 个 capability card + 共享 config form |
| `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx` | text-embedding / rerank tab 加「启动本地 runtime」按钮 |
| `scripts/install-bundled-models.py` | manifest 加 GGUF embedding/rerank candidates |
| `docs/RUNBOOK-local-runtime-diagnose.md` | 加 multi-cap 场景排错条目 |

---

## Sprint 5B-1: 后端 capability 拓展 (Task 1-8)

### Task 1: `resolve_llamacpp_args` 加 capability 参数 + 测试

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_capability.py`

- [ ] **Step 1: 写测试 (TDD)**

新建 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_capability.py`:

```python
"""resolve_llamacpp_args capability 分支测试。"""
from __future__ import annotations

import pytest

from chayuan.server.model_registry import process_args


def _fake_entry(model_id, fmt, path):
    return type("Entry", (), {
        "model_id": model_id,
        "format": fmt,
        "path": path,
        "capability": "chat",  # 不重要,_resolve 通过 local_cap 查
    })()


def test_resolve_llamacpp_args_chat_default(monkeypatch):
    """capability=chat (默认) 走 chat default。args 含 --model + --ctx-size。"""
    e = _fake_entry("qwen3-4b", "gguf", "/tmp/qwen.gguf")
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_llamacpp_args(n_ctx=8192)
    assert r.process == "llamacpp"
    assert "--model" in r.args
    assert "/tmp/qwen.gguf" in r.args
    assert "--ctx-size" in r.args
    assert "8192" in r.args
    # chat 不带 --embedding / --reranking
    assert "--embedding" not in r.args
    assert "--reranking" not in r.args
    assert r.resolved_models["chat"] == "qwen3-4b"


def test_resolve_llamacpp_args_embedding(monkeypatch):
    """capability=embedding 走 embedding default。args 含 --embedding --pooling cls。"""
    e = _fake_entry("bge-small", "gguf", "/tmp/bge.gguf")
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_llamacpp_args(capability="embedding")
    assert "--model" in r.args
    assert "/tmp/bge.gguf" in r.args
    assert "--embedding" in r.args
    assert "--pooling" in r.args
    assert "cls" in r.args
    assert "--reranking" not in r.args
    assert r.resolved_models["embedding"] == "bge-small"


def test_resolve_llamacpp_args_rerank(monkeypatch):
    """capability=rerank 走 rerank default。args 含 --reranking。"""
    e = _fake_entry("bge-rerank", "gguf", "/tmp/rerank.gguf")
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_llamacpp_args(capability="rerank")
    assert "--reranking" in r.args
    assert "--embedding" not in r.args
    assert r.resolved_models["rerank"] == "bge-rerank"


def test_resolve_llamacpp_args_unknown_capability_raises():
    with pytest.raises(ValueError, match="capability"):
        process_args.resolve_llamacpp_args(capability="asr")  # type: ignore[arg-type]


def test_resolve_llamacpp_args_missing_model_reports_capability(monkeypatch):
    """模型未解到时 missing 列表里是 capability 名,不是 'chat' 硬编码。"""
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (None, "no candidate"))
    r = process_args.resolve_llamacpp_args(capability="embedding")
    assert "embedding" in r.missing
    assert "chat" not in r.missing
```

- [ ] **Step 2: 跑测试,确认 5 fail**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_capability.py -v
```

Expected: 5 fail (大多 `TypeError: resolve_llamacpp_args() got an unexpected keyword argument 'capability'`)。

- [ ] **Step 3: 修 process_args.py**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py`,找到 `resolve_llamacpp_args` 函数 (line 170+),整体替换:

```python
_LLAMACPP_CAPABILITIES = ("chat", "embedding", "rerank")
_LLAMACPP_LOCAL_CAP_MAP = {
    "chat": "chat",
    "embedding": "text-embedding",
    "rerank": "rerank",
}


def resolve_llamacpp_args(
    *,
    capability: str = "chat",
    n_threads: Optional[int] = None,
    n_gpu_layers: Optional[int] = None,
    n_ctx: int = 4096,
) -> Resolution:
    """``llama-server`` 启动时的 args。

    capability:
      * ``chat``      → chat default + GGUF + --ctx-size
      * ``embedding`` → text-embedding default + GGUF + --embedding --pooling cls
      * ``rerank``    → rerank default + GGUF + --reranking
    """
    if capability not in _LLAMACPP_CAPABILITIES:
        raise ValueError(f"Unknown capability for llamacpp: {capability!r}")

    local_cap = _LLAMACPP_LOCAL_CAP_MAP[capability]
    r = Resolution(process="llamacpp")
    entry, reason = _resolve(capability, prefer_format="gguf", local_cap=local_cap)
    if entry is None or entry.format != "gguf":
        r.missing.append(capability)
        r.reason = reason if entry is None else (
            f"{capability} model {entry.model_id!r} format={entry.format!r} 不是 gguf"
        )
        return r

    r.args.extend(["--model", entry.path])
    if capability == "chat":
        r.args.extend(["--ctx-size", str(int(n_ctx))])
    elif capability == "embedding":
        r.args.extend(["--embedding", "--pooling", "cls"])
    elif capability == "rerank":
        r.args.extend(["--reranking"])

    if n_threads is not None:
        r.args.extend(["--threads", str(int(n_threads))])
    if n_gpu_layers is not None:
        r.args.extend(["--n-gpu-layers", str(int(n_gpu_layers))])
    r.resolved_models[capability] = entry.model_id
    r.reason = reason
    return r
```

- [ ] **Step 4: 跑测试,确认 5 passed**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_capability.py -v
```

- [ ] **Step 5: 跑全套现有 process_args 相关测试,确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/ -v -k "process_args or local_runtime" 2>&1 | tail -10
```

Expected: 现有 16 个 local_runtime tests 全过 (因为 `capability="chat"` 是默认值,旧调用方未传不受影响)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_capability.py
git commit -m "feat(process_args): resolve_llamacpp_args 加 capability 参数 + embedding/rerank 分支"
```

---

### Task 2: `LocalRuntimeSettings` 加 4 个新字段

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 写测试**

在 `test_local_runtime.py` 末尾追加:

```python
def test_local_runtime_settings_new_capability_fields_defaults():
    """新加的 4 个字段有默认值,旧测试不破。"""
    s = LocalRuntimeSettings()
    assert s.preload_embedding is False
    assert s.preload_rerank is False
    assert s.default_embedding_model == ""
    assert s.default_rerank_model == ""


def test_local_runtime_settings_new_fields_round_trip(tmp_path):
    """新字段 yaml round-trip 正确。"""
    yaml_path = tmp_path / "lr.yaml"
    s = LocalRuntimeSettings(
        preload_embedding=True,
        preload_rerank=True,
        default_embedding_model="bge-small-zh",
        default_rerank_model="bge-rerank-m3",
    )
    s.save(yaml_path)
    s2 = LocalRuntimeSettings.load(yaml_path)
    assert s2.preload_embedding is True
    assert s2.preload_rerank is True
    assert s2.default_embedding_model == "bge-small-zh"
    assert s2.default_rerank_model == "bge-rerank-m3"


def test_local_runtime_settings_old_yaml_compat(tmp_path):
    """没有新字段的旧 yaml 加载时新字段取默认。"""
    yaml_path = tmp_path / "lr.yaml"
    yaml_path.write_text(
        "preload_on_startup: true\nhost: 127.0.0.1\nport: 62582\n",
        encoding="utf-8",
    )
    s = LocalRuntimeSettings.load(yaml_path)
    assert s.preload_embedding is False
    assert s.preload_rerank is False
    assert s.default_embedding_model == ""
```

- [ ] **Step 2: 跑测试,确认 3 fail (AttributeError on new fields)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "new_capability or new_fields_round_trip or old_yaml_compat"
```

- [ ] **Step 3: 修 LocalRuntimeSettings**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`,找到 `@dataclasses.dataclass class LocalRuntimeSettings:` (Plan 1 commit `c0aef89` 加的):

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
```

末尾追加 4 个新字段:

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
```

`load(path)` 的"过滤未知 key"机制 (Plan 1 commit c0aef89) 保证旧 yaml 不带新字段时取默认值,不抛。

- [ ] **Step 4: 跑测试,确认 19 passed (16 旧 + 3 新)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): LocalRuntimeSettings 加 4 个 capability 字段"
```

---

### Task 3: `LlamaRuntimeManager` 加 capability + port_offset 参数

**Files:** 同 Task 2

- [ ] **Step 1: 加测试**

在 `test_local_runtime.py` 末尾追加:

```python
def test_manager_capability_defaults_to_chat(tmp_path):
    """构造器不传 capability 时默认 chat (向后兼容)。"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path)
    assert m.capability == "chat"
    assert m.port_offset == 0


def test_manager_capability_embedding_uses_port_offset(tmp_path):
    """embedding manager port_offset=1,allocate_port preferred = settings.port + 1。"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path, capability="embedding", port_offset=1)
    assert m.capability == "embedding"
    assert m.port_offset == 1


def test_manager_persist_status_uses_capability_key(tmp_path):
    """_persist_status 写 runtime.json 时按 capability 分 key,
    多个 manager 写不互覆盖。"""
    import json
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager, RuntimeStatus

    m_chat = LlamaRuntimeManager(chayuan_root=tmp_path, capability="chat", port_offset=0)
    m_embed = LlamaRuntimeManager(chayuan_root=tmp_path, capability="embedding", port_offset=1)

    m_chat._status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62582", pid=111)
    m_chat._persist_status()
    m_embed._status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62583", pid=222)
    m_embed._persist_status()

    data = json.loads((tmp_path / "runtime.json").read_text(encoding="utf-8"))
    # llama key 下含 chat 和 embedding 两个子 key,不互覆盖
    assert data["llama"]["chat"]["pid"] == 111
    assert data["llama"]["embedding"]["pid"] == 222


def test_manager_find_llama_server_exe_unchanged(tmp_path, monkeypatch):
    """find_llama_server_exe 行为不受 capability 影响。"""
    from chayuan.server.model_registry import local_runtime
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    exe = services / "llama-server.exe"
    exe.write_bytes(b"stub")
    monkeypatch.setattr(local_runtime, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    m_chat = local_runtime.LlamaRuntimeManager(chayuan_root=tmp_path, capability="chat")
    m_embed = local_runtime.LlamaRuntimeManager(chayuan_root=tmp_path, capability="embedding", port_offset=1)
    assert m_chat.find_llama_server_exe() == exe
    assert m_embed.find_llama_server_exe() == exe
```

- [ ] **Step 2: 跑测试,确认 4 fail**

- [ ] **Step 3: 改 LlamaRuntimeManager**

在 `local_runtime.py` 找到 `class LlamaRuntimeManager:` 和它的 `__init__`,替换为:

```python
class LlamaRuntimeManager:
    """单进程内单例,管 llama-server.exe 生命周期。

    Plan 3B 起支持 capability + port_offset:
      * capability ∈ {chat, embedding, rerank} 决定 _resolve_args_for 走哪条
      * port_offset 让 base port (settings.port) 偏移:chat=0 / embedding=1 / rerank=2
      * _persist_status 按 capability 分 key,多 manager 写 runtime.json 不互覆盖
    """

    def __init__(
        self,
        *,
        chayuan_root: Path,
        capability: str = "chat",
        port_offset: int = 0,
    ) -> None:
        self.chayuan_root = chayuan_root
        self.capability = capability
        self.port_offset = port_offset
        self.settings_path = chayuan_root / "model_registry" / "local_runtime.yaml"
        self.status_path = chayuan_root / "runtime.json"
        self._settings = LocalRuntimeSettings.load(self.settings_path)
        self._status = RuntimeStatus(state="stopped")
        self._process = None  # subprocess.Popen 持有处
```

找到 `_persist_status`:

```python
    def _persist_status(self) -> None:
        """状态写 runtime.json,前端读"""
        try:
            self.status_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"llama": self._status.to_dict()}
            self.status_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass  # 状态写不进去不致命
```

替换为按 capability 分 key + merge 已存在的内容:

```python
    def _persist_status(self) -> None:
        """状态写 runtime.json,前端读。

        多 capability 共用同一文件,按 capability 分 key:
          {"llama": {"chat": {...}, "embedding": {...}, "rerank": {...}}}
        本 manager 只写自己 capability 那一段,其它段从磁盘 merge 不动。
        """
        try:
            self.status_path.parent.mkdir(parents=True, exist_ok=True)
            existing: Dict[str, Any] = {}
            if self.status_path.is_file():
                try:
                    existing = json.loads(self.status_path.read_text(encoding="utf-8")) or {}
                except Exception:
                    existing = {}
            llama_section = existing.get("llama") if isinstance(existing.get("llama"), dict) else {}
            # Plan 1 兼容: 旧版本 runtime.json 是 {"llama": {state, endpoint, ...}} 直接展平,
            # 没有 chat/embedding/rerank 分层;检测到这种 shape 时清空重写 (chat 接管)。
            if "state" in llama_section and "chat" not in llama_section:
                llama_section = {}
            llama_section[self.capability] = self._status.to_dict()
            existing["llama"] = llama_section
            self.status_path.write_text(
                json.dumps(existing, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass  # 状态写不进去不致命
```

在 `local_runtime.py` 顶部 import 里把 `Any` 加上(如果还没有):

```python
from typing import Any, Dict, Literal, Optional
```

- [ ] **Step 4: 跑测试,确认 23 passed (19 + 4 新),且现有 16 个测试全过**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

注:Plan 1 的 `test_manager_init_paths` 现在期望 `m.capability == "chat"` (默认),已经在新测试里覆盖;旧测试只检查 `settings_path` / `status_path`,跟新 init 兼容。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): LlamaRuntimeManager 加 capability + port_offset + per-cap status key"
```

---

### Task 4: `_resolve_args_for(capability)` 派发 + 改 start() 用它

**Files:** 同 Task 2

- [ ] **Step 1: 加测试**

```python
@pytest.mark.asyncio
async def test_manager_start_embedding_uses_embedding_resolver(tmp_path, monkeypatch):
    """embedding manager 调 start 时用 resolve_llamacpp_args(capability='embedding')。"""
    from chayuan.server.model_registry import local_runtime as lr
    from chayuan.server.model_registry import process_args

    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    (services / "llama-server.exe").write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    captured_capability = []

    def fake_resolve(**kw):
        captured_capability.append(kw.get("capability", "<missing>"))
        return process_args.Resolution(
            process="llamacpp",
            args=["--model", "/tmp/embed.gguf", "--embedding", "--pooling", "cls"],
            resolved_models={"embedding": "bge"},
        )

    monkeypatch.setattr(lr.process_args, "resolve_llamacpp_args", fake_resolve)

    # mock Popen + health
    fake_proc = mock.MagicMock(pid=999, poll=mock.MagicMock(return_value=None))
    monkeypatch.setattr(lr.subprocess, "Popen", mock.MagicMock(return_value=fake_proc))
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(lr, "_probe_health", fake_health)

    m = lr.LlamaRuntimeManager(chayuan_root=tmp_path, capability="embedding", port_offset=1)
    status = await m.start()
    assert status.state == "ready"
    assert captured_capability == ["embedding"]


@pytest.mark.asyncio
async def test_manager_start_rerank_uses_rerank_resolver(tmp_path, monkeypatch):
    from chayuan.server.model_registry import local_runtime as lr
    from chayuan.server.model_registry import process_args

    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    (services / "llama-server.exe").write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    captured = []
    monkeypatch.setattr(
        lr.process_args, "resolve_llamacpp_args",
        lambda **kw: (captured.append(kw.get("capability")), process_args.Resolution(
            process="llamacpp",
            args=["--model", "/tmp/r.gguf", "--reranking"],
            resolved_models={"rerank": "bge-r"},
        ))[1],
    )

    fake_proc = mock.MagicMock(pid=888, poll=mock.MagicMock(return_value=None))
    monkeypatch.setattr(lr.subprocess, "Popen", mock.MagicMock(return_value=fake_proc))
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(lr, "_probe_health", fake_health)

    m = lr.LlamaRuntimeManager(chayuan_root=tmp_path, capability="rerank", port_offset=2)
    status = await m.start()
    assert status.state == "ready"
    assert "rerank" in captured
```

- [ ] **Step 2: 跑测试,确认 2 fail**

- [ ] **Step 3: 改 start() 用 capability 派发**

在 `local_runtime.py` 顶部 import 加(如果还没):

```python
from chayuan.server.model_registry import process_args
```

`_resolve_chat_args` 函数(Plan 1 commit `5e03247` 加的)改成派发器:

找到现有 `_resolve_chat_args`:

```python
def _resolve_chat_args(*, n_ctx: int | None = None, n_threads: int | None = None):
    """调 process_args.resolve_llamacpp_args,返回 (resolution, model_path)。

    单独包一层方便测试 monkeypatch。
    """
    from chayuan.server.model_registry import process_args
    kwargs = {}
    if n_ctx is not None:
        kwargs["n_ctx"] = n_ctx
    if n_threads is not None:
        kwargs["n_threads"] = n_threads
    r = process_args.resolve_llamacpp_args(**kwargs)
    if r.missing:
        return r, None
    try:
        i = r.args.index("--model")
        return r, r.args[i + 1]
    except (ValueError, IndexError):
        return r, None
```

替换为通用 `_resolve_args_for`:

```python
def _resolve_args_for(
    capability: str,
    *,
    n_ctx: int | None = None,
    n_threads: int | None = None,
):
    """调 process_args.resolve_llamacpp_args,返回 (resolution, model_path)。

    Plan 3B 起 capability 派发到 chat / embedding / rerank 三个分支。
    单独包一层方便测试 monkeypatch。
    """
    kwargs: dict = {"capability": capability}
    if n_ctx is not None:
        kwargs["n_ctx"] = n_ctx
    if n_threads is not None:
        kwargs["n_threads"] = n_threads
    r = process_args.resolve_llamacpp_args(**kwargs)
    if r.missing:
        return r, None
    try:
        i = r.args.index("--model")
        return r, r.args[i + 1]
    except (ValueError, IndexError):
        return r, None


# 旧名兼容(Plan 1 测试用过 _resolve_chat_args);保留 alias 直到 Task 5 后清扫
def _resolve_chat_args(**kw):
    return _resolve_args_for("chat", **kw)
```

在 `LlamaRuntimeManager.start()` 内找到:

```python
        resolution, model_path = _resolve_chat_args()
```

替换为:

```python
        resolution, model_path = _resolve_args_for(self.capability)
```

并把 endpoint / port 计算改成用 `port_offset`:

找到 start() 里的:

```python
        port = self._allocate_port(preferred=self._settings.port)
```

替换为:

```python
        port = self._allocate_port(preferred=self._settings.port + self.port_offset)
```

- [ ] **Step 4: 跑全套 local_runtime 测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

Expected: 25 passed (23 + 2 新),Plan 1 现有测试因 `_resolve_chat_args` alias 保留全过。

注意:Plan 1 现有的 `test_manager_start_spawns_subprocess` 测试 monkeypatch 了 `_resolve_chat_args`。新增的 alias 让该 monkeypatch 仍可工作。等 Task 5 后所有 chat 调用都通过 registry,这个 alias 可以删但留着无害,本 plan 不删。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): _resolve_args_for(cap) 派发 + start 用 port_offset"
```

---

### Task 5: `LocalRuntimeRegistry` 单例 + `get_registry()` accessor

**Files:**
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py`

- [ ] **Step 1: 写测试**

```python
"""LocalRuntimeRegistry 单测。"""
from __future__ import annotations

import pytest


def test_registry_constructs_three_managers(tmp_path):
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    assert set(reg._managers.keys()) == {"chat", "embedding", "rerank"}
    assert reg.get("chat").capability == "chat"
    assert reg.get("chat").port_offset == 0
    assert reg.get("embedding").capability == "embedding"
    assert reg.get("embedding").port_offset == 1
    assert reg.get("rerank").capability == "rerank"
    assert reg.get("rerank").port_offset == 2


def test_registry_get_unknown_raises(tmp_path):
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    with pytest.raises(ValueError, match="unknown capability"):
        reg.get("asr")


def test_registry_all_statuses(tmp_path):
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    sts = reg.all_statuses()
    assert set(sts.keys()) == {"chat", "embedding", "rerank"}
    # 三个 manager 初始都是 stopped
    for cap, st in sts.items():
        assert st.state == "stopped"


@pytest.mark.asyncio
async def test_registry_stop_all_calls_each_stop(tmp_path, monkeypatch):
    from unittest import mock
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    for cap in ("chat", "embedding", "rerank"):
        reg._managers[cap].stop = mock.AsyncMock()
    await reg.stop_all()
    for cap in ("chat", "embedding", "rerank"):
        reg._managers[cap].stop.assert_awaited_once()


@pytest.mark.asyncio
async def test_registry_stop_all_continues_when_one_raises(tmp_path):
    from unittest import mock
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    reg._managers["chat"].stop = mock.AsyncMock(side_effect=RuntimeError("boom"))
    reg._managers["embedding"].stop = mock.AsyncMock()
    reg._managers["rerank"].stop = mock.AsyncMock()
    # 不应该抛
    await reg.stop_all()
    reg._managers["embedding"].stop.assert_awaited_once()
    reg._managers["rerank"].stop.assert_awaited_once()


def test_get_registry_singleton(tmp_path, monkeypatch):
    from chayuan.server.model_registry import local_runtime_registry as lrr
    monkeypatch.setattr(lrr, "_registry_singleton", None)
    monkeypatch.setattr("chayuan.settings.CHAYUAN_ROOT", str(tmp_path))
    r1 = lrr.get_registry()
    r2 = lrr.get_registry()
    assert r1 is r2
    assert isinstance(r1, lrr.LocalRuntimeRegistry)
```

- [ ] **Step 2: 跑测试,确认 6 fail (module not found)**

- [ ] **Step 3: 写 registry 模块**

新建 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py`:

```python
"""3 个 LlamaRuntimeManager 实例的协调器。

捷径(typical use):
    reg = get_registry()
    chat_status = reg.get("chat").status
    await reg.get("embedding").start()
    await reg.stop_all()  # lifespan shutdown

设计:跟 LlamaRuntimeManager 解耦 — manager 仍是单进程的所有者,
registry 只是 3 个 manager 的 lookup;不在 registry 内做并发协调
(每个 capability 独立 start/stop,前端按需触发)。
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Optional

from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager, RuntimeStatus


logger = logging.getLogger("chayuan.model_registry.local_runtime_registry")


class LocalRuntimeRegistry:
    CAPABILITIES = ("chat", "embedding", "rerank")

    def __init__(self, *, chayuan_root: Path) -> None:
        self._managers: Dict[str, LlamaRuntimeManager] = {
            cap: LlamaRuntimeManager(
                chayuan_root=chayuan_root,
                capability=cap,
                port_offset=i,
            )
            for i, cap in enumerate(self.CAPABILITIES)
        }

    def get(self, capability: str) -> LlamaRuntimeManager:
        if capability not in self._managers:
            raise ValueError(f"unknown capability: {capability!r}")
        return self._managers[capability]

    def all_statuses(self) -> Dict[str, RuntimeStatus]:
        return {cap: m.status for cap, m in self._managers.items()}

    async def stop_all(self) -> None:
        """关停所有 capability runtime;单个 stop 抛异常不阻塞其它。"""
        for cap, m in self._managers.items():
            try:
                await m.stop()
            except Exception as e:
                logger.warning("[registry] stop %s 异常: %r", cap, e)


_registry_singleton: Optional[LocalRuntimeRegistry] = None


def get_registry() -> LocalRuntimeRegistry:
    """进程内单例。第一次调用时按 CHAYUAN_ROOT 构造。"""
    global _registry_singleton
    if _registry_singleton is None:
        from chayuan import settings as cy_settings
        _registry_singleton = LocalRuntimeRegistry(chayuan_root=Path(cy_settings.CHAYUAN_ROOT))
    return _registry_singleton
```

- [ ] **Step 4: 跑测试,确认 6 passed**

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py
git commit -m "feat(local-runtime): LocalRuntimeRegistry 单例管 3 capability"
```

---

### Task 6: `get_manager()` 改为 registry alias + 现有测试回归

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 改 get_manager() 为 registry alias**

在 `local_runtime.py` 找到 Plan 1 commit `f514ec2` 加的 `get_manager()`:

```python
_singleton: Optional[LlamaRuntimeManager] = None


def get_manager() -> LlamaRuntimeManager:
    """进程内单例。第一次调时按 CHAYUAN_ROOT 构造。"""
    global _singleton
    if _singleton is None:
        from chayuan import settings as cy_settings
        _singleton = LlamaRuntimeManager(chayuan_root=Path(cy_settings.CHAYUAN_ROOT))
    return _singleton
```

替换为:

```python
_singleton: Optional[LlamaRuntimeManager] = None  # 保留兼容 monkeypatch (Plan 1 测试用)


def get_manager() -> LlamaRuntimeManager:
    """进程内单例 = registry.get('chat')。

    Plan 1 老调用方拿到 chat manager;Plan 3B 多 capability 调用方
    用 get_registry().get(cap) 取对应 manager。
    """
    global _singleton
    if _singleton is not None:
        # monkeypatch 路径:Plan 1 测试直接给 _singleton 赋值,优先用
        return _singleton
    from chayuan.server.model_registry.local_runtime_registry import get_registry
    return get_registry().get("chat")
```

- [ ] **Step 2: 跑现有 16 个 local_runtime 测试 + 6 个 registry 测试,确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py -v
```

Expected: 31 passed (25 + 6)。

如果 `test_get_manager_singleton` 失败因为它做 `monkeypatch.setattr(lr, "_singleton", None)` + 触发延迟构造,需要小调整测试 (但仍验证 idempotency):

如果该测试失败,修复方案 — 把测试改成:

```python
def test_get_manager_singleton(tmp_path, monkeypatch):
    """get_manager() 返回 registry 里的 chat manager。"""
    from chayuan.server.model_registry import local_runtime
    from chayuan.server.model_registry import local_runtime_registry as lrr
    monkeypatch.setattr(local_runtime, "_singleton", None)
    monkeypatch.setattr(lrr, "_registry_singleton", None)
    monkeypatch.setattr("chayuan.settings.CHAYUAN_ROOT", str(tmp_path))

    m1 = local_runtime.get_manager()
    m2 = local_runtime.get_manager()
    assert m1 is m2
    assert m1.capability == "chat"
```

- [ ] **Step 3: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): get_manager() 重定向到 registry.get('chat')"
```

---

### Task 7: `/runtime/llama/{capability}/*` 路由 + `/runtime/llama/registry`

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py`

- [ ] **Step 1: 写测试**

```python
"""GET/POST /runtime/llama/{capability}/* + /runtime/llama/registry 路由测试。"""
from __future__ import annotations

from unittest import mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from chayuan.server.api_server.runtime_routes import runtime_router
from chayuan.server.model_registry.local_runtime import RuntimeStatus


@pytest.fixture
def client(monkeypatch):
    """注入 fake registry 让 3 个 capability 全可 mock。"""
    fake_managers = {}
    for cap in ("chat", "embedding", "rerank"):
        fm = mock.MagicMock()
        fm.status = RuntimeStatus(state="stopped")
        fm.start = mock.AsyncMock(return_value=RuntimeStatus(state="ready", endpoint=f"http://127.0.0.1:{62582 + ('chat embedding rerank'.split().index(cap))}"))
        fm.stop = mock.AsyncMock(return_value=None)
        fm.restart = mock.AsyncMock(return_value=RuntimeStatus(state="ready"))
        fake_managers[cap] = fm

    fake_registry = mock.MagicMock()
    fake_registry._managers = fake_managers
    fake_registry.get = lambda cap: fake_managers[cap] if cap in fake_managers else (_ for _ in ()).throw(ValueError(f"unknown capability: {cap!r}"))
    fake_registry.all_statuses = lambda: {cap: fm.status for cap, fm in fake_managers.items()}

    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    app = FastAPI()
    app.include_router(runtime_router)
    return TestClient(app), fake_managers


def test_llama_registry_returns_three_caps(client):
    c, _ = client
    r = c.get("/runtime/llama/registry")
    assert r.status_code == 200
    data = r.json()["data"]
    assert set(data.keys()) == {"chat", "embedding", "rerank"}


def test_llama_capability_status_chat(client):
    c, fms = client
    fms["chat"].status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62582", pid=1)
    r = c.get("/runtime/llama/chat/status")
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "ready"


def test_llama_capability_status_embedding(client):
    c, fms = client
    fms["embedding"].status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62583", pid=2)
    r = c.get("/runtime/llama/embedding/status")
    assert r.status_code == 200
    assert r.json()["data"]["endpoint"] == "http://127.0.0.1:62583"


def test_llama_capability_status_unknown_400(client):
    c, _ = client
    r = c.get("/runtime/llama/asr/status")
    assert r.status_code == 400


def test_llama_capability_start_embedding(client):
    c, fms = client
    r = c.post("/runtime/llama/embedding/start")
    assert r.status_code == 200
    fms["embedding"].start.assert_awaited_once()
    fms["chat"].start.assert_not_called()


def test_llama_capability_stop_rerank(client):
    c, fms = client
    r = c.post("/runtime/llama/rerank/stop")
    assert r.status_code == 200
    fms["rerank"].stop.assert_awaited_once()


def test_llama_capability_restart_chat(client):
    c, fms = client
    r = c.post("/runtime/llama/chat/restart")
    assert r.status_code == 200
    fms["chat"].restart.assert_awaited_once()
```

- [ ] **Step 2: 跑测试,确认 7 fail (404 on new routes)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py -v
```

- [ ] **Step 3: 加路由到 runtime_routes.py**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`,找到 Plan 1 commit `dd6f526` 加的 `llama_install_info` 路由 (大约文件末尾)。在它之后追加:

```python
# ─────── /runtime/llama/{capability}/* — Plan 3B 多 capability ───────

_VALID_CAPABILITIES = {"chat", "embedding", "rerank"}


def _validate_capability(capability: str) -> None:
    if capability not in _VALID_CAPABILITIES:
        raise HTTPException(status_code=400, detail=f"unknown capability: {capability!r}")


def _llama_registry():
    """惰性 import 避免循环依赖"""
    from chayuan.server.model_registry.local_runtime_registry import get_registry
    return get_registry()


@runtime_router.get("/llama/registry")
def llama_registry_status() -> Dict[str, Any]:
    """一次拿 3 个 capability 状态;前端 LocalRuntimePanel mount 用。"""
    reg = _llama_registry()
    return _ok({cap: st.to_dict() for cap, st in reg.all_statuses().items()})


@runtime_router.get("/llama/{capability}/status")
def llama_capability_status(capability: str) -> Dict[str, Any]:
    _validate_capability(capability)
    return _ok(_llama_registry().get(capability).status.to_dict())


@runtime_router.post("/llama/{capability}/start")
async def llama_capability_start(
    capability: str, body: Dict[str, Any] = Body(default={})
) -> Dict[str, Any]:
    _validate_capability(capability)
    model_id = body.get("model_id") if isinstance(body, dict) else None
    status = await _llama_registry().get(capability).start(model_id=model_id)
    return _ok(status.to_dict())


@runtime_router.post("/llama/{capability}/stop")
async def llama_capability_stop(capability: str) -> Dict[str, Any]:
    _validate_capability(capability)
    mgr = _llama_registry().get(capability)
    await mgr.stop()
    return _ok(mgr.status.to_dict())


@runtime_router.post("/llama/{capability}/restart")
async def llama_capability_restart(
    capability: str, body: Dict[str, Any] = Body(default={})
) -> Dict[str, Any]:
    _validate_capability(capability)
    model_id = body.get("model_id") if isinstance(body, dict) else None
    status = await _llama_registry().get(capability).restart(model_id=model_id)
    return _ok(status.to_dict())
```

- [ ] **Step 4: 跑测试,确认 7 passed**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py -v 2>&1 | tail -5
```

Expected: 17 passed (现有 10 个 routes_llama + 7 个新 multi_cap)。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py
git commit -m "feat(api): /runtime/llama/{capability}/* + /runtime/llama/registry 多 capability 路由"
```

---

### Task 8: first_launch preload + lifespan shutdown 接 registry + Plan 3A diagnose check 拆 per-cap

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/startup.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py`

- [ ] **Step 1: first_launch.py 加 embedding/rerank preload**

打开 first_launch.py,找到 Plan 1 commit `7805870` 加的 chat preload section (step 5 of hooks chain),它现在长这样:

```python
    # 5) 按 LocalRuntimeSettings.preload_on_startup 异步拉起本地 chat runtime
    try:
        from chayuan.server.model_registry.local_runtime import get_manager
        manager = get_manager()
        if manager.settings.preload_on_startup:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(manager.start())
                logger.info("[first_launch] 启动本地模型 runtime (preload_on_startup=True)")
            else:
                logger.info("[first_launch] 不在 event loop 中,跳过预热")
        else:
            logger.info("[first_launch] 跳过预热 (preload_on_startup=False,首次聊天 lazy start)")
    except Exception as e:
        logger.warning("[first_launch] 本地 runtime 预热失败: %r", e)
        report.errors.append(f"local_runtime preload: {type(e).__name__}: {e}")
```

替换为:

```python
    # 5) 按 LocalRuntimeSettings.preload_* 异步拉起本地 runtime (chat / embedding / rerank)
    try:
        import asyncio
        from chayuan.server.model_registry.local_runtime_registry import get_registry
        reg = get_registry()
        # settings 共享,从 chat manager 拿一次即可
        settings = reg.get("chat").settings
        loop = asyncio.get_event_loop()
        if not loop.is_running():
            logger.info("[first_launch] 不在 event loop 中,跳过 runtime 预热")
        else:
            preload_map = {
                "chat": settings.preload_on_startup,
                "embedding": settings.preload_embedding,
                "rerank": settings.preload_rerank,
            }
            for cap, on in preload_map.items():
                if on:
                    loop.create_task(reg.get(cap).start())
                    logger.info("[first_launch] 启动本地 runtime: %s (preload=True)", cap)
                else:
                    logger.info("[first_launch] 跳过预热 %s (preload=False)", cap)
    except Exception as e:
        logger.warning("[first_launch] 本地 runtime 预热失败: %r", e)
        report.errors.append(f"local_runtime preload: {type(e).__name__}: {e}")
```

- [ ] **Step 2: startup.py lifespan shutdown 用 registry.stop_all**

打开 `chayuan-server/libs/chayuan-server/chayuan/startup.py`,找到 Plan 1 commit `7805870` 加的 lifespan shutdown:

```python
    # 关停本地 LLM runtime (级联 kill llama-server.exe)
    try:
        from chayuan.server.model_registry.local_runtime import get_manager
        await get_manager().stop()
    except Exception as e:
        logger.warning("[shutdown] stop local runtime failed: %r", e)
```

替换为:

```python
    # 关停本地 LLM runtime (级联 kill 3 个 llama-server.exe;Plan 3B 多 capability)
    try:
        from chayuan.server.model_registry.local_runtime_registry import get_registry
        await get_registry().stop_all()
    except Exception as e:
        logger.warning("[shutdown] stop local runtime failed: %r", e)
```

- [ ] **Step 3: diagnose check 拆 per-cap**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py`,找到 Plan 3A commit `2c1ad53` 加的 `check_runtime_llama_status`:

```python
def check_runtime_llama_status() -> DiagnoseCheck:
    """LlamaRuntimeManager 当前 state。

    ready    → ok
    failed   → fail (含 last_error)
    其它     → warn
    """
    try:
        from chayuan.server.model_registry.local_runtime import get_manager
        mgr = get_manager()
        st = mgr.status
    except Exception as e:
        return DiagnoseCheck(...)
    ...
```

替换为:

```python
def check_runtime_llama_status_for(capability: str) -> DiagnoseCheck:
    """LlamaRuntimeManager 某 capability 当前 state。

    ready    → ok
    failed   → fail (含 last_error)
    其它     → warn
    """
    name = f"runtime.llama.{capability}.status"
    try:
        from chayuan.server.model_registry.local_runtime_registry import get_registry
        mgr = get_registry().get(capability)
        st = mgr.status
    except Exception as e:
        return DiagnoseCheck(
            name=name,
            ok=False,
            severity="warn",
            detail=f"registry 读 status 异常:{type(e).__name__}: {e}",
        )

    state = st.state
    if state == "ready":
        ok, sev = True, "ok"
        detail = f"state=ready, endpoint={st.endpoint}, model={st.model_id}, pid={st.pid}"
    elif state == "failed":
        ok, sev = False, "fail"
        detail = f"state=failed, last_error={st.last_error or '<none>'}"
    else:
        ok, sev = True, "warn"
        detail = f"state={state} (未运行或过渡态)"

    return DiagnoseCheck(
        name=name,
        ok=ok,
        severity=sev,  # type: ignore[arg-type]
        detail=detail,
        context={
            "state": state,
            "endpoint": st.endpoint,
            "pid": st.pid,
            "model_id": st.model_id,
            "last_error": st.last_error,
        },
    )


# 旧名兼容 (Plan 3A 测试在 Task 8 内已更新,旧别名不再被新代码引用 — 保留是给外部老调用方)
def check_runtime_llama_status() -> DiagnoseCheck:
    """Deprecated:Plan 3B 起改用 check_runtime_llama_status_for(capability)。
    仅返 chat 状态,保留向后兼容。"""
    return check_runtime_llama_status_for("chat")
```

- [ ] **Step 4: `run_all_checks` 跑 3 个 capability 的 check**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`,找到 `run_all_checks` 函数,replace 它末尾的:

```python
        _checks._safe_call("runtime.llama.status", _checks.check_runtime_llama_status),
    ]
```

替换为:

```python
        _checks._safe_call("runtime.llama.chat.status",
                           lambda: _checks.check_runtime_llama_status_for("chat")),
        _checks._safe_call("runtime.llama.embedding.status",
                           lambda: _checks.check_runtime_llama_status_for("embedding")),
        _checks._safe_call("runtime.llama.rerank.status",
                           lambda: _checks.check_runtime_llama_status_for("rerank")),
    ]
```

- [ ] **Step 5: 更新 diagnose 测试 (check 数从 10 → 12)**

打开 `test_diagnose_checks.py`,找到 Plan 3A Task 6 加的 `test_run_all_checks_returns_report_with_summary`:

```python
    report = run_all_checks()
    assert isinstance(report, DiagnoseReport)
    assert len(report.checks) == 10
    # summary 计数加和等于 10
    s = report.summary
    assert s["ok"] + s["warn"] + s["fail"] == 10
```

替换为:

```python
    report = run_all_checks()
    assert isinstance(report, DiagnoseReport)
    assert len(report.checks) == 12  # Plan 3B: runtime.llama.status 拆成 3 个 capability
    s = report.summary
    assert s["ok"] + s["warn"] + s["fail"] == 12
```

找到 Plan 3A Task 5 的 3 个 `test_check_runtime_llama_status_*` 测试,改成调 `check_runtime_llama_status_for("chat")` (保留 chat 测试,新增 embedding/rerank 测试):

把:

```python
def test_check_runtime_llama_status_ready(tmp_path, monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status
    from chayuan.server.model_registry import local_runtime as lr

    fake_status = lr.RuntimeStatus(state="ready", endpoint="...", pid=1234, model_id="m1")

    class FakeMgr:
        status = fake_status

    monkeypatch.setattr(lr, "_singleton", FakeMgr())
    c = check_runtime_llama_status()
    ...
```

改成调通用的 `_for("chat")` + 走 registry monkeypatch:

```python
def _patch_registry_status(monkeypatch, statuses_by_cap):
    """工具:让 get_registry().get(cap).status 返回指定值"""
    from chayuan.server.model_registry import local_runtime_registry as lrr
    fake_managers = {cap: type("Mgr", (), {"status": st})() for cap, st in statuses_by_cap.items()}
    fake_registry = type("Reg", (), {"get": lambda self, cap: fake_managers[cap]})()
    monkeypatch.setattr(lrr, "_registry_singleton", fake_registry)


def test_check_runtime_llama_status_for_chat_ready(monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status_for
    from chayuan.server.model_registry import local_runtime as lr
    _patch_registry_status(monkeypatch, {
        "chat": lr.RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62582", pid=1, model_id="qwen"),
    })
    c = check_runtime_llama_status_for("chat")
    assert c.name == "runtime.llama.chat.status"
    assert c.severity == "ok"


def test_check_runtime_llama_status_for_embedding_failed(monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status_for
    from chayuan.server.model_registry import local_runtime as lr
    _patch_registry_status(monkeypatch, {
        "embedding": lr.RuntimeStatus(state="failed", last_error="model missing"),
    })
    c = check_runtime_llama_status_for("embedding")
    assert c.name == "runtime.llama.embedding.status"
    assert c.severity == "fail"
    assert "model missing" in c.detail


def test_check_runtime_llama_status_for_rerank_stopped(monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status_for
    from chayuan.server.model_registry import local_runtime as lr
    _patch_registry_status(monkeypatch, {
        "rerank": lr.RuntimeStatus(state="stopped"),
    })
    c = check_runtime_llama_status_for("rerank")
    assert c.name == "runtime.llama.rerank.status"
    assert c.severity == "warn"
```

把 Plan 3A 原本的 3 个 `test_check_runtime_llama_status_*` 测试整段删掉,用上面新 3 个替换。

- [ ] **Step 6: 更新路由测试**

`test_runtime_route_diagnose.py` 的 `test_runtime_diagnose_returns_ok_envelope`:

```python
    assert len(data["checks"]) == 10
    assert data["summary"]["ok"] + data["summary"]["warn"] + data["summary"]["fail"] == 10
```

改成:

```python
    assert len(data["checks"]) == 12
    assert data["summary"]["ok"] + data["summary"]["warn"] + data["summary"]["fail"] == 12
```

- [ ] **Step 7: 跑全套 diagnose + first_launch / shutdown 相关测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest \
    libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py \
    libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py \
    -v 2>&1 | tail -10
```

Expected: 全过 (21 个 diagnose + 2 个 route = 23,跟 Plan 3A 数一致;3 个 runtime_llama 测试被替换 1:1)。

跑全套也确认无回归:

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/ -v 2>&1 | tail -3
```

- [ ] **Step 8: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py
git add chayuan-server/libs/chayuan-server/chayuan/startup.py
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py
git commit -m "feat(local-runtime): first_launch + shutdown + diagnose 接 registry 多 capability"
```

---

## Sprint 5B-2: 前端 capability 拓展 (Task 9-13)

### Task 9: `localRuntime.ts` 加 capability-scoped 方法

**Files:**
- Modify: `chayuan-client/packages/api/src/localRuntime.ts`
- Modify: `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts`

- [ ] **Step 1: 加客户端方法**

打开 `chayuan-client/packages/api/src/localRuntime.ts`,在文件末尾的 `export const localRuntime = { ... }` 之前追加:

```typescript
// ─── Plan 3B 多 capability ───
export type LocalRuntimeCapability = 'chat' | 'embedding' | 'rerank';

async function getStatusFor(cap: LocalRuntimeCapability): Promise<LocalRuntimeStatus> {
  return (await request<LocalRuntimeStatus>(`/runtime/llama/${cap}/status`)).data;
}

async function startFor(
  cap: LocalRuntimeCapability,
  opts?: { model_id?: string },
): Promise<LocalRuntimeStatus> {
  return (
    await request<LocalRuntimeStatus>(`/runtime/llama/${cap}/start`, {
      method: 'POST',
      body: opts ?? {},
      timeoutMs: 90_000,
    })
  ).data;
}

async function stopFor(cap: LocalRuntimeCapability): Promise<LocalRuntimeStatus> {
  return (
    await request<LocalRuntimeStatus>(`/runtime/llama/${cap}/stop`, {
      method: 'POST',
      timeoutMs: 20_000,
    })
  ).data;
}

async function restartFor(
  cap: LocalRuntimeCapability,
  opts?: { model_id?: string },
): Promise<LocalRuntimeStatus> {
  return (
    await request<LocalRuntimeStatus>(`/runtime/llama/${cap}/restart`, {
      method: 'POST',
      body: opts ?? {},
      timeoutMs: 90_000,
    })
  ).data;
}

async function getRegistry(): Promise<Record<LocalRuntimeCapability, LocalRuntimeStatus>> {
  return (await request<Record<LocalRuntimeCapability, LocalRuntimeStatus>>('/runtime/llama/registry'))
    .data;
}
```

替换文件末尾的 `export const localRuntime = { ... }`:

```typescript
export const localRuntime = {
  // 旧:chat 别名(Plan 1+2 已用,不动)
  getStatus,
  start,
  stop,
  restart,
  getConfig,
  setConfig,
  getInstallInfo,
  // Plan 3B 多 capability
  getStatusFor,
  startFor,
  stopFor,
  restartFor,
  getRegistry,
};
```

- [ ] **Step 2: 加契约测试**

打开 `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts`,在末尾 `describe` 块内追加:

```typescript
  it('getStatusFor(embedding) 命中 GET /runtime/llama/embedding/status', async () => {
    response = () =>
      new Response(
        JSON.stringify({ code: 0, data: { state: 'ready', endpoint: 'http://127.0.0.1:62583' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const s = await localRuntime.getStatusFor('embedding');
    expect(s.state).toBe('ready');
    expect(s.endpoint).toBe('http://127.0.0.1:62583');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/embedding\/status$/);
  });

  it('startFor(rerank) 命中 POST /runtime/llama/rerank/start 并把 model_id 写 body', async () => {
    response = () =>
      new Response(JSON.stringify({ code: 0, data: { state: 'ready' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await localRuntime.startFor('rerank', { model_id: 'bge-rerank-m3' });
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/rerank\/start$/);
    expect(JSON.parse(calls[0]!.init?.body as string)).toEqual({ model_id: 'bge-rerank-m3' });
  });

  it('getRegistry() 返三个 capability 字典', async () => {
    response = () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            chat: { state: 'ready', endpoint: 'http://127.0.0.1:62582' },
            embedding: { state: 'stopped' },
            rerank: { state: 'stopped' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const reg = await localRuntime.getRegistry();
    expect(reg.chat.state).toBe('ready');
    expect(reg.embedding.state).toBe('stopped');
    expect(reg.rerank.state).toBe('stopped');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/registry$/);
  });
```

- [ ] **Step 3: 跑测试**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/localRuntime.test.ts
```

Expected: 9 passed (6 旧 + 3 新)。

- [ ] **Step 4: typecheck**

```bash
pnpm --filter @chayuan/api run typecheck
```

Expected: 无错。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/api/src/localRuntime.ts
git add chayuan-client/packages/api/src/__tests__/localRuntime.test.ts
git commit -m "feat(api): localRuntime 加 capability-scoped 方法 (getStatusFor / startFor / getRegistry 等)"
```

---

### Task 10: zustand store 加 `statuses` / `pendingFor` 字典 + capability actions

**Files:**
- Modify: `chayuan-client/packages/app/src/store/localRuntime.ts`
- Modify: `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts`

- [ ] **Step 1: 加测试**

在 `test_localRuntime.test.ts` (store 测试) 内,在现有 `describe('useLocalRuntimeStore', ...)` 块末尾追加:

```typescript
  it('refreshRegistry 一次更新 3 个 capability 的 statuses', async () => {
    (api.getRegistry as ReturnType<typeof vi.fn>).mockResolvedValue({
      chat: { state: 'ready', endpoint: 'http://127.0.0.1:62582', pid: 1 },
      embedding: { state: 'stopped' },
      rerank: { state: 'failed', last_error: 'no model' },
    });
    await useLocalRuntimeStore.getState().refreshRegistry();
    const s = useLocalRuntimeStore.getState();
    expect(s.statuses.chat?.state).toBe('ready');
    expect(s.statuses.embedding?.state).toBe('stopped');
    expect(s.statuses.rerank?.state).toBe('failed');
  });

  it('startCapability(embedding) 只置 pendingFor.embedding,不影响 chat', async () => {
    let resolveStart: (s: { state: string }) => void = () => undefined;
    (api.startFor as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolveStart = r;
      }),
    );
    const p = useLocalRuntimeStore.getState().startCapability('embedding');
    expect(useLocalRuntimeStore.getState().pendingFor.embedding).toBe('start');
    expect(useLocalRuntimeStore.getState().pendingFor.chat).toBeNull();
    resolveStart({ state: 'ready' });
    await p;
    expect(useLocalRuntimeStore.getState().pendingFor.embedding).toBeNull();
    expect(useLocalRuntimeStore.getState().statuses.embedding?.state).toBe('ready');
  });

  it('stopCapability(rerank) 写 statuses.rerank 为 stopped', async () => {
    useLocalRuntimeStore.setState({
      statuses: {
        chat: { state: 'ready' },
        embedding: null,
        rerank: { state: 'ready', endpoint: 'http://127.0.0.1:62584', pid: 99 },
      } as never,
    });
    (api.stopFor as ReturnType<typeof vi.fn>).mockResolvedValue({ state: 'stopped' });
    await useLocalRuntimeStore.getState().stopCapability('rerank');
    expect(useLocalRuntimeStore.getState().statuses.rerank?.state).toBe('stopped');
  });
```

测试文件顶部的 `vi.mock('@chayuan/api', ...)` 也要加新方法:

```typescript
vi.mock('@chayuan/api', () => ({
  localRuntime: {
    getStatus: vi.fn(),
    getConfig: vi.fn(),
    getInstallInfo: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    setConfig: vi.fn(),
    // Plan 3B
    getStatusFor: vi.fn(),
    startFor: vi.fn(),
    stopFor: vi.fn(),
    restartFor: vi.fn(),
    getRegistry: vi.fn(),
  },
}));
```

- [ ] **Step 2: 跑测试,确认 3 fail (refreshRegistry / startCapability / stopCapability 没在 store)**

- [ ] **Step 3: 改 store**

打开 `chayuan-client/packages/app/src/store/localRuntime.ts`,先在 imports 加:

```typescript
import {
  localRuntime,
  type LocalRuntimeCapability,
  type LocalRuntimeInstallInfo,
  type LocalRuntimeSettings,
  type LocalRuntimeSettingsPatch,
  type LocalRuntimeStatus,
} from '@chayuan/api';
```

`LocalRuntimeStoreState` 接口加:

```typescript
export interface LocalRuntimeStoreState {
  // 旧字段 (Plan 1+2 不动)
  status: LocalRuntimeStatus | null;
  config: LocalRuntimeSettings | null;
  installInfo: LocalRuntimeInstallInfo | null;
  pending: 'start' | 'stop' | 'restart' | 'save-config' | null;
  lastError: string | null;
  reachable: boolean;

  // Plan 3B 多 capability
  statuses: Record<LocalRuntimeCapability, LocalRuntimeStatus | null>;
  pendingFor: Record<LocalRuntimeCapability, 'start' | 'stop' | 'restart' | null>;

  // 旧 actions
  refreshStatus(): Promise<void>;
  refreshConfig(): Promise<void>;
  refreshInstallInfo(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  saveConfig(patch: LocalRuntimeSettingsPatch): Promise<void>;
  clearError(): void;

  // Plan 3B
  refreshRegistry(): Promise<void>;
  startCapability(cap: LocalRuntimeCapability): Promise<void>;
  stopCapability(cap: LocalRuntimeCapability): Promise<void>;
  restartCapability(cap: LocalRuntimeCapability): Promise<void>;
}
```

`useLocalRuntimeStore = create<...>((set, get) => ({` 内初始 state 加:

```typescript
  statuses: { chat: null, embedding: null, rerank: null },
  pendingFor: { chat: null, embedding: null, rerank: null },
```

actions 末尾(`clearError` 之前)加:

```typescript
  async refreshRegistry() {
    try {
      const reg = await localRuntime.getRegistry();
      set({ statuses: reg, reachable: true });
    } catch (e) {
      set({ reachable: false, lastError: describeError(e) });
    }
  },

  async startCapability(cap) {
    if (get().pendingFor[cap]) return;
    set((s) => ({
      pendingFor: { ...s.pendingFor, [cap]: 'start' },
      lastError: null,
    }));
    try {
      const status = await localRuntime.startFor(cap);
      set((s) => ({
        statuses: { ...s.statuses, [cap]: status },
        pendingFor: { ...s.pendingFor, [cap]: null },
      }));
    } catch (e) {
      set((s) => ({
        pendingFor: { ...s.pendingFor, [cap]: null },
        lastError: describeError(e),
      }));
    }
  },

  async stopCapability(cap) {
    if (get().pendingFor[cap]) return;
    set((s) => ({
      pendingFor: { ...s.pendingFor, [cap]: 'stop' },
      lastError: null,
    }));
    try {
      const status = await localRuntime.stopFor(cap);
      set((s) => ({
        statuses: { ...s.statuses, [cap]: status },
        pendingFor: { ...s.pendingFor, [cap]: null },
      }));
    } catch (e) {
      set((s) => ({
        pendingFor: { ...s.pendingFor, [cap]: null },
        lastError: describeError(e),
      }));
    }
  },

  async restartCapability(cap) {
    if (get().pendingFor[cap]) return;
    set((s) => ({
      pendingFor: { ...s.pendingFor, [cap]: 'restart' },
      lastError: null,
    }));
    try {
      const status = await localRuntime.restartFor(cap);
      set((s) => ({
        statuses: { ...s.statuses, [cap]: status },
        pendingFor: { ...s.pendingFor, [cap]: null },
      }));
    } catch (e) {
      set((s) => ({
        pendingFor: { ...s.pendingFor, [cap]: null },
        lastError: describeError(e),
      }));
    }
  },
```

- [ ] **Step 4: 跑 store 测试,确认 9 passed (6 + 3)**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/app/src/store/__tests__/localRuntime.test.ts
```

- [ ] **Step 5: typecheck**

```bash
pnpm --filter @chayuan/app run typecheck
```

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/store/localRuntime.ts
git add chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts
git commit -m "feat(app): localRuntime store 加 capability-scoped statuses + actions"
```

---

### Task 11: `LocalRuntimeCapabilityCard` 组件

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx`

- [ ] **Step 1: 写组件**

```typescript
/**
 * 单个 capability 的状态 + 启停按钮 card。
 *
 * LocalRuntimePanel 复用 3 次:chat / embedding / rerank。
 */

import * as React from 'react';
import { Play, Square, RotateCw } from 'lucide-react';
import { Button } from '@chayuan/ui';
import type { LocalRuntimeCapability, LocalRuntimeStatus } from '@chayuan/api';
import { LocalRuntimeStatusBadge } from './LocalRuntimeStatusBadge';

const CAPABILITY_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '聊天',
  embedding: '文本嵌入',
  rerank: '重排',
};

export interface LocalRuntimeCapabilityCardProps {
  capability: LocalRuntimeCapability;
  status: LocalRuntimeStatus | null;
  pending: 'start' | 'stop' | 'restart' | null;
  onStart(): void;
  onStop(): void;
  onRestart(): void;
}

export const LocalRuntimeCapabilityCard: React.FC<LocalRuntimeCapabilityCardProps> = ({
  capability,
  status,
  pending,
  onStart,
  onStop,
  onRestart,
}) => {
  const isPending = pending !== null;
  const isReady = status?.state === 'ready';
  const isStopped = !status || status.state === 'stopped';

  return (
    <div className="rounded-md border border-[var(--cy-border-subtle)] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--cy-text-primary)]">
          {CAPABILITY_LABEL[capability]}
        </span>
        <LocalRuntimeStatusBadge status={status} />
        {status?.endpoint && (
          <code className="text-xs text-[var(--cy-text-secondary)]">{status.endpoint}</code>
        )}
        {status?.pid != null && (
          <span className="text-xs text-[var(--cy-text-tertiary)]">pid {status.pid}</span>
        )}
      </div>
      {status?.model_id && (
        <div className="text-xs text-[var(--cy-text-secondary)]">
          模型:<code>{status.model_id}</code>
        </div>
      )}
      {status?.state === 'failed' && status.last_error && (
        <div className="rounded-sm border border-rose-500/30 bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200 whitespace-pre-wrap break-all">
          {status.last_error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={onStart}
          disabled={isPending || status?.state === 'starting' || isReady}
        >
          <Play className={'mr-1 h-3.5 w-3.5' + (pending === 'start' ? ' animate-pulse' : '')} />
          启动
        </Button>
        <Button size="sm" variant="outline" onClick={onStop} disabled={isPending || isStopped}>
          <Square className="mr-1 h-3.5 w-3.5" />
          停止
        </Button>
        <Button size="sm" variant="outline" onClick={onRestart} disabled={isPending}>
          <RotateCw className={'mr-1 h-3.5 w-3.5' + (pending === 'restart' ? ' animate-spin' : '')} />
          重启
        </Button>
      </div>
    </div>
  );
};

export default LocalRuntimeCapabilityCard;
```

- [ ] **Step 2: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx
git commit -m "feat(ui): LocalRuntimeCapabilityCard 单 capability 卡片"
```

---

### Task 12: `LocalRuntimePanel` 改成 3 cards + 共享 config

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx`
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/index.ts`

- [ ] **Step 1: 改 LocalRuntimePanel**

打开 `LocalRuntimePanel.tsx`,在 import 区加:

```typescript
import { LocalRuntimeCapabilityCard } from './LocalRuntimeCapabilityCard';
import type { LocalRuntimeCapability } from '@chayuan/api';
```

把 polling hook 改成 registry-aware:

找到 Plan 2 commit `b259c30` 加的:

```typescript
function useLocalRuntimePolling() {
  const refreshStatus = useLocalRuntimeStore((s) => s.refreshStatus);
  React.useEffect(() => {
    void refreshStatus();
    const t = window.setInterval(() => void refreshStatus(), POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [refreshStatus]);
}
```

替换为(同时拉 chat 单点 + registry 全部):

```typescript
function useLocalRuntimePolling() {
  const refreshStatus = useLocalRuntimeStore((s) => s.refreshStatus);
  const refreshRegistry = useLocalRuntimeStore((s) => s.refreshRegistry);
  React.useEffect(() => {
    void refreshStatus();
    void refreshRegistry();
    const t = window.setInterval(() => {
      void refreshStatus();
      void refreshRegistry();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [refreshStatus, refreshRegistry]);
}
```

在组件函数体内,从 store 取的解构里加新字段:

```typescript
  const {
    status,
    config,
    installInfo,
    pending,
    lastError,
    reachable,
    refreshConfig,
    refreshInstallInfo,
    start,
    stop,
    restart,
    saveConfig,
    clearError,
    // Plan 3B 新增
    statuses,
    pendingFor,
    startCapability,
    stopCapability,
    restartCapability,
  } = useLocalRuntimeStore();
```

把原本的"状态区 section" (含 LocalRuntimeStatusBadge + endpoint + pid + model + 启停按钮) 删掉,替换为 3 cards 循环:

```typescript
      {/* 3 个 capability cards */}
      <section className="space-y-3">
        {(['chat', 'embedding', 'rerank'] as LocalRuntimeCapability[]).map((cap) => (
          <LocalRuntimeCapabilityCard
            key={cap}
            capability={cap}
            status={statuses[cap]}
            pending={pendingFor[cap]}
            onStart={() => void startCapability(cap)}
            onStop={() => void stopCapability(cap)}
            onRestart={() => void restartCapability(cap)}
          />
        ))}
        {lastError && (
          <div className="flex items-center justify-between rounded-md border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <span>{lastError}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={clearError} aria-label="清除错误">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </section>
```

把旧的 `start` / `stop` / `restart` / `status` 解构字段保留 (因为 saveConfig 等仍用 pending),但状态区不再用它们(改用 statuses/pendingFor)。

(其它 section: 共享 config form / 装机路径 / 「生成诊断报告」按钮 — 不动。)

- [ ] **Step 2: index.ts 加 export**

```typescript
export { LocalRuntimeCapabilityCard } from './LocalRuntimeCapabilityCard';
```

- [ ] **Step 3: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。如果 unused-imports 警告,删除已经不用的旧 import (Play, Square, RotateCw 现在只在 Card 里用)。

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx
git add chayuan-client/packages/app/src/features/aiPlatform/index.ts
git commit -m "feat(ui): LocalRuntimePanel 改成 3 capability cards + 共享 config"
```

---

### Task 13: CapabilityCenter「文本嵌入」/「重排」加「启动本地 runtime」按钮

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx`

- [ ] **Step 1: 找 CapabilityCenter 现有 tab 结构**

```bash
grep -n "text-embedding\|rerank\|setActiveCap\|activeCap" /work/chayuan-desktop/chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx | head -15
```

应该看到一个左侧 9 tab nav + 右侧 content area;activeCap state 控制当前 tab。

- [ ] **Step 2: 在 content area 顶部加「启动本地 runtime」按钮**

在 CapabilityCenter.tsx 顶部 import 加:

```typescript
import { Cpu } from 'lucide-react';
import { useLocalRuntimeStore } from '../../store/localRuntime';
import type { LocalRuntimeCapability } from '@chayuan/api';
```

找到组件函数体内显示当前 capability 内容的 section (大约 line 370-400 区域,在「我的 / 推荐 / 自定义」分页 tabs 之前)。加一个 inline button:

```typescript
  const localRuntime = useLocalRuntimeStore();

  // 把 panel cap 字符串映射到 LocalRuntimeCapability;只 embedding / rerank 支持本地 runtime
  const localCap: LocalRuntimeCapability | null =
    activeCap === 'text-embedding' ? 'embedding' :
    activeCap === 'rerank' ? 'rerank' :
    null;
  const localStatus = localCap ? localRuntime.statuses[localCap] : null;
  const localPending = localCap ? localRuntime.pendingFor[localCap] : null;
```

在 content area 顶部 (右侧 9 cap content 容器最开始) 加:

```typescript
        {localCap && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-[var(--cy-border-subtle)] bg-[var(--cy-surface-1)] p-2 text-xs">
            <Cpu className="h-3.5 w-3.5 text-[var(--cy-text-tertiary)]" />
            <span className="text-[var(--cy-text-secondary)]">本地 runtime:</span>
            {localStatus?.state === 'ready' ? (
              <code className="text-emerald-700">运行中 ({localStatus.endpoint})</code>
            ) : (
              <span className="text-[var(--cy-text-tertiary)]">
                {localStatus?.state === 'failed' ? `失败:${localStatus.last_error ?? ''}` : '未运行'}
              </span>
            )}
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              disabled={localPending !== null || localStatus?.state === 'ready'}
              onClick={() => void localRuntime.startCapability(localCap)}
            >
              {localPending === 'start' ? '启动中…' : '启动本地 runtime'}
            </Button>
          </div>
        )}
```

如果文件内 `Button` 没 import,从 `@chayuan/ui` import。

- [ ] **Step 3: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx
git commit -m "feat(ui): CapabilityCenter text-embedding/rerank tab 加「启动本地 runtime」按钮"
```

---

## Sprint 5B-3: 收尾 (Task 14-15)

### Task 14: `install-bundled-models.py` manifest 加 GGUF embedding/rerank

**Files:**
- Modify: `scripts/install-bundled-models.py`

- [ ] **Step 1: 查看现有 manifest 形状**

```bash
grep -n "MANIFEST\|hf_candidates\|ms_candidates\|capability" /work/chayuan-desktop/scripts/install-bundled-models.py | head -15
```

- [ ] **Step 2: 加 GGUF 候选**

(具体 manifest key 名按文件实际叫法调整,以下是 idea level 描述)

打开 `scripts/install-bundled-models.py`,找到 `MANIFEST` 字典里 `embedding` 和 `rerank` 两项。加 GGUF candidates 到 `hf_candidates` 列表顶部 (优先级最高):

```python
MANIFEST = {
    ...
    "embedding": {
        "hf_candidates": [
            # Plan 3B: GGUF 优先 (llama-server --embedding 用)
            "CompendiumLabs/bge-small-en-v1.5-gguf",
            # 旧 HF transformers fallback (infinity_emb 路径)
            "iic/gte-multilingual-base",
        ],
        "ms_candidates": ["iic/gte-multilingual-base"],
        ...
    },
    "rerank": {
        "hf_candidates": [
            # Plan 3B: GGUF 优先
            "gpustack/bge-reranker-v2-m3-GGUF",
            # 旧 HF fallback
            "iic/gte-multilingual-reranker-base",
        ],
        ...
    },
    ...
}
```

(具体 candidates 在 plan 真跑起来时按 HF 实际可用模型调,Plan 3B 不锁死 model id。)

- [ ] **Step 3: 跑 check 验证脚本不破**

```bash
cd /work/chayuan-desktop
python3 scripts/check-bundled-models.py 2>&1 | tail -5
```

Expected: 无 Python 异常 (具体输出取决于 bundled_models/ 里有啥)。

- [ ] **Step 4: Commit**

```bash
git add scripts/install-bundled-models.py
git commit -m "feat(scripts): install-bundled-models GGUF embedding/rerank candidates 优先 (Plan 3B)"
```

---

### Task 15: 总验证 + runbook 增加 multi-cap 场景

**Files:**
- Modify: `docs/RUNBOOK-local-runtime-diagnose.md`

- [ ] **Step 1: 跑全套后端测试**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/ 2>&1 | tail -5
```

Expected: 全过 (Plan 1 49 + Plan 3A 23 增 Plan 3B 后退掉 3 个 runtime_llama 加 3 个 capability,加 Plan 3B 8 + 5 + 6 + 7 + 6 = ~32 新 = 总 ~85 tests passed)。

如果有失败,定位到具体 test,看是否是回归还是新预期未对齐;按情况修。

- [ ] **Step 2: 跑全套前端测试**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/diagnose.test.ts packages/api/src/__tests__/localRuntime.test.ts packages/app/src/store/__tests__/localRuntime.test.ts 2>&1 | tail -5
```

Expected: 全过 (Plan 3A 14 + Plan 3B 加 3 API + 3 store = 20)。

- [ ] **Step 3: 全仓 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm -r run typecheck 2>&1 | tail -5
```

Expected: 11 packages + 2 apps 全过,0 error。

- [ ] **Step 4: 更新 runbook**

打开 `docs/RUNBOOK-local-runtime-diagnose.md`,找到 §4 「常见问题排查」表格。在表末追加 3 行 (Plan 3B multi-cap 场景):

```markdown
| `runtime.llama.embedding.status fail` | embedding 模型未装 / 启动崩 | install-bundled-models 拉 GGUF embedding;看 detail 字段 last_error 修 |
| `runtime.llama.rerank.status fail` | rerank 模型未装 / 启动崩 | 同上;rerank 通常 < 200 MB,装完跑 `/runtime/llama/rerank/start` |
| 三个 capability 同时占内存 | preload_embedding=true + preload_rerank=true 一开机吃 3-5 GB | 设置页关闭对应 preload 开关;按需 lazy start |
```

§3「UI 按钮」改成 multi-card 描述:

把:

> 桌面应用 → 头像菜单 → 设置 → AI 平台 → 「本地模型」tab → 状态区按钮组最右侧「生成诊断报告」按钮。

改成:

> 桌面应用 → 头像菜单 → 设置 → AI 平台 → 「本地模型」tab。
> Plan 3B 后该页显示 3 个 capability 卡片 (chat / 文本嵌入 / 重排),每个独立启停;
> 「生成诊断报告」按钮在底部装机路径区。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add docs/RUNBOOK-local-runtime-diagnose.md
git commit -m "docs(runbook): Plan 3B multi-cap 场景排错条目 + UI 描述更新"
```

---

## Sprint 5B 完成标志

跑通后用户能做:

1. ✅ Settings 页「本地模型」tab 显示 3 个 capability card,各自启停
2. ✅ chat 默认开机预热不变 (Plan 1+2 行为);embedding / rerank 用户手动开 (或在 settings 里勾 preload)
3. ✅ `curl http://127.0.0.1:62581/runtime/llama/registry` 一次拿 3 个 capability 状态
4. ✅ `curl http://127.0.0.1:62581/runtime/llama/embedding/start` POST 拉起本地 embedding
5. ✅ `curl http://127.0.0.1:62583/v1/embeddings -d '{"input":"hello"}'` 直接打通 OpenAI 兼容
6. ✅ rerank 类似 (port 62584,`/rerank` endpoint)
7. ✅ 退桌面 sidecar 时 lifespan shutdown 三个子进程都 kill (registry.stop_all)
8. ✅ Plan 3A 诊断报告 12 项 check,包含 3 个 capability runtime 状态
9. ✅ CapabilityCenter「文本嵌入」/「重排」tab 有「启动本地 runtime」按钮
10. ✅ 后端单测全过 + 前端单测全过 + 全仓 typecheck 0 error

**后续不在本 Plan:**
- Plan 3C (ASR) — Whisper.cpp 另一份 vendor 二进制
- Plan 3D (image-embedding) — CLIP / Tauri webview 集成
- 模型市场 / auto-download — 永远不做或独立 plan
- E2E CI — Plan 3A 哲学,留真机

---

## 跨平台

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| llama-server 二进制 | Plan 1 已带 (vendor/services/llama-server/llama-server.exe);本 plan 不动 | 同 | 同 |
| Popen 参数 (per cap) | chat: `--ctx-size 8192`<br/>embedding: `--embedding --pooling cls`<br/>rerank: `--reranking` | 同 | 同 |
| 端口 | chat=settings.port (62582)、embed=+1、rerank=+2 | 同 | 同 |
| 关停 | terminate→5s wait→kill,registry.stop_all 串行调三个 | 同 | 同 |
| settings.yaml | 旧版无新字段时取默认值,无破坏 | 同 | 同 |
| 内存占用 (默认 preload=False except chat) | chat preload ~3 GB,embed/rerank lazy | 同 | 同 |
