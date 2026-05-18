# 本地 Runtime 诊断 实施计划 (Plan 3A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chayuan-server 暴露 `GET /runtime/diagnose` 跑 10 项 check;CLI 脚本 `.ps1` + `.sh` 和「设置 → AI 平台 → 本地模型 → 生成诊断报告」按钮都共享后端结果,渲染可粘贴的 markdown 报告。

**Architecture:** 后端单一真源 (`chayuan/server/diagnose/checks.py` 10 个纯函数 + `run_all_checks()` 聚合 + `/runtime/diagnose` 路由)。前端 + CLI 各自做 markdown 渲染 (~20 行模板代码,drift 风险低)。CLI 额外做 sidecar-down fallback。

**Tech Stack:** Python 3.10+, FastAPI, pytest, psutil (跨平台进程/端口/磁盘), TypeScript / React (UI 按钮 + Dialog), PowerShell 5.1 / bash (CLI)。

**Spec 关联:** `docs/superpowers/specs/2026-05-15-local-runtime-diagnose-design.md` (commit `0669d0c`)。

**Plan 1+2 关联:** Plan 1 后端 (`/runtime/llama/*`) + Plan 2 前端 (`LocalRuntimePanel`) 已就绪。本 plan 在它们边上加诊断能力。

---

## File Structure

### 新建文件

| 文件 | 责任 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py` | 模块入口,export `run_all_checks` + `DiagnoseCheck` + `DiagnoseReport` |
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/types.py` | `DiagnoseCheck` / `DiagnoseReport` dataclass + Literal severity |
| `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py` | 10 个 check 函数,每个返 `DiagnoseCheck` |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py` | 10 个 check 单测 + 聚合容错测试 |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py` | `/runtime/diagnose` 路由集成测试 (TestClient) |
| `chayuan-client/packages/api/src/diagnose.ts` | TS 类型 + `diagnose.run()` 客户端 |
| `chayuan-client/packages/api/src/__tests__/diagnose.test.ts` | API 契约单测 |
| `chayuan-client/packages/app/src/features/aiPlatform/DiagnoseModal.tsx` | 报告 Dialog + 复制按钮 |
| `scripts/diagnose.ps1` | Win 诊断脚本 (UTF-8 BOM) |
| `scripts/diagnose.sh` | Mac/Linux 诊断脚本 |
| `docs/RUNBOOK-local-runtime-diagnose.md` | 装机后手测 / 用户排错 runbook |

### 修改文件

