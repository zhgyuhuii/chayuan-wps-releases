# 本地 Runtime ASR 实施计划 (Plan 3C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `LlamaRuntimeManager` 重命名为 `SidecarRuntimeManager` 并加 `engine` 参数,`LocalRuntimeRegistry` 加第 4 个 capability `asr`(`engine='whisper'`, `port_offset=3`),vendor whisper-server 二进制,audio.py 顺序改为 sidecar 首选 + Python fallback。

**Architecture:** Sidecar manager 泛化为 `SidecarRuntimeManager(engine, capability, port_offset)`,`LlamaRuntimeManager` 保留作向后兼容 alias(`engine='llama'` 默认);Registry CAPABILITIES 扩到 4 项;API 路径 `/runtime/llama/{cap}/*` 不变,只在 `_VALID_CAPABILITIES` 加 `'asr'`;前端 LocalRuntimePanel 通过现有 cap-agnostic 数组自动渲染第 4 张 card。

**Tech Stack:** Python 3.10+,FastAPI,pytest,TypeScript / React,zustand,whisper.cpp `whisper-server` (HTTP 模式,ggml-tiny.bin 74 MB)。

**Spec 关联:** `docs/superpowers/specs/2026-05-15-local-runtime-asr-design.md` (commit `3b5510d`)

**Plan 1+2+3A+3B 关联:** 已 ship 的 85 commits 全保留,Plan 3B `LlamaRuntimeManager` 42 个引用零改动。

---

## File Structure

### 新建文件

| 文件 | 责任 |
|---|---|
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py` | `resolve_whisper_args` 单测(~3 case) |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py` | audio.py sidecar 首选 + fallback 单测(~4 case) |
| `scripts/install-whisper-server.ps1` | Win 装 whisper-server 二进制(UTF-8 BOM) |
| `scripts/install-whisper-server.sh` | Mac/Linux 装 whisper-server 二进制 |
| `vendor/services/whisper-server/.gitkeep` | 占位,二进制装机时填充 |

### 修改文件

| 文件 | 改什么 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py` | 新增 `resolve_whisper_args(capability='asr')` + 模块常量 `_WHISPER_CAPABILITIES` / `_WHISPER_LOCAL_CAP_MAP` |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` | `LlamaRuntimeManager` 改名 `SidecarRuntimeManager`,加 `engine: Literal['llama','whisper'] = 'llama'` 参数;`find_llama_server_exe` 改名 `find_server_exe()`(按 engine 选 binary 名);`_resolve_args_for` 按 engine 派发;末尾加 `LlamaRuntimeManager(SidecarRuntimeManager)` thin alias |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py` | `CAPABILITIES = ('chat','embedding','rerank','asr')`,asr 那项构造 `engine='whisper'` |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` (LocalRuntimeSettings) | 加 `preload_asr: bool = False` + `default_asr_model: str = ""` |
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` | `_VALID_CAPABILITIES` 加 `'asr'` |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py` | preload_map 加 `'asr': settings.preload_asr` |
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py` | `run_all_checks` 末尾加第 4 个 capability check (`check_runtime_llama_status_for("asr")`) |
| `chayuan-server/libs/chayuan-server/chayuan/server/modality/audio.py` | `AudioPipeline.transcribe` 加 sidecar 路径 + 重排 fallback 顺序 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py` | 加 `SidecarRuntimeManager(engine='whisper')` 测试 + 现有 `LlamaRuntimeManager` 兼容回归 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py` | 加 asr capability 测试(数量 3→4) |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py` | 加 `/runtime/llama/asr/*` 路由测试 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py` | `run_all_checks` 长度 12→13 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py` | 长度断言 12→13 |
| `chayuan-client/packages/api/src/localRuntime.ts` | `LocalRuntimeCapability` 加 `'asr'` |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx` | `CAPABILITY_LABEL` 加 `asr: '语音识别'` |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx` | capability 数组 `['chat','embedding','rerank']` 改 `['chat','embedding','rerank','asr']` |
| `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx` | localCap mapping 加 `activeCap === 'asr' ? 'asr'` |
| `docs/RUNBOOK-local-runtime-diagnose.md` | 加 ASR 排错条目(whisper-server 缺 / 模型 / multipart 4MB 上限) |

---

## Sprint 5C-1: 后端 (Task 1-8)

### Task 1: `resolve_whisper_args` + 测试

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py`

- [ ] **Step 1: 写测试**

新建 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py`:

```python
"""resolve_whisper_args 分支测试。"""
from __future__ import annotations

import pytest

from chayuan.server.model_registry import process_args


def _fake_entry(model_id, fmt, path):
    return type("Entry", (), {
        "model_id": model_id,
        "format": fmt,
        "path": path,
        "capability": "asr",
    })()


def test_resolve_whisper_args_asr_default(monkeypatch):
    """capability=asr(默认)走 asr default,args 含 --model + ggml 路径。"""
    e = _fake_entry("whisper-tiny", "ggml", "/tmp/ggml-tiny.bin")
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_whisper_args()
    assert r.process == "whispercpp"
    assert "--model" in r.args
    assert "/tmp/ggml-tiny.bin" in r.args
    assert r.resolved_models["asr"] == "whisper-tiny"


def test_resolve_whisper_args_unknown_capability_raises():
    """非 asr 的 capability 抛 ValueError。"""
    with pytest.raises(ValueError, match="capability"):
        process_args.resolve_whisper_args(capability="chat")  # type: ignore[arg-type]


def test_resolve_whisper_args_missing_model_reports_asr(monkeypatch):
    """模型未解到时 missing 列表里是 'asr'(不是硬编码 chat)。"""
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (None, "no asr candidate"))
    r = process_args.resolve_whisper_args()
    assert "asr" in r.missing
    assert r.reason == "no asr candidate"


def test_resolve_whisper_args_non_ggml_rejected(monkeypatch):
    """模型 format 不是 ggml 时拒绝。"""
    e = _fake_entry("whisper-tiny", "safetensors", "/tmp/something.safetensors")
    monkeypatch.setattr(process_args, "_resolve", lambda cap, **kw: (e, ""))
    r = process_args.resolve_whisper_args()
    assert "asr" in r.missing
    assert "ggml" in r.reason
```

- [ ] **Step 2: 跑测试,确认 4 fail**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py -v
```

Expected: 4 fail(`AttributeError: module 'chayuan.server.model_registry.process_args' has no attribute 'resolve_whisper_args'`)。

- [ ] **Step 3: 加 resolve_whisper_args 到 process_args.py**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py`,在 `resolve_llamacpp_args` 函数(Plan 3B 加的)之后追加:

```python
_WHISPER_CAPABILITIES = ("asr",)
_WHISPER_LOCAL_CAP_MAP = {
    "asr": "asr",
}


def resolve_whisper_args(
    *,
    capability: str = "asr",
    n_threads: Optional[int] = None,
) -> Resolution:
    """``whisper-server`` 启动时的 args。

    capability:
      * ``asr`` → asr default + ggml 模型 + --model <path>
    """
    if capability not in _WHISPER_CAPABILITIES:
        raise ValueError(f"Unknown capability for whisper: {capability!r}")

    local_cap = _WHISPER_LOCAL_CAP_MAP[capability]
    r = Resolution(process="whispercpp")
    entry, reason = _resolve(capability, prefer_format="ggml", local_cap=local_cap)
    if entry is None or entry.format != "ggml":
        r.missing.append(capability)
        r.reason = reason if entry is None else (
            f"{capability} model {entry.model_id!r} format={entry.format!r} 不是 ggml"
        )
        return r

    r.args.extend(["--model", entry.path])
    if n_threads is not None:
        r.args.extend(["--threads", str(int(n_threads))])
    r.resolved_models[capability] = entry.model_id
    r.reason = reason
    return r
```

- [ ] **Step 4: 跑测试,确认 4 passed**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py -v
```

- [ ] **Step 5: 跑 Plan 3B 现有 process_args 测试确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_process_args_capability.py -v 2>&1 | tail -5
```

Expected: 5 passed(Plan 3B 已有)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/process_args.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py
git commit -m "feat(process_args): resolve_whisper_args + asr capability (Plan 3C)"
```

---

### Task 2: `SidecarRuntimeManager` 改名 + `engine` 参数 + LlamaRuntimeManager alias

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试(验证 alias 兼容 + engine 参数)**

在 `test_local_runtime.py` 末尾追加:

```python
def test_sidecar_runtime_manager_default_engine_is_llama(tmp_path):
    """SidecarRuntimeManager 默认 engine='llama'(向后兼容)。"""
    from chayuan.server.model_registry.local_runtime import SidecarRuntimeManager
    m = SidecarRuntimeManager(chayuan_root=tmp_path)
    assert m.engine == "llama"
    assert m.capability == "chat"


