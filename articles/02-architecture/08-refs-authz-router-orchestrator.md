# refs authz router orchestrator 这四个名字背后的职责切分

chayuan-desktop 桌面单机版后端 retrieval/query 模块下有四个核心子模块：refs、authz、router、orchestrator。这四个名字看着像随便起的，其实每个都对应一个独立职责，互相之间不重叠也不漏。这一篇专门讲这四个模块各自管什么，为什么这么切。

refs 模块。职责是 解析知识源标识。具体做的事情是：拿到请求里的 ku_ids 列表，逐个解析格式（doc:* / src:* / office:*），查询每个标识背后的元数据（来自 KB 列表数据库）、检查可用性、把可用的封装成 KnowledgeRef 对象，把不可用的封装成 错误描述。这个模块只关心 这个标识合法吗、这个 KB 能找到吗，不关心权限不关心检索。

为什么单独切出 refs。早期版本里这件事散落在各个 adapter 内部，每个 adapter 自己解析 ku_id。结果是同样的解析逻辑写了好几遍，且不同 adapter 处理边界不一致。比如不存在的 KB，有的 adapter 跑半天才返回错，有的 adapter 直接抛异常。统一到 refs 之后所有 adapter 在 KnowledgeRef 已合法的前提下工作，错误处理规整。

authz 模块。职责是 权限判断。单机版默认关鉴权，这个模块在单机模式下是 通过 通行的状态。多用户版本里它会校验：当前用户是不是这个 KB 的所有者或被授权方、当前应用是不是有 KB 访问权限、当前操作（读 / 写）是不是被允许。authz 跟 refs 解耦，refs 只回答 KB 在不在，authz 回答 你能不能用。

把 authz 单独切的好处。一个是 单机和多人同源。同一份 retrieval/query 代码能从单机模式无缝跑到多用户模式，差异只在 authz 实现。另一个是 审计点统一。所有权限检查都在这一层，审计日志只需要在这里埋点就能记录全部访问。

router 模块。职责是 识别查询意图，决定走哪条检索路径。常见判定包括：这是文档问答还是结构化聚合、是单源还是多源、要不要做重排、要不要走多模态。router 的实现结合了 LLM 推断和规则启发：简单规则比如 KB 列表里有 src:dm_finance（达梦）就考虑结构化路径，有 doc:* 考虑文档路径。复杂判定走小模型分类。

router 的判定输出是一个 plan，包括要派给哪些 adapter、参数是什么、超时多少。router 不直接调 adapter，只负责生成 plan，调用是 orchestrator 的事。

orchestrator 模块。职责是 调度与聚合。它拿 router 的 plan，按计划把任务派给各 adapter，并发执行。具体做的事情包括：超时控制（每个 adapter 单独超时 + 整体超时）、错误隔离（一个失败不影响其他）、并发数限制（避免一个查询打爆所有 adapter）、trace 收集（每一步耗时、命中数、错误码）、结果聚合（多 adapter 命中合并、去重、按 score 排序）。

为什么单独切 orchestrator。如果让 router 直接调 adapter，router 既要懂判定又要懂调度，职责膨胀。把调度切出去之后，router 只关心 决定怎么查，orchestrator 只关心 执行查询，互相独立可测试。

四个模块协作流程。一次 /api/v1/kb-query/search 请求到 service 层之后：先 refs 解析 ku_ids，得到 KnowledgeRef 列表；再 authz 校验，过滤掉无权限的；剩下的交给 router 生成查询 plan；orchestrator 按 plan 调 adapters；结果回到 service 层做最终包装返回前端。

这四个模块共用一份 数据契约。不管是 refs 给出的 KnowledgeRef，还是 router 给出的 plan，还是 orchestrator 收的 RetrievalHit，都基于 Pydantic v2 模型定义，schema 在 kb_query/schemas.py 里集中维护。新增字段、改类型都能自动跑合同测试，避免上下游漏跟。

api 路由层只做协议适配。/api/v1/kb-query/search 路由文件就是十几行：解析请求体、调 service.kb_query.search、序列化响应。不写任何业务逻辑。CLAUDE.md 里把这条作为架构红线：API 路由文件只做协议适配、参数校验和身份注入。这条规矩让路由层始终是薄的，业务在专门模块里。

WPS AI 插件 chayuan-wps 调的就是这套接口。加载项发起的检索请求，经过 refs / authz / router / orchestrator 四个模块的处理，跟桌面客户端走的路径完全一致。这是单机版加载项体验一致的根本。

四个模块各管一摊的设计，让 chayuan-desktop 的 retrieval/query 在测试覆盖、错误处理、可演进性上都比早期 一锅粥 的实现强很多。免费开源的AI软件 长期维护要靠这种切割得清爽的架构。
