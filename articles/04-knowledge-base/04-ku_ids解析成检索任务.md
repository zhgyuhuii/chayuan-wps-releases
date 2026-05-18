# 一次问答里 ku_ids怎么被解析成检索任务

chayuan-desktop 桌面单机版的一次问答涉及 ku_ids 从前端到检索任务的完整流转。前面讲过整体的 22 步流程，这一篇专门聚焦 ku_ids 这一段，把解析过程拆细。

第一步，前端构造 ku_ids 数组。用户在 KB 选择器里勾了三个库：一个文档库 doc:技术资料、一个达梦数据库 src:dm_finance、一个个人库 office:zhangsan。前端把这三个 ku_id 字符串放进 SearchRequest 的 ku_ids 字段。

第二步，前端发 POST /api/v1/kb-query/search。请求体是 SearchRequest 的 JSON 序列化。除了 ku_ids 还有 query（用户问句）、top_k、filters、其他可选参数。

第三步，FastAPI 路由层接到请求，跑 Pydantic v2 schema 校验。SearchRequest 里 ku_ids 字段是 list[str]，每条字符串必须匹配 doc:* / src:* / office: 格式。如果某条不合法，立刻 422 返回。

第四步，路由层调 service 层 kb_query.service.search(req)。service 层拿 SearchRequest 进入业务流程。

第五步，refs 模块解析 ku_ids。具体动作。

每条 ku_id 字符串先按 : 分割成 prefix 和 rest。doc 是 prefix='doc'，rest='技术资料'。office:zhangsan:team_a 是 prefix='office'，rest='zhangsan:team_a'。src:dm_finance 是 prefix='src'，rest='dm_finance'。

按 prefix 选解析器。doc 解析器去 KB 表里查 name='技术资料' 的 KB 记录。src 解析器去外部连接器表里查 connector_id='dm_finance' 的连接配置。office 解析器把 rest 进一步拆分成 owner 和 group。

每个解析器返回一个 KnowledgeRef 对象。doc:技术资料 解析成 DocRef(ku_id='doc:技术资料', kind='document', display_name='技术资料', metadata={chunk_count, embedding_model, last_synced})。src:dm_finance 解析成 StructuredRef(ku_id='src:dm_finance', kind='structured', display_name='达梦财务库', metadata={dialect, table_count, whitelist})。office:zhangsan 解析成 OfficeRef(ku_id='office:zhangsan', kind='office', display_name='张三的个人库', metadata={owner='zhangsan', group=None})。

解析失败的处理。比如 doc:不存在的库 在 KB 表里查不到，refs 模块返回一个 ResolutionError 而不是 KnowledgeRef。整个 ku_ids 列表里有解析失败的条目时，service 层决定是 严格模式（任何失败整个请求失败）还是 宽松模式（失败的跳过，剩下的继续）。chayuan-desktop 默认宽松模式，前端展示警告 部分 KB 不可用。

第六步，authz 模块校验权限。每个解析出来的 KnowledgeRef 调 authz.check(user, kb_ref, action='read')。单机版下默认通过。多用户版下校验 user 是否有这个 KB 的读权限。失败的 KB 从列表里移除，给前端报警告。

第七步，router 模块基于 KnowledgeRef 列表生成查询 plan。router 看 query 内容（自然语言问题）和 KB 类型组合，决定走哪些 adapter。比如有 doc:* 跟 src:dm_finance 混选，问句 财务报表里关于 2025 年增长的内容，router 可能生成 plan：调 document adapter 查文档库，调 structured adapter 查数据库取增长数据，最后聚合。

第八步，orchestrator 按 plan 派任务。每个任务是 (KnowledgeRef, adapter, params) 元组。orchestrator 用 asyncio.gather 并发执行。每个任务有自己的超时（默认 10 秒）。

第九步，每个 adapter 执行检索。document adapter 跑 sqlite-vec 向量召回 + bce-reranker 重排。structured adapter 跑 text2sql 生成 SQL + AST 校验 + 执行 + 结果验证。office adapter 走办公库的命名空间过滤 + 文档检索。

第十步，所有 adapter 返回 RetrievalHit 列表。每个 hit 带 ku_id（哪个 KB 命中的）、score、文本片段、metadata、原文位置。

第十一步，results 模块聚合。按 score 排序、去重（同一份资料在多个库里时合并）、分组（按 ku_id 分组保留前 K 个）、构造统一的 QueryBlock 返回。

整个 ku_ids 解析到检索任务完成的过程在毫秒到几百毫秒之间。复杂度受 ku_ids 数量、KB 大小、外部源响应速度影响。

WPS AI 插件 chayuan-wps 调同一个接口走同一套流程。加载项里勾的 KB 同样形成 ku_ids 数组发到 sidecar。处理结果一致。

ku_ids 解析这一步是 chayuan-desktop 知识源处理的入口。免费开源的AI软件 想做出 多源混合检索 的体验，这一步必须做得稳。chayuan-desktop 的 refs 模块把这一步收敛到几百行代码，覆盖了所有命名空间的解析逻辑。