def test_sidecar_runtime_manager_whisper_engine(tmp_path):
    """SidecarRuntimeManager(engine='whisper') 字段正确。"""
    from chayuan.server.model_registry.local_runtime import SidecarRuntimeManager
    m = SidecarRuntimeManager(
        chayuan_root=tmp_path, engine="whisper", capability="asr", port_offset=3
    )
    assert m.engine == "whisper"
    assert m.capability == "asr"
    assert m.port_offset == 3


def test_llama_runtime_manager_alias_inherits_sidecar(tmp_path):
    """LlamaRuntimeManager 是 SidecarRuntimeManager 子类,默认 engine='llama'。"""
    from chayuan.server.model_registry.local_runtime import (
        LlamaRuntimeManager, SidecarRuntimeManager,
    )
    m = LlamaRuntimeManager(chayuan_root=tmp_path)
    assert isinstance(m, SidecarRuntimeManager)
    assert m.engine == "llama"


def test_llama_runtime_manager_alias_with_capability_kw(tmp_path):
    """Plan 3B 已有写法 LlamaRuntimeManager(chayuan_root=..., capability='embedding', port_offset=1) 仍 work。"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path, capability="embedding", port_offset=1)
    assert m.engine == "llama"
    assert m.capability == "embedding"
    assert m.port_offset == 1
```

- [ ] **Step 2: 跑测试,确认 4 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "sidecar_runtime_manager or llama_runtime_manager_alias"
```

- [ ] **Step 3: 改 local_runtime.py 把 LlamaRuntimeManager 改名 SidecarRuntimeManager**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`。

找到 `class LlamaRuntimeManager:` (大约 line 170+)。整段类定义替换 — **把类名改为 `SidecarRuntimeManager`**,并在 `__init__` 加 `engine` 参数:

```python
class SidecarRuntimeManager:
    """通用 sidecar (llama / whisper) 生命周期管理。

    Plan 3C 起从 LlamaRuntimeManager 改名,加 ``engine`` 参数:
      * ``engine='llama'``   → spawn llama-server (chat/embedding/rerank)
      * ``engine='whisper'`` → spawn whisper-server (asr)

    构造器其它参数:
      * capability ∈ {chat, embedding, rerank, asr}
      * port_offset → base port (settings.port) 偏移
      * _persist_status 按 capability 分 key,多 manager 写 runtime.json 不互覆盖
    """

    def __init__(
        self,
        *,
        chayuan_root: Path,
        engine: Literal["llama", "whisper"] = "llama",
        capability: str = "chat",
        port_offset: int = 0,
    ) -> None:
        self.chayuan_root = chayuan_root
        self.engine = engine
        self.capability = capability
        self.port_offset = port_offset
        # 其它字段保留 Plan 3B 内容不动:
        self.settings_path = chayuan_root / "model_registry" / "local_runtime.yaml"
        self.status_path = chayuan_root / "runtime.json"
        self._settings = LocalRuntimeSettings.load(self.settings_path)
        self._status = RuntimeStatus(state="stopped")
        self._process = None
```

(注意:保留 Plan 3B `__init__` 内所有其它字段。`engine` 紧跟 `chayuan_root` 之后,在 `capability` 之前,作为新加的 keyword-only 参数。)

如果 `Literal` 不在 typing 顶部 import,加上:

```python
from typing import Any, Dict, Literal, Optional
```

(Plan 3B 已经有 `Literal`,本步只是确认。)

在文件末尾(get_manager 之后)加 `LlamaRuntimeManager` 子类 alias:

```python
# Plan 3C: Plan 1+2+3B 已有 42 个引用都叫 LlamaRuntimeManager。
# 保留同名 thin alias,默认 engine='llama',旧代码零改动。
class LlamaRuntimeManager(SidecarRuntimeManager):
    """Back-compat alias(Plan 3C 起 SidecarRuntimeManager 的 engine='llama' 子类)。"""

    def __init__(self, **kw):
        kw.setdefault("engine", "llama")
        super().__init__(**kw)
```

- [ ] **Step 4: 跑测试,确认 4 新测试 passed + Plan 3B 现有测试不破**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v 2>&1 | tail -10
```

Expected: 全过(Plan 3B 25 + 4 新 = 29 passed)。

如果 Plan 3B 现有测试因 `LlamaRuntimeManager` 类签名变化失败(理论上不会,因为 alias 处理了),按报错调整。

- [ ] **Step 5: 跑 Plan 3B registry / routes 测试确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py -v 2>&1 | tail -5
```

Expected: 全过(Plan 3B 23 个 passed)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): LlamaRuntimeManager → SidecarRuntimeManager + engine 参数 + alias (Plan 3C)"
```

---

### Task 3: `find_server_exe` 按 engine 选 binary 名

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

```python
def test_find_server_exe_llama_engine(tmp_path, monkeypatch):
    """engine='llama' 找 llama-server[.exe]。"""
    from chayuan.server.model_registry import local_runtime as lr
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    exe = services / "llama-server.exe"
    exe.write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    m = lr.SidecarRuntimeManager(chayuan_root=tmp_path, engine="llama")
    assert m.find_server_exe() == exe


def test_find_server_exe_whisper_engine(tmp_path, monkeypatch):
    """engine='whisper' 找 whisper-server[.exe]。"""
    from chayuan.server.model_registry import local_runtime as lr
    services = tmp_path / "services" / "whisper-server"
    services.mkdir(parents=True)
    exe = services / "whisper-server.exe"
    exe.write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    m = lr.SidecarRuntimeManager(chayuan_root=tmp_path, engine="whisper", capability="asr", port_offset=3)
    assert m.find_server_exe() == exe


def test_find_server_exe_missing_returns_none(tmp_path, monkeypatch):
    """vendor 目录里没装,返回 None。"""
    from chayuan.server.model_registry import local_runtime as lr
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])
    m = lr.SidecarRuntimeManager(chayuan_root=tmp_path, engine="whisper")
    assert m.find_server_exe() is None


def test_find_llama_server_exe_back_compat(tmp_path, monkeypatch):
    """Plan 3B 已有 find_llama_server_exe 方法名,保留可调(返同一结果)。"""
    from chayuan.server.model_registry import local_runtime as lr
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    exe = services / "llama-server.exe"
    exe.write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    m = lr.LlamaRuntimeManager(chayuan_root=tmp_path)
    assert m.find_llama_server_exe() == exe
    assert m.find_server_exe() == exe
```

- [ ] **Step 2: 跑测试,确认 4 fail (AttributeError: find_server_exe)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "find_server_exe or find_llama_server_exe_back_compat"
```

- [ ] **Step 3: 改 find_llama_server_exe → find_server_exe(按 engine 选 binary 名)**

打开 `local_runtime.py`,找到 `find_llama_server_exe` 方法(Plan 3B 命名,大约 line 199-225):

```python
    def find_llama_server_exe(self) -> Optional[Path]:
        """在 install 目录树里找 llama-server[.exe]"""
        global _INSTALL_SERVICES_DIRS
        dirs = _INSTALL_SERVICES_DIRS if _INSTALL_SERVICES_DIRS is not None else _default_install_services_dirs()
        names = ["llama-server.exe", "llama-server"]
        ...
```

把它改名 `find_server_exe` 并按 `self.engine` 切换 binary 名 + 子目录:

```python
    def find_server_exe(self) -> Optional[Path]:
        """在 install 目录树里找 sidecar binary。

        engine='llama'   → 子目录 services/llama-server/,binary llama-server[.exe]
        engine='whisper' → 子目录 services/whisper-server/,binary whisper-server[.exe]
        """
        global _INSTALL_SERVICES_DIRS
        dirs = _INSTALL_SERVICES_DIRS if _INSTALL_SERVICES_DIRS is not None else _default_install_services_dirs()
        bin_name = f"{self.engine}-server"
        names = [f"{bin_name}.exe", bin_name]
        for base in dirs:
            sub = base / bin_name
            if sub.is_dir():
                for name in names:
                    p = sub / name
                    if p.is_file():
                        return p
        return None

    # Plan 3B 已有方法名,保留 alias 给老调用方
    def find_llama_server_exe(self) -> Optional[Path]:
        """Deprecated:Plan 3C 起改用 find_server_exe();此 alias 留作向后兼容。"""
        return self.find_server_exe()
```

注意:**保留原 `find_llama_server_exe` 方法名作 alias**(返回 `self.find_server_exe()`),让 Plan 1 起的所有调用方零改动。

如果原方法体里有跨 dir 的查找逻辑(不止 `sub / name`,可能 fallback 直接 `base / name`),保留这套查找,只改 binary 名和子目录名。

- [ ] **Step 4: 跑测试,确认 4 passed**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "find_server_exe or find_llama_server_exe"
```

- [ ] **Step 5: 跑全套 local_runtime 测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v 2>&1 | tail -8
```

Expected: 33 passed(29 + 4 新)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): find_server_exe 按 engine 找 binary (Plan 3C)"
```

---

### Task 4: `_resolve_args_for` 按 engine 派发 + start 内 spawn binary

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

```python
@pytest.mark.asyncio
async def test_sidecar_whisper_start_uses_whisper_resolver(tmp_path, monkeypatch):
    """engine='whisper' 启动时调 resolve_whisper_args(capability='asr')。"""
    from chayuan.server.model_registry import local_runtime as lr
    from chayuan.server.model_registry import process_args

    services = tmp_path / "services" / "whisper-server"
    services.mkdir(parents=True)
    (services / "whisper-server.exe").write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    captured = []

    def fake_whisper_resolve(**kw):
        captured.append(("whisper", kw.get("capability", "<missing>")))
        return process_args.Resolution(
            process="whispercpp",
            args=["--model", "/tmp/ggml-tiny.bin"],
            resolved_models={"asr": "whisper-tiny"},
        )

    monkeypatch.setattr(lr.process_args, "resolve_whisper_args", fake_whisper_resolve)

    fake_proc = mock.MagicMock(pid=777, poll=mock.MagicMock(return_value=None))
    monkeypatch.setattr(lr.subprocess, "Popen", mock.MagicMock(return_value=fake_proc))
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(lr, "_probe_health", fake_health)

    m = lr.SidecarRuntimeManager(chayuan_root=tmp_path, engine="whisper", capability="asr", port_offset=3)
    status = await m.start()
    assert status.state == "ready"
    assert captured == [("whisper", "asr")]


@pytest.mark.asyncio
async def test_sidecar_llama_start_still_uses_llama_resolver(tmp_path, monkeypatch):
    """engine='llama'(Plan 3B 行为)仍走 resolve_llamacpp_args。"""
    from chayuan.server.model_registry import local_runtime as lr
    from chayuan.server.model_registry import process_args

    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    (services / "llama-server.exe").write_bytes(b"stub")
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    captured = []
    monkeypatch.setattr(
        lr.process_args, "resolve_llamacpp_args",
        lambda **kw: (captured.append(("llama", kw.get("capability"))), process_args.Resolution(
            process="llamacpp",
            args=["--model", "/tmp/qwen.gguf", "--ctx-size", "8192"],
            resolved_models={"chat": "qwen"},
        ))[1],
    )

    fake_proc = mock.MagicMock(pid=111, poll=mock.MagicMock(return_value=None))
    monkeypatch.setattr(lr.subprocess, "Popen", mock.MagicMock(return_value=fake_proc))
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(lr, "_probe_health", fake_health)

    m = lr.SidecarRuntimeManager(chayuan_root=tmp_path, engine="llama", capability="chat")
    status = await m.start()
    assert status.state == "ready"
    assert captured == [("llama", "chat")]
```

- [ ] **Step 2: 跑测试,确认 2 fail**

- [ ] **Step 3: 改 _resolve_args_for 派发 engine**

在 `local_runtime.py` 找到 Plan 3B 加的 `_resolve_args_for(capability, ...)` (module-level):

```python
def _resolve_args_for(
    capability: str,
    *,
    n_ctx: int | None = None,
    n_threads: int | None = None,
):
    """调 process_args.resolve_llamacpp_args,返回 (resolution, model_path)。"""
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
```

改成接 engine 参数派发:

```python
def _resolve_args_for(
    capability: str,
    *,
    engine: str = "llama",
    n_ctx: int | None = None,
    n_threads: int | None = None,
):
    """调对应 engine 的 process_args.resolve_*,返回 (resolution, model_path)。

    Plan 3C 起 engine 参数派发:
      * engine='llama'   → resolve_llamacpp_args
      * engine='whisper' → resolve_whisper_args
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
    else:
        raise ValueError(f"Unknown engine: {engine!r}")

    if r.missing:
        return r, None
    try:
        i = r.args.index("--model")
        return r, r.args[i + 1]
    except (ValueError, IndexError):
        return r, None


