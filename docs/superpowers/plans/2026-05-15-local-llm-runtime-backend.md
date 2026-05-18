# 本地 LLM Runtime 后端 实施计划 (Plan 1: Sprint 1 + 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集成版桌面装机后,sidecar 启动期自动 spawn `llama-server.exe` 跑本地 chat GGUF,提供 OpenAI 兼容 endpoint;curl 可直接打通,前端 UI 暂不接 (留 Plan 2)。

**Architecture:** Tauri sidecar = chayuan-server (Python),内部新增 `LlamaRuntimeManager` 单例管理 vendor 进集成版的 `llama-server.exe` 子进程;通过 `/runtime/llama/*` 一组 API 暴露 status / start / stop / restart / config / install-info。

**Tech Stack:** Python 3.10+, FastAPI, pytest, subprocess + httpx for health probe, llama.cpp `llama-server.exe` (CPU build), PyInstaller spec, Tauri bundle.resources。

**Spec 关联:** `docs/superpowers/specs/2026-05-15-local-llm-runtime-integration-design.md` §4.1-4.3 (Module 1+2+3)。

---

## File Structure

### 新建文件

| 文件 | 责任 |
|---|---|
| `chayuan-server/vendor/services/llama-server/.gitkeep` | 占位,确保目录存在 |
| `chayuan-server/vendor/services/llama-server/README.md` | 来源 / 版本 / 升级流程说明 |
| `chayuan-server/vendor/services/llama-server/.gitignore` | 排除 *.exe / *.dll (二进制不入 git) |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` | LlamaRuntimeManager + LocalRuntimeSettings + RuntimeStatus |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py` | LlamaRuntimeManager 单元测试 (mock Popen / httpx) |
| `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py` | /runtime/llama/* 路由集成测试 (TestClient) |
| `scripts/install-llama-server.ps1` | 开发机 / CI 下载 llama-server.exe 到 vendor/ |
| `scripts/install-llama-server.sh` | Linux/Mac dev 同上 |
| `scripts/test-local-runtime.ps1` | 装机后手测脚本,curl 走通本地 runtime |

### 修改文件

| 文件 | 改什么 |
|---|---|
| `chayuan-server/packaging/pyinstaller/build.py` | 加 `SERVICES_SRC` / `DESKTOP_SERVICES_DIR` 常量 + `sync_services()` 函数 + size-guard 扫 services/ + `--sync-services-only` flag + main() 调 sync_services |
| `chayuan-client/apps/desktop/src-tauri/tauri.conf.json` | `bundle.resources` 加 `"services/**/*"` |
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` | 加 `/runtime/llama/*` 7 个新路由 |
| `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py` | `first_launch_hooks()` 末尾按 `LocalRuntimeSettings.preload_on_startup` 调 `manager.start()` (异步) |
| `chayuan-server/libs/chayuan-server/chayuan/startup.py` | lifespan shutdown 加 `await manager.stop()` cascade kill |

---

## Sprint 1: Vendor llama-server.exe + build pipeline (Task 1-6)

### Task 1: vendor/services/ 目录骨架 + .gitignore + README

**Files:**
- Create: `chayuan-server/vendor/services/llama-server/.gitkeep`
- Create: `chayuan-server/vendor/services/llama-server/.gitignore`
- Create: `chayuan-server/vendor/services/llama-server/README.md`

- [ ] **Step 1: Create the directory and placeholder files**

```bash
mkdir -p chayuan-server/vendor/services/llama-server
touch chayuan-server/vendor/services/llama-server/.gitkeep
```

- [ ] **Step 2: Create .gitignore**

写入 `chayuan-server/vendor/services/llama-server/.gitignore`:

```gitignore
# llama-server 二进制 + 依赖 dll 不入 git
# (~30 MB,跑 scripts/install-llama-server.{ps1,sh} 拉取)
*.exe
*.dll
*.so
*.dylib
VERSION
```

- [ ] **Step 3: Create README.md**

写入 `chayuan-server/vendor/services/llama-server/README.md`:

```markdown
# vendor/services/llama-server

放 `llama.cpp` 官方 release 的 `llama-server` 二进制 + 依赖 dll。
集成版打包时由 `build.py sync_services()` 拷到 Tauri resources,
装机后落在 `<install_dir>/services/llama-server/llama-server.exe`。

## 当前版本

来源:https://github.com/ggerganov/llama.cpp/releases
Build:`llama-bin-win-cpu-x64.zip` (Windows CPU only,~25 MB)
版本记录:`VERSION` 文件,内容是 commit hash + 下载日期。

## 获取方式

二进制不入 git。开发 / CI 跑下载脚本:

```powershell
# Windows
.\scripts\install-llama-server.ps1
```

```bash
# Linux / Mac dev
./scripts/install-llama-server.sh
```

## 升级

1. 跑下载脚本指定新版本:`.\scripts\install-llama-server.ps1 -Version b<N>`
2. 跑装机测试 `.\scripts\test-local-runtime.ps1` 验证兼容性
3. 提 PR 时 `VERSION` 文件改动 + 上一行 changelog
```

- [ ] **Step 4: Commit**

```bash
git add chayuan-server/vendor/services/llama-server/
git commit -m "feat(vendor): 加 services/llama-server/ 目录骨架"
```

---

### Task 2: install-llama-server.{ps1,sh} 下载脚本

**Files:**
- Create: `scripts/install-llama-server.ps1`
- Create: `scripts/install-llama-server.sh`

- [ ] **Step 1: 写 install-llama-server.ps1**

写入 `scripts/install-llama-server.ps1`(UTF-8 BOM,避免中文乱码):

```powershell
﻿<#
.SYNOPSIS
  下载 llama-server.exe (CPU only build) 到 vendor/services/llama-server/。

.PARAMETER Version
  llama.cpp release tag,默认 'b4404' (2025-12 LTS-ish build)。
  改时同步更新 vendor/services/llama-server/VERSION 文件。

.EXAMPLE
  .\scripts\install-llama-server.ps1
#>
[CmdletBinding()]
param(
    [string]$Version = 'b4404'
)

try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    chcp 65001 > $null 2>&1
} catch {}

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $here
$destDir = Join-Path $workspaceRoot 'chayuan-server\vendor\services\llama-server'

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
}

$zipName = "llama-$Version-bin-win-cpu-x64.zip"
$url = "https://github.com/ggerganov/llama.cpp/releases/download/$Version/$zipName"
$tmpZip = Join-Path $env:TEMP $zipName

Write-Host "[install-llama-server] 下载 $url"
Invoke-WebRequest -Uri $url -OutFile $tmpZip -UseBasicParsing
Write-Host "[install-llama-server] 下完,$([math]::Round((Get-Item $tmpZip).Length/1MB,1)) MB"

# 解压到临时目录,挑 llama-server.exe + 必需 dll
$tmpExtract = Join-Path $env:TEMP "llama-$Version-extract"
if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

# 清旧
Get-ChildItem $destDir -File | Where-Object {
    $_.Extension -in '.exe', '.dll', '.so', '.dylib'
} | Remove-Item -Force

# 拷 llama-server.exe + 所有 dll
$needed = Get-ChildItem $tmpExtract -Recurse -File | Where-Object {
    $_.Name -eq 'llama-server.exe' -or $_.Extension -eq '.dll'
}
foreach ($f in $needed) {
    Copy-Item $f.FullName (Join-Path $destDir $f.Name) -Force
    Write-Host "  $($f.Name)  ($([math]::Round($f.Length/1MB,2)) MB)"
}

# 写 VERSION 文件
"$Version`n$(Get-Date -Format 'yyyy-MM-dd')`n" | Set-Content -Path (Join-Path $destDir 'VERSION') -NoNewline

Remove-Item $tmpZip -Force
Remove-Item $tmpExtract -Recurse -Force

Write-Host ""
Write-Host "[install-llama-server] 完成。 $destDir 内容:"
Get-ChildItem $destDir -File | Format-Table Name, @{N='MB';E={[math]::Round($_.Length/1MB,2)}}
```

- [ ] **Step 2: 写 install-llama-server.sh**

写入 `scripts/install-llama-server.sh`:

```bash
#!/usr/bin/env bash
# 下载 llama-server (Linux/Mac dev 用) 到 vendor/services/llama-server/
set -euo pipefail

VERSION="${1:-b4404}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(dirname "$HERE")"
DEST="$WORKSPACE/chayuan-server/vendor/services/llama-server"

mkdir -p "$DEST"

OS="$(uname -s)"
case "$OS" in
    Linux)  ZIP="llama-$VERSION-bin-ubuntu-x64.zip" ;;
    Darwin) ZIP="llama-$VERSION-bin-macos-arm64.zip" ;;
    *) echo "[install] 不支持的 OS: $OS" >&2; exit 1 ;;
esac

URL="https://github.com/ggerganov/llama.cpp/releases/download/$VERSION/$ZIP"
TMPZIP="/tmp/$ZIP"

echo "[install-llama-server] 下载 $URL"
curl -L -o "$TMPZIP" "$URL"
echo "[install-llama-server] 下完 $(du -h "$TMPZIP" | cut -f1)"

TMP_EXTRACT="/tmp/llama-$VERSION-extract"
rm -rf "$TMP_EXTRACT"
mkdir -p "$TMP_EXTRACT"
unzip -q "$TMPZIP" -d "$TMP_EXTRACT"

# 清旧二进制
find "$DEST" -maxdepth 1 -type f \( -name '*.exe' -o -name '*.dll' -o -name '*.so' -o -name '*.dylib' -o -name 'llama-server' \) -delete 2>/dev/null || true

# 拷 llama-server + .so / .dylib
find "$TMP_EXTRACT" -type f \( -name 'llama-server' -o -name '*.so' -o -name '*.dylib' \) -exec cp -v {} "$DEST/" \;

echo -e "$VERSION\n$(date +%Y-%m-%d)" > "$DEST/VERSION"
rm "$TMPZIP"
rm -rf "$TMP_EXTRACT"

echo
echo "[install-llama-server] 完成:"
ls -lh "$DEST"
```

- [ ] **Step 3: chmod + commit**

```bash
chmod +x scripts/install-llama-server.sh
git add scripts/install-llama-server.ps1 scripts/install-llama-server.sh
git commit -m "feat(scripts): 加 install-llama-server.{ps1,sh} 拉 vendor 二进制"
```

---

### Task 3: build.py 加 sync_services() + 常量

**Files:**
- Modify: `chayuan-server/packaging/pyinstaller/build.py` (在 `BUNDLED_SRC` 常量后,`sync_bundled_models` 之后加新代码)

- [ ] **Step 1: 先看现有 BUNDLED_SRC 定义位置**

Run: `grep -n "BUNDLED_SRC\|DESKTOP_BUNDLED_MODELS_DIR\|DESKTOP_SRC_TAURI" chayuan-server/packaging/pyinstaller/build.py | head -10`

Expected: line 63-64 附近,`DESKTOP_BUNDLED_MODELS_DIR = DESKTOP_SRC_TAURI / "bundled_models"` 和 `BUNDLED_SRC = ROOT / "vendor" / "bundled_models"`。

- [ ] **Step 2: 在那两行之后插入 services 常量**

`chayuan-server/packaging/pyinstaller/build.py` 在 `BUNDLED_SRC = ROOT / "vendor" / "bundled_models"` 行之后加:

```python
SERVICES_SRC = ROOT / "vendor" / "services"
DESKTOP_SERVICES_DIR = DESKTOP_SRC_TAURI / "services"
```

- [ ] **Step 3: 在 sync_bundled_models 函数之后(本文件约 line 250+)加 sync_services**

```python
def sync_services(*, lite: bool) -> None:
    """同步 vendor/services/ → src-tauri/services/(给 Tauri resources)。

    集成版需要把 llama-server.exe 这类外部 runtime 二进制带进安装包,
    轻量版不需要(在线下载 chat 时也是用 sidecar 自己代理,不起本地 runtime)。

    幂等:重复跑结果相同。每次都先清掉旧目录避免上一次 flavor 残留。
    """
    if DESKTOP_SERVICES_DIR.exists():
        shutil.rmtree(DESKTOP_SERVICES_DIR)
    DESKTOP_SERVICES_DIR.mkdir(parents=True, exist_ok=True)

    if lite:
        (DESKTOP_SERVICES_DIR / ".gitkeep").touch()
        print(f"[build] 轻量版:清空 {DESKTOP_SERVICES_DIR}", flush=True)
        return

    if not SERVICES_SRC.is_dir():
        print(f"[build] 警告:services 源不存在 {SERVICES_SRC},集成版退化为空目录", flush=True)
        (DESKTOP_SERVICES_DIR / ".gitkeep").touch()
        return

    # 集成版打包前 size guard:撞 2 GB 就拒(跟 bundled_models 共用相同逻辑)
    # 单文件 2 GB 上限不太可能撞到(llama-server.exe < 50 MB),但保险起见扫一遍
    n_files = 0
    n_bytes = 0
    for entry in sorted(SERVICES_SRC.iterdir()):
        if entry.name.startswith("."):
            continue
        if entry.is_dir():
            for sub in entry.rglob("*"):
                if sub.is_file() and sub.name != ".gitkeep":
                    if sub.stat().st_size >= _WIN_INSTALLER_FILE_LIMIT:
                        print(
                            f"[build] FATAL: services 内单文件 ≥ 2 GB,无法打进 Windows installer:\n"
                            f"  {sub.relative_to(SERVICES_SRC)} ({sub.stat().st_size / 1024 / 1024 / 1024:.2f} GB)",
                            file=sys.stderr, flush=True,
                        )
                        raise SystemExit(2)
                    rel = sub.relative_to(SERVICES_SRC)
                    dst = DESKTOP_SERVICES_DIR / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(sub, dst)
                    n_files += 1
                    n_bytes += dst.stat().st_size
    mb = n_bytes / 1024 / 1024
    print(
        f"[build] 集成版:services 已同步 {n_files} 个文件 ({mb:.1f} MB) "
        f"→ {DESKTOP_SERVICES_DIR}",
        flush=True,
    )
```

- [ ] **Step 4: 在 main() 调 sync_services**

找到 `main()` 里现有 `sync_bundled_models(lite=lite)` 调用(应该有 2 处:`--sync-bundled-only` 分支 + 正常打包分支),每处之后加一行 `sync_services(lite=lite)`。

Run: `grep -n "sync_bundled_models(lite=" chayuan-server/packaging/pyinstaller/build.py`

Expected: 两处调用 (大约 line 297 和 305)。

每处之后追加:

```python
sync_services(lite=lite)
```

- [ ] **Step 5: 加 --sync-services-only flag**

跟 `--sync-bundled-only` 平行,在 main() 的 argparse 加:

```python
parser.add_argument(
    "--sync-services-only",
    action="store_true",
    help="只同步 vendor/services/ 到 src-tauri/services/(快速 vendor 二进制改动迭代),"
         "跟 --sync-bundled-only 互斥",
)
```

main() 入口处理逻辑里,加分支:

```python
if args.sync_services_only:
    sync_services(lite=lite)
    return
```

放在现有 `if args.sync_bundled_only:` 那段附近。

- [ ] **Step 6: py_compile 验证**

Run: `python3 -m py_compile chayuan-server/packaging/pyinstaller/build.py`

Expected: 无输出 (无语法错误)。

- [ ] **Step 7: Commit**

```bash
git add chayuan-server/packaging/pyinstaller/build.py
git commit -m "feat(build): sync_services 把 vendor/services/ 进集成版安装包"
```

---

### Task 4: tauri.conf.json 加 services 到 bundle.resources

**Files:**
- Modify: `chayuan-client/apps/desktop/src-tauri/tauri.conf.json:35` (`bundle.resources` 字段)

- [ ] **Step 1: 看当前 resources**

Run: `grep -n '"resources"' chayuan-client/apps/desktop/src-tauri/tauri.conf.json`

Expected: line 35 附近, `"resources": ["bundled_models/**/*"]`

