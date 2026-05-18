# 选Tauri 1还是Tauri 2 v3.0升级的痛与得

chayuan-desktop 桌面单机版从 v2.x 时代基于 Tauri 1，v3.0 升级到了 Tauri 2。这次升级耗时大概一两个月。这一篇讲清楚 Tauri 2 比 Tauri 1 强在哪、升级的痛点、最终的收益。

先看 Tauri 2 的几个核心改进。多窗口支持原生化（Tauri 1 的多窗口能力较弱）。Mobile 端支持（iOS、Android）虽然 chayuan-desktop 当前不用，但保留可能性。Plugin 系统重构（plugin 现在是 Tauri 主进程的标准模块化机制）。Capability 安全模型（细粒度的 API 访问控制）。WebView2 / WebKit 的版本要求更新。

升级的几个主要痛点。

痛点一：API breaking changes。Tauri 1 的 invoke 调用签名跟 Tauri 2 不一样。命令注册方式从 Builder 改成 generate_handler 宏。chayuan-desktop 的所有 invoke 调用都要改一遍。

痛点二：plugin 兼容。Tauri 1 时代的 plugin（比如 tauri-plugin-store v1）跟 Tauri 2 不兼容，得换成 v2 版本。某些第三方 plugin 升级慢，要等。chayuan-desktop 评估了用到的所有 plugin 的 v2 状态，等齐了才升。

痛点三：capability 配置。Tauri 1 的 allowlist 改成了 Tauri 2 的 capability。chayuan-desktop 要把所有 API 调用按 capability 重新声明。这一步工作量大但收益是安全模型更清晰。

痛点四：构建链调整。tauri-cli v2 的命令跟 v1 略有不同。chayuan-desktop 的 build-desktop 脚本要改。CI 配置也要改。

痛点五：webview 版本要求提高。Tauri 2 对 WebView2 版本要求 110+。某些老旧 Win10 用户没自动更新 webview，启动失败。chayuan-desktop 在安装包里检测 webview 版本，缺了引导用户安装。

升级的收益。

收益一：安全审计可解释。chayuan-desktop 的 capability 声明集中在 src-tauri/capabilities 目录，IT 审计时一目了然 这个应用能做什么。Tauri 1 的 allowlist 不那么直观。

收益二：多窗口稳定。chayuan-desktop 的 模型对抗 arena 用独立窗口，Tauri 2 的多窗口管理稳定多了。

收益三：plugin 版本管理。Tauri 2 的 plugin 都按 plugin-X-vY 形式独立 crates。chayuan-desktop 升级单个 plugin 不影响其他 plugin。

收益四：未来移动端的可能。chayuan-desktop 当前不做手机端，但 Tauri 2 的 mobile 能力让未来不被锁死。

升级时间线。chayuan-desktop 的 Tauri 2 升级在 v3.0 这个版本完成。前期评估两周，开发主流程一个月，测试和 bug 修复两到三周。整个 v3.0 周期就这一件事最费力。

测试覆盖。升级期间 chayuan-desktop 的 e2e 测试集帮了大忙。每改一段 invoke 调用都跑一轮 e2e 验证不破坏功能。这一段 e2e 投资在升级时收回来。

国产化支持下的 Tauri 2。麒麟 UOS 上 webkit2gtk 4.1 版本要求是 Tauri 2 引入的，麒麟 V10 SP1 自带 4.0，需要单独装 4.1。这是国产 OS 上的额外适配工作。loongarch64 上 Tauri 2 的 Rust 工具链需要专门构建，整套构建链花了几天打通。

如果新项目今天选。直接选 Tauri 2 不用犹豫。Tauri 1 不再有新功能，只有兼容性维护。Tauri 2 已经稳定到生产可用。

不升级的备选。如果不想做 Tauri 2 升级，可以继续维护 Tauri 1 版本。但是 Tauri 1 的安全更新会逐渐放缓，长期不安全。chayuan-desktop 选择主动升级避免长期债。

WPS AI 插件 chayuan-wps 不依赖 Tauri，升级跟它无关。WPS 加载项的技术栈是独立的。

Tauri 2 升级是 chayuan-desktop v3.0 的主要工程项目。免费开源的AI软件 主动跟随基础框架的版本节奏，付出的是短期工程成本，得到的是长期可维护性。这种取舍在每次大版本升级都要做一遍。