| 文件 | 改什么 |
|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` | 加 `GET /runtime/diagnose` 路由 (跟 `/runtime/llama/*` 同 router) |
| `chayuan-client/packages/api/src/index.ts` | export `diagnose` 模块 |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx` | 状态区按钮组加「生成诊断报告」按钮 + 挂 `DiagnoseModal` |
| `chayuan-client/packages/app/src/features/aiPlatform/index.ts` | re-export `DiagnoseModal` |

---

## Sprint 5A: 后端 checks 模块 (Task 1-6)

### Task 1: 骨架 + DiagnoseCheck/DiagnoseReport dataclass + sidecar.healthz check

**Files:**
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/types.py`
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`

- [ ] **Step 1: 写测试 (TDD)**

写入 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`:

```python
"""diagnose.checks 单元测试。

每个 check 是纯函数,外部依赖通过 monkeypatch 模拟。
"""
from __future__ import annotations

import pytest

from chayuan.server.diagnose.types import DiagnoseCheck, DiagnoseReport


def test_check_sidecar_healthz_returns_ok():
    """sidecar.healthz check:模块跑起来就 ok"""
    from chayuan.server.diagnose.checks import check_sidecar_healthz

    c = check_sidecar_healthz()
    assert isinstance(c, DiagnoseCheck)
    assert c.name == "sidecar.healthz"
    assert c.ok is True
    assert c.severity == "ok"


def test_diagnose_check_dataclass_defaults():
    """DiagnoseCheck context 默认 None,severity 必填"""
    c = DiagnoseCheck(name="x", ok=True, severity="ok", detail="d")
    assert c.context is None
```

- [ ] **Step 2: 跑测试,确认 fail**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py -v
```

Expected: 2 errors (`ModuleNotFoundError: chayuan.server.diagnose`)

- [ ] **Step 3: 写 types.py**

```python
"""diagnose 报告数据结构。"""
from __future__ import annotations

import dataclasses
from typing import Any, Dict, List, Literal, Optional


Severity = Literal["ok", "warn", "fail"]


@dataclasses.dataclass
class DiagnoseCheck:
    name: str
    ok: bool
    severity: Severity
    detail: str
    context: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class DiagnoseReport:
    timestamp: str
    platform: str
    python_version: str
    chayuan_root: str
    chayuan_server_version: str
    checks: List[DiagnoseCheck]
    summary: Dict[str, int]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "platform": self.platform,
            "python_version": self.python_version,
            "chayuan_root": self.chayuan_root,
            "chayuan_server_version": self.chayuan_server_version,
            "checks": [c.to_dict() for c in self.checks],
            "summary": self.summary,
        }
```

- [ ] **Step 4: 写 checks.py 第一个 check**

```python
"""所有 diagnose check 函数。每个函数纯函数化,无 IO 副作用 (除了读盘 / 网络)。

约定:任何函数都不允许抛异常,内部用 try/except 包好;失败时返回
severity=fail + detail 描述。
"""
from __future__ import annotations

from chayuan.server.diagnose.types import DiagnoseCheck


def check_sidecar_healthz() -> DiagnoseCheck:
    """sidecar 进程跑起来就视为 ok (路由调用本函数 = 路由可达 = healthz 一定通)。

    单独保留这个 check 是给报告里留个明确正信号:用户看到「sidecar.healthz: ✓」
    就知道至少 HTTP 层是通的,后面其它 check 失败可以锁定到具体子系统。
    """
    return DiagnoseCheck(
        name="sidecar.healthz",
        ok=True,
        severity="ok",
        detail="sidecar HTTP 层就绪 (routing layer responsive)",
    )
```

- [ ] **Step 5: 写 __init__.py**

```python
"""本地 runtime 诊断模块。

入口 ``run_all_checks()`` 跑所有 check 返回 ``DiagnoseReport``;
单个 check 也可以单独 import (例:``from .checks import check_port``)。
"""
from __future__ import annotations

from .types import DiagnoseCheck, DiagnoseReport, Severity

__all__ = ["DiagnoseCheck", "DiagnoseReport", "Severity"]
```

- [ ] **Step 6: 跑测试,确认 pass**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py -v
```

Expected: 2 passed。

- [ ] **Step 7: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git commit -m "feat(diagnose): 模块骨架 + DiagnoseCheck/Report dataclass + sidecar.healthz check"
```

---

### Task 2: vendor + bundled_models checks (2 个 check)

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`

- [ ] **Step 1: 加测试**

在 `test_diagnose_checks.py` 末尾追加:

```python
def test_check_vendor_llama_server_binary_present(tmp_path, monkeypatch):
    """vendor 二进制存在时 → ok,detail 含路径 + version"""
    from chayuan.server.model_registry import local_runtime
    from chayuan.server.diagnose.checks import check_vendor_llama_server_binary

    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    exe = services / "llama-server.exe"
    exe.write_bytes(b"x" * 1024)
    (services / "VERSION").write_text("b4404\n2026-05-15\n")
    monkeypatch.setattr(local_runtime, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    c = check_vendor_llama_server_binary()
    assert c.name == "vendor.llama-server.binary"
    assert c.ok is True
    assert c.severity == "ok"
    assert "b4404" in c.detail
    assert "llama-server.exe" in c.detail


def test_check_vendor_llama_server_binary_missing(tmp_path, monkeypatch):
    """vendor 二进制缺失时 → fail"""
    from chayuan.server.model_registry import local_runtime
    from chayuan.server.diagnose.checks import check_vendor_llama_server_binary

    monkeypatch.setattr(local_runtime, "_INSTALL_SERVICES_DIRS", [tmp_path / "nothing"])
    c = check_vendor_llama_server_binary()
    assert c.ok is False
    assert c.severity == "fail"
    assert "未找到" in c.detail or "not found" in c.detail.lower()


def test_check_bundled_models_chat_present(tmp_path, monkeypatch):
    """bundled_models 至少 1 个 chat .gguf → ok"""
    from chayuan.server.diagnose.checks import check_bundled_models_chat

    fake_entries = [
        type("Entry", (), {"capability": "chat", "model_id": "qwen3-4b", "path": str(tmp_path / "a.gguf")})()
    ]
    fake_index = type("Idx", (), {"by_capability": lambda self, cap: fake_entries if cap == "chat" else []})()
    monkeypatch.setattr(
        "chayuan.server.diagnose.checks.get_local_index",
        lambda **kw: fake_index,
    )

    c = check_bundled_models_chat()
    assert c.name == "vendor.bundled_models.chat"
    assert c.ok is True
    assert "1" in c.detail or "qwen3" in c.detail.lower()


def test_check_bundled_models_chat_empty(monkeypatch):
    """bundled_models 0 个 chat 模型 → fail"""
    from chayuan.server.diagnose.checks import check_bundled_models_chat

    fake_index = type("Idx", (), {"by_capability": lambda self, cap: []})()
    monkeypatch.setattr(
        "chayuan.server.diagnose.checks.get_local_index",
        lambda **kw: fake_index,
    )

    c = check_bundled_models_chat()
    assert c.ok is False
    assert c.severity == "fail"
```

- [ ] **Step 2: 跑测试,确认 4 个 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py -v -k "vendor or bundled"
```

Expected: 4 fail (ImportError: cannot import name 'check_vendor_llama_server_binary' / 'check_bundled_models_chat' / 'get_local_index')。

- [ ] **Step 3: 实现 2 个 check**

在 `checks.py` 顶部 import 加:

```python
from pathlib import Path

from chayuan.server.model_registry.local_index import get_local_index
from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
```

(`LlamaRuntimeManager` 给 Task 5 用,这里一起 import。)

在 `check_sidecar_healthz` 之后追加:

```python
def check_vendor_llama_server_binary() -> DiagnoseCheck:
    """检查 vendor/services/llama-server/llama-server(.exe) 是否存在 + 读 VERSION。"""
    try:
        from pathlib import Path as _P

        # 复用 manager 的查找逻辑;chayuan_root 这里只是占位,find_llama_server_exe
        # 不依赖 chayuan_root
        mgr = LlamaRuntimeManager(chayuan_root=_P("/tmp"))
        exe = mgr.find_llama_server_exe()
    except Exception as e:
        return DiagnoseCheck(
            name="vendor.llama-server.binary",
            ok=False,
            severity="fail",
            detail=f"查找二进制时异常:{type(e).__name__}: {e}",
        )

    if exe is None:
        return DiagnoseCheck(
            name="vendor.llama-server.binary",
            ok=False,
            severity="fail",
            detail="未找到 llama-server 二进制;检查集成版是否完整 / 开发机是否跑过 install-llama-server",
        )

    version = "unknown"
    version_file = exe.parent / "VERSION"
    if version_file.is_file():
        try:
            version = version_file.read_text(encoding="utf-8").splitlines()[0].strip()
        except Exception:
            pass

    try:
        size_mb = exe.stat().st_size / 1024 / 1024
    except Exception:
        size_mb = 0.0

    return DiagnoseCheck(
        name="vendor.llama-server.binary",
        ok=True,
        severity="ok",
        detail=f"{exe} ({version}, {size_mb:.1f} MB)",
        context={"path": str(exe), "version": version, "size_bytes": exe.stat().st_size},
    )


def check_bundled_models_chat() -> DiagnoseCheck:
    """bundled_models 是否至少有 1 个 chat .gguf 模型 (local_index 扫得到)。"""
    try:
        idx = get_local_index()
        cands = idx.by_capability("chat")
    except Exception as e:
        return DiagnoseCheck(
            name="vendor.bundled_models.chat",
            ok=False,
            severity="fail",
            detail=f"local_index 查询失败:{type(e).__name__}: {e}",
        )

    if not cands:
        return DiagnoseCheck(
            name="vendor.bundled_models.chat",
            ok=False,
            severity="fail",
            detail="bundled_models/ 下未扫到任何 chat 模型",
        )

    names = ", ".join(getattr(c, "model_id", "<?>") for c in cands[:3])
    more = "" if len(cands) <= 3 else f" 等 {len(cands)} 个"
    return DiagnoseCheck(
        name="vendor.bundled_models.chat",
        ok=True,
        severity="ok",
        detail=f"{len(cands)} 个 chat 模型: {names}{more}",
        context={"count": len(cands), "model_ids": [getattr(c, "model_id", None) for c in cands]},
    )
```

- [ ] **Step 4: 跑测试,确认 pass**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py -v
```

Expected: 6 passed (2 prior + 4 new)。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git commit -m "feat(diagnose): vendor.llama-server.binary + vendor.bundled_models.chat checks"
```

---

### Task 3: 路径 / 磁盘 checks (4 个 check)

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`

- [ ] **Step 1: 加测试**

```python
def test_check_chayuan_root_writable_ok(tmp_path):
    from chayuan.server.diagnose.checks import check_chayuan_root_writable
    c = check_chayuan_root_writable(tmp_path)
    assert c.name == "chayuan_root.writable"
    assert c.ok is True
    assert c.severity == "ok"
    # 测试文件应被清理
    assert not (tmp_path / ".diagnose-test").exists()


def test_check_chayuan_root_writable_not_dir(tmp_path):
    from chayuan.server.diagnose.checks import check_chayuan_root_writable
    c = check_chayuan_root_writable(tmp_path / "does-not-exist")
    assert c.ok is False
    assert c.severity == "fail"


def test_check_runtime_json_writable_ok(tmp_path):
    from chayuan.server.diagnose.checks import check_runtime_json_writable
    c = check_runtime_json_writable(tmp_path / "runtime.json")
    assert c.ok is True


def test_check_local_runtime_yaml_readable_missing_is_ok(tmp_path):
    """文件不存在等于"用默认值",不算 fail"""
    from chayuan.server.diagnose.checks import check_local_runtime_yaml_readable
    c = check_local_runtime_yaml_readable(tmp_path / "absent.yaml")
    assert c.ok is True
    assert c.severity == "ok"
    assert "不存在" in c.detail or "默认" in c.detail


def test_check_local_runtime_yaml_readable_present_ok(tmp_path):
    from chayuan.server.diagnose.checks import check_local_runtime_yaml_readable
    yaml_path = tmp_path / "lr.yaml"
    yaml_path.write_text("port: 62582\n", encoding="utf-8")
    c = check_local_runtime_yaml_readable(yaml_path)
    assert c.ok is True


def test_check_local_runtime_yaml_readable_corrupt_warn(tmp_path):
    from chayuan.server.diagnose.checks import check_local_runtime_yaml_readable
    yaml_path = tmp_path / "lr.yaml"
    yaml_path.write_bytes(b"\x00\x01\xff garbage")
    c = check_local_runtime_yaml_readable(yaml_path)
    assert c.ok is False or c.severity == "warn"


def test_check_disk_free_gb(tmp_path, monkeypatch):
    """正常磁盘 → ok;< 2 GB → warn;< 500 MB → fail"""
    from chayuan.server.diagnose import checks as _checks

    # 用 monkeypatch 替 shutil.disk_usage
    def fake_du(_path):
        return type("DU", (), {"total": 100 * 2**30, "used": 0, "free": 50 * 2**30})()

    monkeypatch.setattr(_checks.shutil, "disk_usage", fake_du)
    c = _checks.check_disk_free_gb(tmp_path)
    assert c.ok is True

    def low_du(_path):
        return type("DU", (), {"total": 100 * 2**30, "used": 0, "free": 1 * 2**30})()
    monkeypatch.setattr(_checks.shutil, "disk_usage", low_du)
    c = _checks.check_disk_free_gb(tmp_path)
    assert c.severity == "warn"

    def crit_du(_path):
        return type("DU", (), {"total": 100 * 2**30, "used": 0, "free": 200 * 2**20})()
    monkeypatch.setattr(_checks.shutil, "disk_usage", crit_du)
    c = _checks.check_disk_free_gb(tmp_path)
    assert c.severity == "fail"
```

- [ ] **Step 2: 跑测试,确认 fail**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py -v -k "chayuan_root or runtime_json or yaml or disk"
```

Expected: 7 fail (ImportError 各 check 函数)。

- [ ] **Step 3: 实现 4 个 check**

`checks.py` 顶部 import 加:

```python
import shutil
import yaml
```

(`yaml` 是 pyyaml,chayuan-server 现有依赖。)

末尾追加:

```python
def check_chayuan_root_writable(chayuan_root: Path) -> DiagnoseCheck:
    """尝试在 chayuan_root 创建 + 删除 .diagnose-test 文件"""
    if not chayuan_root.is_dir():
        return DiagnoseCheck(
            name="chayuan_root.writable",
            ok=False,
            severity="fail",
            detail=f"chayuan_root 不存在: {chayuan_root}",
        )
    probe = chayuan_root / ".diagnose-test"
    try:
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
    except Exception as e:
        return DiagnoseCheck(
            name="chayuan_root.writable",
            ok=False,
            severity="fail",
            detail=f"无法写入 {chayuan_root}: {type(e).__name__}: {e}",
        )
    return DiagnoseCheck(
        name="chayuan_root.writable",
        ok=True,
        severity="ok",
        detail=f"可写: {chayuan_root}",
    )


def check_runtime_json_writable(status_path: Path) -> DiagnoseCheck:
    """检查 runtime.json 父目录可写 (LlamaRuntimeManager._persist_status 写它)。"""
    parent = status_path.parent
    try:
        parent.mkdir(parents=True, exist_ok=True)
        probe = parent / ".diagnose-runtime-json-test"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
    except Exception as e:
        return DiagnoseCheck(
            name="runtime_json.writable",
            ok=False,
            severity="fail",
            detail=f"runtime.json 父目录不可写 ({parent}): {type(e).__name__}: {e}",
        )
    return DiagnoseCheck(
        name="runtime_json.writable",
        ok=True,
        severity="ok",
        detail=f"可写: {status_path}",
    )


def check_local_runtime_yaml_readable(yaml_path: Path) -> DiagnoseCheck:
    """local_runtime.yaml 不存在不算 fail (= 用默认),存在则解析必须成功。"""
    if not yaml_path.is_file():
        return DiagnoseCheck(
            name="local_runtime_yaml.readable",
            ok=True,
            severity="ok",
            detail=f"{yaml_path} 不存在,使用默认配置",
        )
    try:
        with open(yaml_path, "rb") as f:
            raw = f.read()
        yaml.safe_load(raw.decode("utf-8", errors="strict"))
    except Exception as e:
        return DiagnoseCheck(
            name="local_runtime_yaml.readable",
            ok=False,
            severity="warn",
            detail=f"yaml 解析失败 ({yaml_path}): {type(e).__name__}: {e}",
        )
    return DiagnoseCheck(
        name="local_runtime_yaml.readable",
        ok=True,
        severity="ok",
        detail=f"{yaml_path} 解析成功",
    )


def check_disk_free_gb(chayuan_root: Path) -> DiagnoseCheck:
    """磁盘剩余空间:>= 2 GB ok / 500MB-2GB warn / < 500MB fail"""
    try:
        du = shutil.disk_usage(chayuan_root if chayuan_root.exists() else chayuan_root.parent)
    except Exception as e:
        return DiagnoseCheck(
            name="disk.chayuan_root.free_gb",
            ok=False,
            severity="warn",
            detail=f"无法查询磁盘空间:{type(e).__name__}: {e}",
        )
    free_gb = du.free / 2**30
    if free_gb < 0.5:
        sev: str = "fail"
        ok = False
    elif free_gb < 2.0:
        sev = "warn"
        ok = True
    else:
        sev = "ok"
        ok = True
    return DiagnoseCheck(
        name="disk.chayuan_root.free_gb",
        ok=ok,
        severity=sev,  # type: ignore[arg-type]
        detail=f"{free_gb:.1f} GB 可用",
        context={"free_bytes": du.free, "total_bytes": du.total},
    )
```

- [ ] **Step 4: 跑测试,确认 13 passed (6 + 7)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py -v
```

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git commit -m "feat(diagnose): 路径/磁盘 4 个 check (chayuan_root, runtime_json, yaml, disk)"
```

---

### Task 4: 进程 / 端口 checks (2 个 check)

**Files:** 同 Task 3

- [ ] **Step 1: 加测试**

```python
def test_check_port_free(monkeypatch):
    """62582 没被占 → ok"""
    from chayuan.server.diagnose import checks as _checks

    # 模拟 psutil.net_connections 返回空 (无监听)
    fake_conns: list = []
    monkeypatch.setattr(_checks.psutil, "net_connections", lambda kind: fake_conns)

    c = _checks.check_port_62582()
    assert c.ok is True
    assert "空闲" in c.detail


def test_check_port_occupied_other_process(monkeypatch):
    """62582 被其它进程占 → warn"""
    from chayuan.server.diagnose import checks as _checks

    # 模拟一个 LISTEN 在 62582 的连接,pid 不是当前进程
    laddr = type("Addr", (), {"ip": "127.0.0.1", "port": 62582})()
    conn = type("Conn", (), {"status": "LISTEN", "laddr": laddr, "pid": 99999})()
    monkeypatch.setattr(_checks.psutil, "net_connections", lambda kind: [conn])

    # 模拟 Process(99999).name() = 'chrome.exe'
    proc = type("Proc", (), {"name": lambda self: "chrome.exe"})()
    monkeypatch.setattr(_checks.psutil, "Process", lambda pid: proc)

    c = _checks.check_port_62582()
    assert c.ok is True  # warn 算 ok
    assert c.severity == "warn"
    assert "chrome" in c.detail.lower() or "99999" in c.detail


def test_check_chayuan_server_process():
    """当前进程信息总能拿到 → ok"""
    from chayuan.server.diagnose.checks import check_chayuan_server_process

    c = check_chayuan_server_process()
    assert c.name == "chayuan_server.process"
    assert c.ok is True
    assert "pid" in c.detail.lower() or str(__import__("os").getpid()) in c.detail
```

- [ ] **Step 2: 跑测试,确认 fail**

Expected: 3 fail (ImportError check_port_62582 / check_chayuan_server_process / psutil 没在 checks 内 import)。

- [ ] **Step 3: 实现**

`checks.py` 顶部 import 加 `import os` 和 `import psutil`(psutil 是 chayuan-server 现有依赖)。

末尾追加:

```python
def check_port_62582() -> DiagnoseCheck:
    """检查端口 62582 是否被占。

    被本进程 (chayuan-server) 占 = 也算 ok (sidecar 自己拿着 62581;
      llama-server 拿 62582 是预期)。
    被其它进程占 = warn (会让 start 时 _allocate_port 往上 bump 到 62583)。
    """
    try:
        conns = psutil.net_connections(kind="inet")
    except Exception as e:
        return DiagnoseCheck(
            name="port.62582",
            ok=True,
            severity="warn",
            detail=f"psutil 调用失败:{type(e).__name__}: {e};无法验证端口占用",
        )

    listeners = [
        c for c in conns
        if getattr(c, "status", None) == "LISTEN"
        and getattr(c.laddr, "port", None) == 62582
    ]
    if not listeners:
        return DiagnoseCheck(
            name="port.62582",
            ok=True,
            severity="ok",
            detail="62582 空闲",
        )
    owner = listeners[0]
    owner_pid = getattr(owner, "pid", None)
    owner_name = "<unknown>"
    if owner_pid:
        try:
            owner_name = psutil.Process(owner_pid).name()
        except Exception:
            pass
    if owner_pid == os.getpid():
        return DiagnoseCheck(
            name="port.62582",
            ok=True,
            severity="ok",
            detail=f"62582 被本进程 ({owner_name}, pid {owner_pid}) 占用",
        )
    return DiagnoseCheck(
        name="port.62582",
        ok=True,
        severity="warn",
        detail=f"62582 被其它进程占用: pid={owner_pid} ({owner_name})",
        context={"owner_pid": owner_pid, "owner_name": owner_name},
    )


def check_chayuan_server_process() -> DiagnoseCheck:
    """当前 sidecar 进程的 pid / 启动时间 / RSS。"""
    try:
        p = psutil.Process(os.getpid())
        rss_mb = p.memory_info().rss / 1024 / 1024
        from datetime import datetime as _dt
        started = _dt.fromtimestamp(p.create_time()).isoformat(timespec="seconds")
        return DiagnoseCheck(
            name="chayuan_server.process",
            ok=True,
            severity="ok",
            detail=f"pid={p.pid}, RSS={rss_mb:.1f} MB, started_at={started}",
            context={"pid": p.pid, "rss_bytes": p.memory_info().rss, "started_at": started},
        )
    except Exception as e:
        return DiagnoseCheck(
            name="chayuan_server.process",
            ok=False,
            severity="warn",
            detail=f"psutil 读不到本进程:{type(e).__name__}: {e}",
        )
```

- [ ] **Step 4: 跑测试,确认 16 passed (13 + 3)**

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git commit -m "feat(diagnose): port.62582 + chayuan_server.process checks (psutil)"
```

---

### Task 5: runtime.llama.status check

**Files:** 同 Task 3

- [ ] **Step 1: 加测试**

```python
def test_check_runtime_llama_status_ready(tmp_path, monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status
    from chayuan.server.model_registry import local_runtime as lr

    fake_status = lr.RuntimeStatus(
        state="ready", endpoint="http://127.0.0.1:62583", pid=1234, model_id="m1"
    )

    class FakeMgr:
        status = fake_status

    monkeypatch.setattr(lr, "_singleton", FakeMgr())
    c = check_runtime_llama_status()
    assert c.name == "runtime.llama.status"
    assert c.ok is True
    assert c.severity == "ok"
    assert "ready" in c.detail
    assert "m1" in c.detail
    assert "62583" in c.detail


def test_check_runtime_llama_status_failed(tmp_path, monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status
    from chayuan.server.model_registry import local_runtime as lr

    fake_status = lr.RuntimeStatus(state="failed", last_error="exe missing")

    class FakeMgr:
        status = fake_status

    monkeypatch.setattr(lr, "_singleton", FakeMgr())
    c = check_runtime_llama_status()
    assert c.ok is False
    assert c.severity == "fail"
    assert "exe missing" in c.detail


def test_check_runtime_llama_status_stopped(tmp_path, monkeypatch):
    from chayuan.server.diagnose.checks import check_runtime_llama_status
    from chayuan.server.model_registry import local_runtime as lr

    fake_status = lr.RuntimeStatus(state="stopped")

    class FakeMgr:
        status = fake_status

    monkeypatch.setattr(lr, "_singleton", FakeMgr())
    c = check_runtime_llama_status()
    # stopped 不是 ok 也不是 fail,是 warn (用户没主动启,但不算坏)
    assert c.severity == "warn"
```

- [ ] **Step 2: 跑测试,确认 3 fail**

- [ ] **Step 3: 实现**

末尾追加:

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
        return DiagnoseCheck(
            name="runtime.llama.status",
            ok=False,
            severity="warn",
            detail=f"manager 读 status 异常:{type(e).__name__}: {e}",
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
        name="runtime.llama.status",
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
```

- [ ] **Step 4: 跑测试,确认 19 passed (16 + 3)**

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git commit -m "feat(diagnose): runtime.llama.status check (ready/failed/其它三态)"
```

---

### Task 6: run_all_checks 聚合 + /runtime/diagnose 路由

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py`

- [ ] **Step 1: 写聚合 + 路由测试**

在 `test_diagnose_checks.py` 末尾追加:

```python
def test_run_all_checks_returns_report_with_summary(tmp_path, monkeypatch):
    """聚合应返 DiagnoseReport + summary 计数正确"""
    from chayuan.server.diagnose import run_all_checks, DiagnoseReport
    from chayuan.server.model_registry import local_runtime as lr

    # 让 chayuan_root 指向 tmp_path,所有 check 都不会因找不到路径炸
    monkeypatch.setattr("chayuan.settings.CHAYUAN_ROOT", str(tmp_path))

    # 让 LlamaRuntimeManager status 是 stopped (warn)
    fake_status = lr.RuntimeStatus(state="stopped")

    class FakeMgr:
        status = fake_status

    monkeypatch.setattr(lr, "_singleton", FakeMgr())

    # vendor 二进制肯定找不到 → fail
    monkeypatch.setattr(lr, "_INSTALL_SERVICES_DIRS", [tmp_path / "nothing"])

    report = run_all_checks()
    assert isinstance(report, DiagnoseReport)
    assert len(report.checks) == 10
    # summary 计数加和等于 10
    s = report.summary
    assert s["ok"] + s["warn"] + s["fail"] == 10


def test_run_all_checks_does_not_raise_when_check_raises(tmp_path, monkeypatch):
    """单个 check 抛异常不能影响其它"""
    from chayuan.server.diagnose import run_all_checks
    from chayuan.server.diagnose import checks as _checks

    def boom():
        raise RuntimeError("explode")

    monkeypatch.setattr(_checks, "check_sidecar_healthz", boom)
    monkeypatch.setattr("chayuan.settings.CHAYUAN_ROOT", str(tmp_path))

    report = run_all_checks()
    # 还能跑出来,sidecar.healthz 那项变成 fail
    names = [c.name for c in report.checks]
    assert "sidecar.healthz" in names
    sidecar_c = next(c for c in report.checks if c.name == "sidecar.healthz")
    assert sidecar_c.severity == "fail"
    assert "explode" in sidecar_c.detail.lower() or "runtimeerror" in sidecar_c.detail.lower()
```

新文件 `test_runtime_route_diagnose.py`:

```python
"""GET /runtime/diagnose 路由集成测试。"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from chayuan.server.api_server.runtime_routes import runtime_router


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr("chayuan.settings.CHAYUAN_ROOT", str(tmp_path))
    app = FastAPI()
    app.include_router(runtime_router)
    return TestClient(app)


def test_runtime_diagnose_returns_ok_envelope(client):
    r = client.get("/runtime/diagnose")
    assert r.status_code == 200
    body = r.json()
    assert body.get("code") == 0
    data = body["data"]
    assert "timestamp" in data
    assert "platform" in data
    assert "checks" in data
    assert "summary" in data
    assert isinstance(data["checks"], list)
    assert len(data["checks"]) == 10
    assert data["summary"]["ok"] + data["summary"]["warn"] + data["summary"]["fail"] == 10


def test_runtime_diagnose_each_check_has_required_fields(client):
    r = client.get("/runtime/diagnose")
    for c in r.json()["data"]["checks"]:
        assert "name" in c
        assert "ok" in c
        assert "severity" in c
        assert c["severity"] in ("ok", "warn", "fail")
        assert "detail" in c
```

- [ ] **Step 2: 跑测试,确认 fail (4 个)**

- [ ] **Step 3: 实现 `run_all_checks` 聚合**

在 `checks.py` 末尾追加:

```python
def _safe_call(name: str, fn) -> DiagnoseCheck:
    """check 内部如果还能漏出异常,这里再兜一层"""
    try:
        return fn()
    except Exception as e:
        return DiagnoseCheck(
            name=name,
            ok=False,
            severity="fail",
            detail=f"check 抛异常:{type(e).__name__}: {e}",
        )
```

更新 `__init__.py`:

```python
"""本地 runtime 诊断模块。"""
from __future__ import annotations

import platform as _platform
import sys
from datetime import datetime
from pathlib import Path

from chayuan import __version__ as _server_version
from chayuan.server.diagnose import checks as _checks
from chayuan.server.diagnose.types import DiagnoseCheck, DiagnoseReport, Severity

__all__ = [
    "DiagnoseCheck",
    "DiagnoseReport",
    "Severity",
    "run_all_checks",
]


def _resolve_chayuan_root() -> Path:
    from chayuan import settings as cy_settings
    return Path(cy_settings.CHAYUAN_ROOT)


def run_all_checks() -> DiagnoseReport:
    """跑 10 项 check,聚合成报告。单个 check 抛异常不阻塞其它 check。"""
    root = _resolve_chayuan_root()
    settings_path = root / "model_registry" / "local_runtime.yaml"
    status_path = root / "runtime.json"

    results = [
        _checks._safe_call("sidecar.healthz", _checks.check_sidecar_healthz),
        _checks._safe_call("vendor.llama-server.binary", _checks.check_vendor_llama_server_binary),
        _checks._safe_call("vendor.bundled_models.chat", _checks.check_bundled_models_chat),
        _checks._safe_call("chayuan_root.writable", lambda: _checks.check_chayuan_root_writable(root)),
        _checks._safe_call("runtime_json.writable", lambda: _checks.check_runtime_json_writable(status_path)),
        _checks._safe_call("local_runtime_yaml.readable", lambda: _checks.check_local_runtime_yaml_readable(settings_path)),
        _checks._safe_call("disk.chayuan_root.free_gb", lambda: _checks.check_disk_free_gb(root)),
        _checks._safe_call("port.62582", _checks.check_port_62582),
        _checks._safe_call("chayuan_server.process", _checks.check_chayuan_server_process),
        _checks._safe_call("runtime.llama.status", _checks.check_runtime_llama_status),
    ]

    summary = {"ok": 0, "warn": 0, "fail": 0}
    for c in results:
        summary[c.severity] += 1

    return DiagnoseReport(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        platform=sys.platform,
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        chayuan_root=str(root),
        chayuan_server_version=_server_version,
        checks=results,
        summary=summary,
    )
```

- [ ] **Step 4: 加 `GET /runtime/diagnose` 路由**

在 `runtime_routes.py` 文件末尾(在 install-info 路由之后)追加:

```python
@runtime_router.get("/diagnose")
def runtime_diagnose() -> Dict[str, Any]:
    """跑所有本地 runtime 健康检查,返报告 JSON。"""
    from chayuan.server.diagnose import run_all_checks
    report = run_all_checks()
    return _ok(report.to_dict())
```

- [ ] **Step 5: 跑测试,确认 pass (21 = 19 + 2 在 checks 测 + 2 在路由测;实际 21+2=23 但路由测在单独文件)**

```bash
PYTHONPATH=libs/chayuan-server python3 -m pytest libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py -v
```

Expected: 23 passed (21 checks tests + 2 route tests)。

- [ ] **Step 6: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/diagnose/
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py
git commit -m "feat(diagnose): run_all_checks 聚合 + GET /runtime/diagnose 路由"
```

---

## Sprint 5B: 前端 + CLI (Task 7-12)

### Task 7: 前端 diagnose API 客户端 + 契约单测 + index 导出

**Files:**
- Create: `chayuan-client/packages/api/src/diagnose.ts`
- Create: `chayuan-client/packages/api/src/__tests__/diagnose.test.ts`
- Modify: `chayuan-client/packages/api/src/index.ts`

- [ ] **Step 1: 写客户端**

```typescript
/**
 * 本地 runtime 诊断 API 客户端。
 *
 * 对齐 chayuan-server GET /runtime/diagnose:跑 10 项 check 返
 * DiagnoseReport,前端做 markdown 渲染 (在 DiagnoseModal)。
 */