- [ ] **Step 2: 改成数组加 services/**

把这行:

```json
"resources": ["bundled_models/**/*"],
```

改成:

```json
"resources": ["bundled_models/**/*", "services/**/*"],
```

- [ ] **Step 3: JSON 合法性验证**

```bash
python3 -c "import json; json.load(open('chayuan-client/apps/desktop/src-tauri/tauri.conf.json'))"
```

Expected: 无输出 (无 JSON 解析错误)。

- [ ] **Step 4: Commit**

```bash
git add chayuan-client/apps/desktop/src-tauri/tauri.conf.json
git commit -m "feat(tauri): bundle.resources 加 services/**,装机带 llama-server 二进制"
```

---

### Task 5: build.py 测试:在 tmp 模拟 services/ 验证 sync_services 行为

**Files:**
- Create: `chayuan-server/tests/test_build_sync_services.py` (顶层 tests 目录,跟现有 packaging 测试同位置)

- [ ] **Step 1: 看现有 packaging 测试位置**

Run: `find chayuan-server -name "test_build*" -type f`

Expected: 列出现有 build.py 相关测试文件(如果存在);如果不存在则在 `chayuan-server/tests/` 下新建。

- [ ] **Step 2: 写测试 (TDD)**

写入 `chayuan-server/tests/test_build_sync_services.py`:

```python
"""``sync_services`` 行为测试。

集成版打包时,vendor/services/llama-server/* 应整树拷到
src-tauri/services/llama-server/*;轻量版应清空 src-tauri/services/。
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest


@pytest.fixture
def build_module(tmp_path, monkeypatch):
    """动态导入 build.py,把 ROOT/DESKTOP_SRC_TAURI 替换成 tmp_path"""
    build_py = Path(__file__).resolve().parent.parent / "packaging" / "pyinstaller" / "build.py"
    spec = importlib.util.spec_from_file_location("build_mod", build_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # 重写 ROOT/DESKTOP_SRC_TAURI 指向 tmp_path 镜像
    monkeypatch.setattr(mod, "ROOT", tmp_path)
    monkeypatch.setattr(mod, "DESKTOP_SRC_TAURI", tmp_path / "desktop_src_tauri")
    monkeypatch.setattr(mod, "SERVICES_SRC", tmp_path / "vendor" / "services")
    monkeypatch.setattr(mod, "DESKTOP_SERVICES_DIR", tmp_path / "desktop_src_tauri" / "services")
    return mod


def test_sync_services_integrated_copies_tree(build_module, tmp_path):
    """集成版应整树拷 vendor/services/ → src-tauri/services/"""
    svc_src = tmp_path / "vendor" / "services" / "llama-server"
    svc_src.mkdir(parents=True)
    (svc_src / "llama-server.exe").write_bytes(b"x" * 1024)
    (svc_src / "ggml-cpu.dll").write_bytes(b"y" * 512)
    (svc_src / "VERSION").write_text("b4404\n2026-05-15\n")

    build_module.sync_services(lite=False)

    dst = tmp_path / "desktop_src_tauri" / "services" / "llama-server"
    assert (dst / "llama-server.exe").is_file()
    assert (dst / "llama-server.exe").read_bytes() == b"x" * 1024
    assert (dst / "ggml-cpu.dll").is_file()
    assert (dst / "VERSION").read_text().startswith("b4404")


def test_sync_services_lite_clears_dir(build_module, tmp_path):
    """轻量版应清空 src-tauri/services/,只留 .gitkeep"""
    svc_src = tmp_path / "vendor" / "services" / "llama-server"
    svc_src.mkdir(parents=True)
    (svc_src / "llama-server.exe").write_bytes(b"x" * 1024)

    # 先模拟上次集成版残留
    dst_dir = tmp_path / "desktop_src_tauri" / "services" / "llama-server"
    dst_dir.mkdir(parents=True)
    (dst_dir / "stale.exe").write_bytes(b"old")

    build_module.sync_services(lite=True)

    dst = tmp_path / "desktop_src_tauri" / "services"
    assert dst.is_dir()
    assert (dst / ".gitkeep").is_file()
    assert not (dst / "llama-server").exists()  # 残留干净


def test_sync_services_missing_src_does_not_crash(build_module, tmp_path):
    """vendor/services/ 不存在时(开发机没跑过 install-llama-server)应 graceful 退化"""
    # 不创建 SERVICES_SRC
    build_module.sync_services(lite=False)

    dst = tmp_path / "desktop_src_tauri" / "services"
    assert dst.is_dir()
    assert (dst / ".gitkeep").is_file()


def test_sync_services_size_guard_rejects_2gb(build_module, tmp_path):
    """单文件 ≥ 2 GB 应 abort (Windows installer 硬限制)"""
    svc_src = tmp_path / "vendor" / "services" / "huge"
    svc_src.mkdir(parents=True)
    huge = svc_src / "huge.bin"
    # 不能真造 2 GB 文件,mock stat().st_size 行为不好;
    # 改用 sparse file (truncate) 在大多数 fs 上支持
    with open(huge, "wb") as f:
        f.truncate(build_module._WIN_INSTALLER_FILE_LIMIT + 1)

    with pytest.raises(SystemExit) as exc:
        build_module.sync_services(lite=False)
    assert exc.value.code == 2
```

- [ ] **Step 3: 跑测试,确认全 PASS**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server pytest tests/test_build_sync_services.py -v
```

Expected: 4 passed。如果失败,根据错误信息回到 Task 3 检查 `sync_services` 实现。

- [ ] **Step 4: Commit**

```bash
git add chayuan-server/tests/test_build_sync_services.py
git commit -m "test(build): sync_services 单元测试 (集成/轻量/缺源/size-guard)"
```

---

### Task 6: Sprint 1 集成验证 — 装机后 llama-server 落对位置

**Files:** 无新文件,跑命令 + 检查产物

- [ ] **Step 1: 开发机准备 vendor/services/llama-server/ 内容 (跳过下载,造空 stub 也行)**

```bash
cd /work/chayuan-desktop
mkdir -p chayuan-server/vendor/services/llama-server
echo "stub" > chayuan-server/vendor/services/llama-server/llama-server.exe
echo "b0000-stub" > chayuan-server/vendor/services/llama-server/VERSION
```

(真正跑 install-llama-server.ps1 拉 b4404 是 Windows 上跑 Plan 1 时再做;Linux 开发机这一步先用 stub 走通)

- [ ] **Step 2: 跑 sync-services-only 看效果**

```bash
cd chayuan-server
python3 packaging/pyinstaller/build.py --sync-services-only
```

Expected: 打印 `[build] 集成版:services 已同步 N 个文件 (M.M MB) → /work/.../src-tauri/services/`

- [ ] **Step 3: 确认产物**

```bash
ls -la /work/chayuan-desktop/chayuan-client/apps/desktop/src-tauri/services/llama-server/
```

Expected: `llama-server.exe`, `VERSION` 文件存在。

- [ ] **Step 4: 清理 stub,prep for next sprint**

```bash
rm -f chayuan-server/vendor/services/llama-server/llama-server.exe
rm -f chayuan-server/vendor/services/llama-server/VERSION
```

- [ ] **Step 5: Commit (无文件改动,只是 sprint 标记)**

无需 commit。Sprint 1 完。Sprint 2 开始时再次手工准备 vendor 内容。

---

## Sprint 2: LlamaRuntimeManager + API 路由 (Task 7-15)

### Task 7: LocalRuntimeSettings + RuntimeStatus dataclass + yaml 持久化

**Files:**
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 写测试 (TDD,先 settings load/save)**

写入 `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`:

```python
"""LlamaRuntimeManager 单元测试。

