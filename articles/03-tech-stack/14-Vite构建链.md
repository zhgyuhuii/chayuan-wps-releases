# 单机版前端构建链选型 Vite还是Rspack

chayuan-desktop 桌面单机版的前端用 Vite 做构建链。这一篇讲清楚为什么是 Vite 不是 Rspack 或者 Webpack 或者 Turbopack。

先看几个候选。Webpack 是 Web 构建链的元老，功能全但慢。Vite 用 ESBuild 做开发态构建，Rollup 做生产打包，开发体验快。Rspack 是字节开源的 Webpack 兼容版，用 Rust 重写，比 Webpack 快。Turbopack 是 Vercel 的产品，Rust 实现，跟 Next.js 强绑定。

chayuan-desktop 选 Vite 的理由。

第一个理由是开发体验。Vite 的 dev server 启动几秒，HMR 毫秒级。Tauri 跟 Vite 集成原生支持，dev mode 下 Tauri 主进程加 Vite dev server 启动一气呵成。改前端代码立刻在 Tauri 窗口里看到。

第二个理由是 Rollup 的生产打包。Vite 生产构建用 Rollup，输出干净的 ES module。最终前端 JS bundle 体积可控，几百 KB 量级，符合桌面应用的体积控制。

第三个理由是生态成熟。Vite 周边的 React plugin、TypeScript plugin、CSS preprocessor 集成都成熟。chayuan-desktop 用的几个核心 plugin（@vitejs/plugin-react、vite-plugin-svg、vite-plugin-checker）都很稳定。

第四个理由是 Tauri 官方推荐。Tauri 文档把 Vite 列为推荐的前端工具。chayuan-desktop 跟 Tauri 官方推荐保持一致，避免选偏门工具带来的兼容性问题。

不选 Webpack 的原因。Webpack 配置复杂，开发态 HMR 比 Vite 慢明显。chayuan-desktop 在前期评估时直接跳过 Webpack。

不选 Rspack 的原因。Rspack 还比较新，跟 Tauri 集成不如 Vite 成熟。Rspack 的优势是兼容 Webpack 配置，但 chayuan-desktop 没有 Webpack 历史包袱，不需要兼容。Rust 实现速度优势在 Vite 已经够快的前提下没那么诱人。

不选 Turbopack 的原因。Turbopack 跟 Next.js 绑得太紧，独立使用还不太成熟。chayuan-desktop 不用 Next.js，所以不考虑 Turbopack。

Vite 的具体配置。chayuan-desktop 的 vite.config.ts 不复杂。声明几个 plugin（react、svgr、checker）、声明 alias（@ → src/）、声明 build target（chrome105 + safari15+ 覆盖 Tauri 的 webview）、声明环境变量（VITE_BACKEND_URL 等）。

Tauri 与 Vite 的集成。Tauri 的 tauri.conf.json 里 build.devPath 指向 Vite dev server URL（http://localhost:5173），build.distDir 指向 Vite 生产构建输出目录（dist/）。tauri dev 命令同时启动 Vite dev server 和 Tauri 主进程。tauri build 命令先跑 vite build 再编译 Tauri。

构建性能。chayuan-desktop 前端代码大约 5-8 万行 TypeScript+TSX。Vite 生产构建在 SSD 上 30-60 秒。dev mode HMR 单次更新几十毫秒。这个性能在桌面应用项目里属于优秀水平。

代码分割。Vite 默认按 dynamic import 做代码分割。chayuan-desktop 把几个不常用的页面（设置详情、模型对抗、Help 中心）用 dynamic import 加载，主 bundle 体积压缩。

环境变量。Vite 用 import.meta.env.VITE_* 注入环境变量。chayuan-desktop 在 dev 和生产模式下用不同的 backend URL（dev 连 8001 测试 sidecar，生产连 62581 嵌入 sidecar）。

资源处理。图标、SVG、字体走 Vite 的 asset pipeline。chayuan-desktop 的品牌 logo、模型供应商 icon 都通过 Vite 处理输出到 dist/。

跨平台一致性。Vite 在 Windows、macOS、Linux 上行为一致。chayuan-desktop 的 CI 流水线在三个平台上跑相同的 Vite 命令，输出可重复构建。

升级节奏。Vite 大版本升级跟得紧（每年一次大版本）。chayuan-desktop 的版本策略是跟主流稳定版，不立刻追最新。当前用 Vite 5，6 出来后会评估升级。

WPS AI 插件 chayuan-wps 也用 Vite 做构建链。Vue 3 + Vite 是常见组合。两个产品的前端构建链选型一致，团队跨产品协作时认知成本低。

Vite 在 chayuan-desktop 的位置是开发态加速器和生产打包工具。免费开源的AI软件 选构建链不需要追最新最快，选成熟稳定且跟主框架契合的就够。
