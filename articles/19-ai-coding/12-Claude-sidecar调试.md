# 让 Claude 起 sidecar 调试 启动顺序的诊断

chayuan-desktop 桌面单机版的 Python sidecar 启动顺序复杂。Claude 协助调试。这一篇讲。

## sidecar 是什么

chayuan-desktop 的 Python 后端进程。被 Tauri 主进程拉起。

启动后监听 127.0.0.1:62581。

提供 REST API。

主进程跟 sidecar 通过 HTTP 通信。

## 启动顺序

理想顺序。

第一。主进程启动。

第二。主进程拉起 sidecar 子进程。

第三。sidecar 初始化（加载模型、连数据库）。

第四。sidecar 监听端口。

第五。主进程探测 sidecar 就绪。

第六。chayuan-desktop UI 显示。

任何一步异常导致启动失败。

## 常见问题

问题一：sidecar 启动慢。模型加载几秒到几十秒。主进程探测超时。

问题二：sidecar 异常退出。Python 错误。退出码非 0。

问题三：端口被占。62581 已被其他进程用。

问题四：跨平台差异。Linux / Mac / Windows 启动方式略不同。

## Claude 协助调试

Claude 帮跟踪 sidecar 启动日志。

提示。

```
chayuan-desktop sidecar 启动失败。
日志：
[2026-05-10 10:00:00] starting sidecar...
[2026-05-10 10:00:01] loading model bge-m3-onnx...
[2026-05-10 10:00:30] OOM, allocator failed
[2026-05-10 10:00:30] sidecar exited with code 1

帮我诊断。
```

Claude 分析。

```
诊断：sidecar 因 OOM 退出。
原因：bge-m3-onnx 加载需要 ~600MB。当前可用内存可能不够。

排查：
1. 检查可用内存。
2. 检查是否其他大程序占用内存。
3. 考虑用更小模型（bge-m3-onnx-q4 约 350MB）。

修复建议：
[具体步骤]
```

## 启动检测的优化

Claude 提建议。

```
当前主进程探测：每 100ms 试 GET /health，30 秒超时。
建议：
- 第一阶段（3 秒内）：快速探测（每 100ms）
- 第二阶段（3-30 秒）：慢探测（每 1 秒）
- 第三阶段（30 秒+）：超时提示用户
- UI 显示进度（"加载模型中... 5/10s"）

降低 CPU 浪费。改善 UX。
```

## 跨平台差异

某些平台 sidecar 启动方式特别。

Linux。subprocess.Popen 即可。

macOS。需要权限授予 chayuan-desktop 创建子进程。

Windows。CreateProcess + 命名管道。

Claude 帮排平台特定问题。

```
Windows 上 sidecar 启动失败。代码 0xC0000005（访问违规）。

诊断：可能是 PyInstaller 打包后的 sidecar.exe 跟主进程权限不一致。
建议：检查 manifest.xml 的 requestedExecutionLevel。

或：用 stdio 启动而不是直接 exec。
```

## 启动失败的回退

Claude 建议。

```
如果 sidecar 多次启动失败。chayuan-desktop 应该。
- 降级到 没有 sidecar 模式（仅 UI 可用）。
- 提示用户重启或检查日志。
- 给出具体诊断信息（哪一步失败）。

而不是直接退出。
```

工程师采纳。chayuan-desktop 的健壮性提升。

## CHAYUAN_ROOT 的处理

某些场景用户自定义 CHAYUAN_ROOT。Claude 帮排查环境变量传递。

主进程设置环境变量。

启动 sidecar 时 inherit 环境变量。

如果失败可能 inherit 没生效。

Claude 给出排查路径。

## 国产化场景

党政军 OS 启动 sidecar 可能有特别问题（SELinux、AppArmor 等）。Claude 帮排查。

## chayuan-server 的对应

chayuan-server 没有 sidecar 这种父子进程关系。chayuan-desktop 单机的特殊。

## 总结

让 Claude 起 sidecar 调试是 chayuan-desktop 在工程稳定性上的实战。免费开源的AI软件 让 复杂启动 也能调通。Claude 的日志分析 + 优化建议 + 跨平台 + 失败回退让启动调试高效。