mock subprocess.Popen + httpx 不真起 llama-server,只验证状态机 + yaml 持久化。
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from unittest import mock

import pytest

from chayuan.server.model_registry.local_runtime import (
    LocalRuntimeSettings,
    RuntimeStatus,
)


def test_local_runtime_settings_defaults():
    s = LocalRuntimeSettings()
    assert s.preload_on_startup is True
    assert s.host == "127.0.0.1"
    assert s.port == 62582
    assert s.api_key == ""
    assert s.expose_lan is False
    assert s.default_chat_model == ""


def test_local_runtime_settings_load_save(tmp_path):
    """yaml round-trip:写 → 读 → 值一致"""
    yaml_path = tmp_path / "local_runtime.yaml"
    s = LocalRuntimeSettings(
        preload_on_startup=False,
        host="0.0.0.0",
        port=62590,
        api_key="secret123",
        expose_lan=True,
        default_chat_model="Qwen3-4B-Instruct-2507-Q3_K_S",
    )
    s.save(yaml_path)
    assert yaml_path.is_file()

    s2 = LocalRuntimeSettings.load(yaml_path)
    assert s2.preload_on_startup is False
    assert s2.host == "0.0.0.0"
    assert s2.port == 62590
    assert s2.api_key == "secret123"
    assert s2.expose_lan is True
    assert s2.default_chat_model == "Qwen3-4B-Instruct-2507-Q3_K_S"


