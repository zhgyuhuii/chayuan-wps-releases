# 全模型支持的Rust端逻辑控制在多少 边界划在前端调用而不是业务代码

chayuan-desktop 桌面单机版的 Tauri 主进程是 Rust 写的，但 Rust 代码量很少。业务逻辑都在 Python sidecar，前端用 React。这种 Rust 控制在最薄一层 的设计是 chayuan-desktop 的明确选择。这一篇讲清楚为什么这么划边界。

先看 Rust 在 chayuan-desktop 做的具体事。窗口管理（创建主窗口、设置标题、调整大小）、菜单和托盘集成、系统级事件（文件关联、URL 协议）、子进程管理（spawn sidecar、监控 sidecar、kill sidecar）、配置文件读写（tauri-plugin-store）、环境变量注入。这些都是 OS 级别集成，必须用 native 代码，Rust 是合适的工具。

不在 Rust 做的事。所有 AI 业务（模型调用、RAG、tools）、所有数据访问（SQLite、向量库）、所有协议处理（HTTP API、SSE 流式、模型协议归一）、所有 UI 逻辑。这些事如果放 Rust，工作量数倍且生态不如 Python 成熟。

为什么这么划。

第一个理由是生态匹配度。AI 生态在 Python 上无敌，从 LLM SDK 到文档解析到 ONNX Runtime 到 SQL 引擎，几乎所有需要的库都有 Python 版。Rust 上同等功能的库少得多且不成熟。

第二个理由是开发速度。Python 写 RAG、写 tools、写 adapter 比 Rust 快几倍。chayuan-desktop 是产品迭代节奏快的项目，开发速度对功能扩展重要。

第三个理由是可维护性。Rust 的 ownership 模型严格，对 Rust 不熟的开发者上手慢。把业务放 Python 让贡献者门槛低。chayuan-desktop 想做长期开源维护，社区贡献门槛是关键考虑。

第四个理由是性能。AI 应用的性能瓶颈不在解释器开销，而在 IO 等待（模型调用网络、SQL 查询、文件读写）和外部库（ONNX Runtime、SQLite）。Python 应用在这种 IO 密集场景下跟 Rust 应用差异微小。

第五个理由是边界清晰。Rust 主进程只管系统集成，Python sidecar 管业务，前端管 UI。三层职责清晰，互相不混淆。这种 each layer one concern 的设计让代码组织自然。

Rust 主进程的代码量。chayuan-desktop 的 src-tauri/src 目录下大约 1000-1500 行 Rust 代码。比起 sidecar 的几万行 Python 是小数。这个比例反映了 边界划得很薄 的事实。

Rust 主进程做的最复杂的事。sidecar 启动和监控逻辑。包括 spawn 子进程、注入环境变量、轮询 health 接口、监听 sidecar 退出、自动重启策略、优雅关闭。这一段 Rust 代码大约 300 行。

Rust 跟前端的通信。Tauri 有 invoke 机制让前端调 Rust 命令。chayuan-desktop 用得很少，仅限于必须 native 的操作（选目录、托盘菜单点击、全局快捷键触发）。绝大多数前后端通信走 fetch HTTP 调 sidecar，不经过 Rust。

为什么前后端通信不走 Tauri invoke。Tauri invoke 适合简单 RPC，但 chayuan-desktop 的对话流式响应、文件上传、错误处理用 HTTP 更直接。SSE 流式响应在 fetch + ReadableStream 上自然，invoke 上要自己造轮子。HTTP 也方便 chayuan-wps 加载项以同样方式接入 sidecar。

Rust 的安全模型加成。Tauri 在 Rust 主进程做安全策略 enforcement，比如 webview 能调哪些 native API、能访问哪些文件路径。这一层在 Rust 控制最稳。

Rust 出错的处理。chayuan-desktop 的 Rust 主进程很少出错，因为代码量少且逻辑简单。万一出错通常是 spawn sidecar 失败这种系统问题，处理方式是给用户弹错误对话框。

未来如果业务移到 Rust。如果某些性能极致敏感的场景需要 Rust，可以单独写 Rust 库给 sidecar 调（PyO3 桥接）。但这种场景应该极少。chayuan-desktop 的 Python sidecar 性能完全够当前场景。

国产化支持下的 Rust。Rust 跨平台编译成熟，loongarch64 也有官方支持。chayuan-desktop 的 Rust 主进程在龙芯架构上构建顺畅，跟 x86 体验一致。

WPS AI 插件 chayuan-wps 完全没有 Rust 部分，加载项是 Vue 3 + JS。两个产品的 native 集成方式不同：chayuan-desktop 是 Tauri，chayuan-wps 是 WPS 加载项。但都不依赖业务级 native 代码。

Rust 边界控制在最薄一层 这件事在 chayuan-desktop 内部是明确共识。免费开源的AI软件 想长期保持低维护成本和高贡献门槛，技术栈划界这种事比表面看起来重要。