# Plan 3B 旧名兼容
def _resolve_chat_args(**kw):
    return _resolve_args_for("chat", **kw)
```

(`_resolve_chat_args` Plan 3B alias 保留,但加 engine 默认 'llama'。)

在 `SidecarRuntimeManager.start()` 内,找到 Plan 3B 加的:

```python
        resolution, model_path = _resolve_args_for(self.capability)
```

改成传 engine:

```python
        resolution, model_path = _resolve_args_for(self.capability, engine=self.engine)
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v 2>&1 | tail -10
```

Expected: 35 passed(33 + 2 新)。

- [ ] **Step 5: 跑全套 process_args/local_runtime/registry/routes 测试确认无回归**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest \
  libs/chayuan-server/tests/unit_tests/test_process_args_capability.py \
  libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py \
  libs/chayuan-server/tests/unit_tests/test_local_runtime.py \
  libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py \
  libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py \
  libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py \
  -q 2>&1 | tail -3
```

Expected: 全过(~80 passed)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): _resolve_args_for 按 engine 派发 + start 用 engine (Plan 3C)"
```

---

### Task 5: `LocalRuntimeRegistry` 加 asr capability

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py`

- [ ] **Step 1: 加测试**

打开 `test_local_runtime_registry.py`,把现有的 `test_registry_constructs_three_managers` 测试改成 four(或新加一个 four 测试):

```python
def test_registry_constructs_four_managers(tmp_path):
    """Plan 3C: registry 含 chat/embedding/rerank/asr 4 个 manager。"""
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    assert set(reg._managers.keys()) == {"chat", "embedding", "rerank", "asr"}
    assert reg.get("chat").engine == "llama"
    assert reg.get("chat").port_offset == 0
    assert reg.get("embedding").engine == "llama"
    assert reg.get("embedding").port_offset == 1
    assert reg.get("rerank").engine == "llama"
    assert reg.get("rerank").port_offset == 2
    assert reg.get("asr").engine == "whisper"
    assert reg.get("asr").port_offset == 3


def test_registry_all_statuses_four_caps(tmp_path):
    """all_statuses() 返 4 项,asr 初始 stopped。"""
    from chayuan.server.model_registry.local_runtime_registry import LocalRuntimeRegistry
    reg = LocalRuntimeRegistry(chayuan_root=tmp_path)
    sts = reg.all_statuses()
    assert set(sts.keys()) == {"chat", "embedding", "rerank", "asr"}
    for cap, st in sts.items():
        assert st.state == "stopped"
```

把 Plan 3B 原 `test_registry_constructs_three_managers` 测试改名为四 manager 版本(或保留同名但断言改 4)。具体动作:
- 找现有 `test_registry_constructs_three_managers` 测试,直接 **删掉**(被新的 `test_registry_constructs_four_managers` 替代)。
- 找现有 `test_registry_all_statuses` 测试,**删掉**(被 `test_registry_all_statuses_four_caps` 替代)。
- 其它 4 个 registry 测试(`test_registry_get_unknown_raises`、`stop_all_calls_each_stop`、`stop_all_continues_when_one_raises`、`test_get_registry_singleton`)保留不动。

- [ ] **Step 2: 跑测试,确认 2 fail(因为 CAPABILITIES 还是 3 个)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py -v 2>&1 | tail -10
```

- [ ] **Step 3: 改 LocalRuntimeRegistry**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py`,找到 Plan 3B 的:

```python
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
```

替换为(用 SidecarRuntimeManager + 按 cap 派发 engine):

```python
# Plan 3C: cap → engine 映射
_CAP_ENGINE: Dict[str, str] = {
    "chat": "llama",
    "embedding": "llama",
    "rerank": "llama",
    "asr": "whisper",
}


class LocalRuntimeRegistry:
    CAPABILITIES = ("chat", "embedding", "rerank", "asr")

    def __init__(self, *, chayuan_root: Path) -> None:
        from chayuan.server.model_registry.local_runtime import SidecarRuntimeManager
        self._managers: Dict[str, SidecarRuntimeManager] = {
            cap: SidecarRuntimeManager(
                chayuan_root=chayuan_root,
                engine=_CAP_ENGINE[cap],
                capability=cap,
                port_offset=i,
            )
            for i, cap in enumerate(self.CAPABILITIES)
        }
```