def test_local_runtime_settings_load_missing_returns_default(tmp_path):
    """yaml 文件不存在时,load 返回 default 配置而非 raise"""
    yaml_path = tmp_path / "nope.yaml"
    s = LocalRuntimeSettings.load(yaml_path)
    assert s.preload_on_startup is True
    assert s.port == 62582


def test_runtime_status_default():
    st = RuntimeStatus(state="stopped")
    assert st.state == "stopped"
    assert st.endpoint is None
    assert st.pid is None
    assert st.last_error is None
```

- [ ] **Step 2: 跑测试,确认全 FAIL (函数还没定义)**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

Expected: 4 个 `ModuleNotFoundError` 或 `ImportError: local_runtime` (因为还没写)。

- [ ] **Step 3: 写最小实现**

写入 `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`:

```python
"""本地 LLM runtime 管理 (vendor 进集成版的 llama-server.exe)。

职责:
- 启动 / 停止 / 重启 vendor/services/llama-server/llama-server.exe 子进程
- 健康检查:轮询 /health,失败重试
- 状态写入 <CHAYUAN_ROOT>/runtime.json (前端读)
- 配置持久化到 <CHAYUAN_ROOT>/model_registry/local_runtime.yaml

设计:整个 chayuan-server 进程内一个 manager 单例,通过 get_manager() 拿。
sidecar lifespan shutdown 必须 await manager.stop() 级联关停 llama-server。
"""
from __future__ import annotations

import dataclasses
import json
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

import yaml


# ───────────────────────── 配置 / 状态 dataclass ─────────────────────────

@dataclasses.dataclass
class LocalRuntimeSettings:
    """本地 runtime 用户可配项,持久化到 local_runtime.yaml"""
    preload_on_startup: bool = True
    host: str = "127.0.0.1"
    port: int = 62582
    api_key: str = ""
    expose_lan: bool = False
    default_chat_model: str = ""

    @classmethod
    def load(cls, path: Path) -> "LocalRuntimeSettings":
        if not path.is_file():
            return cls()
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except Exception:
            return cls()
        return cls(**{
            k: data[k]
            for k in dataclasses.asdict(cls()).keys()
            if k in data
        })

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            yaml.safe_dump(dataclasses.asdict(self), allow_unicode=True),
            encoding="utf-8",
        )


@dataclasses.dataclass
class RuntimeStatus:
    """RuntimeManager 实时状态,序列化给 API 返回。"""
    state: Literal["stopped", "starting", "ready", "failed", "restarting"]
    endpoint: Optional[str] = None
    pid: Optional[int] = None
    model_id: Optional[str] = None
    model_path: Optional[str] = None
    started_at: Optional[datetime] = None
    last_health_at: Optional[datetime] = None
    last_error: Optional[str] = None

    def to_dict(self) -> dict:
        d = dataclasses.asdict(self)
        for k in ("started_at", "last_health_at"):
            if d[k] is not None:
                d[k] = d[k].isoformat()
        return d
```

- [ ] **Step 4: 跑测试,确认 PASS**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

Expected: 4 passed。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): LocalRuntimeSettings + RuntimeStatus dataclass + yaml 持久化"
```

---

### Task 8: LlamaRuntimeManager.__init__ + _find_exe + _allocate_port

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` (加 manager class)
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py` (加测试)

- [ ] **Step 1: 加测试 (TDD)**

在 `test_local_runtime.py` 末尾追加:

```python
def test_manager_init_paths(tmp_path):
    """manager 构造时定位 runtime_yaml / vendor exe / runtime.json 路径"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path)
    assert m.settings_path == tmp_path / "model_registry" / "local_runtime.yaml"
    assert m.status_path == tmp_path / "runtime.json"


def test_manager_find_llama_server_exe_missing(tmp_path):
    """vendor 二进制找不到时,_find_llama_server_exe 返回 None"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path)
    # 没真 vendor 二进制
    assert m._find_llama_server_exe() is None


def test_manager_find_llama_server_exe_present(tmp_path, monkeypatch):
    """vendor/services/llama-server/llama-server.exe 存在时,返回该路径"""
    from chayuan.server.model_registry import local_runtime
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    exe = services / "llama-server.exe"
    exe.write_bytes(b"stub")

    # mock 装机后的搜索路径
    monkeypatch.setattr(local_runtime, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    m = local_runtime.LlamaRuntimeManager(chayuan_root=tmp_path)
    assert m._find_llama_server_exe() == exe


def test_manager_allocate_port_default_free(tmp_path):
    """端口默认 62582 没被占用时,_allocate_port 返回 62582"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path)
    # 假定测试机 62582 没占(很大概率)
    port = m._allocate_port(preferred=62582)
    assert 62582 <= port <= 62600


def test_manager_allocate_port_bumps_on_conflict(tmp_path, monkeypatch):
    """端口被占时往上 bump,直到找到空闲"""
    import socket
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path)

    # 占住 62582-62584
    occupied = []
    for p in (62582, 62583, 62584):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            s.listen(1)
            occupied.append(s)
        except OSError:
            s.close()

    try:
        port = m._allocate_port(preferred=62582)
        # 应该是 62585 或后面 (受是否占成功影响)
        assert port not in (s.getsockname()[1] for s in occupied)
    finally:
        for s in occupied:
            s.close()
```