import { request } from './client';

export type DiagnoseSeverity = 'ok' | 'warn' | 'fail';

export interface DiagnoseCheck {
  name: string;
  ok: boolean;
  severity: DiagnoseSeverity;
  detail: string;
  context?: Record<string, unknown> | null;
}

export interface DiagnoseReport {
  timestamp: string;
  platform: string;
  python_version: string;
  chayuan_root: string;
  chayuan_server_version: string;
  checks: DiagnoseCheck[];
  summary: { ok: number; warn: number; fail: number };
}

async function run(): Promise<DiagnoseReport> {
  return (await request<DiagnoseReport>('/runtime/diagnose', { timeoutMs: 15_000 })).data;
}

export const diagnose = { run };
```

- [ ] **Step 2: 写测试**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@chayuan/platform-shared';
import { configureClient } from '../client';
import { diagnose } from '../diagnose';

interface MockCall { url: string; init?: RequestInit }
let calls: MockCall[] = [];
let response: (call: MockCall) => Response = () =>
  new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

const fakeFetch: typeof globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const call = { url, init: init ?? undefined };
  calls.push(call);
  return response(call);
};

beforeEach(() => {
  calls = [];
  response = () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  setPlatform({
    kind: 'web',
    runtime: { appName: 't', appVersion: '0', release: 't@0', defaultApiBase: 'http://api.local' },
    secure: { get: async () => null, set: async () => undefined, del: async () => undefined },
    db: { exec: async () => undefined, query: async () => [] },
    fs: { pickFiles: async () => [], saveText: async () => undefined, readDropped: async () => [] },
    net: { fetch: fakeFetch, sse: fakeFetch },
  } as never);
  configureClient({ baseURL: 'http://api.local' });
});

describe('diagnose client', () => {
  it('run() 命中 GET /runtime/diagnose 并解包 envelope', async () => {
    response = () => new Response(
      JSON.stringify({
        code: 0,
        data: {
          timestamp: '2026-05-15T14:00:00',
          platform: 'linux',
          python_version: '3.11.5',
          chayuan_root: '/data',
          chayuan_server_version: '1.0.0',
          checks: [
            { name: 'sidecar.healthz', ok: true, severity: 'ok', detail: 'ok' },
          ],
          summary: { ok: 1, warn: 0, fail: 0 },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
    const r = await diagnose.run();
    expect(r.summary.ok).toBe(1);
    expect(r.checks[0]!.name).toBe('sidecar.healthz');
    expect(calls[0]!.url).toMatch(/\/runtime\/diagnose$/);
    expect(calls[0]!.init?.method ?? 'GET').toBe('GET');
  });

  it('run() 超时上限是 15s', async () => {
    // 仅断言我们传了 timeoutMs (request 客户端会用它)
    response = () => new Response(JSON.stringify({ code: 0, data: {} }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
    await diagnose.run();
    // 没法直接读 timeoutMs;通过 calls[0].init.signal 间接验证有 abort signal
    expect(calls[0]!.init?.signal).toBeDefined();
  });
});
```