(注意:`LlamaRuntimeManager` 替换为 `SidecarRuntimeManager` 是因为 Plan 3C 已经做了改名;Plan 3B 已 ship 的代码用 `LlamaRuntimeManager` 也能 work,因为它是 alias,但语义上 registry 现在应该用 SidecarRuntimeManager。`from ... import` 改成顶部 import 也行。)

文件顶部如有 `from ... import LlamaRuntimeManager, RuntimeStatus`,改成:

```python
from chayuan.server.model_registry.local_runtime import SidecarRuntimeManager, RuntimeStatus
```

(留 `RuntimeStatus` 因为 `all_statuses()` 返 `Dict[str, RuntimeStatus]`。)

`all_statuses()` / `stop_all()` 内部 type hint 用 `SidecarRuntimeManager`(如果原来用 `LlamaRuntimeManager`)。

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py -v 2>&1 | tail -10
```

Expected: 6 passed(Plan 3B 6 个 + 2 新替换 = 6 新,实际不变 6 passed)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime_registry.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py
git commit -m "feat(registry): LocalRuntimeRegistry 加 asr capability (engine='whisper') (Plan 3C)"
```

---

### Task 6: 路由 `_VALID_CAPABILITIES` 加 'asr'

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py`

- [ ] **Step 1: 加测试**

打开 `test_runtime_routes_llama_multi_cap.py`,**改 fixture**:在 `fake_managers` dict 加 `'asr'` 项:

```python
@pytest.fixture
def client(monkeypatch):
    """注入 fake registry 让 4 个 capability 全可 mock。"""
    fake_managers = {}
    caps = ("chat", "embedding", "rerank", "asr")  # Plan 3C: 加 asr
    for cap in caps:
        fm = mock.MagicMock()
        fm.status = RuntimeStatus(state="stopped")
        idx = caps.index(cap)
        fm.start = mock.AsyncMock(return_value=RuntimeStatus(state="ready", endpoint=f"http://127.0.0.1:{62582 + idx}"))
        fm.stop = mock.AsyncMock(return_value=None)
        fm.restart = mock.AsyncMock(return_value=RuntimeStatus(state="ready"))
        fake_managers[cap] = fm

    fake_registry = mock.MagicMock()
    fake_registry._managers = fake_managers

    def fake_get(cap):
        if cap not in fake_managers:
            raise ValueError(f"unknown capability: {cap!r}")
        return fake_managers[cap]
    fake_registry.get = fake_get
    fake_registry.all_statuses = lambda: {cap: fm.status for cap, fm in fake_managers.items()}

    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    app = FastAPI()
    app.include_router(runtime_router)
    return TestClient(app), fake_managers
```

(把 `caps = ("chat", "embedding", "rerank")` 改 4 项即可,其它 fixture 代码不动。)

在文件末尾追加 2 个 asr 测试:

```python
def test_llama_capability_status_asr(client):
    c, fms = client
    fms["asr"].status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62585", pid=99)
    r = c.get("/runtime/llama/asr/status")
    assert r.status_code == 200
    assert r.json()["data"]["state"] == "ready"
    assert r.json()["data"]["endpoint"] == "http://127.0.0.1:62585"


def test_llama_capability_start_asr(client):
    c, fms = client
    r = c.post("/runtime/llama/asr/start")
    assert r.status_code == 200
    fms["asr"].start.assert_awaited_once()
    fms["chat"].start.assert_not_called()
```

把 `test_llama_registry_returns_three_caps` 测试改名 + 改断言为 4:

```python
def test_llama_registry_returns_four_caps(client):
    c, _ = client
    r = c.get("/runtime/llama/registry")
    assert r.status_code == 200
    data = r.json()["data"]
    assert set(data.keys()) == {"chat", "embedding", "rerank", "asr"}
```

(把原 `three_caps` 测试名换 `four_caps`,断言集合加 'asr'。)

- [ ] **Step 2: 跑测试,确认 asr 路由 404**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py -v 2>&1 | tail -10
```

Expected: `test_llama_capability_status_asr` 和 `test_llama_capability_start_asr` 失败,返 400(`_VALID_CAPABILITIES` 还不含 asr)。

- [ ] **Step 3: 改 runtime_routes.py**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`,找到 Plan 3B 加的:

```python
_VALID_CAPABILITIES = {"chat", "embedding", "rerank"}
```

改成:

```python
_VALID_CAPABILITIES = {"chat", "embedding", "rerank", "asr"}
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py -v 2>&1 | tail -10
```

Expected: 9 passed(Plan 3B 7 个 + 2 新 asr)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py
git commit -m "feat(api): _VALID_CAPABILITIES 加 asr (Plan 3C)"
```

---

### Task 7: `LocalRuntimeSettings` 加 preload_asr / default_asr_model

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

在 `test_local_runtime.py` 末尾追加:

```python
def test_local_runtime_settings_asr_fields_defaults():
    """Plan 3C: preload_asr / default_asr_model 默认值。"""
    s = LocalRuntimeSettings()
    assert s.preload_asr is False
    assert s.default_asr_model == ""


def test_local_runtime_settings_asr_round_trip(tmp_path):
    """Plan 3C: asr 字段 yaml round-trip。"""
    yaml_path = tmp_path / "lr.yaml"
    s = LocalRuntimeSettings(preload_asr=True, default_asr_model="whisper-tiny")
    s.save(yaml_path)
    s2 = LocalRuntimeSettings.load(yaml_path)
    assert s2.preload_asr is True
    assert s2.default_asr_model == "whisper-tiny"


def test_local_runtime_settings_old_yaml_no_asr_field(tmp_path):
    """Plan 3B 写的 yaml(无 asr 字段)加载时 asr 取默认值。"""
    yaml_path = tmp_path / "lr.yaml"
    yaml_path.write_text(
        "preload_on_startup: true\nhost: 127.0.0.1\nport: 62582\n"
        "preload_embedding: false\npreload_rerank: false\n",
        encoding="utf-8",
    )
    s = LocalRuntimeSettings.load(yaml_path)
    assert s.preload_asr is False
    assert s.default_asr_model == ""
```

- [ ] **Step 2: 跑测试,确认 3 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "asr_fields_defaults or asr_round_trip or old_yaml_no_asr_field"
```

- [ ] **Step 3: 改 LocalRuntimeSettings 加 2 字段**

打开 `local_runtime.py`,找到 Plan 3B `@dataclasses.dataclass class LocalRuntimeSettings:` 块:

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

末尾追加 Plan 3C 字段:

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
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v 2>&1 | tail -8
```

Expected: 38 passed(35 + 3 新)。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): LocalRuntimeSettings 加 preload_asr + default_asr_model (Plan 3C)"
```

---

### Task 8: first_launch + diagnose 接 asr

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py`

- [ ] **Step 1: 改 first_launch.py 加 asr preload**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py`,找到 Plan 3B 加的 preload_map:

```python
            preload_map = {
                "chat": settings.preload_on_startup,
                "embedding": settings.preload_embedding,
                "rerank": settings.preload_rerank,
            }
```

加 asr 一项:

```python
            preload_map = {
                "chat": settings.preload_on_startup,
                "embedding": settings.preload_embedding,
                "rerank": settings.preload_rerank,
                "asr": settings.preload_asr,
            }
```

- [ ] **Step 2: 改 diagnose/__init__.py 加 asr check**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`,找到 Plan 3B `run_all_checks` 末尾:

```python
        _checks._safe_call("runtime.llama.chat.status",
                           lambda: _checks.check_runtime_llama_status_for("chat")),
        _checks._safe_call("runtime.llama.embedding.status",
                           lambda: _checks.check_runtime_llama_status_for("embedding")),
        _checks._safe_call("runtime.llama.rerank.status",
                           lambda: _checks.check_runtime_llama_status_for("rerank")),
    ]
```

加 asr 一行:

```python
        _checks._safe_call("runtime.llama.chat.status",
                           lambda: _checks.check_runtime_llama_status_for("chat")),
        _checks._safe_call("runtime.llama.embedding.status",
                           lambda: _checks.check_runtime_llama_status_for("embedding")),
        _checks._safe_call("runtime.llama.rerank.status",
                           lambda: _checks.check_runtime_llama_status_for("rerank")),
        _checks._safe_call("runtime.llama.asr.status",
                           lambda: _checks.check_runtime_llama_status_for("asr")),
    ]
```

- [ ] **Step 3: 改测试断言长度 12→13**

