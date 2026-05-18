# 本地 Runtime 开发调试指南 — 跨平台主页

适用于:在 dev 机上直接跑 `chayuan-server` 源码,手动调试 5 个 capability(`chat` / `embedding` / `rerank` / `asr` / `image-embedding`)对应的本地 sidecar。

> 装机版用户验收用的是 `docs/RUNBOOK-local-runtime-diagnose.md` 那条路径(安装包 → 桌面 UI → 一键诊断按钮);本文档是给**改代码 / 跑 PR / 单步调试**用的。

## 🚀 一键启动

| 平台    | 命令                                        | 编码备注                                            |
|---------|---------------------------------------------|-----------------------------------------------------|
| Windows | `.\scripts\dev-start.cmd` 或 `dev-start.ps1` | `.ps1` 必须 **UTF-8 BOM**,`.cmd` 自动 `chcp 65001` |
| macOS   | `./scripts/dev-start.sh`                    | LANG=UTF-8 + PYTHONIOENCODING=utf-8                 |
| Linux   | `./scripts/dev-start.sh`                    | 同上                                                |

加 `--check-only` 只跑 preflight 不真启;加 `--bg`(sh)/ `-Bg`(ps1)后台跑。

## 📚 平台专属说明

各平台的"一次性准备"+ "常见坑"看专门文档:

- 🪟 [DEV-WINDOWS.md](./DEV-WINDOWS.md) — PowerShell BOM / ExecutionPolicy / AVX2 变体 / Defender 误报
- 🍎 [DEV-MACOS.md](./DEV-MACOS.md) — Xcode CLT / brew install whisper-cpp / Gatekeeper / Apple Silicon vs Intel
- 🐧 [DEV-LINUX.md](./DEV-LINUX.md) — GLIBC 2.34 要求 / Docker fallback / CRLF / systemd locale

---

## 跨平台细节(都通用)

---

## 1. 全景:5 个 capability 怎么落地

| capability | engine | 进程/模块 | 偏好端口 | 二进制装哪儿 | 模型装哪儿 |
|---|---|---|---|---|---|
| chat              | llama    | `llama-server(.exe)` (子进程)                              | 62582 | `chayuan-server/vendor/services/llama-server/`    | `chayuan-server/vendor/bundled_models/chat/`               |
| embedding         | llama    | `llama-server --embedding` (子进程,复用 llama-server)        | 62583 | 同上                                                | `chayuan-server/vendor/bundled_models/embedding/`          |
| rerank            | llama    | `llama-server --reranking` (子进程,复用 llama-server)        | 62584 | 同上                                                | `chayuan-server/vendor/bundled_models/rerank/`             |
| asr               | whisper  | `whisper-server(.exe)` (子进程)                            | 62585 | `chayuan-server/vendor/services/whisper-server/`  | `chayuan-server/vendor/bundled_models/asr/`                |
| image-embedding   | infinity | `python -m chayuan.server.image_source.infinity_server`   | 62586 | (用当前 Python 解释器,无独立二进制)                  | `chayuan-server/vendor/bundled_models/image/` (clip-vit-base-patch32) |

- 端口由 `LocalRuntimeRegistry` 按 `port_offset` 推算,被占会自动 bump。
- 进程编排在 `chayuan/server/model_registry/local_runtime.py:SidecarRuntimeManager`(`engine` 参数派发)。
- HTTP 路由在 `chayuan/server/api_server/runtime_routes.py`:`/runtime/llama/{capability}/start|stop|restart|status`。

---

## 2. 一次性准备

### 2.1 仓库 + Python 环境

```bash
cd /work/chayuan-desktop
# 假定有现成 venv;否则 conda/mamba/uv 任意一个能跑 Python 3.10+ 即可
python3 -m pip install -e chayuan-server/libs/chayuan-server
```

如果你只想跑 unit test,不打算真启 sidecar:

```bash
PYTHONPATH="chayuan-server/libs/chayuan-server" pytest -q chayuan-server/libs/chayuan-server/tests/unit_tests/ -k "local_runtime or process_args"
```

### 2.2 CHAYUAN_ROOT(数据目录)

