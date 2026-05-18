# 本地开发调试 — Linux 快速上手

跨平台细节(整体架构、5 个 capability 怎么落地、模型怎么装、HTTP 调试、测试)看
[DEV-LOCAL-RUNTIME.md](./DEV-LOCAL-RUNTIME.md)。本文只讲 Linux 特定坑。

## 0. 一键启动(推荐)

```bash
./scripts/dev-start.sh
```

或只 preflight:

```bash
./scripts/dev-start.sh --check-only
```

`dev-start.sh` 自动做的事:
1. `LANG=en_US.UTF-8` + `PYTHONIOENCODING=utf-8`
2. 检测 `uname -m` → 选 `linux-x64` 或 `linux-arm64` vendor 子目录
3. 找 poetry 或 `python3` + 验证 `import chayuan`
4. 检查 `vendor/services/llama-server/<plat>/llama-server` 存在
5. 默认 `CHAYUAN_ROOT=$HOME/.chayuan-dev`,首次跑 `chayuan init -q`
6. 起 `python -m chayuan start -a --single-machine`(前台 / `--bg` 后台)

## 1. 一次性准备

### 1.1 装系统依赖

> ⚠ **chayuan-server 不支持 Python 3.13**。实测 3.13 上 multiprocessing 子 worker 100% SIGSEGV(C 扩展不兼容)。**必须 Python 3.10 / 3.11 / 3.12**(推荐 3.12)。

```bash
# Ubuntu 22.04+ / Debian 12+(推荐)
sudo apt update
sudo apt install -y python3.12 python3-pip python3-venv git curl build-essential cmake

# RHEL 9 / Rocky 9 / Alma 9
sudo dnf install -y python3.12 python3-pip git curl gcc-c++ make cmake

# Anolis / Alibaba Cloud Linux 3(系统 Python 通常是 3.6 太老)→ 用 conda:
curl -fsSL https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -o /tmp/mc.sh
bash /tmp/mc.sh -b -p $HOME/miniconda3
$HOME/miniconda3/bin/conda create -n py312 python=3.12 -y
export CHAYUAN_PYTHON=$HOME/miniconda3/envs/py312/bin/python3
# 然后 dev-start.sh 会自动用这个

# Arch / Manjaro
sudo pacman -S python python-pip git curl base-devel cmake

# Alpine
sudo apk add python3 py3-pip git curl gcc g++ make cmake
```

`dev-start.sh` 按 **CHAYUAN_PYTHON env > conda envs/py312 > pyenv 3.12.x > python3.12 / python3.11** 顺序找;系统只有 3.13 时给清晰错误指引。

### 1.2 装 poetry(可选)

```bash
pip install --user poetry
# 或 brew(Linuxbrew):brew install poetry
```

### 1.3 装 chayuan-server 依赖

```bash
cd chayuan-server
poetry install --only main
# 或:pip install -e libs/chayuan-server
```

### 1.4 检查 vendor 二进制

`chayuan-server/vendor/services/llama-server/` 下应该已带:

```text
llama-server/linux-x64/      ← Ubuntu 22.04+ glibc 2.34, x86_64
llama-server/linux-arm64/    ← Linux aarch64(Apple M VM / Pi / Graviton),Docker 提取
whisper-server/linux-x64/    ← Docker amd64 提取
whisper-server/linux-arm64/  ← 没,upstream Docker 无 arm64,要源码 build
```

需要别的版本:

```bash
./scripts/install-llama-server.sh b4500                  # 自动 host
./scripts/install-llama-server.sh b4500 --target linux-x64
./scripts/install-whisper-server.sh v1.7.6 --target linux-x64
```

### 1.5 装 bundled 模型

```bash
python3 scripts/install-bundled-models.py
# 国内 hf-mirror Xet 慢可切 ModelScope:
python3 scripts/install-bundled-models.py --source modelscope
```

## 2. 编码问题(Linux 通常没事但生产 server 也容易撞)

### 2.1 终端 locale

```bash
locale  # 应输出 en_US.UTF-8 / C.UTF-8 / zh_CN.UTF-8 之一
# 不是就 export
echo 'export LANG="en_US.UTF-8"' >> ~/.bashrc
echo 'export LC_ALL="en_US.UTF-8"' >> ~/.bashrc
```

### 2.2 `.sh` 不要 BOM,LF 行尾

仓库 `.gitattributes` 已固定 `*.sh = LF`。如果 git pull 后变 CRLF:

```bash
sed -i 's/\r$//' scripts/dev-start.sh
git config core.autocrlf input
```