打开 `test_diagnose_checks.py`,找到 `test_run_all_checks_returns_report_with_summary`(Plan 3B 改过的):

```python
    assert len(report.checks) == 12
    ...
    assert s["ok"] + s["warn"] + s["fail"] == 12
```

改成:

```python
    assert len(report.checks) == 13
    ...
    assert s["ok"] + s["warn"] + s["fail"] == 13
```

打开 `test_runtime_route_diagnose.py`,找到 `test_runtime_diagnose_returns_ok_envelope`:

```python
    assert len(data["checks"]) == 12
    assert data["summary"]["ok"] + data["summary"]["warn"] + data["summary"]["fail"] == 12
```

改成 13。

- [ ] **Step 4: 加 asr 测试条目**

在 `test_diagnose_checks.py` 加一条 asr-specific 测试:

```python
def test_check_runtime_llama_status_for_asr_ready(monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status_for
    from chayuan.server.model_registry import local_runtime as lr
    _patch_registry_status(monkeypatch, {
        "asr": lr.RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62585", pid=10, model_id="whisper-tiny"),
    })
    c = check_runtime_llama_status_for("asr")
    assert c.name == "runtime.llama.asr.status"
    assert c.severity == "ok"
    assert "whisper-tiny" in c.detail
```

(`_patch_registry_status` 是 Plan 3B Task 8 加的 helper,本测试直接复用。)

- [ ] **Step 5: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py -v 2>&1 | tail -10
```

Expected: 全过(Plan 3B 21+2 + 1 新 asr = 24 passed)。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py
git commit -m "feat(local-runtime): first_launch + diagnose 接 asr (Plan 3C)"
```

---

## Sprint 5C-2: vendor + audio.py (Task 9-12)

### Task 9: `scripts/install-whisper-server.ps1` (Win, UTF-8 BOM)

**Files:**
- Create: `scripts/install-whisper-server.ps1`
- Create: `vendor/services/whisper-server/.gitkeep`

- [ ] **Step 1: 看 Plan 1 install-llama-server.ps1 风格**

```bash
grep -n "Invoke-WebRequest\|Expand-Archive\|release.*tag" /work/chayuan-desktop/scripts/install-llama-server.ps1 | head -10
```

(参考它的下载 + 解压 + 验证套路。)

- [ ] **Step 2: 写 install-whisper-server.ps1(UTF-8 BOM)**

新建 `/work/chayuan-desktop/scripts/install-whisper-server.ps1`(必须 UTF-8 BOM,见 Plan 3A 经验):

```powershell
# install-whisper-server.ps1 — 装 whisper.cpp `whisper-server.exe` (Windows)
# 用法: pwsh -File scripts/install-whisper-server.ps1
$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DestDir = Join-Path $RepoRoot "vendor/services/whisper-server"

if (-not (Test-Path $DestDir)) { New-Item -ItemType Directory -Path $DestDir | Out-Null }

# whisper.cpp Win release tag 优先级 (新→老 fallback)
$Tags = @("v1.7.4", "v1.7.3", "v1.7.2")
$Asset = "whisper-bin-x64.zip"  # Win pre-built 二进制 zip

$ok = $false
foreach ($tag in $Tags) {
    $Url = "https://github.com/ggerganov/whisper.cpp/releases/download/$tag/$Asset"
    Write-Host "[install-whisper] 尝试拉 $Url"
    $tmpZip = Join-Path $env:TEMP "whisper-server-$tag.zip"
    try {
        Invoke-WebRequest -Uri $Url -OutFile $tmpZip -ErrorAction Stop
        $tmpDir = Join-Path $env:TEMP "whisper-server-$tag"
        if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
        Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
        $exe = Get-ChildItem -Recurse -Path $tmpDir -Filter "whisper-server.exe" | Select-Object -First 1
        if (-not $exe) {
            Write-Warning "[install-whisper] $tag zip 里没找到 whisper-server.exe,试下一个 tag"
            continue
        }
        Copy-Item -Path $exe.FullName -Destination (Join-Path $DestDir "whisper-server.exe") -Force
        # 同时复制依赖 DLL (whisper.cpp Win build 通常带几个)
        Get-ChildItem -Recurse -Path $tmpDir -Filter "*.dll" | ForEach-Object {
            Copy-Item -Path $_.FullName -Destination (Join-Path $DestDir $_.Name) -Force
        }
        $ok = $true
        Write-Host "[install-whisper] 装好 $tag → $DestDir"
        break
    } catch {
        Write-Warning "[install-whisper] $tag 失败:$_"
    }
}

if (-not $ok) { throw "[install-whisper] 所有 release tag 都失败,检查网络 / GitHub release 可达性" }

# 验证 binary 可执行
$bin = Join-Path $DestDir "whisper-server.exe"
& $bin --help 2>&1 | Select-Object -First 3
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    throw "[install-whisper] whisper-server.exe --help 退出码 $LASTEXITCODE,可能 AVX2 / Visual C++ Runtime 缺失"
}
Write-Host "[install-whisper] OK"
```

(注:实际 ggerganov/whisper.cpp Win release 的 asset 名 / 内部结构可能跟"whisper-bin-x64.zip"不同,如真机跑时找不到,看 https://github.com/ggerganov/whisper.cpp/releases 实际 asset 名再调脚本的 `$Asset` 变量。本 plan 不锁死 release 版本号或 asset 文件名,留给真机装机时按当时实际 release 调整。)

- [ ] **Step 3: 占位 .gitkeep**

新建 `/work/chayuan-desktop/vendor/services/whisper-server/.gitkeep`:

```bash
mkdir -p /work/chayuan-desktop/vendor/services/whisper-server
touch /work/chayuan-desktop/vendor/services/whisper-server/.gitkeep
```

(让目录进 git,实际 binary 由 install-whisper-server.{ps1,sh} 真机装时填充。)

- [ ] **Step 4: 验证 UTF-8 BOM**

```bash
file /work/chayuan-desktop/scripts/install-whisper-server.ps1
```

Expected: `... UTF-8 Unicode (with BOM) text` 或类似。

如果没有 BOM,加上:

```bash
python3 -c "
content = open('/work/chayuan-desktop/scripts/install-whisper-server.ps1', 'rb').read()
if not content.startswith(b'\xef\xbb\xbf'):
    open('/work/chayuan-desktop/scripts/install-whisper-server.ps1', 'wb').write(b'\xef\xbb\xbf' + content)
    print('Added BOM')
else:
    print('Already has BOM')
"
```

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add scripts/install-whisper-server.ps1 vendor/services/whisper-server/.gitkeep
git commit -m "feat(scripts): install-whisper-server.ps1 (Win, Plan 3C)"
```

---

### Task 10: `scripts/install-whisper-server.sh` (Mac/Linux)

**Files:**
- Create: `scripts/install-whisper-server.sh`

- [ ] **Step 1: 写 sh 脚本**

新建 `/work/chayuan-desktop/scripts/install-whisper-server.sh`(无 BOM,可执行):

```bash
#!/usr/bin/env bash
# install-whisper-server.sh — 装 whisper.cpp `whisper-server` (Mac / Linux)
# 用法: bash scripts/install-whisper-server.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST_DIR="$REPO_ROOT/vendor/services/whisper-server"

mkdir -p "$DEST_DIR"

OS="$(uname -s)"
case "$OS" in
    Darwin)  ASSET="whisper-bin-macos-arm64.tar.gz"; PLATFORM="macos-arm64" ;;
    Linux)   ASSET="whisper-bin-linux-x64.tar.gz"; PLATFORM="linux-x64" ;;
    *) echo "[install-whisper] 不支持的 OS: $OS"; exit 1 ;;
esac

TAGS=("v1.7.4" "v1.7.3" "v1.7.2")
TMP="${TMPDIR:-/tmp}/whisper-server-$$"
mkdir -p "$TMP"
trap "rm -rf $TMP" EXIT

ok=0
for tag in "${TAGS[@]}"; do
    URL="https://github.com/ggerganov/whisper.cpp/releases/download/$tag/$ASSET"
    echo "[install-whisper] 尝试拉 $URL"
    if curl -fsSL "$URL" -o "$TMP/asset.tar.gz" 2>/dev/null; then
        tar -xzf "$TMP/asset.tar.gz" -C "$TMP"
        SERVER_BIN=$(find "$TMP" -name "whisper-server" -type f | head -n 1 || true)
        if [ -z "$SERVER_BIN" ]; then
            echo "[install-whisper] $tag tarball 里没找到 whisper-server,试下一个 tag"
            continue
        fi
        cp "$SERVER_BIN" "$DEST_DIR/whisper-server"
        chmod +x "$DEST_DIR/whisper-server"
        # Mac/Linux 通常 binary 自带依赖,但若有 .dylib / .so 一并复制
        find "$TMP" \( -name "*.dylib" -o -name "*.so" -o -name "*.so.*" \) -type f \
            -exec cp -f {} "$DEST_DIR/" \;
        ok=1
        echo "[install-whisper] 装好 $tag → $DEST_DIR"
        break
    else
        echo "[install-whisper] $tag 失败"
    fi