dev 环境推荐固定一份 chayuan_root,跟装机版的「数据目录」概念一致:

```bash
export CHAYUAN_ROOT="/chayuan_data"     # 或自选路径,首次跑 `chayuan init` 会生成基础 yaml
mkdir -p "$CHAYUAN_ROOT/models/bundled"  # 5 个 capability 真正读模型的位置
```

> `models/bundled/` 是 `bundled_seed.py` 在首次启动时从 `vendor/bundled_models/` 拷过来的副本。dev 时直接放也行,见 §4。

---

## 3. 装 vendor 二进制(llama-server / whisper-server)

**注意**:常用平台预编译 binary **已经 commit 进 git** 了,clone 即用 — 不必跑脚本。
布局(`local_runtime.py:find_server_exe()` 按 OS 自动挑;命名 = `<os>-<arch>[-cpu-variant]`):

```
chayuan-server/vendor/services/llama-server/
├── linux-x64/        ← Ubuntu 22.04+ glibc 2.34, x86_64       (b4404, 5 MB)
├── linux-arm64/      ← (占位,upstream 没发)
├── macos-arm64/      ← Apple Silicon + Metal shader            (b4404, 6 MB)
├── macos-x64/        ← Intel Mac                               (b4404, 5 MB)
├── win-x64/          ← Win x64 默认(AVX2,Haswell 2013+)      (b4404, 5 MB)
├── win-x64-avx/      ← Win x64 AVX(Sandy/Ivy Bridge 2011-13)  (b4404, 5 MB)
├── win-x64-avx512/   ← Win x64 AVX-512(Skylake-X / Xeon)     (b4404, 5 MB)
├── win-x64-noavx/    ← Win x64 无 AVX(Pentium/Celeron / VM)  (b4404, 5 MB)
└── win-arm64/        ← Windows on ARM(Surface Pro X)         (b4404, 5 MB)

chayuan-server/vendor/services/whisper-server/
├── win-x64/          ← Win64 whisper-server                    (v1.7.6, 2 MB)
├── linux-x64/        ← (占位,upstream 没发,brew/cmake build 自己装)
├── linux-arm64/      ← (占位)
├── macos-arm64/      ← (占位)
└── macos-x64/        ← (占位)
```

**默认 candidate(按 OS / 架构推断)**:

| 主机平台              | candidate 列表(高优先级在前)         |
|-----------------------|--------------------------------------|
| Win x86_64            | `[win-x64, win-x64-noavx]`            |
| Win ARM64             | `[win-arm64]`                         |
| macOS Apple Silicon   | `[macos-arm64]`                       |
| macOS Intel           | `[macos-x64]`                         |
| Linux x86_64          | `[linux-x64]`                         |
| Linux aarch64         | `[linux-arm64]`                       |

**强制覆盖**:`CHAYUAN_VENDOR_PLATFORM=<subdir>` env 变量。例:

```bash
# Win 强制 AVX512 build
set CHAYUAN_VENDOR_PLATFORM=win-x64-avx512

# Win 强制无 AVX(VM 里 / 老 CPU)
set CHAYUAN_VENDOR_PLATFORM=win-x64-noavx

# 临时禁用平台子目录,只看扁平 install 脚本落点
set CHAYUAN_VENDOR_PLATFORM=__none__   # 任意不存在的值都行
```

需要别的版本时(或 git 里的二进制版本太老)再跑下面脚本:

### 3.1 llama-server(chat / embedding / rerank 共用)

```bash
./scripts/install-llama-server.sh           # Linux / Mac
# 或 .\scripts\install-llama-server.ps1     # Windows PowerShell
```

成品落在 `chayuan-server/vendor/services/llama-server/llama-server[.exe]`。脚本自带版本 fallback,默认 `b4404`。

> **GLIBC 注意**:upstream `llama-bXXXX-bin-ubuntu-x64.zip` 是在 Ubuntu 22.04 上编的,
> 要求 `GLIBC >= 2.34` / `GLIBCXX >= 3.4.32`。RHEL 8 / Alibaba Cloud Linux 3 /
> Anolis(GLIBC 2.28~2.32)跑会报 `version not found`。这类 dev 机要么:
> - 切到 Ubuntu 22.04+ / WSL2 / macOS / Windows 跑;
> - 或源码 `cmake -B build && cmake --build build --target llama-server` 自己编一份。