- [ ] **Step 3: 跑测试,确认 fail (module not found)**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm exec vitest run packages/api/src/__tests__/diagnose.test.ts
```

- [ ] **Step 4: 实现 + 跑测试,确认 2 pass**

(Step 1 已写,这步重跑确认)

- [ ] **Step 5: 加 index export**

`packages/api/src/index.ts` 末尾:

```typescript
export * from './diagnose';
```

- [ ] **Step 6: 顶层 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/api run typecheck
```

Expected: 无错。

- [ ] **Step 7: Commit**

```bash
git add chayuan-client/packages/api/src/diagnose.ts
git add chayuan-client/packages/api/src/__tests__/diagnose.test.ts
git add chayuan-client/packages/api/src/index.ts
git commit -m "feat(api): diagnose 客户端 + 契约单测"
```

---

### Task 8: DiagnoseModal 组件

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/DiagnoseModal.tsx`

- [ ] **Step 1: 写组件**

```typescript
/**
 * 本地 runtime 诊断报告 Dialog。
 *
 * 触发方:LocalRuntimePanel 的「生成诊断报告」按钮。
 * 行为:
 *   1. open=true 时调 diagnose.run()
 *   2. 拿到 DiagnoseReport → 渲染 markdown
 *   3. 复制按钮把 markdown 塞 navigator.clipboard
 *   4. 调用失败显友好错误,不闪退
 */