done

if [ $ok -eq 0 ]; then
    echo "[install-whisper] 所有 release tag 都失败,检查网络 / GitHub release"
    exit 1
fi

# 验证 binary 可执行
"$DEST_DIR/whisper-server" --help 2>&1 | head -3 || {
    echo "[install-whisper] whisper-server --help 失败,可能依赖库缺失"
    exit 2
}
echo "[install-whisper] OK"
```

(同样,实际 asset 名 / release 编号按真机时 ggerganov/whisper.cpp 实际 release 调。本 plan 留模板。)

- [ ] **Step 2: 确认可执行**

```bash
chmod +x /work/chayuan-desktop/scripts/install-whisper-server.sh
ls -la /work/chayuan-desktop/scripts/install-whisper-server.sh
```

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add scripts/install-whisper-server.sh
git commit -m "feat(scripts): install-whisper-server.sh (Mac/Linux, Plan 3C)"
```

---

### Task 11: `audio.py` sidecar 路径 + fallback 顺序

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/modality/audio.py`

- [ ] **Step 1: 看现状**

```bash
head -120 /work/chayuan-desktop/chayuan-server/libs/chayuan-server/chayuan/server/modality/audio.py
```

(回忆 transcribe 方法 4 路 fallback:faster-whisper → openai-whisper → OpenAI API。)

- [ ] **Step 2: 改 transcribe() 加 sidecar 路径**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/modality/audio.py`。找到 `class AudioPipeline:` 和 `def transcribe(...)` 方法。

在 `transcribe` 顶部(materialize 之后,faster-whisper 之前)插 sidecar 路径。完整 transcribe 方法替换为:

```python
    def transcribe(self, audio: Any, *, language: Optional[str] = None,
                    model: Optional[str] = None) -> str:
        """Whisper 风格转录。失败返回空字符串。

        Plan 3C 起 fallback 顺序:
          1) 本地 sidecar (whisper-server, /runtime/llama/asr/inference)
          2) faster-whisper (Python in-process)
          3) openai-whisper (Python in-process)
          4) OpenAI API
        """
        if not model:
            try:
                from chayuan.server.capability_router import resolve_model
                model = resolve_model("asr") or "base"
            except Exception:  # noqa: BLE001
                model = "base"
        try:
            path, cleanup = self._materialize(audio)
        except Exception as e:  # noqa: BLE001
            logger.warning("materialize audio 失败:%r", e)
            return ""

        # Plan 3C: 1) 本地 sidecar 优先
        try:
            text = self._transcribe_via_sidecar(path, language=language)
            if text:
                if cleanup is not None:
                    cleanup.cleanup()
                return text
        except Exception as e:  # noqa: BLE001
            logger.info("[asr] sidecar 不可用,fallback Python:%r", e)

        try:
            # 2) faster-whisper(首选 Python,速度 3-5x)
            try:
                from faster_whisper import WhisperModel  # type: ignore
                m = WhisperModel(model, device="cpu", compute_type="int8")
                segments, _info = m.transcribe(path, language=language, beam_size=1)
                return "".join(seg.text for seg in segments).strip()
            except Exception as e:  # noqa: BLE001
                logger.debug("faster-whisper 不可用:%r", e)
            # 3) openai-whisper(CPU/GPU 皆可)
            try:
                import whisper  # type: ignore
                m = whisper.load_model(model)
                out = m.transcribe(path, language=language)
                return (out.get("text") or "").strip()
            except Exception as e:  # noqa: BLE001
                logger.debug("openai-whisper 不可用:%r", e)
            # 4) OpenAI API(云端)
            try:
                from chayuan.server.utils import get_OpenAI
                client = get_OpenAI()
                with open(path, "rb") as f:
                    resp = client.audio.transcriptions.create(
                        model="whisper-1", file=f, language=language,
                    )
                return (getattr(resp, "text", "") or "").strip()
            except Exception as e:  # noqa: BLE001
                logger.warning("OpenAI ASR fallback 失败:%r", e)
            return ""
        finally:
            if cleanup is not None:
                cleanup.cleanup()
```

(注:保留 Plan 1 已有 faster-whisper / openai-whisper / OpenAI API 三段不动,只在最前加 sidecar 一段 + 处理 cleanup。)

在 `class AudioPipeline:` 内加新方法 `_transcribe_via_sidecar`:

```python
    def _transcribe_via_sidecar(self, audio_path: str, *, language: Optional[str] = None) -> str:
        """走本地 whisper-server (Plan 3C)。

        步骤:
          1. 取 registry.get('asr') 当前 status
          2. 若 state != 'ready',触发 await start() (最多 30s)
          3. POST http://127.0.0.1:<port>/inference (multipart, file)
          4. 返 JSON text 字段
        sidecar 不可用任何环节抛 Exception,上层 fallback Python。
        """
        import asyncio
        import httpx

        try:
            from chayuan.server.model_registry.local_runtime_registry import get_registry
            mgr = get_registry().get("asr")
        except Exception as e:  # noqa: BLE001
            raise RuntimeError(f"asr registry 取 manager 失败:{e}") from e

        # 确保 ready
        if mgr.status.state != "ready":
            loop = asyncio.new_event_loop()
            try:
                status = loop.run_until_complete(asyncio.wait_for(mgr.start(), timeout=30))
            finally:
                loop.close()
            if status.state != "ready":
                raise RuntimeError(f"asr sidecar start 失败 state={status.state} last_error={status.last_error}")

        endpoint = mgr.status.endpoint or ""
        if not endpoint:
            raise RuntimeError("asr sidecar endpoint 空")

        url = f"{endpoint.rstrip('/')}/inference"
        data = {}
        if language:
            data["language"] = language
        with open(audio_path, "rb") as f:
            files = {"file": (Path(audio_path).name, f, "application/octet-stream")}
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(url, data=data, files=files)
                resp.raise_for_status()
                payload = resp.json()
                return (payload.get("text") or "").strip()
```

文件顶部 import 加(如还没):

```python
from pathlib import Path
```

(其它 import 如 `httpx` / `asyncio` 在方法体内 lazy import,避免 chayuan-server 启动期循环依赖。)

- [ ] **Step 3: 写 audio.py sidecar 测试(下一 task 详细写,这里只跑现有测试不破)**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/ -v -k "audio or transcribe" 2>&1 | tail -10
```

如果 Plan 1 没有现成 audio_pipeline 测试,本步只确认 import 没破:

```bash
PYTHONPATH=libs/chayuan-server python3 -c "from chayuan.server.modality.audio import AudioPipeline; print(AudioPipeline)"
```

Expected: `<class 'chayuan.server.modality.audio.AudioPipeline'>`。

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/modality/audio.py
git commit -m "feat(modality): audio.py 加 sidecar 路径 + fallback 重排 (Plan 3C)"
```

---

### Task 12: `test_audio_pipeline_sidecar.py` 单测

**Files:**
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py`

- [ ] **Step 1: 写 4 case 测试**

新建 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py`:

