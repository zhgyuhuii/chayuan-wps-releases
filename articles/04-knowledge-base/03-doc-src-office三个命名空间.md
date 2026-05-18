# 本地离线知识库的三个命名空间 doc src office各自管什么

chayuan-desktop 桌面单机版的 ku_id 有三种命名空间：doc:*、src:*、office:*。这一篇讲每个命名空间各自的设计意图和具体用法。

doc:* 命名空间。承载本地文档库。这一类最常用，覆盖 PDF、Word、Excel、PPT、Markdown、HTML 等办公文档。文档被切成 chunk，每个 chunk 用 bge-m3 嵌入，索引存在 sqlite-vec 文件里。doc:技术资料 这种 ku_id 直接对应一个 sqlite-vec 文件。

doc:* 的命名规则。冒号后面是 KB 名，由用户自定义。中英文混合都行。但建议不要用特殊字符（斜杠、引号），不要太长（超过 30 字符），不要含空格。chayuan-desktop 内部对 KB 名做规范化处理避免某些字符引起的问题。

src:* 命名空间。承载外部数据源。外部 SQL 数据库（达梦 DM、金仓 KingbaseES、PostgreSQL、MySQL 等）、外部向量库（Milvus、Chroma、Zilliz、PG-vector 等）、外部全文搜索（Elasticsearch、OpenSearch）、外部 SaaS 系统（Notion、飞书）。

src:* 的标识规则。冒号后面是连接器实例 ID，由 chayuan-desktop 在用户创建外部连接时自动分配，比如 src:milvus_local_xyz。这个 ID 不需要用户记忆，前端 UI 展示时用人类可读的连接名。

src:* 跟 doc:* 的区别。doc:* 的数据是 chayuan-desktop 自己解析、嵌入、入库的。src:* 的数据在外部系统里，chayuan-desktop 只是查询接入。两者的检索语义完全不同：doc:* 走 ANN + 重排，src:* 按外部系统的查询语言（SQL、Milvus query、ES DSL 等）。

office:* 命名空间。承载办公私库，按 owner 和可选的 group 做命名空间隔离。office:zhangsan 是个人库，office:dept_finance 是部门库，office:dept_finance:team_a 是部门下团队库。这种命名给政企场景下的多层组织结构留位置。

office:* 在单机版上的简化。单机版没有用户概念，所以 office:* 主要用 office:zhangsan 这种个人库形态，其中 zhangsan 是当前 OS 用户名或者用户自定义的隐式身份。多人共享后端时 office:* 才发挥真正作用。

三个命名空间的不冲突保证。前缀本身就是区分。doc:zhangsan 和 office:zhangsan 完全不同，不会混淆。前端 UI 展示时按 kind 字段渲染，doc 一种图标，src 另一种，office 第三种。

混选场景。一次检索请求可以同时带多个命名空间的 ku_id。比如 ku_ids: ["doc:技术资料", "src:dm_finance", "office:zhangsan"]。chayuan-desktop 的 orchestrator 把每个 ku_id 派给对应 adapter 并发跑。

权限边界。每个命名空间有自己的权限模型。doc:* 单机版下默认无权限校验。src:* 取决于外部系统的连接凭据。office:* 有 owner 隔离，office:other_user 不能被 office:zhangsan 查到。

引用气泡的差异。doc:* 引用展开原文段落，能跳页能下载原文件。src:* 引用展示 SQL 或者 vector ID，可能不能下载原文件。office:* 引用展示文件路径加 owner 元数据。前端组件按 kind 自动分流。

未来命名空间的扩展。chayuan-desktop 的设计预留了新命名空间的可能。比如未来加 mem:*（agent memory）、stream:*（流式数据源）、history:*（自身对话历史检索）。每个新命名空间扩展三类抽象之一即可。

CLAUDE.md 里的红线。 src:* 不能被强行当作 doc:* KB 处理。这是合同层面的硬约束。早期版本踩过这个坑，新代码严格区分。

WPS AI 插件 chayuan-wps 同样使用三个命名空间。在 WPS 文字里挑 KB 时能看到所有命名空间的库，按用户选择发到 sidecar。这种统一让单机版加加载项的 KB 体验完全一致。

三个命名空间的设计是 chayuan-desktop 知识源管理的基础。本地离线知识库 这件事变得复杂之后，命名空间分类是把复杂度收敛的关键。免费开源的AI软件 在数据组织上的清晰度，靠的是这种命名规范。