import * as React from 'react';
import { Copy } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@chayuan/ui';
import { diagnose, type DiagnoseReport, type DiagnoseCheck } from '@chayuan/api';

export interface DiagnoseModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

const SEV_ICON: Record<string, string> = { ok: '✓', warn: '⚠', fail: '✗' };

function renderMarkdown(r: DiagnoseReport): string {
  const head =
    `# Chayuan 本地 Runtime 诊断报告\n\n` +
    `- 时间: ${r.timestamp}\n` +
    `- 平台: ${r.platform}\n` +
    `- Python: ${r.python_version}\n` +
    `- chayuan-server: ${r.chayuan_server_version}\n` +
    `- chayuan_root: ${r.chayuan_root}\n\n` +
    `## 结果: ${r.summary.ok} ✓ / ${r.summary.warn} ⚠ / ${r.summary.fail} ✗\n\n`;
  const rows = r.checks
    .map((c) => `| ${c.name} | ${SEV_ICON[c.severity] ?? '?'} | ${c.detail.replace(/\|/g, '\\|')} |`)
    .join('\n');
  return `${head}| 检查项 | 状态 | 说明 |\n|---|---|---|\n${rows}\n`;
}

export const DiagnoseModal: React.FC<DiagnoseModalProps> = ({ open, onOpenChange }) => {
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState<DiagnoseReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setReport(null);
      setError(null);
      setCopied(false);
      return;
    }
    setLoading(true);
    setError(null);
    diagnose
      .run()
      .then((r) => setReport(r))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const md = report ? renderMarkdown(report) : '';

  const onCopy = () => {
    if (!md) return;
    void navigator.clipboard?.writeText(md);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>本地 Runtime 诊断报告</DialogTitle>
          <DialogDescription>
            生成后可复制全文,贴到 GitHub issue / 客服群帮助开发者定位问题。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="py-8 text-center text-sm text-[var(--cy-text-tertiary)]">
              正在跑 10 项检查…
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="font-medium">无法生成报告</div>
              <div className="mt-1 break-all">{error}</div>
              <div className="mt-2 text-xs">
                请先确保桌面应用正在运行;如仍不行,在装机目录跑{' '}
                <code>diagnose.ps1</code> / <code>diagnose.sh</code> 留存日志后上报。
              </div>
            </div>
          )}
          {report && (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[var(--cy-surface-1)] p-3 text-xs text-[var(--cy-text-primary)]">
              {md}
            </pre>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopy}
            disabled={!report}
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            {copied ? '已复制' : '复制全部'}
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiagnoseModal;
```

- [ ] **Step 2: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。如果 `DialogDescription` 或某个 Dialog 子组件名不对,跟 `LocalRuntimePanel` 的导入 fallback。

- [ ] **Step 3: Commit**

```bash
git add chayuan-client/packages/app/src/features/aiPlatform/DiagnoseModal.tsx
git commit -m "feat(ui): DiagnoseModal 报告对话框 + 复制按钮"
```

---

### Task 9: LocalRuntimePanel 加「生成诊断报告」按钮

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx`
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/index.ts`

- [ ] **Step 1: 改 LocalRuntimePanel**

在 LocalRuntimePanel.tsx 顶部 import:

```typescript
import { ClipboardList } from 'lucide-react';
import { DiagnoseModal } from './DiagnoseModal';
```

在组件内,`useLocalRuntimePolling()` 之后加 state:

```typescript
  const [diagnoseOpen, setDiagnoseOpen] = React.useState(false);
```

找到状态区里的按钮组(包含 启动 / 停止 / 重启 的 div):

```typescript
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void start()} ...>
```

在该 div 末尾 (重启按钮之后) 加:

```typescript
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDiagnoseOpen(true)}
          >
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            生成诊断报告
          </Button>