- [ ] **Step 2: 跑测试,确认全 FAIL**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k manager
```

Expected: 5 个测试,全 fail (LlamaRuntimeManager class 还没定义)。

- [ ] **Step 3: 在 local_runtime.py 加 manager class**

在 RuntimeStatus 之后追加:

```python
# ─────────────────────── manager ─────────────────────────

# 装机后 services 二进制可能的路径(按优先级排;集成版 / dev / 自定义)
def _default_install_services_dirs() -> list[Path]:
    """运行时定位 services 二进制目录。

    集成版装机后:
      Windows:  <install_dir>\services\
      Mac:      <install_dir>/Contents/Resources/services/
      Linux:    <install_dir>/services/

    Tauri 会把 bundle.resources 中的 services/** 解压到运行时
    可执行文件旁边的 resources/ 子目录。我们扫几个常见位置取并集。
    """
    candidates: list[Path] = []
    import sys
    # PyInstaller frozen 时 sys.executable = sidecar exe;
    # exe 同目录里的 services/ 是 Tauri install dir 的 services/
    if getattr(sys, "frozen", False):
        candidates.append(Path(sys.executable).parent / "services")
        candidates.append(Path(sys.executable).parent.parent / "services")
        # Mac .app bundle 结构
        candidates.append(Path(sys.executable).parent.parent / "Resources" / "services")
    # dev mode:从仓库 vendor/services/ 找
    candidates.append(Path(__file__).resolve().parents[5] / "vendor" / "services")
    # 兜底:CHAYUAN_ROOT/services
    return candidates


_INSTALL_SERVICES_DIRS: list[Path] | None = None  # 单元测试可 monkeypatch 覆盖


class LlamaRuntimeManager:
    """单进程内单例,管 llama-server.exe 生命周期"""

    def __init__(self, *, chayuan_root: Path) -> None:
        self.chayuan_root = chayuan_root
        self.settings_path = chayuan_root / "model_registry" / "local_runtime.yaml"
        self.status_path = chayuan_root / "runtime.json"
        self._settings = LocalRuntimeSettings.load(self.settings_path)
        self._status = RuntimeStatus(state="stopped")
        self._process = None  # subprocess.Popen 持有处

    @property
    def settings(self) -> LocalRuntimeSettings:
        return self._settings

    @property
    def status(self) -> RuntimeStatus:
        return self._status

    def _find_llama_server_exe(self) -> Optional[Path]:
        """跨平台找 vendor 进集成版的 llama-server 二进制"""
        global _INSTALL_SERVICES_DIRS
        dirs = _INSTALL_SERVICES_DIRS if _INSTALL_SERVICES_DIRS is not None else _default_install_services_dirs()
        names = ["llama-server.exe", "llama-server"]
        for d in dirs:
            llama_dir = d / "llama-server"
            for name in names:
                p = llama_dir / name
                if p.is_file():
                    return p
        return None

    def _allocate_port(self, *, preferred: int) -> int:
        """从 preferred 开始往上找空闲端口 (上限 +20)"""
        import socket
        for offset in range(21):
            port = preferred + offset
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("127.0.0.1", port))
                    return port
                except OSError:
                    continue
        raise RuntimeError(f"没找到空闲端口 (从 {preferred} bump 了 20 次都被占)")
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k manager
```

Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): manager 骨架 + _find_exe + _allocate_port"
```

---

### Task 9: LlamaRuntimeManager.start / stop (TDD,mock subprocess)

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py`
- Modify: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py`

- [ ] **Step 1: 加测试**

```python
@pytest.mark.asyncio
async def test_manager_start_spawns_subprocess(tmp_path, monkeypatch):
    """start() 成功 spawn 时,状态变 starting → ready (mock health 200)"""
    from chayuan.server.model_registry import local_runtime
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    exe = services / "llama-server.exe"
    exe.write_bytes(b"stub")
    monkeypatch.setattr(local_runtime, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    # mock resolve_llamacpp_args 返回 fake args
    fake_resolution = mock.MagicMock(
        missing=[],
        args=["--model", "/tmp/fake.gguf", "--ctx-size", "8192"],
        resolved_models={"chat": "fake-chat-model"},
        reason="",
    )
    monkeypatch.setattr(
        local_runtime, "_resolve_chat_args",
        lambda *a, **kw: (fake_resolution, "/tmp/fake.gguf"),
    )

    # mock Popen + httpx
    fake_proc = mock.MagicMock(pid=12345, poll=mock.MagicMock(return_value=None))
    monkeypatch.setattr(local_runtime.subprocess, "Popen", mock.MagicMock(return_value=fake_proc))
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(local_runtime, "_probe_health", fake_health)

    m = local_runtime.LlamaRuntimeManager(chayuan_root=tmp_path)
    status = await m.start()

    assert status.state == "ready"
    assert status.pid == 12345
    assert status.endpoint == "http://127.0.0.1:62582"
    assert status.model_id == "fake-chat-model"


@pytest.mark.asyncio
async def test_manager_start_missing_exe_fails(tmp_path):
    """vendor 二进制缺失时,start() 状态 → failed"""
    from chayuan.server.model_registry.local_runtime import LlamaRuntimeManager
    m = LlamaRuntimeManager(chayuan_root=tmp_path)
    status = await m.start()
    assert status.state == "failed"
    assert "llama-server" in (status.last_error or "").lower()


@pytest.mark.asyncio
async def test_manager_stop_kills_process(tmp_path, monkeypatch):
    """stop() 调 terminate + wait,状态 → stopped"""
    from chayuan.server.model_registry import local_runtime

    fake_proc = mock.MagicMock(pid=12345)
    fake_proc.poll.return_value = None  # 进程还活着
    fake_proc.terminate = mock.MagicMock()
    fake_proc.wait = mock.MagicMock(return_value=0)

    m = local_runtime.LlamaRuntimeManager(chayuan_root=tmp_path)
    m._process = fake_proc
    m._status = local_runtime.RuntimeStatus(state="ready", pid=12345)

    await m.stop()

    fake_proc.terminate.assert_called_once()
    fake_proc.wait.assert_called_once()
    assert m._status.state == "stopped"
    assert m._status.pid is None
```

注意要加 pytest-asyncio fixture。先确认是否已配:

Run: `grep -r "pytest-asyncio\|asyncio_mode" libs/chayuan-server/pyproject.toml libs/chayuan-server/pytest.ini libs/chayuan-server/setup.cfg 2>/dev/null | head -3`

如果没启用,在 `test_local_runtime.py` 文件顶部加:

```python
pytestmark = pytest.mark.asyncio
```

- [ ] **Step 2: 跑测试,确认 fail**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v -k "start or stop"
```

Expected: 3 个 fail (AttributeError: no `start` / `stop`)。

- [ ] **Step 3: 在 local_runtime.py 加 imports + helper + start/stop**

在 `local_runtime.py` 顶部 import 区加:

```python
import asyncio
import os
import subprocess
import sys
```

在文件最上面(import 区下面)加 helper:

```python
async def _probe_health(url: str, *, timeout: float = 2.0) -> "object":
    """探一次 /health。返回类 httpx.Response 的对象 (有 .status_code)。

    单元测试 monkeypatch 这个函数。
    """
    import httpx
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.get(url)


def _resolve_chat_args(*, n_ctx: int = 8192, n_threads: int | None = None):
    """调 process_args.resolve_llamacpp_args,返回 (resolution, model_path)。

    单独包一层方便测试 monkeypatch。
    """
    from chayuan.server.model_registry import process_args
    r = process_args.resolve_llamacpp_args(n_ctx=n_ctx, n_threads=n_threads)
    if r.missing:
        return r, None
    # 从 args 里抽 --model 后那个路径
    try:
        i = r.args.index("--model")
        return r, r.args[i + 1]
    except (ValueError, IndexError):
        return r, None