### 2.3 systemd / docker 跑 chayuan 时的 UTF-8

systemd 子进程默认 LANG=C(单字节),会让 Python 的 print 中文报 UnicodeEncodeError。
systemd unit file 加:

```ini
[Service]
Environment=LANG=en_US.UTF-8
Environment=PYTHONIOENCODING=utf-8
```

## 3. GLIBC 兼容性(头等大坑)

`chayuan-server/vendor/services/llama-server/linux-x64/llama-server` 是在 **Ubuntu 22.04** 编的,要求:

- `GLIBC >= 2.34`
- `GLIBCXX >= 3.4.32`

不满足的发行版:

| 发行版 | glibc 版本 | 兼容? |
|---|---|---|
| Ubuntu 20.04           | 2.31 | ✗ |
| Ubuntu 22.04+ / 24.04+ | 2.35+ | ✓ |
| Debian 11              | 2.31 | ✗ |
| Debian 12+             | 2.36 | ✓ |
| RHEL 8 / CentOS 8 / Anolis 8 / Alibaba Cloud Linux 3 | 2.28-2.32 | ✗ |
| RHEL 9 / Rocky 9 / Alma 9 | 2.34 | ✓ |
| Alpine 3.18+(musl 而非 glibc) | n/a | ✗ |

确认本机 glibc:

```bash
ldd --version | head -1
```

**不兼容的解法:**

```bash
# 方案 A:容器跑 server(最干净)
docker run -it --rm -v $PWD:/work -w /work ubuntu:22.04 bash
apt update && apt install -y python3-pip
pip install -e chayuan-server/libs/chayuan-server
python3 -m chayuan start -a --single-machine

# 方案 B:源码 build llama.cpp(需要 cmake + g++)
git clone --depth 1 --branch b4404 https://github.com/ggerganov/llama.cpp /tmp/llama.cpp
cd /tmp/llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --target llama-server -j$(nproc)
cp build/bin/llama-server $REPO/chayuan-server/vendor/services/llama-server/linux-x64/

# 方案 C:挂个 Ubuntu 22 VM 跑(GitHub Codespaces / Multipass / Lima)
```

## 4. 起 chayuan-server(不用 dev-start)

```bash
export CHAYUAN_ROOT="$HOME/.chayuan-dev"
export CHAYUAN_VENDOR_PLATFORM=linux-x64       # 可选,strict

cd chayuan-server
poetry run python -m chayuan start -a --single-machine
```

主 API `127.0.0.1:62581`。

## 5. 起 Tauri 桌面端(本地联调)

```bash
# Tauri 依赖:
sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev

cd chayuan-client
pnpm install
pnpm tauri dev
```

不想 Tauri 自动 spawn:

```bash
# 终端 A
./scripts/dev-start.sh

# 终端 B
export CHAYUAN_DESKTOP_SPAWN_SIDECAR=0
cd chayuan-client
pnpm tauri dev
```

## 6. 常见 Linux 坑

| 现象 | 原因 | 解法 |
|---|---|---|
| `llama-server: GLIBC_2.34 not found` | 系统 glibc 比 binary 旧 | §3 三个方案 |
| `cannot execute binary file: Exec format error` | 用错了架构子目录(x64 binary 跑在 arm64) | 设 `CHAYUAN_VENDOR_PLATFORM=linux-arm64` |
| `libwhisper.so.1: cannot open shared object` | loader 没找到同目录的 .so | `dev-start.sh` 已注入 `LD_LIBRARY_PATH`;手动起时 `export LD_LIBRARY_PATH="$PWD/chayuan-server/vendor/services/whisper-server/linux-x64"` |
| AVX2 不支持(老 Xeon / VM) | 二进制需要 AVX2 | upstream Linux 只有一个 build,没 noavx 选项;源码 build 或换 Win |
| `dev-start.sh: /bin/bash^M: bad interpreter` | CRLF 行尾 | `sed -i 's/\r$//' scripts/dev-start.sh` |
| 端口被占 | 已有 jupyter / mlflow / vllm | PortAllocator bump |
| `pip install` 卡在 torch 编译 | 没用 cpu wheel | `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| Alpine 跑不起 | musl libc + libstdc++ 不兼容 | 用 Debian / Ubuntu;或 `apk add gcompat`(部分场景能糊弄) |

## 7. 一键诊断

```bash
./scripts/diagnose.sh
```

日志落到 `/tmp/chayuan-diagnose-<ts>.md`。
