# Tauri外壳加Python sidecar的进程模型 启动顺序与心跳

chayuan-desktop 桌面单机版从外面看是一个普通桌面应用，但跑起来背后是两个进程在协作。这一篇拆开讲 Tauri 主进程和嵌入式 Python sidecar 之间的进程模型，包括启动顺序、心跳监控、退出处理。

先理清楚这两个进程的角色。Tauri 主进程是用户双击图标启动的那个 process，它负责：渲染原生窗口、加载 webview、处理系统级事件（托盘、快捷键、通知）、管理 sidecar 子进程的生命周期。Python sidecar 是 PyInstaller 打的 chayuan-server.exe（或者无后缀的可执行），由 Tauri 主进程在启动时 spawn 出来，监听 127.0.0.1:62581。

启动顺序。用户双击图标，OS 启动 Tauri 主进程；Tauri 读自己的配置文件，确认 CHAYUAN_ROOT 路径；Tauri 通过 std::process::Command 把 chayuan-server 二进制 spawn 出来，注入环境变量 CHAYUAN_ROOT 和 CHAYUAN_ROOT_IGNORE_STATE 等；Tauri 启动一个轮询循环，每隔 500ms GET 一次 http://127.0.0.1:62581/health；sidecar 完成初始化（加载模型权重、连数据库、跑 schema 迁移）后 /health 返回 200；Tauri 主进程进 webview 初始化阶段，加载 React 主界面；React 应用通过 fetch /api/v1/* 跟 sidecar 通信。

整个启动过程在 SSD 上一般 2-3 秒，机械盘上慢一些。仓库最近的提交里加了 sidecar-gate 简化逻辑，把 ready 信号显式确认之后才进主界面，避免 webview 比 sidecar 早起来导致的连接拒绝。

心跳监控。Tauri 主进程在 sidecar 起来之后维护一个心跳。每 5 秒 GET 一次 /health，连续三次失败认为 sidecar 异常。处理策略有两条：一条是自动重启 sidecar，另一条是弹窗让用户确认。chayuan-desktop 当前默认走自动重启，重启失败再弹窗。

子进程的 stdin stdout 处理。sidecar 的标准输出会被 Tauri 主进程接管并写到 CHAYUAN_ROOT/logs/server.log。这种方式比让 sidecar 自己管日志更简单，也不会丢早期启动失败的信息。stdin 一般不用，但保留通道方便后期发送控制信号。

环境变量注入。Tauri 启动 sidecar 时注入的关键变量包括：CHAYUAN_ROOT 数据目录；CHAYUAN_ROOT_IGNORE_STATE 让 Tauri 注入的目录真生效；CHAYUAN_DESKTOP_MODE 标记单机模式，让 sidecar 自动跳过多用户鉴权；CHAYUAN_HOST 默认 127.0.0.1；CHAYUAN_PORT 默认 62581。这一组变量决定了 sidecar 的行为模式。

退出处理。用户关闭主窗口时，Tauri 主进程会先发一个 POST /api/v1/system/shutdown 给 sidecar，让它优雅退出（保存对话、关闭数据库连接、写日志）。等 sidecar 退出之后 Tauri 主进程再退出。如果 sidecar 在 10 秒内没退出，Tauri 强制 kill 子进程，再退出自己。这个流程保证了对话历史不会因为强制关机而丢失。

异常崩溃处理。sidecar 如果意外崩溃（比如某个模型权重文件被破坏），Tauri 心跳会发现，触发自动重启。重启失败超过 3 次后，Tauri 会弹一个错误对话框告诉用户，并提供 打开日志目录 按钮，方便排查。这种容错对单机版很重要，因为没有运维团队在后面救场。

跨平台差异。Windows 上 spawn 子进程用的是 CreateProcess API，会有一个新的窗口实例。chayuan-desktop 通过设置 CREATE_NO_WINDOW 标志避免在任务栏出现额外的命令行窗口。macOS 和 Linux 上没有这个问题。

国产化支持下的细节。麒麟 UOS 上 spawn 子进程时偶尔会触发 SELinux 策略，需要预先配置允许 Tauri 主进程的执行策略。loongarch64 平台上 PyInstaller 打的二进制启动比 x86_64 慢，建议把心跳超时从默认的 30 秒延长到 60 秒。

debug 模式。开发态下可以让 sidecar 单独跑，Tauri 主进程通过环境变量 CHAYUAN_EXTERNAL_SIDECAR=1 跳过 spawn，直接连一个独立运行的 sidecar。这种方式适合后端开发调试，前端开发者改代码不需要重启 sidecar。

WPS AI 插件 chayuan-wps 不影响这套进程模型。它只是 sidecar 的另一个 HTTP 客户端，跟 Tauri webview 平起平坐。chayuan-desktop 关闭时 WPS 加载项会失去后端，但加载项有专门的离线降级提示，不会让 WPS 崩溃。

整套进程模型不复杂，但每个细节都对应着实际场景里踩过的坑。免费开源的AI软件 想做出生产级稳定，进程模型这一层要打磨清楚。