```

在组件 return 的最外层 div 内 (装机路径 section 之后),挂 Modal:

```typescript
      <DiagnoseModal open={diagnoseOpen} onOpenChange={setDiagnoseOpen} />
```

- [ ] **Step 2: index.ts 加 re-export**

```typescript
export { DiagnoseModal } from './DiagnoseModal';
```

- [ ] **Step 3: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 4: Commit**

```bash
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx
git add chayuan-client/packages/app/src/features/aiPlatform/index.ts
git commit -m "feat(ui): LocalRuntimePanel 加「生成诊断报告」按钮 + 挂 DiagnoseModal"
```

---

### Task 10: scripts/diagnose.ps1 (Win, UTF-8 BOM)

**Files:**
- Create: `scripts/diagnose.ps1`

- [ ] **Step 1: 写脚本**

写到 `scripts/diagnose.ps1`(**UTF-8 BOM**;首 3 字节 EF BB BF;Chinese-locale Win + PowerShell 5.1 防 GBK 乱码):

```powershell
﻿<#
.SYNOPSIS
  本地 LLM runtime 诊断。装机后跑 / 用户报 bug 贴日志。

.DESCRIPTION
  步骤:
    1) 探 sidecar 进程:Get-Process chayuan-server
       不在 → 友好提示退出 (exit 2)
    2) 在 → curl GET /runtime/diagnose 拿 JSON
    3) JSON → markdown,打印 stdout + 写 %TEMP%\chayuan-diagnose-<ts>.md

