# ku_id与KnowledgeRef是合同主字段 kb_names只是兼容

chayuan-desktop 桌面单机版前端跟后端之间有一个核心数据合同：ku_ids 是携带知识源选择的真源字段。这件事在 CLAUDE.md 里写过不止一次，但实际开发中仍偶尔出现误用。这一篇专门讲清楚 ku_id 在合同里的位置。

先看 ku_id 长什么样。三种命名空间。doc:文档库名 比如 doc:技术资料 doc:合同档案。src:外部源ID 比如 src:milvus_local src:dm_finance。office:owner[:group] 比如 office:zhangsan office:zhangsan:team_a。三种之间互不冲突，前缀决定 kind。

为什么不用 显示名。早期某段代码用 KB 显示名做合同主字段。问题立刻出现：用户给两个 KB 起了同样的中文名（用户随手起的，没意识到重名），后端收到 显示名 不知道要查哪个。再换显示名时所有历史会话的引用就废了。后来切到 ku_id（内部稳定 ID + 类型前缀），这些问题消失。

ku_id 与 KnowledgeRef 的关系。前端持有 ku_id 字符串，发请求时把它放在 ku_ids 数组里。后端 refs 模块解析 ku_id，查询元数据，构造 KnowledgeRef 对象。后续的 authz、router、orchestrator、adapter 都基于 KnowledgeRef 工作，不再回查 ku_id 字符串。

合同字段在 schema 里的形状。Pydantic v2 模型 SearchRequest 里有 ku_ids: list[str] 字段。每条字符串必须匹配 doc:* / src:* / office: 三种格式之一。schema 校验在路由层就把不合法格式挡住。

kb_names 字段的兼容定位。kb_names: list[str] 在 SearchRequest 里仍存在，但只接受文档库名（隐式视为 doc:* 命名空间）。它存在的唯一原因是兼容旧版本前端发的请求。新代码不应该再用 kb_names。

不要把 src:* 当作普通文档 KB 处理。这是合同里最容易踩的红线。早期某些版本的前端会把外部源混进 kb_names 字段，结果后端把外部源当文档库走。chayuan-desktop 的新代码已经强制要求 ku_ids 携带所有源，kb_names 不接受非 doc 类型。前端开发时务必注意这一点。

source_ids 字段。早期版本还有一个 source_ids 字段专门承载外部源。新版本合同里 source_ids 视为废弃兼容字段，不要新增依赖。新代码统一用 ku_ids。

合同变更的版本管理。chayuan-desktop 的接口变更走 alembic 类似的迁移机制：新增字段保持向后兼容，破坏字段先标记 deprecated 至少一个版本，移除字段在大版本升级时统一处理。当前 v3.0 已经把核心合同收敛到 ku_ids，下个 v4 大版本可能把 kb_names 真正删掉。

合同测试。chayuan-server/tests/unit_tests/test_kb_query_schemas.py 里固化了合同字段。每次 PR 跑 CI 自动校验。如果某个 PR 改了 ku_ids 字段类型或者删了字段，测试立刻失败。

前端类型同步。chayuan-client 的 packages/api 包里有 TypeScript 类型定义，从 Pydantic schema 生成。前端开发时 import 这些类型，编译期就能发现 不该传 kb_names 但传了 之类的问题。

KbSelectorDialog 的实现。前端的 KB 选择器组件持有 selectedKuIds 数组，每个元素是 ku_id 字符串。展示时按 kind 渲染图标和名称。提交检索时直接把 selectedKuIds 发到后端，不做转换。这种设计让前端逻辑跟合同直接对应。

KbSourceStrip 的引用展示。当回答带引用时，每个引用的 ku_id 决定展示形态：doc:* 显示文件名加页码，src:* 显示 collection 加 vector ID 或 SQL 加表名，office:* 显示文件路径加 owner。前端按 kind 字段分流。

跟 chayuan-wps WPS AI 插件 的合同对齐。WPS 加载项发起的检索请求同样使用 ku_ids 合同。加载项内部的 KbSelectorDialog 共用 chayuan-client 的组件，selectedKuIds 字段名跟桌面客户端一致。两边对接 sidecar 时合同绝对统一。

什么时候用 ku_id 什么时候用 KnowledgeRef。前端只用 ku_id（短字符串）。后端 refs 模块把 ku_id 解析成 KnowledgeRef（含完整元数据）。后续业务逻辑都用 KnowledgeRef。这种分工让前后端各自处理合适的数据形态。

如果你在 chayuan-desktop 代码库里看到 kb_names 用法，多半是兼容代码或者历史遗留。新写代码用 ku_ids。这条约定是 免费开源的AI软件 长期可演化的工程基础。