```python
"""AudioPipeline.transcribe 的 sidecar 路径 + fallback 测试 (Plan 3C)。"""
from __future__ import annotations

from unittest import mock

import pytest


def _make_audio_bytes() -> bytes:
    """随便一段 16kHz mono PCM-like bytes(只是占位,不真解码)。"""
    return b"\x00" * 1024


def test_transcribe_via_sidecar_success(tmp_path, monkeypatch):
    """sidecar ready → POST /inference → 200 text → 返 text。"""
    from chayuan.server.modality.audio import AudioPipeline
    from chayuan.server.model_registry import local_runtime as lr

    # mock registry.get('asr') 返 ready manager
    fake_mgr = mock.MagicMock()
    fake_mgr.status = lr.RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62585", pid=99)

    fake_registry = mock.MagicMock()
    fake_registry.get = mock.MagicMock(return_value=fake_mgr)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    # mock httpx
    fake_resp = mock.MagicMock()
    fake_resp.json.return_value = {"text": "今天天气真好"}
    fake_resp.raise_for_status = mock.MagicMock()

    fake_client = mock.MagicMock()
    fake_client.__enter__ = mock.MagicMock(return_value=fake_client)
    fake_client.__exit__ = mock.MagicMock(return_value=None)
    fake_client.post = mock.MagicMock(return_value=fake_resp)

    monkeypatch.setattr("httpx.Client", mock.MagicMock(return_value=fake_client))

    pipe = AudioPipeline()
    result = pipe.transcribe(_make_audio_bytes(), language="zh")
    assert result == "今天天气真好"


def test_transcribe_sidecar_not_ready_falls_back_to_python(tmp_path, monkeypatch):
    """sidecar state=failed → 抛 → fallback faster-whisper(也 mock 掉返空)。"""
    from chayuan.server.modality.audio import AudioPipeline
    from chayuan.server.model_registry import local_runtime as lr

    fake_mgr = mock.MagicMock()
    fake_mgr.status = lr.RuntimeStatus(state="failed", last_error="binary 缺失")
    # start 也失败
    async def fake_start():
        return lr.RuntimeStatus(state="failed", last_error="binary 缺失")
    fake_mgr.start = mock.AsyncMock(side_effect=fake_start)

    fake_registry = mock.MagicMock()
    fake_registry.get = mock.MagicMock(return_value=fake_mgr)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    # mock faster_whisper 抛 ImportError
    import sys
    monkeypatch.setitem(sys.modules, "faster_whisper", None)
    monkeypatch.setitem(sys.modules, "whisper", None)
    # OpenAI client 也抛
    monkeypatch.setattr(
        "chayuan.server.utils.get_OpenAI",
        mock.MagicMock(side_effect=RuntimeError("no openai")),
    )

    pipe = AudioPipeline()
    result = pipe.transcribe(_make_audio_bytes())
    # 全失败时 transcribe 返空字符串
    assert result == ""


def test_transcribe_sidecar_5xx_falls_back(tmp_path, monkeypatch):
    """sidecar HTTP 500 → 抛 → fallback faster-whisper。"""
    from chayuan.server.modality.audio import AudioPipeline
    from chayuan.server.model_registry import local_runtime as lr
    import httpx

    fake_mgr = mock.MagicMock()
    fake_mgr.status = lr.RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62585")

    fake_registry = mock.MagicMock()
    fake_registry.get = mock.MagicMock(return_value=fake_mgr)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    fake_resp = mock.MagicMock()
    fake_resp.raise_for_status = mock.MagicMock(side_effect=httpx.HTTPStatusError(
        "500", request=mock.MagicMock(), response=mock.MagicMock(status_code=500),
    ))

    fake_client = mock.MagicMock()
    fake_client.__enter__ = mock.MagicMock(return_value=fake_client)
    fake_client.__exit__ = mock.MagicMock(return_value=None)
    fake_client.post = mock.MagicMock(return_value=fake_resp)
    monkeypatch.setattr("httpx.Client", mock.MagicMock(return_value=fake_client))

    # fallback faster-whisper 也 ImportError → 全空
    import sys
    monkeypatch.setitem(sys.modules, "faster_whisper", None)
    monkeypatch.setitem(sys.modules, "whisper", None)
    monkeypatch.setattr(
        "chayuan.server.utils.get_OpenAI",
        mock.MagicMock(side_effect=RuntimeError("no openai")),
    )

    pipe = AudioPipeline()
    result = pipe.transcribe(_make_audio_bytes())
    assert result == ""


def test_transcribe_sidecar_language_passed(tmp_path, monkeypatch):
    """sidecar 走通时 language 字段透传到 multipart data。"""
    from chayuan.server.modality.audio import AudioPipeline
    from chayuan.server.model_registry import local_runtime as lr

    fake_mgr = mock.MagicMock()
    fake_mgr.status = lr.RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62585")

    fake_registry = mock.MagicMock()
    fake_registry.get = mock.MagicMock(return_value=fake_mgr)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime_registry.get_registry",
        lambda: fake_registry,
    )

    captured_data = {}

    fake_resp = mock.MagicMock()
    fake_resp.json.return_value = {"text": "hi"}
    fake_resp.raise_for_status = mock.MagicMock()

    def fake_post(url, *, data=None, files=None):
        captured_data["data"] = data
        captured_data["url"] = url
        return fake_resp

    fake_client = mock.MagicMock()
    fake_client.__enter__ = mock.MagicMock(return_value=fake_client)
    fake_client.__exit__ = mock.MagicMock(return_value=None)
    fake_client.post = mock.MagicMock(side_effect=fake_post)
    monkeypatch.setattr("httpx.Client", mock.MagicMock(return_value=fake_client))

    pipe = AudioPipeline()
    pipe.transcribe(_make_audio_bytes(), language="ja")
    assert captured_data["data"] == {"language": "ja"}
    assert captured_data["url"].endswith("/inference")
```

- [ ] **Step 2: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py -v
```

Expected: 4 passed。

如果有 ImportError(如 httpx 没装),先看 pyproject 是否有 httpx 依赖。Plan 1 已经用 httpx,应该装着;如果不在,本 plan 不加依赖,改 audio.py 用 `import urllib.request` 或 `requests` 自适应。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py
git commit -m "test(modality): audio.py sidecar 路径 + fallback 单测 (Plan 3C)"
```

---

## Sprint 5C-3: 前端 + 收尾 (Task 13-16)

### Task 13: `@chayuan/api` LocalRuntimeCapability 加 'asr'

**Files:**
- Modify: `chayuan-client/packages/api/src/localRuntime.ts`
- Modify: `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts`

- [ ] **Step 1: 改 type**

打开 `chayuan-client/packages/api/src/localRuntime.ts`,找到 Plan 3B 加的:

```typescript
export type LocalRuntimeCapability = 'chat' | 'embedding' | 'rerank';
```

改成:

```typescript
export type LocalRuntimeCapability = 'chat' | 'embedding' | 'rerank' | 'asr';
```

- [ ] **Step 2: 加测试**

在 `__tests__/localRuntime.test.ts` 末尾的 describe 块追加:

```typescript
  it('getStatusFor(asr) 命中 GET /runtime/llama/asr/status', async () => {
    response = () =>
      new Response(
        JSON.stringify({ code: 0, data: { state: 'ready', endpoint: 'http://127.0.0.1:62585' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const s = await localRuntime.getStatusFor('asr');
    expect(s.state).toBe('ready');
    expect(s.endpoint).toBe('http://127.0.0.1:62585');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/asr\/status$/);
  });

  it('startFor(asr) 命中 POST /runtime/llama/asr/start', async () => {
    response = () =>
      new Response(JSON.stringify({ code: 0, data: { state: 'ready' } }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    await localRuntime.startFor('asr');
    expect(calls[0]!.init?.method).toBe('POST');
    expect(calls[0]!.url).toMatch(/\/runtime\/llama\/asr\/start$/);
  });

  it('getRegistry() 返四个 capability(含 asr)', async () => {
    response = () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            chat: { state: 'ready' },
            embedding: { state: 'stopped' },
            rerank: { state: 'stopped' },
            asr: { state: 'stopped' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const reg = await localRuntime.getRegistry();
    expect(reg.asr.state).toBe('stopped');
  });
```

- [ ] **Step 3: 跑测试 + typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/localRuntime.test.ts 2>&1 | tail -10
pnpm --filter @chayuan/api run typecheck
```

Expected: 12 passed (9 旧 + 3 新);typecheck 无错。

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/api/src/localRuntime.ts
git add chayuan-client/packages/api/src/__tests__/localRuntime.test.ts
git commit -m "feat(api): LocalRuntimeCapability 加 asr (Plan 3C)"
```

---

### Task 14: `LocalRuntimeCapabilityCard` + `LocalRuntimePanel` 加 asr 卡

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx`
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx`
- Modify: `chayuan-client/packages/app/src/store/localRuntime.ts`

- [ ] **Step 1: 改 LocalRuntimeCapabilityCard 加 label**

打开 `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx`,找到 Plan 3B 加的:

```typescript
const CAPABILITY_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '聊天',
  embedding: '文本嵌入',
  rerank: '重排',
};
```

改成:

```typescript
const CAPABILITY_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '聊天',
  embedding: '文本嵌入',
  rerank: '重排',
  asr: '语音识别',
};
```

- [ ] **Step 2: 改 LocalRuntimePanel 数组加 asr**

打开 `LocalRuntimePanel.tsx`,找到:

```typescript
        {(['chat', 'embedding', 'rerank'] as LocalRuntimeCapability[]).map((cap) => (
```

改成:

