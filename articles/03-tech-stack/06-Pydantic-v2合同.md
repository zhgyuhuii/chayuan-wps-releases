# 全模型支持下的请求合同 Pydantic v2在察元AI的位置

chayuan-desktop 桌面单机版的所有 HTTP 接口、内部数据结构、配置文件 schema 都用 Pydantic v2 定义。这是 chayuan-desktop 后端 sidecar 工程化质量的基础之一。这一篇讲清楚 Pydantic v2 在 chayuan-desktop 的具体位置以及为什么。

先看 Pydantic v2 比 v1 强在哪。v2 用 Rust 重写了核心校验引擎（pydantic-core），性能比 v1 快 5-50 倍。typing 支持更严格，泛型、判别联合类型、模式匹配都更稳。v2 的错误消息格式化更清晰。这些差距对生产产品很关键。

chayuan-desktop 的具体使用。

第一个用法是 HTTP 请求合同。kb_query/schemas.py 这种文件集中定义所有 API 接口的 Request/Response schema。FastAPI 直接拿 Pydantic 模型做参数和返回类型，自动生成 OpenAPI 文档，自动跑请求校验。

第二个用法是内部数据结构。retrieval、knowledge_source、tools 各模块之间传的数据都是 Pydantic 模型，类型可见、字段命名稳定、跨模块边界清晰。比如 KnowledgeRef、RetrievalHit、Citation、Diagnostic 这几个核心结构都是 Pydantic 模型。

第三个用法是配置文件。chayuan-desktop 的 settings 用 Pydantic Settings 管理，环境变量、.env 文件、默认值统一处理。CHAYUAN_ROOT、CHAYUAN_HOST、CHAYUAN_PORT 这些配置在一个地方声明，所有模块通过依赖注入用。

第四个用法是工具参数 schema。每个内置工具的 args 定义为一个 Pydantic 模型。LLM 调用工具时按 schema 校验参数，参数不对直接拒绝。OpenAPI 自动导入工具时把 Swagger schema 翻译成 Pydantic 模型。

第五个用法是知识库 source connector 配置。每种外部源（Milvus、Chroma、ES、达梦、金仓）的连接配置是一个 Pydantic 模型。前端展示连接配置表单时基于 schema 自动渲染字段。

性能影响。Pydantic v2 的 Rust 核心让 schema 校验非常快。一次 HTTP 请求的 Pydantic 校验在微秒级，几乎可以忽略不计。chayuan-desktop 后端单 sidecar 处理所有请求，Pydantic 不是性能瓶颈。

类型严格度的好处。Pydantic v2 严格的类型 enforcement 让很多 bug 在请求层就被挡住。比如客户端发来的 ku_id 字段格式错误，Pydantic 在路由层直接 422 返回，业务代码不需要做额外校验。

错误消息的友好度。Pydantic v2 的错误消息包含字段路径、错误类型、错误描述。前端拿到这些信息可以直接展示给用户。比如 ku_id 字段格式不对会返回 ku_ids[2]: invalid format, expected doc:* / src:* / office:*。

discriminated unions 的应用。Pydantic v2 的 discriminator 字段让多态结构很自然。chayuan-desktop 的 KnowledgeRef 按 kind 字段区分子类型（DocRef、StructuredRef、VectorRef、OfficeRef）。每个子类型有自己的 metadata 字段，但都是 KnowledgeRef 的子类。这种设计让 多类型统一接口 简洁。

序列化与反序列化。Pydantic v2 的 model_dump 和 model_validate 让 Python 对象和 JSON 之间的转换无缝。chayuan-desktop 在 SQLite 存对话历史时把 messages 字段序列化成 JSON 落盘，读出来直接 model_validate 反序列化。这种用法大量出现在 chat、conversation、KB metadata 等模块。

兼容性边界。Pydantic v2 跟 v1 的 API 不完全兼容，升级时部分代码要改。chayuan-desktop 早期是 v1，后期完整迁移到 v2。迁移过程不复杂但需要一遍 pass。新功能开发后只用 v2 API。

合同测试。chayuan-desktop 的 tests 目录下有专门的合同测试（test_kb_query_schemas.py 等），固化了核心 schema 的字段和行为。每次 PR 跑 CI 都校验 schema 没有破坏性变更。这是 免费开源的AI软件 跨版本兼容的工程基础。

跟前端 TypeScript 类型同步。chayuan-desktop 通过 Pydantic 的 schema export 自动生成 TypeScript 类型定义，前端直接用。这避免了前后端类型不一致的常见 bug。

WPS AI 插件 chayuan-wps 用 TypeScript，调 sidecar 接口时同样用从 Pydantic schema 生成的 TS 类型。两个客户端共享同一份接口定义，加 schema 校验，确保前后端不会跑偏。

Pydantic v2 在 chayuan-desktop 的位置不是某个工具，是一份基础设施。免费开源的AI软件 想做出生产级稳定，类型与合同的明确度是这种产品工程的基础。
