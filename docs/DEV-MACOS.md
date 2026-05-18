# 本地开发调试 — macOS 快速上手

跨平台细节(整体架构、5 个 capability 怎么落地、模型怎么装、HTTP 调试、测试)看
[DEV-LOCAL-RUNTIME.md](./DEV-LOCAL-RUNTIME.md)。本文只讲 macOS 特定坑。

## 0. 一键启动(推荐)

```bash
./scripts/dev-start.sh
```

或只 preflight 不启:

```bash
./scripts/dev-start.sh --check-only
```

`dev-start.sh` 自动做的事:
1. `LANG=en_US.UTF-8` + `PYTHONIOENCODING=utf-8`(防中文乱码)
2. 检测 `uname -m` → 选 `macos-arm64`(M1+)或 `macos-x64`(Intel)
3. 找 poetry 或 `python3` + 验证 `import chayuan`
4. 检查 `vendor/services/llama-server/<plat>/llama-server` 存在
5. 默认 `CHAYUAN_ROOT=$HOME/.chayuan-dev`,首次跑 `chayuan init -q`
6. 起 `python -m chayuan start -a --single-machine`(前台 / `--bg` 后台)

## 1. 一次性准备

### 1.1 装 Xcode CLT + brew(几乎所有 mac 都要)

```bash
xcode-select --install
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1.2 装 Python + poetry

> ⚠ **chayuan-server 不支持 Python 3.13**(C 扩展跟 multiprocessing 子 worker 不兼容,100% SIGSEGV)。**必须 Python 3.10 / 3.11 / 3.12**。

```bash
brew install python@3.12 poetry
# 或 conda:conda create -n py312 python=3.12 -y
```

`dev-start.sh` 按优先级找 Python 3.12 / 3.11;只有 3.13 时给指引让你装 3.12。可显式:

```bash
export CHAYUAN_PYTHON=$(brew --prefix python@3.12)/bin/python3.12
./scripts/dev-start.sh
```

### 1.3 装 chayuan-server 依赖

```bash
cd chayuan-server
poetry install --only main
# 或不用 poetry:pip install -e libs/chayuan-server
```

### 1.4 检查 vendor 二进制

`chayuan-server/vendor/services/llama-server/` 和 `whisper-server/` 下应该已带:

```text
llama-server/macos-arm64/    ← Apple Silicon (M1+) + Metal shader
llama-server/macos-x64/      ← Intel Mac
whisper-server/<空>          ← upstream 没发 mac binary,brew install whisper-cpp
```

需要别的版本:

```bash
./scripts/install-llama-server.sh b4500            # 默认 host 平台
./scripts/install-llama-server.sh b4500 --target macos-x64   # cross-arch
```

### 1.5 whisper-server 装法(Mac 只能这两条路)

Upstream **没有** macOS pre-built。两条路:

**路径 A — brew(推荐,几秒搞定)**

```bash
brew install whisper-cpp
./scripts/install-whisper-server.sh
# 脚本自动从 $(brew --prefix whisper-cpp)/bin/whisper-server 复制
```

**路径 B — 源码 cmake build**

```bash
brew install cmake
./scripts/install-whisper-server.sh v1.7.6
# 自动 git clone + cmake -DWHISPER_BUILD_SERVER=ON
```

### 1.6 装 bundled 模型(首次或换默认模型时)

```bash
python3 scripts/install-bundled-models.py
# 或只装 chat:python3 scripts/install-bundled-models.py --only chat
```

## 2. 编码问题(macOS 比 Windows 友好但不能松)

### 2.1 终端 UTF-8

默认 Terminal.app / iTerm2 都是 UTF-8。如果不是:

```bash
# .zshrc / .bash_profile 加:
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"
```

### 2.2 `.sh` 文件不要 BOM

shell 不认 BOM,脚本首行 `#!/usr/bin/env bash` 前必须**不带** BOM,否则 `exec` 报「Bad interpreter」。
VSCode 默认就是 UTF-8 without BOM,不用管。

### 2.3 git autocrlf

仓库 `.gitattributes` 已规定 `*.sh` = LF。新 clone 没问题;如果同事在 Windows 改过
`.sh` 引入 CRLF,跑:

```bash
git config core.autocrlf input
```

## 3. 起 chayuan-server(不用 dev-start)

```bash
export CHAYUAN_ROOT="$HOME/.chayuan-dev"
export CHAYUAN_VENDOR_PLATFORM=macos-arm64    # 可选,strict

cd chayuan-server
poetry run python -m chayuan start -a --single-machine
```

主 API `127.0.0.1:62581`。

## 4. 起 Tauri 桌面端(本地联调)

```bash
cd chayuan-client
pnpm install
pnpm tauri dev
```

不想让 Tauri 自动 spawn(用已起的 dev server):

```bash
# 终端 A
./scripts/dev-start.sh

# 终端 B
export CHAYUAN_DESKTOP_SPAWN_SIDECAR=0
cd chayuan-client
pnpm tauri dev
```

## 5. 常见 macOS 坑

| 现象 | 原因 | 解法 |
|---|---|---|
| `dev-start.sh: Permission denied` | 没 x 位 | `chmod +x scripts/dev-start.sh` 或 `bash scripts/dev-start.sh` |
| llama-server 报 `cannot be opened because the developer cannot be verified` | Gatekeeper 拦没签名的 binary | `xattr -dr com.apple.quarantine chayuan-server/vendor/services/llama-server/` |
| llama-server 在 M1 上慢 | 用错了 binary(macos-x64 跑在 Rosetta) | 确认 `arch` 输出 `arm64`;`CHAYUAN_VENDOR_PLATFORM=macos-arm64 ./scripts/dev-start.sh` |
| whisper-server.dylib 找不到 | brew 装的 .dylib 在 cellar 里被 LD 找不到 | `dev-start.sh` 已注入 `DYLD_LIBRARY_PATH`;若手动起 server,加 `export DYLD_LIBRARY_PATH="$(brew --prefix whisper-cpp)/lib"` |
| 端口被占(38080 onlyoffice / 39530 milvus) | 装了其它 brew 服务 | PortAllocator 自动 bump,看 `/runtime/services` |
| poetry 装依赖卡在 build | torch / sentence-transformers 编译 | 装 ARM whl:`pip install torch --index-url https://download.pytorch.org/whl/cpu` |

## 6. 一键诊断

```bash
./scripts/diagnose.sh
```

日志落到 `/tmp/chayuan-diagnose-<ts>.md`。