.PARAMETER SidecarBase
  默认 http://127.0.0.1:62581;改成其它 base 可对接非默认端口。
#>
[CmdletBinding()]
param(
    [string]$SidecarBase = 'http://127.0.0.1:62581'
)

try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); chcp 65001 > $null 2>&1 } catch {}
$ErrorActionPreference = 'Continue'

$ts = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$logFile = Join-Path $env:TEMP "chayuan-diagnose-$ts.md"
$out = [System.Text.StringBuilder]::new()
function W($t) {
    Write-Host $t
    [void]$out.AppendLine($t)
}

W "# Chayuan 本地 Runtime 诊断报告"
W ""
W "- 时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "- 系统: Windows ($([System.Environment]::OSVersion.VersionString))"
W "- sidecar base: $SidecarBase"
W ""

# 1) 探 sidecar 进程
$proc = Get-Process chayuan-server -ErrorAction SilentlyContinue
if (-not $proc) {
    W "## ✗ sidecar 进程未发现"
    W ""
    W "Get-Process chayuan-server 没找到进程,说明 chayuan-server 没在跑。"
    W "请先启动 Chayuan 桌面应用,或检查装机日志:"
    W "  %LOCALAPPDATA%\chayuan\logs\sidecar.log"
    W ""
    $out.ToString() | Set-Content -Path $logFile -Encoding UTF8
    Write-Host ""
    Write-Host "日志写到: $logFile"
    exit 2
}

W "## ✓ sidecar 进程在跑"
W ""
W "- pid: $($proc.Id)"
W "- 启动: $($proc.StartTime)"
W ""

# 2) curl /runtime/diagnose
try {
    $resp = Invoke-RestMethod -Uri "$SidecarBase/runtime/diagnose" -TimeoutSec 15
    $report = $resp.data
} catch {
    W "## ✗ /runtime/diagnose 调用失败"
    W ""
    W "错误: $_"
    W ""
    $out.ToString() | Set-Content -Path $logFile -Encoding UTF8
    Write-Host ""
    Write-Host "日志写到: $logFile"
    exit 2
}

W "## 结果: $($report.summary.ok) ✓ / $($report.summary.warn) ⚠ / $($report.summary.fail) ✗"
W ""
W "- chayuan-server: $($report.chayuan_server_version) (Python $($report.python_version), $($report.platform))"
W "- chayuan_root: $($report.chayuan_root)"
W ""
W "| 检查项 | 状态 | 说明 |"
W "|---|---|---|"
foreach ($c in $report.checks) {
    $icon = switch ($c.severity) { 'ok' { '✓' } 'warn' { '⚠' } 'fail' { '✗' } default { '?' } }
    $detail = $c.detail -replace '\|', '\|'
    W "| $($c.name) | $icon | $detail |"
}
W ""

$out.ToString() | Set-Content -Path $logFile -Encoding UTF8

Write-Host ""
Write-Host "日志已写到: $logFile"

# exit code:有 fail → 1,全 ok/warn → 0
if ($report.summary.fail -gt 0) { exit 1 } else { exit 0 }
```

- [ ] **Step 2: 验证 BOM**

```bash
head -c 3 /work/chayuan-desktop/scripts/diagnose.ps1 | xxd
```

Expected: `0000000: efbb bf` (3 字节 BOM)。

- [ ] **Step 3: Commit**

```bash
git add scripts/diagnose.ps1
git commit -m "feat(scripts): diagnose.ps1 Win 本地 runtime 诊断 (UTF-8 BOM)"
```

---

### Task 11: scripts/diagnose.sh (Mac/Linux)

**Files:**
- Create: `scripts/diagnose.sh`

- [ ] **Step 1: 写脚本**

```bash
#!/usr/bin/env bash
# 本地 LLM runtime 诊断 (Mac/Linux)。装机后跑 / 用户报 bug 贴日志。
set -uo pipefail

SIDECAR_BASE="${SIDECAR_BASE:-http://127.0.0.1:62581}"

ts=$(date +'%Y-%m-%d_%H%M%S')
log_file="/tmp/chayuan-diagnose-${ts}.md"

out=""
W() {
    echo "$1"
    out="${out}${1}"$'\n'
}

W "# Chayuan 本地 Runtime 诊断报告"
W ""
W "- 时间: $(date +'%Y-%m-%d %H:%M:%S')"
W "- 系统: $(uname -srm)"
W "- sidecar base: $SIDECAR_BASE"
W ""

# 1) 探 sidecar 进程
sidecar_pid=$(pgrep -f 'chayuan-server' | head -1 || true)
if [ -z "$sidecar_pid" ]; then
    W "## ✗ sidecar 进程未发现"
    W ""
    W "pgrep -f chayuan-server 没找到进程,说明 chayuan-server 没在跑。"
    W "请先启动 Chayuan 桌面应用,或检查日志:"
    W "  Linux: ~/.local/share/chayuan/logs/sidecar.log"
    W "  Mac:   ~/Library/Logs/chayuan/sidecar.log"
    W ""
    printf '%s' "$out" > "$log_file"
    echo
    echo "日志写到: $log_file"
    exit 2
fi

W "## ✓ sidecar 进程在跑"
W ""
W "- pid: $sidecar_pid"
W ""

# 2) curl /runtime/diagnose
if ! command -v curl >/dev/null 2>&1; then
    W "## ✗ 系统没装 curl,无法继续"
    printf '%s' "$out" > "$log_file"
    echo "日志写到: $log_file"
    exit 2
fi

resp=$(curl -fsS --max-time 15 "$SIDECAR_BASE/runtime/diagnose" 2>&1) || {
    W "## ✗ /runtime/diagnose 调用失败"
    W ""
    W '```'
    W "$resp"
    W '```'
    printf '%s' "$out" > "$log_file"
    echo "日志写到: $log_file"
    exit 2
}

