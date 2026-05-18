# 本地开发调试 — Windows 快速上手

跨平台细节(整体架构、5 个 capability 怎么落地、模型怎么装、HTTP 调试、测试)看
[DEV-LOCAL-RUNTIME.md](./DEV-LOCAL-RUNTIME.md)。本文只讲 Windows 特定坑。

## 0. 一键启动(推荐)

打开 PowerShell 或双击 `scripts\dev-start.cmd`:

```powershell
.\scripts\dev-start.ps1
```

或只 preflight 不启:

```powershell
.\scripts\dev-start.ps1 -CheckOnly
```

`dev-start.ps1` 自动做的事:
1. `chcp 65001` + `[Console]::OutputEncoding = UTF-8`(防中文乱码)
2. 检测 `PROCESSOR_ARCHITECTURE` → 选 `win-x64` 或 `win-arm64` vendor 子目录
3. 找 poetry 或 `python.exe` + 验证 `import chayuan`
4. 检查 `vendor\services\llama-server\<plat>\llama-server.exe` 等存在
5. 默认 `CHAYUAN_ROOT=$env:USERPROFILE\.chayuan-dev`,首次跑 `chayuan init -q`
6. 起 `python -m chayuan start -a --single-machine`(前台 / `-Bg` 后台)

## 1. 一次性准备

### 1.1 装 Python 3.12 + poetry

> ⚠ **chayuan-server 不支持 Python 3.13**(C 扩展 + multiprocessing 子 worker 100% SIGSEGV)。**必须 Python 3.10 / 3.11 / 3.12**。

```powershell
winget install Python.Python.3.12
pip install poetry
```

`dev-start.ps1` 自动按 Python 3.12 / 3.11 优先;只有 3.13 时给指引。要强制用某个 Python:

```powershell
$env:CHAYUAN_PYTHON = 'C:\Python312\python.exe'
.\scripts\dev-start.ps1
```

### 1.2 装 chayuan-server 依赖

```powershell
cd chayuan-server
poetry install --only main
```

如果没用 poetry:

```powershell
cd chayuan-server
pip install -e libs\chayuan-server
```

### 1.3 检查 vendor 二进制

`chayuan-server\vendor\services\llama-server\` 和 `whisper-server\` 下应该已有平台子目录(从 git checkout 即带)。要 5 个 Win 变体之一:

```text
llama-server\win-x64\        ← AVX2 默认(Haswell 2013+)
llama-server\win-x64-avx\    ← AVX 老 Sandy/Ivy Bridge
llama-server\win-x64-avx512\ ← Skylake-X / Xeon
llama-server\win-x64-noavx\  ← Pentium/Celeron / VM
llama-server\win-arm64\      ← Surface Pro X / Copilot+ PC
```

需要别的版本时:`.\scripts\install-llama-server.ps1 -Target win-x64-noavx -Version b4500`

### 1.4 装 bundled 模型(可选,首次或换默认模型时)

```powershell
python scripts\install-bundled-models.py
# 或只装 chat
python scripts\install-bundled-models.py --only chat
# 国内走 ModelScope
python scripts\install-bundled-models.py --source modelscope
```

## 2. 编码问题(Windows 特别坑)

### 2.1 `.ps1` 文件必须 UTF-8 BOM

仓库里所有 `.ps1` 都是 UTF-8 with BOM(前 3 字节 `EF BB BF`)。
**不要**用 VSCode 「另存为」选「UTF-8 without BOM」—— Windows PowerShell 5.x 会按
ANSI/GBK 解析,中文全乱码。

验证当前文件:

```powershell
$bytes = [System.IO.File]::ReadAllBytes('scripts\dev-start.ps1') | Select-Object -First 3
$bytes | ForEach-Object { '0x{0:X2}' -f $_ }
# 应输出 0xEF 0xBB 0xBF
```

### 2.2 PowerShell 7+ 用 UTF-8 也行,但 5.x 不行

公司机器一般还是 PS 5.1 + Windows Terminal。装 PowerShell 7:

```powershell
winget install Microsoft.PowerShell
```

### 2.3 `.cmd` 文件不要加 BOM

`.cmd` / `.bat` 必须**不带** BOM,否则 cmd.exe 第一行解析失败报 ``... 不是内部或外部命令``。

### 2.4 chayuan-server 日志 UTF-8

`dev-start.ps1` 启动前 export `PYTHONIOENCODING=utf-8`,确保 server 的 print 不会编码错。
单独跑 `python -m chayuan start` 时:

```powershell
$env:PYTHONIOENCODING = 'utf-8'
chcp 65001
python -m chayuan start -a --single-machine
```

### 2.5 git autocrlf

`.gitattributes` 已把 `*.ps1 *.cmd` 设成 `text eol=crlf`,`*.sh` 设成 `text eol=lf`。
新克隆的仓库不该出现 LF/CRLF 混乱;如果遇到,跑 `git config core.autocrlf input`。

## 3. 起 chayuan-server(不用 dev-start)

```powershell
$env:CHAYUAN_ROOT = "$env:USERPROFILE\.chayuan-dev"
$env:CHAYUAN_VENDOR_PLATFORM = 'win-x64'   # 可选,强制 CPU 变体

cd chayuan-server
poetry run python -m chayuan start -a --single-machine
```

主 API 监听 `127.0.0.1:62581`。5 个 capability 按需 spawn 各自的 sidecar:

| capability      | port  |
|-----------------|-------|
| chat            | 62582 |
| embedding       | 62583 |
| rerank          | 62584 |
| asr             | 62585 |
| image-embedding | 62586 |

## 4. 起 Tauri 桌面端(本地联调)

```powershell
cd chayuan-client
pnpm install
pnpm tauri dev
```

默认会自动 spawn chayuan-server sidecar;不想让 Tauri 自动 spawn,先跑 dev-start
再开 desktop:

```powershell
# 终端 A
.\scripts\dev-start.ps1

# 终端 B —— 设 dev 模式不 spawn,Tauri 用已起的 server
$env:CHAYUAN_DESKTOP_SPAWN_SIDECAR = '0'
cd chayuan-client
pnpm tauri dev
```

## 5. 常见 Windows 坑

| 现象 | 原因 | 解法 |
|---|---|---|
| `.ps1` 中文显示成乱码 | 文件少 BOM 或终端不是 UTF-8 | 看 §2.1 / §2.2 |
| `.\xxx.ps1` 报「不允许在系统上运行脚本」 | ExecutionPolicy 默认 Restricted | 用 `dev-start.cmd`(已带 `-ExecutionPolicy Bypass`);或 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| llama-server.exe 启动闪退 | CPU 不支持 AVX2 | `dev-start.ps1 -VendorPlatform win-x64-noavx` |
| 火绒 / Defender 报毒 | llama.cpp 二进制未签名 | 加白名单 `chayuan-server\vendor\services\llama-server\win-x64\` 整目录 |
| 端口被占 | 62581 / 62582 被其它服务用 | PortAllocator 自动 bump 到 62583+,看 `/runtime/llama/chat/status` 里的 endpoint |
| `import chayuan` 失败 | 没 pip install -e | `cd chayuan-server; pip install -e libs\chayuan-server` |
| poetry run 慢 | 第一次会建 venv | 改用 `python -m chayuan ...` 直接跑 |

## 6. 一键诊断

```powershell
.\scripts\diagnose.ps1
```

日志落到 `$env:TEMP\chayuan-diagnose-<ts>.md`。