### 3.2 whisper-server(asr)

```bash
./scripts/install-whisper-server.sh         # Linux / Mac → brew 或源码 cmake build
# 或 .\scripts\install-whisper-server.ps1   # Windows PowerShell → pre-built zip
```

成品落在 `chayuan-server/vendor/services/whisper-server/whisper-server[.exe]`(+ 依赖 dll/so/dylib)。

> **Upstream 现状**:whisper.cpp 官方只发 Windows pre-built(`whisper-bin-x64.zip`,
> 从 v1.7.6 起),Linux / Mac **没发** binary asset。Windows 默认 v1.7.6+;
> Mac/Linux 脚本自动:
> - macOS:有 brew → `brew install whisper-cpp`;
> - 否则:`git clone --branch <tag> whisper.cpp` + `cmake -DWHISPER_BUILD_SERVER=ON` 现场编。
>
> 因此 Linux dev 机必须装 `cmake / build-essential / git`(`apt install -y cmake build-essential git` 或 `dnf groupinstall -y "Development Tools" && dnf install -y cmake`)。

### 3.3 image-embedding 不需要独立二进制

走当前 venv 的 Python:`python -m chayuan.server.image_source.infinity_server --model <model-id> --port <p> ...`。模块入口和 sidecar HTTP 由 `infinity_server.py` 实现,只要 venv 装了 `transformers` / `torch` / `pillow` / `fastapi` 就行(`pip install -e chayuan-server/libs/chayuan-server` 已经把它们当依赖拉了)。

### 3.4 验证二进制落到了对的地方

```bash
ls chayuan-server/vendor/services/llama-server/llama-server*
ls chayuan-server/vendor/services/whisper-server/whisper-server*
```

> 注意路径必须是 `chayuan-server/vendor/services/<engine>-server/`,**不是** repo 根的 `vendor/services/`。dev 路径搜索逻辑在 `local_runtime.py:_default_install_services_dirs()` 里写死 `parents[5]` = `chayuan-server`,旧版 install-whisper-server 装错位置的 bug 已在本 commit 修复。

---

## 4. 装 bundled 模型

```bash
# 全下(~4 GB,Q3 chat + gte embedding/rerank + ggml-tiny + clip-vit-base-patch32)
python3 scripts/install-bundled-models.py

# 只下某一个 capability
python3 scripts/install-bundled-models.py --only chat
python3 scripts/install-bundled-models.py --only embedding
python3 scripts/install-bundled-models.py --only rerank
python3 scripts/install-bundled-models.py --only asr
python3 scripts/install-bundled-models.py --only image-embedding   # 别名 = "image"

# hf-mirror.com Xet 不通时切 ModelScope:
python3 scripts/install-bundled-models.py --source modelscope --only chat

# 重下覆盖:
python3 scripts/install-bundled-models.py --clean --only chat
```

下载结果落在 `chayuan-server/vendor/bundled_models/<cap>/<dest_subdir>/`。**首次 dev 跑 server 时 `bundled_seed.py` 会自动从这里拷到 `$CHAYUAN_ROOT/models/bundled/`**;之后改 yaml / 换模型可以直接编辑后者,不必再走 vendor。

> 命名小坑:`--only` 接受 `image` 和 `image-embedding` 两种写法,内部归一到 MANIFEST 的 `image`。

---

## 5. 启 chayuan-server(dev mode)

dev 模式直接跑 CLI:

```bash
source /chayuan_data/activate.sh   # 或 export CHAYUAN_ROOT=...
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH="libs/chayuan-server" python3 -m chayuan start
```

默认 sidecar 监听 `127.0.0.1:62581`(主 API)。`/runtime/llama/<cap>/...` 路由按 capability 控制 5 个子 sidecar。

> 集成版桌面客户端的 Tauri 是用 plugin-shell 的 `sidecar("chayuan-server")` 拉编好的 PyInstaller 单文件;dev 完全不走那条路,直接跑源码即可。

---

## 6. 启停单个 capability(HTTP 手动调试)