```

然后在 LlamaRuntimeManager class 内追加:

```python
    async def start(self, *, model_id: str | None = None) -> RuntimeStatus:
        """spawn llama-server.exe。失败时返回 state=failed 的 RuntimeStatus。"""
        if self._status.state in ("starting", "ready"):
            return self._status

        self._status = RuntimeStatus(state="starting")

        exe = self._find_llama_server_exe()
        if exe is None:
            self._status = RuntimeStatus(
                state="failed",
                last_error="llama-server.exe 不在 vendor/services/llama-server/ 里;集成版未带,或开发环境没跑 install-llama-server.ps1",
            )
            self._persist_status()
            return self._status

        resolution, model_path = _resolve_chat_args()
        if resolution.missing or not model_path:
            self._status = RuntimeStatus(
                state="failed",
                last_error=f"chat 模型未就绪:{resolution.reason or 'no chat default'}",
            )
            self._persist_status()
            return self._status

        port = self._allocate_port(preferred=self._settings.port)
        host = "0.0.0.0" if self._settings.expose_lan else self._settings.host

        args = [str(exe), "--host", host, "--port", str(port), "--log-disable"]
        args.extend(resolution.args)
        if self._settings.api_key:
            args.extend(["--api-key", self._settings.api_key])
        if "--ctx-size" not in resolution.args:
            args.extend(["--ctx-size", "8192"])
        if "--threads" not in resolution.args:
            args.extend(["--threads", str(min(8, os.cpu_count() or 4))])

        try:
            self._process = subprocess.Popen(
                args,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                # Windows 下 CREATE_NO_WINDOW = 0x08000000,避免弹黑框
                creationflags=0x08000000 if sys.platform == "win32" else 0,
            )
        except Exception as e:
            self._status = RuntimeStatus(state="failed", last_error=f"spawn failed: {e}")
            self._persist_status()
            return self._status

        # 等 /health 200(最长 60s)
        endpoint = f"http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}"
        ready = False
        deadline = datetime.now().timestamp() + 60.0
        while datetime.now().timestamp() < deadline:
            if self._process.poll() is not None:
                err = (self._process.stderr.read() if self._process.stderr else b"").decode("utf-8", errors="replace")[-500:]
                self._status = RuntimeStatus(
                    state="failed",
                    last_error=f"llama-server 启动时退出:{err}",
                )
                self._process = None
                self._persist_status()
                return self._status
            try:
                resp = await _probe_health(f"{endpoint}/health", timeout=2.0)
                if getattr(resp, "status_code", None) == 200:
                    ready = True
                    break
            except Exception:
                pass
            await asyncio.sleep(0.5)

        if not ready:
            # 超时也 kill 掉别留尸
            try:
                self._process.terminate()
                self._process.wait(timeout=5)
            except Exception:
                pass
            self._process = None
            self._status = RuntimeStatus(state="failed", last_error="启动 60s 内 /health 没返 200")
            self._persist_status()
            return self._status

        self._status = RuntimeStatus(
            state="ready",
            endpoint=endpoint,
            pid=self._process.pid,
            model_id=resolution.resolved_models.get("chat"),
            model_path=model_path,
            started_at=datetime.now(),
            last_health_at=datetime.now(),
        )
        self._persist_status()
        return self._status

    async def stop(self, *, timeout: float = 10.0) -> None:
        if self._process is None:
            self._status = RuntimeStatus(state="stopped")
            self._persist_status()
            return
        try:
            self._process.terminate()
            self._process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            self._process.kill()
        except Exception:
            pass
        finally:
            self._process = None
        self._status = RuntimeStatus(state="stopped")
        self._persist_status()

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

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

Expected: 全 passed (12+ 个测试)。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): start/stop 完整状态机 + Popen + health probe"
```

---

### Task 10: restart + status persistence + 单例 accessor

**Files:** 同 Task 9

- [ ] **Step 1: 加测试**

```python
@pytest.mark.asyncio
async def test_manager_restart_stop_then_start(tmp_path, monkeypatch):
    """restart() 应该等价于 stop + start"""
    from chayuan.server.model_registry import local_runtime
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    (services / "llama-server.exe").write_bytes(b"stub")
    monkeypatch.setattr(local_runtime, "_INSTALL_SERVICES_DIRS", [tmp_path / "services"])

    fake_resolution = mock.MagicMock(
        missing=[],
        args=["--model", "/tmp/fake.gguf"],
        resolved_models={"chat": "m1"},
        reason="",
    )
    monkeypatch.setattr(local_runtime, "_resolve_chat_args", lambda **kw: (fake_resolution, "/tmp/fake.gguf"))

    proc1 = mock.MagicMock(pid=111, poll=mock.MagicMock(return_value=None), wait=mock.MagicMock(return_value=0))
    proc2 = mock.MagicMock(pid=222, poll=mock.MagicMock(return_value=None), wait=mock.MagicMock(return_value=0))
    popen_mock = mock.MagicMock(side_effect=[proc1, proc2])
    monkeypatch.setattr(local_runtime.subprocess, "Popen", popen_mock)
    async def fake_health(url, **kw):
        return mock.MagicMock(status_code=200)
    monkeypatch.setattr(local_runtime, "_probe_health", fake_health)

    m = local_runtime.LlamaRuntimeManager(chayuan_root=tmp_path)
    s1 = await m.start()
    assert s1.pid == 111
    s2 = await m.restart()
    assert s2.pid == 222


def test_get_manager_singleton(tmp_path, monkeypatch):
    """get_manager() 返回单例"""
    from chayuan.server.model_registry import local_runtime
    monkeypatch.setattr(local_runtime, "_singleton", None)
    monkeypatch.setattr("chayuan.settings.CHAYUAN_ROOT", tmp_path)

    m1 = local_runtime.get_manager()
    m2 = local_runtime.get_manager()
    assert m1 is m2
```

- [ ] **Step 2: 实现 restart + singleton accessor**

在 LlamaRuntimeManager class 末尾加:

```python
    async def restart(self, *, model_id: str | None = None) -> RuntimeStatus:
        self._status = RuntimeStatus(state="restarting")
        self._persist_status()
        await self.stop()
        return await self.start(model_id=model_id)
```

文件末尾加 singleton accessor:

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

- [ ] **Step 3: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py -v
```

Expected: 全 passed (14 个左右)。

- [ ] **Step 4: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_local_runtime.py
git commit -m "feat(local-runtime): restart 实现 + get_manager 单例 accessor"
```

---

### Task 11: 接入 first_launch hook (preload) + lifespan shutdown

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/startup.py` (lifespan shutdown)

- [ ] **Step 1: 看现状**

```bash
grep -n "def first_launch_hooks\|seed_bundled_models\|promote_defaults_from_local" chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py | head -10
```

期望看到 first_launch_hooks 函数定义和它调的 3 个步骤。

- [ ] **Step 2: 加 preload 调用**

在 `first_launch.py` 末尾 `promote_defaults_from_local()` 调用之后,追加:

```python
    # 4) 按 LocalRuntimeSettings.preload_on_startup 异步拉起本地 chat runtime
    try:
        from chayuan.server.model_registry.local_runtime import get_manager
        manager = get_manager()
        if manager.settings.preload_on_startup:
            import asyncio
            # 不阻塞 first_launch,放 background task
            asyncio.create_task(manager.start())
            logger.info("[first_launch] 启动本地模型 runtime (preload_on_startup=True)")
        else:
            logger.info("[first_launch] 跳过预热 (preload_on_startup=False,首次聊天 lazy start)")
    except Exception as e:
        logger.warning("[first_launch] 本地 runtime 预热失败: %r", e)
        report.errors.append(f"local_runtime preload: {type(e).__name__}: {e}")
```