# 解 JSON (依赖 python3 — 比 jq 装机率高)
if command -v python3 >/dev/null 2>&1; then
    parsed=$(python3 -c "
import json, sys
r = json.loads(sys.stdin.read())['data']
print('summary', r['summary']['ok'], r['summary']['warn'], r['summary']['fail'])
print('meta', r.get('chayuan_server_version', '?'), r.get('python_version', '?'), r.get('platform', '?'))
print('root', r.get('chayuan_root', '?'))
for c in r['checks']:
    icon = {'ok': 'OK', 'warn': 'WARN', 'fail': 'FAIL'}[c['severity']]
    detail = c['detail'].replace('|', '\\\\|').replace('\\n', ' ')
    print('row', c['name'], icon, detail)
" <<< "$resp")
else
    W "## ✗ python3 不在 PATH,无法解析 JSON"
    W ""
    W '原始响应:'
    W '```json'
    W "$resp"
    W '```'
    printf '%s' "$out" > "$log_file"
    echo "日志写到: $log_file"
    exit 2
fi

summary_line=$(echo "$parsed" | grep '^summary ')
ok=$(echo "$summary_line" | awk '{print $2}')
warn=$(echo "$summary_line" | awk '{print $3}')
fail=$(echo "$summary_line" | awk '{print $4}')

meta_line=$(echo "$parsed" | grep '^meta ')
sv=$(echo "$meta_line" | awk '{print $2}')
pyv=$(echo "$meta_line" | awk '{print $3}')
plat=$(echo "$meta_line" | awk '{print $4}')

root_line=$(echo "$parsed" | grep '^root ')
root=$(echo "$root_line" | cut -d' ' -f2-)

W "## 结果: $ok ✓ / $warn ⚠ / $fail ✗"
W ""
W "- chayuan-server: $sv (Python $pyv, $plat)"
W "- chayuan_root: $root"
W ""
W "| 检查项 | 状态 | 说明 |"
W "|---|---|---|"
echo "$parsed" | while IFS= read -r line; do
    case "$line" in
        row\ *)
            name=$(echo "$line" | awk '{print $2}')
            icon_raw=$(echo "$line" | awk '{print $3}')
            detail=$(echo "$line" | cut -d' ' -f4-)
            case "$icon_raw" in
                OK)   icon='✓' ;;
                WARN) icon='⚠' ;;
                FAIL) icon='✗' ;;
                *)    icon='?' ;;
            esac
            row="| $name | $icon | $detail |"
            echo "$row"
            out="${out}${row}"$'\n'
            ;;
    esac
done | tee /dev/null

W ""

printf '%s' "$out" > "$log_file"

echo
echo "日志已写到: $log_file"

if [ "$fail" -gt 0 ]; then exit 1; else exit 0; fi
```

- [ ] **Step 2: chmod + bash -n 语法 sanity**

```bash
chmod +x /work/chayuan-desktop/scripts/diagnose.sh
bash -n /work/chayuan-desktop/scripts/diagnose.sh
```

Expected: bash -n 无输出。

- [ ] **Step 3: Commit**

```bash
git add scripts/diagnose.sh
git commit -m "feat(scripts): diagnose.sh Mac/Linux 本地 runtime 诊断"
```

---

### Task 12: 手测 runbook + 总验证

**Files:**
- Create: `docs/RUNBOOK-local-runtime-diagnose.md`

- [ ] **Step 1: 写 runbook**

```markdown
# 本地 Runtime 诊断 — 装机手测 Runbook

适用于:Plan 1+2+3A 全部落盘之后,真机装机验证。

## 1. 准备

- 装机前确认 chayuan-server 已包好 (sidecar exe 存在)
- 装好 .msi (Win) / .dmg (Mac) / .deb-.AppImage (Linux)
- 安装目录里能看到 `services/llama-server/llama-server(.exe)`

## 2. 跑 CLI 脚本

### Windows

打开 PowerShell,cd 到 Chayuan 安装目录,运行:

\`\`\`powershell
.\scripts\diagnose.ps1
\`\`\`

预期输出末尾:

\`\`\`
日志已写到: C:\Users\<you>\AppData\Local\Temp\chayuan-diagnose-<ts>.md
\`\`\`

退出码 0 = 全 ok/warn,1 = 至少一项 fail,2 = sidecar 不可达。

### Mac / Linux

\`\`\`bash
./scripts/diagnose.sh
\`\`\`

预期日志落在 `/tmp/chayuan-diagnose-<ts>.md`。

## 3. UI 按钮

桌面应用 → 头像菜单 → 设置 → AI 平台 → 「本地模型」tab → 状态区按钮组最右侧「生成诊断报告」按钮。

预期:Dialog 弹出,~1s 内显示报告 markdown;点「复制全部」复制到剪贴板。

## 4. 常见问题排查

| 现象 | 可能原因 | 诊断报告里的标记 |
|---|---|---|
| sidecar 进程没找到 | chayuan-server 启动失败 / 装机不全 | CLI 退出码 2 + 日志写「sidecar 进程未发现」 |
| `vendor.llama-server.binary fail` | 集成版打包遗漏 vendor 二进制 | 重装;或开发机跑 `scripts/install-llama-server.{ps1,sh}` |
| `vendor.bundled_models.chat fail` | bundled_models 没打进 .msi | 重装;或手动放 .gguf 到 chayuan_root/models/bundled/chat/ |
| `port.62582 warn` | 端口被其它进程占 | `_allocate_port` 自动 bump 到 62583+,不影响功能 |
| `runtime.llama.status fail` | start 失败,看 last_error | 看报告里 detail 字段,根据 error 修 (常见:AVX2 缺失 / 模型路径错) |
| `chayuan_root.writable fail` | chayuan_root 路径写不进 (权限 / 路径错) | 检查 chayuan_root 路径,确认用户有写权限 |
| `disk.chayuan_root.free_gb fail` | 磁盘剩 < 500 MB | 清理磁盘 |

## 5. 报 bug 流程

发现问题时:

1. 跑 `diagnose.{ps1,sh}` 或 UI 按钮生成报告。
2. 复制 / 上传日志文件 (路径在脚本末尾打印 / Dialog 按钮)。
3. GitHub issue 模板里贴报告 + 描述复现步骤。

报告里 `chayuan_root` / `model_id` 这类信息可能被认作敏感,贴前自己判断。
```

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK-local-runtime-diagnose.md
git commit -m "docs: 本地 runtime 诊断装机手测 runbook"
```

- [ ] **Step 3: 全套总验证**

后端:
```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m pytest \
    libs/chayuan-server/tests/unit_tests/test_diagnose_checks.py \
    libs/chayuan-server/tests/unit_tests/test_runtime_route_diagnose.py \
    libs/chayuan-server/tests/unit_tests/test_local_runtime.py \
    libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py \
    -v 2>&1 | tail -10
```

Expected: 23 (新增) + 16 + 10 = **49 passed**(diagnose 单测 ≈ 23,Plan 1+2 follow-up 后端测试无回归)。

前端:
```bash
cd /work/chayuan-desktop/chayuan-client
pnpm -r run typecheck
pnpm exec vitest run packages/api/src/__tests__/diagnose.test.ts packages/api/src/__tests__/localRuntime.test.ts packages/app/src/store/__tests__/localRuntime.test.ts
```

Expected: 全 pass(2 diagnose + 6 localRuntime API + 6 store = 14 个),typecheck 0 error。

---

## Sprint 5A + 5B 完成标志

1. ✅ 后端 `GET /runtime/diagnose` 返 10 项 check 报告,单测 23+ 个绿
2. ✅ `scripts/diagnose.ps1` (Win UTF-8 BOM) + `scripts/diagnose.sh` (Mac/Linux) 都能跑通
3. ✅ 设置页「本地模型」tab「生成诊断报告」按钮弹 Dialog + 复制 markdown
4. ✅ sidecar 没跑时 CLI 退出 2 + 落日志文件
5. ✅ 任何单个 check 抛异常不阻塞其它 check
6. ✅ 跨平台覆盖:Win/Mac/Linux 三套都能跑 (CLI 双脚本 + 后端 psutil)
7. ✅ 全仓 typecheck 0 error;新增单测全绿;Plan 1+2 测试无回归

**后续不在本 Plan:**
- Plan 3B (多 runtime 扩展) — embedding + rerank 跟 chat 一样跑独立 llama-server 子进程
- Plan 3C (ASR) — Whisper / FunASR 不同 inference 栈,独立设计
- 真机 Windows 装机后手测 — runbook 已有,等用户拿到 .msi 实际跑