server 起来之后,curl 验:

```bash
BASE="http://127.0.0.1:62581"

# 看 5 个 capability 当前 status(空 / starting / ready / error)
curl -s "$BASE/runtime/llama/registry" | python3 -m json.tool

# 启 chat
curl -s -X POST "$BASE/runtime/llama/chat/start" | python3 -m json.tool

# 等几秒看 status
curl -s "$BASE/runtime/llama/chat/status" | python3 -m json.tool

# 停 chat
curl -s -X POST "$BASE/runtime/llama/chat/stop" | python3 -m json.tool

# 同理:embedding / rerank / asr / image-embedding
curl -s -X POST "$BASE/runtime/llama/asr/start"
curl -s -X POST "$BASE/runtime/llama/image-embedding/start"
```

启动失败时 `status.last_error` 字段会带 stderr 尾巴,直接看。

---

## 7. 直接打 sidecar 端口(跳过 chayuan-server,纯压子进程)

5 个 sidecar 各自有自己的 HTTP API,启起来后可以独立 curl:

| capability        | 端点示例                                          |
|-------------------|---------------------------------------------------|
| chat              | `POST 127.0.0.1:62582/v1/chat/completions`        |
| embedding         | `POST 127.0.0.1:62583/v1/embeddings`              |
| rerank            | `POST 127.0.0.1:62584/v1/reranking`               |
| asr               | `POST 127.0.0.1:62585/inference` (multipart)      |
| image-embedding   | `POST 127.0.0.1:62586/embeddings`                 |

(端口被占时实际端口在 `/runtime/llama/<cap>/status` 的 `endpoint` 字段)

例:

```bash
# embedding
curl -s http://127.0.0.1:62583/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"gte-multilingual-base","input":["你好世界"]}' | python3 -m json.tool

# image-embedding(text 输入)
curl -s http://127.0.0.1:62586/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"input":["a photo of a cat"]}' | python3 -m json.tool
```

---

## 8. 一键诊断

```bash
./scripts/diagnose.sh    # 落日志到 /tmp/chayuan-diagnose-<ts>.md
```

会列 14 项检查:vendor 二进制存在性 / bundled_models 完整性 / 端口可用性 / 4 个 llama capability runtime status / asr runtime status / image-embedding runtime status / chayuan_root 可写 / 磁盘剩余。失败项的 `detail` 直接告诉你下一步该跑哪条命令。

退出码:

- `0` = 全 OK / 仅 warn
- `1` = 至少一项 fail
- `2` = sidecar 不可达(server 没起 / 端口错)

---

## 9. 单元 / 集成测试速跑

```bash
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH="libs/chayuan-server" pytest -q libs/chayuan-server/tests/unit_tests/ -k "local_runtime or process_args or image_embedding or whisper"
```

新加测试时:

- `process_args` 类放 `tests/unit_tests/test_process_args_*.py`
- runtime 编排放 `tests/unit_tests/test_local_runtime_*.py`
- sidecar 路由放 `tests/unit_tests/test_runtime_routes_*.py`

---

## 10. 常见 dev 坑速查