```typescript
        {(['chat', 'embedding', 'rerank', 'asr'] as LocalRuntimeCapability[]).map((cap) => (
```

- [ ] **Step 3: 改 store 的 statuses / pendingFor 初始值**

打开 `chayuan-client/packages/app/src/store/localRuntime.ts`,找到 Plan 3B 加的初始 state:

```typescript
  statuses: { chat: null, embedding: null, rerank: null },
  pendingFor: { chat: null, embedding: null, rerank: null },
```

改成:

```typescript
  statuses: { chat: null, embedding: null, rerank: null, asr: null },
  pendingFor: { chat: null, embedding: null, rerank: null, asr: null },
```

- [ ] **Step 4: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck 2>&1 | tail -8
```

Expected: 无错。

- [ ] **Step 5: 跑现有 store / panel 测试确认无回归**

```bash
pnpm exec vitest run packages/app/src/store/__tests__/localRuntime.test.ts 2>&1 | tail -5
```

Expected: 全过(Plan 3B 9 个 + 0 新 = 9 passed)。

如果有失败因为旧测试断言 statuses keys 是 3 个,改成 4 个。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeCapabilityCard.tsx
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx
git add chayuan-client/packages/app/src/store/localRuntime.ts
git commit -m "feat(ui): LocalRuntimePanel 加 asr 卡 + store statuses/pendingFor 加 asr (Plan 3C)"
```

---

### Task 15: `CapabilityCenter` asr tab localCap mapping

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx`

- [ ] **Step 1: 改 localCap 派生**

打开 `chayuan-client/packages/app/src/features/aiPlatform/CapabilityCenter.tsx`,找到 Plan 3B 加的:

```typescript
  const localCap: LocalRuntimeCapability | null =
    activeCap === 'text-embedding' ? 'embedding' :
    activeCap === 'rerank' ? 'rerank' :
    null;
```

改成:

```typescript
  const localCap: LocalRuntimeCapability | null =
    activeCap === 'text-embedding' ? 'embedding' :
    activeCap === 'rerank' ? 'rerank' :
    activeCap === 'asr' ? 'asr' :
    null;
```

(注:CapabilityCenter 的 capability list 已含 'asr' tab — Plan 1 已经有,Plan 3C 不动 tab 列表本身。)

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
git commit -m "feat(ui): CapabilityCenter asr tab 加「启动本地 runtime」按钮 mapping (Plan 3C)"
```

---

### Task 16: 总验证 + RUNBOOK 更新

**Files:**
- Modify: `docs/RUNBOOK-local-runtime-diagnose.md`

- [ ] **Step 1: 跑全套后端 + 前端测试**

```bash
cd /work/chayuan-desktop
PYTHONPATH=chayuan-server/libs/chayuan-server python3 -m pytest \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime_registry.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_capability.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_process_args_whisper.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama_multi_cap.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_audio_pipeline_sidecar.py \
  -q 2>&1 | tail -3
```

Expected: ~90 passed(Plan 3B 76 + Plan 3C 4+4+1+2+1+1+4 = 17 → 93 估)。

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/localRuntime.test.ts packages/app/src/store/__tests__/localRuntime.test.ts 2>&1 | tail -5
```

Expected: ~21 passed(Plan 3B 18 + Plan 3C 3 新)。

```bash
pnpm -r run typecheck 2>&1 | grep -E "error|Failed" | head -5
```

Expected: 无 error。

- [ ] **Step 2: 改 RUNBOOK §4 加 ASR 排错条目**

打开 `docs/RUNBOOK-local-runtime-diagnose.md`,在 §4 「常见问题排查」表末尾追加 3 行:

```markdown
| `runtime.llama.asr.status fail` | whisper-server 启动崩 / 模型未装 | install-bundled-models 拉 ggml-tiny.bin;binary 由 install-whisper-server.{ps1,sh} 装 |
| ASR 调时 sidecar 不可用 fallback Python | whisper-server.exe 缺 / 模型路径错 / 首次 cold start 超 30s | 检查 vendor/services/whisper-server/;Plan 3C audio.py 已自动 fallback faster-whisper,功能正常但失局部加速 |
| `whisper-server multipart 4MB 413` | 单次音频 > 4 MB | 切短音频段;后续 plan 可调 whisper-server `--max-multipart` |
```

§3 「UI 按钮」描述 Plan 3B 后是 3 个 capability card,Plan 3C 改成 4 个:

把:
> Plan 3B 后该页显示 3 个 capability 卡片(chat / 文本嵌入 / 重排),每个独立启停;

改成:
> Plan 3C 后该页显示 4 个 capability 卡片(chat / 文本嵌入 / 重排 / 语音识别),每个独立启停;

- [ ] **Step 3: Commit RUNBOOK**

```bash
cd /work/chayuan-desktop
git add docs/RUNBOOK-local-runtime-diagnose.md
git commit -m "docs(runbook): Plan 3C ASR 排错条目 + 4 card UI 描述更新"
```

- [ ] **Step 4: 跨平台兼容验证(模拟)**

```bash
# Win (mock)
grep -l "Get-Process\|Invoke-WebRequest\|Expand-Archive" /work/chayuan-desktop/scripts/install-whisper-server.ps1

# Mac/Linux (mock)
bash -n /work/chayuan-desktop/scripts/install-whisper-server.sh && echo "sh syntax OK"

# 后端跨平台无 OS-specific 代码
grep -n "Windows\|Linux\|Darwin\|win32\|sys.platform" /work/chayuan-desktop/chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py | head -5
```

Expected: PS1 内含 PowerShell cmdlet;sh 语法 OK;backend manager 无 OS-specific 判断(_default_install_services_dirs 已跨平台,Plan 1 处理过)。

---

## Sprint 5C 完成标志

跑通后用户能做:

1. ✅ 设置 → AI 平台 → 本地模型 显示 4 张 capability card(chat / 文本嵌入 / 重排 / 语音识别),asr 卡可独立启停
2. ✅ `curl http://127.0.0.1:62581/runtime/llama/asr/start` POST 拉起 whisper-server
3. ✅ `curl http://127.0.0.1:62585/inference -F file=@hello.wav` 直接打通(whisper-server 原生 API)
4. ✅ `curl http://127.0.0.1:62581/modality/asr -F audio=@hello.wav` 优先走 sidecar,fail 时 fallback Python
5. ✅ `curl http://127.0.0.1:62581/runtime/llama/registry` 一次返 4 个 capability 状态
6. ✅ Plan 3A 诊断报告 13 项 check,含 `runtime.llama.asr.status`
7. ✅ 退桌面 sidecar 时 lifespan shutdown 4 个子进程都 kill
8. ✅ CapabilityCenter「语音识别」tab 有「启动本地 runtime」按钮
9. ✅ 后端单测全过(Plan 3B 76 + Plan 3C 新增 ~17 = 93),前端单测 0 error,全仓 typecheck 0 error
10. ✅ Plan 1+2+3A+3B 已 ship 的 85 commits 不破坏(LlamaRuntimeManager alias / find_llama_server_exe alias / `_resolve_chat_args` alias 全保留)

**后续不在本 Plan:**
- Plan 3D (image-embedding) — CLIP / Tauri webview,另起 plan
- whisper-server streaming WebSocket — 另起 plan
- 删 faster-whisper Python deps(瘦 installer) — 另起 plan
- whisper 模型多档量化(tiny/base/small/medium) — 另起 plan
- E2E CI — 沿 Plan 3A 真机装机手测哲学

---

## 跨平台兼容矩阵

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| whisper-server 二进制 | ggerganov whisper.cpp release w64-mingw zip | release tar.gz / Homebrew brew | release tar.gz / source build |
| 安装脚本 | `scripts/install-whisper-server.ps1` (UTF-8 BOM) | `scripts/install-whisper-server.sh` | 同 sh |
| Popen 参数 | `--model <ggml-tiny.bin> --port 62585 --host 127.0.0.1` | 同 | 同 |
| 模型路径 | `<chayuan_root>/models/bundled/asr/ggml-tiny.bin` | 同 | 同 |
| 端口 (62585) | psutil 跨平台 | 同 | 同 |
| 关停 | terminate→5s wait→kill;registry.stop_all 串行 4 个 | 同 | 同 |
| settings.yaml | 旧版无 asr 字段时取默认值,无破坏 | 同 | 同 |
| 内存占用 (默认 preload=False) | sidecar 不预热;首次 ASR 调时 lazy start ~3-5s | 同 | 同 |
| 防火墙 / AV | Defender 可能拦 whisper-server.exe spawn | n/a (Mac sandbox) | n/a |

---