- [ ] **Step 3: 接 lifespan shutdown**

```bash
grep -n "lifespan\|app.on_event\|shutdown" chayuan-server/libs/chayuan-server/chayuan/startup.py | head -10
```

找到 lifespan async context manager(FastAPI 风格),在 shutdown 段加:

```python
    # 关停本地 LLM runtime (级联 kill llama-server.exe)
    try:
        from chayuan.server.model_registry.local_runtime import get_manager
        await get_manager().stop()
    except Exception as e:
        logger.warning("[shutdown] stop local runtime failed: %r", e)
```

- [ ] **Step 4: 跑 startup 相关测试 (确认没破坏其它启动逻辑)**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/ -v -k "first_launch or startup" 2>&1 | tail -20
```

Expected: 现有测试仍 pass(我们只加了 preload 调用,且 try/except 包了)。

- [ ] **Step 5: py_compile 验证**

```bash
python3 -m py_compile chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py
python3 -m py_compile chayuan-server/libs/chayuan-server/chayuan/startup.py
```

Expected: 无输出。

- [ ] **Step 6: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/first_launch.py
git add chayuan-server/libs/chayuan-server/chayuan/startup.py
git commit -m "feat(local-runtime): first_launch 预热 + lifespan shutdown 级联关停"
```

---

### Task 12: /runtime/llama/* API 路由 (status, start, stop, restart)

**Files:**
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` (在 `runtime_router` 后追加路由)
- Create: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py`

- [ ] **Step 1: 写测试 (TDD)**

```python
"""``/runtime/llama/*`` 路由测试。

mock LlamaRuntimeManager,验证路由 → manager 方法的转发 + 响应 JSON 结构。
"""
from __future__ import annotations

from unittest import mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from chayuan.server.api_server.runtime_routes import runtime_router
from chayuan.server.model_registry.local_runtime import RuntimeStatus


@pytest.fixture
def client(monkeypatch):
    fake = mock.MagicMock()
    fake.status = RuntimeStatus(state="ready", endpoint="http://127.0.0.1:62582", pid=1234)
    fake.start = mock.AsyncMock(return_value=fake.status)
    fake.stop = mock.AsyncMock(return_value=None)
    fake.restart = mock.AsyncMock(return_value=fake.status)
    monkeypatch.setattr(
        "chayuan.server.model_registry.local_runtime.get_manager",
        lambda: fake,
    )
    app = FastAPI()
    app.include_router(runtime_router)
    return TestClient(app), fake


def test_llama_status(client):
    c, _ = client
    r = c.get("/runtime/llama/status")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["state"] == "ready"
    assert data["endpoint"] == "http://127.0.0.1:62582"


def test_llama_start(client):
    c, fake = client
    r = c.post("/runtime/llama/start")
    assert r.status_code == 200
    fake.start.assert_called_once()


def test_llama_stop(client):
    c, fake = client
    r = c.post("/runtime/llama/stop")
    assert r.status_code == 200
    fake.stop.assert_called_once()


def test_llama_restart(client):
    c, fake = client
    r = c.post("/runtime/llama/restart")
    assert r.status_code == 200
    fake.restart.assert_called_once()
```

- [ ] **Step 2: 跑测试,确认 fail (路由未定义)**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py -v
```

Expected: 4 个测试,fail (404 Not Found,路由未注册)。

- [ ] **Step 3: 加路由到 runtime_routes.py**

文件末尾追加(在 `runtime_router` 最后一个现有路由之后):

```python
# ───────────────────────── /runtime/llama/* ─────────────────────────
# 本地 LLM runtime (llama-server.exe) 控制面。详见
# docs/superpowers/specs/2026-05-15-local-llm-runtime-integration-design.md §4.3。

def _llama_manager():
    """惰性 import 避免循环依赖"""
    from chayuan.server.model_registry.local_runtime import get_manager
    return get_manager()


def _ok(data) -> Dict[str, Any]:
    return {"code": 0, "data": data}


@runtime_router.get("/llama/status")
def llama_status() -> Dict[str, Any]:
    return _ok(_llama_manager().status.to_dict())


@runtime_router.post("/llama/start")
async def llama_start(body: Dict[str, Any] = Body(default={})) -> Dict[str, Any]:
    model_id = body.get("model_id") if isinstance(body, dict) else None
    status = await _llama_manager().start(model_id=model_id)
    return _ok(status.to_dict())


@runtime_router.post("/llama/stop")
async def llama_stop() -> Dict[str, Any]:
    await _llama_manager().stop()
    return _ok(_llama_manager().status.to_dict())


@runtime_router.post("/llama/restart")
async def llama_restart(body: Dict[str, Any] = Body(default={})) -> Dict[str, Any]:
    model_id = body.get("model_id") if isinstance(body, dict) else None
    status = await _llama_manager().restart(model_id=model_id)
    return _ok(status.to_dict())
```

- [ ] **Step 4: 跑测试,确认 pass**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py -v
```

Expected: 4 passed。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py
git commit -m "feat(api): /runtime/llama/{status,start,stop,restart} 路由"
```

---

### Task 13: /runtime/llama/config GET+POST

**Files:** 同 Task 12

- [ ] **Step 1: 加测试**

在 `test_runtime_routes_llama.py` 末尾追加:

```python
def test_llama_config_get(client):
    c, fake = client
    fake.settings = mock.MagicMock(
        preload_on_startup=True,
        host="127.0.0.1",
        port=62582,
        api_key="",
        expose_lan=False,
        default_chat_model="",
    )
    import dataclasses
    fake.settings.__dataclass_fields__ = {}  # 让 dataclass.asdict 不 crash
    # 用真 dataclass 替代:
    from chayuan.server.model_registry.local_runtime import LocalRuntimeSettings
    fake.settings = LocalRuntimeSettings()

    r = c.get("/runtime/llama/config")
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["port"] == 62582
    assert data["preload_on_startup"] is True


def test_llama_config_post(client):
    c, fake = client
    from chayuan.server.model_registry.local_runtime import LocalRuntimeSettings
    fake.settings = LocalRuntimeSettings()
    fake.set_config = mock.MagicMock()

    r = c.post("/runtime/llama/config", json={"port": 62590, "expose_lan": True})
    assert r.status_code == 200
    fake.set_config.assert_called_once()
    args, _ = fake.set_config.call_args
    cfg_update = args[0]
    assert cfg_update["port"] == 62590
    assert cfg_update["expose_lan"] is True
```

- [ ] **Step 2: 在 LlamaRuntimeManager 加 set_config 方法**

`local_runtime.py` 的 class 末尾加:

```python
    def set_config(self, update: dict) -> LocalRuntimeSettings:
        """部分更新设置 + 持久化 yaml。返回更新后的 settings。

        注意:不立即重启 llama-server,需要前端追一次 /runtime/llama/restart。
        """
        cur = dataclasses.asdict(self._settings)
        for k, v in update.items():
            if k in cur:
                cur[k] = v
        self._settings = LocalRuntimeSettings(**cur)
        self._settings.save(self.settings_path)
        return self._settings
```

- [ ] **Step 3: 加路由到 runtime_routes.py**

```python
@runtime_router.get("/llama/config")
def llama_config_get() -> Dict[str, Any]:
    import dataclasses as _dc
    return _ok(_dc.asdict(_llama_manager().settings))


