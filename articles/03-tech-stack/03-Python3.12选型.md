# Python 3.12的选择理由 性能 typing 与wheel生态对单机版的影响

chayuan-desktop 桌面单机版的后端 sidecar 跑在 Python 3.12 上。选 Python 这个语言不算意外（AI 生态主流），但选 3.12 这个具体版本有几个实际理由。这一篇讲清楚为什么是 3.12，以及这个选择对 免费开源的AI软件 的实际影响。

先看 Python 版本的演化。3.10 引入了模式匹配（match-case）。3.11 大幅优化了解释器性能（PEP 659），常见代码快 10-25%。3.12 进一步优化加 typing 改进。3.13 引入实验性的 free-threaded（无 GIL）。

为什么不停在 3.10 或 3.11。3.10 已经是几年前的版本，部分新依赖库不支持。3.11 的性能提升对 Python 应用是个大跳跃，但仍有一些 typing 相关的细节在 3.12 才完善。

为什么不直接上 3.13。3.13 在仓库选型时还偏新，部分关键依赖（PyTorch、ONNX Runtime、SQLAlchemy 某些扩展）对 3.13 的支持滞后。chayuan-desktop 是单机版要打成发行包，依赖兼容性比追最新版本重要。无 GIL 听起来美但实际收益对单机版有限，因为 sidecar 主要瓶颈在 IO 不在 GIL 锁竞争。

3.12 的具体收益。一是性能。比 3.10 快 10-30%，对 sidecar 启动速度和 RAG 入库吞吐都有帮助。二是 typing。PEP 695（type alias 语法）让 generic 类型声明更清楚。Pydantic v2 在 3.12 上的运行时性能比 3.11 更好。三是 GIL release 优化。某些 io-heavy 操作在 3.12 上更高效，对 sidecar 这种 io 密集应用有意义。

wheel 生态。Python 应用打包成 PyInstaller 单文件，需要所有依赖有对应平台的预编译 wheel。3.12 在仓库选型时已经发布快两年，主流依赖都有 wheel。这一点对单机版很关键，因为 PyInstaller 打包过程需要每个依赖能跑起来。

具体涉及的关键依赖。FastAPI 0.110+ 支持 3.12。Pydantic v2 在 3.12 上 native 编译性能最好。SQLAlchemy 2.0 支持 3.12。LangChain 主要包支持 3.12。ONNX Runtime 1.17+ 支持 3.12。PyMuPDF、python-docx、openpyxl 这些文档解析库支持 3.12。这些都是 chayuan-desktop 后端必需的库。

PyInstaller 与 3.12。PyInstaller 6.0+ 对 3.12 的兼容性稳定。PyInstaller 5.x 在 3.12 上有几个已知 bug。chayuan-desktop 用 PyInstaller 6.x。

跨平台兼容。3.12 的官方安装包覆盖 Windows、macOS、Linux。各发行版的包管理器（apt、yum、brew、winget）都有 3.12。chayuan-desktop 嵌入的是用 PyInstaller 打包的 3.12 解释器，用户机器上不需要装 Python，但 PyInstaller 的拉取需要 3.12 的运行时。

国产化支持下的考量。麒麟 V10 SP1 自带的 Python 是 3.7，太旧不行。SP2 上是 3.10。chayuan-desktop 通过 PyInstaller 把 3.12 解释器塞进发行包，不依赖系统 Python。这种做法绕开了系统 Python 版本不一致的麻烦。

loongarch64 平台上的 3.12。龙芯架构上的 Python 3.12 wheel 不那么齐全，部分 PyTorch、ONNX Runtime 依赖需要专门构建。chayuan-desktop 的龙芯发行包通过自家构建链解决了这部分。

3.12 的潜在风险。一是某些较老的库不支持，需要替换或自己 fork。chayuan-desktop 早期换掉了几个不维护的库，比如把某个老的 PDF 解析库换成 PyMuPDF。二是 deprecation warning。3.12 把部分 3.10 之前的旧 API 标记为 deprecated，长期看要跟着升级，但短期不影响。

3.12 与 typing。Pydantic v2 是 chayuan-desktop 的请求合同基础，schema 校验都靠它。3.12 上 Pydantic 的性能表现最好，schema 校验快几倍。每次 HTTP 请求的开销因此压低。

未来升级到 3.13 或更新版本的判断。免费开源的AI软件 不会因为追新而升 Python，会等到 3.13 的依赖生态完整、PyInstaller 的稳定支持、收益明显（比如无 GIL 的真实场景测试）才升。这种保守对单机版用户最稳。

WPS AI 插件 chayuan-wps 是 Vue 3 前端，不直接跑 Python。它依赖的是 chayuan-desktop sidecar 的 HTTP 接口，sidecar 用 3.12 不影响加载项。

Python 3.12 在 chayuan-desktop 的选择理由总结：性能足够好、依赖生态完整、PyInstaller 兼容性稳定、国产平台覆盖到位。这种 不冒险但跟得上 的版本策略，是单机版应用的合理选择。
