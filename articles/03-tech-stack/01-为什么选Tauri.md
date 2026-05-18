# 免费开源的AI软件为什么选Tauri 2而不是Electron 体积与体验的对账

桌面应用做跨平台壳，Electron 是事实上的主流。Cherry Studio、Chatbox、ChatGPT Desktop、AnythingLLM 都用 Electron。chayuan-desktop 桌面单机版选了 Tauri 2，没跟主流。这一篇讲清楚这个选型的理由，给同样在选型的团队一份参考。

先看 Electron 的常见问题。一是体积。Electron 自带一份 Chromium，安装包基础体积一百多兆。加上业务代码和依赖，普通 Electron 应用 200-400 兆是常态。Cursor 这种重型 Electron 应用安装包接近 1G。chayuan-desktop 想让 免费开源的AI软件 覆盖普通办公电脑，包大用户接受度低。

二是内存占用。Electron 的 Chromium 内存占用常态 300-500MB，一些应用甚至上 G。在 8G 内存的办公电脑上同时跑 chayuan-desktop 加 WPS 加浏览器，Electron 的内存消耗压力大。Tauri 用系统自带的 webview（Windows 的 WebView2、macOS 的 WebKit、Linux 的 WebKitGTK），常态内存 50-100MB，差三到五倍。

三是启动速度。Electron 启动需要拉起 Chromium，冷启动 1-3 秒。Tauri 启动用系统 webview，冷启动半秒到 1 秒。这个差距在用户体感上很明显，特别是 sidecar 还没起来的等待期。

Tauri 2 的优势。除了上面的三点，Tauri 2 还有几个额外好处。

Rust 主进程。Tauri 主进程是 Rust 写的，比 Electron 的 Node.js 主进程快，且没有 GC 暂停。系统集成（文件、系统托盘、全局快捷键）调用更稳定。

更好的安全模型。Tauri 默认对 webview 的 API 访问做白名单，前端能调什么 native 接口在 tauri.conf.json 里显式声明。Electron 的 preload 脚本机制更松。chayuan-desktop 在安全敏感场景下需要这种可审计的 API 边界。

更小的攻击面。Tauri 不带 Chromium，没有 Chromium 的零日漏洞攻击向量。chayuan-desktop 作为可能装在政企电脑上的应用，攻击面小是加分项。

但 Tauri 2 也有代价。

第一个代价是 webview 一致性。Tauri 用系统 webview，意味着 macOS 上是 WebKit，Linux 上是 WebKitGTK，Windows 上是 WebView2。三个 webview 的 CSS、JS API 实现略有差异，CSS 兼容性偶尔出问题。Electron 全平台 Chromium 一致，开发体验更稳。chayuan-desktop 在 CSS 上做了适配性处理，避开了几个跨 webview 的坑。

第二个代价是 Rust 学习曲线。Tauri 主进程的逻辑写 Rust。如果团队没有 Rust 经验，前期开发慢。但 chayuan-desktop 的主进程做的事情很有限（窗口管理、spawn sidecar、系统集成），Rust 代码量很少，大部分逻辑在 Python 后端，团队入手成本可控。

第三个代价是 Linux 桌面环境差异。Tauri 在 Linux 上依赖 WebKitGTK，不同发行版的版本差异比较大。麒麟 V10 SP1 上 WebKitGTK 4.0 不够新，需要装 4.1。Electron 因为自带 Chromium 不受这个影响。chayuan-desktop 通过 deb 包依赖声明覆盖了主流发行版，但仍有少数 OS 需要单独适配。

第四个代价是生态成熟度。Electron 周边生态（自动更新、原生模块、调试工具）非常成熟。Tauri 2 的生态在跟，但仍有不足。chayuan-desktop 当前的自动更新能力还在路线图里，部分原因是 Tauri 2 的 updater plugin 需要再观察一段时间。

最终选 Tauri 2 的决定理由。chayuan-desktop 是 装到办公电脑上的免费开源软件，体积、内存、启动速度的优势比开发便利性更重要。免费开源的AI软件 走 Tauri 是用户视角的选择。

跟用户不直接相关但工程上重要的几件事。Tauri 2 的插件生态（global-shortcut、tray-icon、notification、clipboard-manager 等）足够覆盖 chayuan-desktop 的系统集成需求。Tauri 2 对 sidecar 子进程的管理（spawn、监控、kill）原生支持，配合 Python 嵌入式后端非常顺。Tauri 的 v1 到 v2 升级当时痛过一阵，但 v2 之后的 API 稳定下来。

WPS AI 插件 chayuan-wps 不受 Tauri 选择影响，它是 WPS 的加载项，用 Vue 3 + Vite。两个产品的前端框架不同，但后端共用同一份 chayuan-server，体验通过 sidecar 抹平。

Tauri 与 Electron 的对账，核心问题不是哪个技术更先进，而是哪个更符合产品定位。chayuan-desktop 选 Tauri 的过程其实是反复确认 单机优先 加 体积敏感 这两个产品定位的过程。