@runtime_router.post("/llama/config")
def llama_config_post(body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    """部分更新设置。不立即重启,需要 /runtime/llama/restart 让端口 / API key 生效"""
    if not isinstance(body, dict) or not body:
        raise HTTPException(status_code=400, detail="body 必须是非空 dict")
    # 端口合法性校验
    port = body.get("port")
    if port is not None and not (1024 <= int(port) <= 65535):
        raise HTTPException(status_code=422, detail="port 必须在 1024-65535")
    new_settings = _llama_manager().set_config(body)
    import dataclasses as _dc
    return _ok(_dc.asdict(new_settings))
```

- [ ] **Step 4: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py -v
```

Expected: 6 passed。

- [ ] **Step 5: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py
git commit -m "feat(api): /runtime/llama/config GET+POST + LlamaRuntimeManager.set_config"
```

---

### Task 14: /runtime/llama/install-info

**Files:** 同 Task 12

- [ ] **Step 1: 加测试**

```python
def test_llama_install_info(client, tmp_path, monkeypatch):
    c, fake = client
    fake.chayuan_root = tmp_path
    (tmp_path / "models" / "bundled").mkdir(parents=True)
    services = tmp_path / "services" / "llama-server"
    services.mkdir(parents=True)
    (services / "llama-server.exe").write_bytes(b"stub")
    (services / "VERSION").write_text("b4404\n")
    fake._find_llama_server_exe = mock.MagicMock(return_value=services / "llama-server.exe")

    r = c.get("/runtime/llama/install-info")
    assert r.status_code == 200
    d = r.json()["data"]
    assert "models_root" in d
    assert "llama_server_exe" in d
    assert d["llama_server_exe"].endswith("llama-server.exe")
    assert d["build_version"] == "b4404"
```

- [ ] **Step 2: 加路由**

```python
@runtime_router.get("/llama/install-info")
def llama_install_info() -> Dict[str, Any]:
    """透出关键路径给设置页"模型存放路径" section 显示"""
    m = _llama_manager()
    exe = m._find_llama_server_exe()  # 受 monkeypatch 影响,测试可注入
    version = None
    if exe is not None and exe.parent.is_dir():
        v_path = exe.parent / "VERSION"
        if v_path.is_file():
            version = v_path.read_text(encoding="utf-8").splitlines()[0].strip()
    return _ok({
        "chayuan_root": str(m.chayuan_root),
        "models_root": str(m.chayuan_root / "models"),
        "bundled_models_root": str(m.chayuan_root / "models" / "bundled"),
        "llama_server_exe": str(exe) if exe else None,
        "build_version": version,
    })
```

- [ ] **Step 3: 跑测试**

```bash
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py -v
```

Expected: 7 passed。

- [ ] **Step 4: Commit**

```bash
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py
git add chayuan-server/libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py
git commit -m "feat(api): /runtime/llama/install-info 透出模型路径给设置页"
```

---

### Task 15: 装机手测脚本 + Sprint 2 验证

**Files:**
- Create: `scripts/test-local-runtime.ps1`

- [ ] **Step 1: 写手测脚本**

写入 `scripts/test-local-runtime.ps1` (UTF-8 BOM):

```powershell
﻿<#
.SYNOPSIS
  装机后手测本地 LLM runtime 是否跑通,输出可粘贴日志。

.DESCRIPTION
  顺序:
    1. 拉 /runtime/llama/install-info 看路径
    2. 拉 /runtime/llama/status 看当前状态
    3. 如果 stopped,POST /runtime/llama/start 等就绪
    4. POST /v1/chat/completions 直打 llama-server 验证 OpenAI-compat
    5. /runtime/llama/status 收尾确认
#>
[CmdletBinding()]
param(
    [string]$SidecarBase = 'http://127.0.0.1:62581',
    [string]$Question = '中国首都是?'
)

try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); chcp 65001 > $null 2>&1 } catch {}
$ErrorActionPreference = 'Stop'

$logFile = Join-Path $env:TEMP "chayuan-local-runtime-test.log"
$out = [System.Text.StringBuilder]::new()

function W($t) {
    Write-Host $t
    [void]$out.AppendLine($t)
}

W "=== 本地 LLM runtime 装机手测 ==="
W "时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W "sidecar: $SidecarBase"
W ""

W "── 1. /runtime/llama/install-info ──"
$info = Invoke-RestMethod -Uri "$SidecarBase/runtime/llama/install-info" -TimeoutSec 10
W ($info.data | ConvertTo-Json -Depth 5)
W ""

W "── 2. /runtime/llama/status (当前) ──"
$status = Invoke-RestMethod -Uri "$SidecarBase/runtime/llama/status" -TimeoutSec 10
W ($status.data | ConvertTo-Json -Depth 5)
W ""

if ($status.data.state -ne 'ready') {
    W "── 3. /runtime/llama/start ──"
    $started = Invoke-RestMethod -Uri "$SidecarBase/runtime/llama/start" -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 90
    W ($started.data | ConvertTo-Json -Depth 5)
    if ($started.data.state -ne 'ready') {
        W "[FAIL] 启动失败:$($started.data.last_error)"
        $out.ToString() | Set-Content -Path $logFile -Encoding UTF8
        Write-Host ""
        Write-Host "日志已写到: $logFile"
        exit 1
    }
}

$endpoint = $status.data.endpoint
if (-not $endpoint) { $endpoint = (Invoke-RestMethod -Uri "$SidecarBase/runtime/llama/status").data.endpoint }
W ""
W "── 4. POST $endpoint/v1/chat/completions ──"
$payload = @{
    model = 'auto'
    messages = @(@{ role = 'user'; content = $Question })
    max_tokens = 64
    stream = $false
} | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Uri "$endpoint/v1/chat/completions" -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 30
    W "Q: $Question"
    W "A: $($resp.choices[0].message.content)"
} catch {
    W "[FAIL] OpenAI-compat 调用失败: $_"
}
W ""

W "── 5. /runtime/llama/status (收尾) ──"
W (Invoke-RestMethod -Uri "$SidecarBase/runtime/llama/status").data | ConvertTo-Json -Depth 5
W ""

$out.ToString() | Set-Content -Path $logFile -Encoding UTF8
Write-Host ""
Write-Host "日志已写到: $logFile"
```

- [ ] **Step 2: 总验证 — 全套测试一次 pass**

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server pytest libs/chayuan-server/tests/unit_tests/test_local_runtime.py libs/chayuan-server/tests/unit_tests/test_runtime_routes_llama.py libs/chayuan-server/tests/unit_tests/test_admin_models_install_release_route.py -v 2>&1 | tail -10
```

Expected: 全 passed (≥ 25 个)。

- [ ] **Step 3: Commit**

```bash
git add scripts/test-local-runtime.ps1
git commit -m "test(scripts): test-local-runtime.ps1 装机手测脚本"
```

---

## Sprint 1 + Sprint 2 完成标志

跑通后用户能做:

1. ✅ 开发机:`./scripts/install-llama-server.sh` 拉 vendor 二进制 → `python packaging/pyinstaller/build.py --sync-services-only` 同步到 Tauri resources
2. ✅ 集成版 .msi 装机后:`C:\Program Files\Chayuan\services\llama-server\llama-server.exe` 存在
3. ✅ 桌面启动后 (preload=on,默认):后台 60s 内本地 chat runtime ready
4. ✅ curl `http://127.0.0.1:62581/runtime/llama/status` 拿到 state=ready
5. ✅ curl `http://127.0.0.1:62582/v1/chat/completions` 直打 llama-server 拿响应
6. ✅ POST `/runtime/llama/config` 改 host/port,POST `/runtime/llama/restart` 生效
7. ✅ 关 desktop 时 sidecar shutdown → 级联 kill llama-server,无进程留尸

**Plan 2 (Sprint 3+4) 在 Plan 1 完成 review 后开始**:把这些 API 接到前端设置页 + Composer 模型下拉。
