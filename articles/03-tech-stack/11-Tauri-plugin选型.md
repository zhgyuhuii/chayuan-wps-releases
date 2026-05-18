# 免费开源的AI软件的Tauri 2 plugin 选哪些不选哪些

Tauri 2 的 plugin 生态比 v1 时代成熟很多。chayuan-desktop 桌面单机版用了若干官方 plugin，也舍弃了一些。这一篇讲清楚每个 plugin 选不选、为什么。

用了的 plugin。tauri-plugin-shell 用来启动 sidecar 子进程，是 chayuan-desktop 的核心依赖。tauri-plugin-store 用来管 Tauri 主进程自己的配置（dataDir、窗口位置等）。tauri-plugin-dialog 用来弹文件选择对话框（用户选 CHAYUAN_ROOT、上传文件）。tauri-plugin-fs 用来读写文件系统（少量必要场景，大部分文件操作通过 sidecar）。tauri-plugin-notification 用来发系统级通知（升级提示、长任务完成）。tauri-plugin-clipboard-manager 用来读写剪贴板。tauri-plugin-global-shortcut 用来注册全局快捷键。tauri-plugin-tray-icon 用来管系统托盘图标。

没用的 plugin。tauri-plugin-http 没用，因为对 sidecar 的 HTTP 调用走 webview 自己的 fetch。tauri-plugin-process 部分功能没用，因为 sidecar 管理走 plugin-shell 已足够。tauri-plugin-stronghold 用了但不直接暴露给前端，密钥存储在 sidecar 内部用 Stronghold。tauri-plugin-updater 没用，因为当前自动更新还在路线图上，发布走手动下载。

每个 plugin 的具体用法。

plugin-shell：在 tauri.conf.json 里声明允许执行的命令。chayuan-desktop 只允许执行内嵌的 chayuan-server 二进制，不允许执行任意命令。安全模型严格。

plugin-store：维护 dataDir、windowPosition、locale 三个核心字段。每次改动 store 主动写盘。

plugin-dialog：仅在 FirstRunSetup 选 CHAYUAN_ROOT 时和用户上传文件时使用。

plugin-fs：限制只能访问 CHAYUAN_ROOT 下的文件，不允许访问任意路径。这是 Tauri 安全模型的标准用法。

plugin-notification：升级提示、模型对抗结果出来、长 RAG 入库完成时弹原生通知。频率克制不打扰。

plugin-clipboard-manager：用户在对话里点击 复制 按钮，写入剪贴板。也支持从剪贴板粘贴文本到对话框。

plugin-global-shortcut：默认注册 Ctrl+Shift+C 调起 chayuan-desktop 主窗口（macOS 上是 Cmd+Shift+C）。用户可在设置里关闭或改键位。

plugin-tray-icon：系统托盘图标，右键菜单包括 显示主窗口、新建对话、设置、退出。Windows 任务栏右下、macOS 右上、Linux 顶栏（如桌面环境支持）。

plugin 的安全模型。Tauri 2 把 plugin 的能力按 capability 声明，前端通过 capability 申请才能调。chayuan-desktop 在 src-tauri/capabilities 目录下集中声明所有允许的 capability。前端 fetch 的对象只能是 sidecar 端口，不能任意 URL。这种白名单机制让 chayuan-desktop 可以通过严格的安全审计。

不用 plugin 自己实现的几件事。窗口管理用 Tauri Window API 直接调；webview 配置在 tauri.conf.json 里；HTTP 请求走 webview 原生 fetch 而不是 plugin-http。

plugin 的版本兼容。Tauri 2 的官方 plugin 跟 Tauri 主版本同步发布。chayuan-desktop 升级 Tauri 大版本时把所有 plugin 一起升。第三方 plugin 慎用，因为升级节奏不一定跟得上。

国产化支持下的 plugin 注意。麒麟桌面上 plugin-tray-icon 在某些桌面环境（XFCE、LXQt 较老版本）显示有问题。chayuan-desktop 在这种环境下检测到不支持就降级（不显示托盘图标），不影响主功能。loongarch64 上 plugin 的二进制部分需要专门构建。

未来可能加的 plugin。tauri-plugin-updater（自动更新）、tauri-plugin-sql（虽然 chayuan-desktop 后端有 SQLite，前端 Tauri 端如果需要本地小存储可以用）、tauri-plugin-window-state（记住每个窗口的位置和大小）。这些都在路线图上。

WPS AI 插件 chayuan-wps 跟 Tauri 完全无关，它是 WPS 加载项。两个产品的桌面集成方式完全不同，但都不依赖第三方 framework。

Tauri plugin 的选型对桌面应用的功能丰富度有直接影响。免费开源的AI软件 选 plugin 时要考虑稳定性、安全模型、跨平台一致性、维护节奏。chayuan-desktop 当前的 plugin 集合是几次取舍后的结果。