| 现象 | 原因 | 解法 |
|---|---|---|
| `vendor.llama-server.binary fail` | 没跑 install-llama-server | 跑 `scripts/install-llama-server.{sh,ps1}` |
| `vendor.whisper-server.binary fail` | 没跑 install-whisper-server | 跑 `scripts/install-whisper-server.{sh,ps1}`,验路径在 `chayuan-server/vendor/services/whisper-server/` 而不是 repo 根 |
| `vendor.bundled_models.<cap> fail` | 没跑 install-bundled-models | 跑对应 `--only` |
| 启 image-embedding 卡 `starting` 60s 超时 | 首次 transformers 编译 / torch IO 慢 | 重试;或先 `python -c "from transformers import CLIPModel; CLIPModel.from_pretrained('openai/clip-vit-base-patch32')"` 预热 cache |
| `port.62582 warn` | 端口被其它进程占 | PortAllocator 自动 bump 到 62583+;不影响功能 |
| `last_error: AVX2 缺失` | llama-server 二进制需要 AVX2 而本机没有 | 用 cpu-no-avx 版二进制(`install-llama-server -Version b<N>` 选别的 build)|
| `llama-server: GLIBC_2.34 not found` | 系统 glibc 比 upstream ubuntu zip 旧 | 见 §3.1 — 切 Ubuntu 22.04+ / WSL2 / macOS / Win,或源码 cmake build |
| `install-whisper-server` 下载 404 | upstream v1.7.4/3/2 没发 binary asset | 用本仓最新脚本(默认 v1.7.6,或 sh 自动走 brew/cmake) |
| ASR 直接 fallback Python faster-whisper | whisper-server 二进制缺 / 模型路径错 / sidecar cold start > 30s | 检查 `vendor/services/whisper-server/`;Plan 3C audio.py 已自动 fallback,但本地 dev 跑加速版优先修上述 |
| image-embedding facade fallback in-process | sidecar status != ready | curl `/runtime/llama/image-embedding/status` 看 `last_error`,大概率模型权重路径错 |
| `from __future__ import annotations` + FastAPI Body 解析失败(422) | sidecar 把 `Request` 当 query param | 修法见 `infinity_server.py`:HTTPException/Request 必须放模块顶层,不能闭包 import |

---

## 11. 改完代码该跑啥

PR 提交前最小验证:

```bash
# 1. 类型 / lint
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH="libs/chayuan-server" python3 -m py_compile $(git diff --name-only HEAD libs/chayuan-server | grep '\.py$')

# 2. 单元测试
PYTHONPATH="libs/chayuan-server" pytest -q libs/chayuan-server/tests/unit_tests/ -k "<改动相关>"

# 3. 真起一次 server,打 /runtime/llama/registry 看 5 个 cap idle
python3 -m chayuan start &
sleep 5
curl -s http://127.0.0.1:62581/runtime/llama/registry | python3 -m json.tool
kill %1
```

提交规则参考 `/work/CLAUDE.md`(固定 branch = `main`,不要 force push,不要带 `.env` / 模型权重 / 临时日志)。

---

## 12. 打集成包(选 vendor 二进制 + 验证可运行)

`chayuan-server/packaging/pyinstaller/build.py` 在打集成版时:

- **按 target triple 选 platform 子目录**:`x86_64-pc-windows-msvc → win-x64`,
  `aarch64-apple-darwin → macos-arm64` 等(详见 README 矩阵)。
- **缺子目录就跳过**:不会因为 whisper Linux 没 upstream binary 而 fail —— 那个
  capability 在装机后就没本地加速,fallback 到 Python 实现。
- **复制内容到扁平 layout**:`vendor/services/llama-server/win-x64/*` → `src-tauri/services/llama-server/*`(无 `win-x64/` 一层),end-user 装机后由 `find_server_exe` 扁平 fallback 命中。
- **验证 binary**:
  1. 文件存在 + 大小 > 100 KB(防 LFS 占位 / 半下载)
  2. magic bytes(MZ for PE / `\x7fELF` for Linux / `\xcf\xfa\xed\xfe` for Mach-O)
  3. host == target 时跑 `binary --help`:5s 超时 / OSError / 非常规退出码 → fail;
     GLIBC 等 runtime-linker 错误 → 软警告不阻断 build(给目标机器跑,跟本机无关)

用法:

```bash
cd chayuan-server
# 默认:用当前 host 的 target triple,跑完顺带 verify
poetry run python packaging/pyinstaller/build.py --release lite

# 显式 cross-build target(CI 矩阵跨平台打包)
poetry run python packaging/pyinstaller/build.py \
    --release lite --target aarch64-apple-darwin

# Win 上想打 noavx 变体的安装包(给老 CPU / VM 用户)
set CHAYUAN_VENDOR_PLATFORM=win-x64-noavx
poetry run python packaging/pyinstaller/build.py --release lite

# 跳过 verify(只 sync 不检查,iter dev 用)
poetry run python packaging/pyinstaller/build.py --sync-services-only --skip-verify
```

`build-desktop.{sh,ps1}` 不需要改 —— 它已经透传 `--release`,verify 自动跑。CI 矩阵的
`rust-target` 通过 `--target` 透传(后续 CI workflow 改一行即可)。
