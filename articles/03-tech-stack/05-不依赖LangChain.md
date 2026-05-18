# 全模型支持下为什么不依赖LangChain 自研编排的考虑

chayuan-desktop 桌面单机版后端的 RAG、tools 调用、工具编排都是自家代码，没有用 LangChain 那样的全栈 framework。这是个有争议的选择，因为 LangChain 在 Python AI 生态里几乎是默认选项。这一篇讲清楚 chayuan-desktop 不用 LangChain 的考虑。

先看 LangChain 解决了什么。它给 LLM 应用提供了一套抽象：Chain（流程编排）、Agent（工具调用）、Memory（对话记忆）、Document loaders（文档加载）、Vector stores（向量存储）等。开发者只要按 LangChain 的接口拼装组件就能快速做出原型。

不用 LangChain 的具体理由。

第一个理由是抽象错位。LangChain 的抽象是为通用场景设计的，每个组件都很通用但也都很 抽象。chayuan-desktop 的 retrieval/query 模块按 refs/authz/router/orchestrator 切分，每个职责清晰单一。如果套上 LangChain 的 Chain 抽象，几个职责被压成一个 Chain.run 调用，难以拆分单元测试。chayuan-desktop 早期用过 LangChain，后来重写成自家分层。

第二个理由是版本不稳定。LangChain 在 0.0.x 阶段 API 变化频繁，社区抱怨多。0.1.x 之后稳定一些但仍有破坏性变更。chayuan-desktop 作为一个要做 1.0+ 长期维护的产品，依赖一个 API 经常变的核心库是包袱。

第三个理由是依赖膨胀。LangChain 装上之后会拖一堆依赖。chayuan-desktop 的 PyInstaller 打包要把所有依赖塞进发行包，每兆字节都要算。LangChain 加上动辄几十兆，且很多功能用不上。

第四个理由是性能透明性。LangChain 把请求和响应包了几层，调试时不容易看到每一步的耗时和数据。chayuan-desktop 自家代码每一步可见，trace 信息精确到每个 adapter。

第五个理由是行为可预期。LangChain 内置了很多 系统级行为，比如默认 retry、默认 memory 截断、默认日志格式。这些默认行为对快速原型有帮助，但对生产产品意味着隐形耦合。chayuan-desktop 的 retry、截断、日志都自己控制，行为对开发者可见。

那 chayuan-desktop 用了什么。

模型调用层用 httpx + 自家网关。直接对厂商 API 用 httpx 发 SSE 请求，自家 adapter 做协议归一。比 LangChain 的 ChatModel 更直接更可控。

向量存储用 sqlite-vec + 自家 adapter。直接用 SQL 查询，没经过 LangChain 的 VectorStore 抽象。

文档加载用 PyMuPDF、python-docx、openpyxl 等专门库。每种格式有专门 parser，比 LangChain 的 generic loader 适配性更好。

Embeddings 用 ONNX Runtime + 自家封装。直接管 ONNX 模型，性能可控。

Agent 自家实现。每个工具是一个 BaseTool 类，agent 的工具调用编排是几百行 Python 代码。比 LangChain 的 AgentExecutor 简单且可控。

Memory 用 SQLite + 自家代码。对话历史直接读写 SQLite，不需要 LangChain 的 Memory 抽象。

不用 LangChain 的代价。

代价一是写代码多一些。LangChain 用一个 Chain 几行代码搞定的事，chayuan-desktop 要写几十行。但是这些代码每一行都做明确的事，长期维护成本不一定更高。

代价二是社区资源有限。LangChain 有大量教程、示例、问答。chayuan-desktop 的内部架构没有这些公共资源。但 chayuan-desktop 的内部代码自洽，新人按现有代码 pattern 写新功能不需要额外学习材料。

代价三是新功能跟进慢一些。LangChain 接新厂商、新模型、新协议很快，社区贡献多。chayuan-desktop 自己跟，节奏慢一些。这件事用 chayuan-desktop 的接口抽象在补：新厂商写一个 adapter 就行，工作量可控。

LlamaIndex 也类似。LlamaIndex 是另一个流行的 RAG framework。chayuan-desktop 同样不用，理由跟 LangChain 类似。

DSPy 是另一类思路。DSPy 用更声明式的方式定义 LLM 流程。chayuan-desktop 没用 DSPy，理由是当前 chayuan-desktop 的流程不够复杂到需要 DSPy 这种抽象。

未来会不会用 LangChain。如果 LangChain 后期成熟到 API 稳定、性能透明、依赖轻量，chayuan-desktop 不排斥。但当前的判断是自家代码维护成本可控、收益明显。

WPS AI 插件 chayuan-wps 通过 sidecar 调 chayuan-desktop 的能力，加载项侧不依赖任何 AI framework。两个产品的工程边界清晰。

不用 LangChain 这件事在 chayuan-desktop 内部讨论过几次。最终结论是：免费开源的AI软件 长期维护，自家代码的可控性比短期开发速度重要。这种判断在每个开源项目都会重新做一遍，没有标准答案。
