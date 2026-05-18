# 本地 Runtime 诊断 — 装机手测 Runbook

适用于:Plan 1+2+3A 全部落盘之后,真机装机验证。

## 1. 准备

- 装机前确认 chayuan-server 已包好 (sidecar exe 存在)
- 装好 .msi (Win) / .dmg (Mac) / .deb / .AppImage (Linux)
- 安装目录里能看到 `services/llama-server/llama-server(.exe)`

## 2. 跑 CLI 脚本

### Windows

打开 PowerShell,cd 到 Chayuan 安装目录,运行:

```powershell
.\scripts\diagnose.ps1
```

预期输出末尾:

```
日志已写到: C:\Users\<you>\AppData\Local\Temp\chayuan-diagnose-<ts>.md
```

退出码 0 = 全 ok/warn,1 = 至少一项 fail,2 = sidecar 不可达。

### Mac / Linux

```bash
./scripts/diagnose.sh
```

预期日志落在 `/tmp/chayuan-diagnose-<ts>.md`。

## 3. UI 按钮

桌面应用 → 头像菜单 → 设置 → AI 平台 → 「本地模型」tab。

Plan 3D 后该页显示 5 个 capability 卡片(chat / 文本嵌入 / 重排 / 语音识别 / 图像嵌入),每个独立启停;
「生成诊断报告」按钮在 5 个卡片下方。

预期:Dialog 弹出,~1s 内显示报告 markdown;点「复制全部」复制到剪贴板。

## 4. 常见问题排查

| 现象 | 可能原因 | 诊断报告里的标记 |
|---|---|---|
| `vendor.platform.detected fail` | host OS / 架构没对应的 vendor 子目录,或 CHAYUAN_VENDOR_PLATFORM 指向不存在的目录 | detail 字段里报 `candidates=[...]`,`override=...`,`llama=None / 路径`;参考 `chayuan-server/vendor/services/llama-server/README.md` 选对的子目录 |
| sidecar 进程没找到 | chayuan-server 启动失败 / 装机不全 | CLI 退出码 2 + 日志写「sidecar 进程未发现」 |
| `vendor.llama-server.binary fail` | 集成版打包遗漏 vendor 二进制 | 重装;或开发机跑 `scripts/install-llama-server.{ps1,sh}` |
| `vendor.bundled_models.chat fail` | bundled_models 没打进 .msi | 重装;或手动放 .gguf 到 chayuan_root/models/bundled/chat/ |
| `port.62582 warn` | 端口被其它进程占 | `_allocate_port` 自动 bump 到 62583+,不影响功能 |
| `runtime.llama.chat.status fail` | chat runtime start 失败,看 last_error | 看报告里 detail 字段,根据 error 修 (常见:AVX2 缺失 / 模型路径错) |
| `runtime.llama.embedding.status fail` | embedding 模型未装 / 启动崩 | install-bundled-models 拉 GGUF embedding;看 detail 字段 last_error 修 |
| `runtime.llama.rerank.status fail` | rerank 模型未装 / 启动崩 | 同上;rerank 通常 < 200 MB,装完跑 `/runtime/llama/rerank/start` |
| 三个 capability 同时占内存 | preload_embedding=true + preload_rerank=true 一开机吃 3-5 GB | 设置页关闭对应 preload 开关;按需 lazy start |
| `runtime.llama.asr.status fail` | whisper-server 启动崩 / 模型未装 | install-bundled-models 拉 ggml-tiny.bin;binary 由 install-whisper-server.{ps1,sh} 装 |
| ASR 调时 sidecar 不可用 fallback Python | whisper-server.exe 缺 / 模型路径错 / 首次 cold start 超 30s | 检查 vendor/services/whisper-server/;Plan 3C audio.py 已自动 fallback faster-whisper,功能正常但失局部加速 |
| `whisper-server multipart 4MB 413` | 单次音频 > 4 MB | 切短音频段;后续 plan 可调 whisper-server `--max-multipart` |
| `runtime.llama.image-embedding.status fail` | infinity sidecar 启动崩 / 模型加载 OOM | 装机或运行环境 RAM 不足;减小模型(SigLIP2-base / CLIP-vit-base 等) |
| Image-embedding sidecar PyInstaller frozen 启动失败 | chayuan-server.exe 主入口未实现 `--sidecar-mode` 分支(本 plan 留给后续 plan) | facade 自动 fallback in-process,功能正常但失局部进程隔离 |
| sidecar 启动 60s 超时 | 模型权重加载慢(首次 PyTorch 编译 / 网盘 IO) | 重试启动;持续超时检查 `model.from_pretrained` 错误 |
| `chayuan_root.writable fail` | chayuan_root 路径写不进 (权限 / 路径错) | 检查 chayuan_root 路径,确认用户有写权限 |
| `disk.chayuan_root.free_gb fail` | 磁盘剩 < 500 MB | 清理磁盘 |

## 5. 报 bug 流程

发现问题时:

1. 跑 `diagnose.{ps1,sh}` 或 UI 按钮生成报告。
2. 复制 / 上传日志文件 (路径在脚本末尾打印 / Dialog 按钮)。
3. GitHub issue 模板里贴报告 + 描述复现步骤。

报告里 `chayuan_root` / `model_id` 这类信息可能被认作敏感,贴前自己判断。

## 6. 跨平台兼容矩阵 (Plan 3A 验收点)

| 维度 | Windows | macOS | Linux |
|---|---|---|---|
| 进程探测 | `Get-Process chayuan-server` | `pgrep -f chayuan-server` | 同 |
| HTTP 调用 | `Invoke-RestMethod` | `curl` | 同 |
| JSON 解析 | PowerShell 原生 | `python3 -c` | 同 |
| 日志路径 | `%TEMP%\chayuan-diagnose-<ts>.md` | `/tmp/chayuan-diagnose-<ts>.md` | 同 |
| UTF-8 编码 | `.ps1` 必须 BOM (防 GBK) | `.sh` 无 BOM | 同 |
| 端口探测 (后端) | psutil 跨平台 | 同 | 同 |
| 防火墙 / AV 影响 | 火绒 / Defender 可能拦 llama-server.exe spawn | n/a (Mac sandbox) | n/a (大多无 AV) |
