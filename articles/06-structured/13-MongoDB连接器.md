# MongoDB连接器 把非关系型当结构化的边界

chayuan-desktop 桌面单机版支持 MongoDB 作为结构化 KB。MongoDB 是文档型 NoSQL，跟关系型 SQL 数据库不同。把 MongoDB 当 结构化 是有边界的。这一篇讲清楚。

先看 MongoDB 的特征。文档（document）是基本单位，每个文档是 BSON（类 JSON）格式。集合（collection）类似 SQL 的表，但每个文档结构可以不一样。查询语言是 Mongo Query Language（MQL）或者通过 PyMongo Python API。

接入到 chayuan-desktop。chayuan-desktop 用 motor 或 pymongo 驱动接入。在 KB 创建时选 结构化数据 - MongoDB 类型。填 connection string、database、collections 选择。

MongoDB 跟 SQL 的差异。

差异一：schema 不严格。同一 collection 里每个文档字段可以不同。chayuan-desktop 在 schema linking 时按 sample 一组文档推断 隐式 schema，给 LLM 看常见字段。

差异二：嵌套结构。MongoDB 文档可以嵌套（用户文档里嵌入地址数组）。SQL 一般是扁平。chayuan-desktop 在 schema 描述中标记 嵌套字段，LLM 在生成查询时用点号访问。

差异三：查询语言。MongoDB 用 find/aggregate 而不是 SELECT。chayuan-desktop 让 LLM 生成 MongoDB 风格的查询，再用 pymongo 执行。

差异四：聚合管道。MongoDB 的 aggregate 用 pipeline 模型（一系列阶段），跟 SQL 的 GROUP BY 不同但功能类似。chayuan-desktop 的 prompt 给 LLM 介绍 MongoDB 聚合管道。

LLM 怎么生成 MongoDB 查询。chayuan-desktop 的 prompt 模板。

prompt 含。当前数据库类型 = MongoDB。集合 schema（字段名 + 类型 + 注释）。sample 文档（前 3-5 条）。常见 MongoDB 操作（find、aggregate、distinct、count）。

LLM 输出。一段 Python 代码或一个 MongoDB query JSON。chayuan-desktop 的执行层用 pymongo 跑这个 query。

实测精度。MongoDB 上的 text2sql（其实是 text2mongo）准确率比关系型 SQL 略低。

简单 find 查询：90%+。

简单聚合（按字段分组计数）：85%。

复杂 pipeline（多阶段）：65-75%。

LLM 对 MongoDB 操作熟悉度低于 SQL，复杂场景容易出错。

什么场景 MongoDB 当结构化 KB 合适。

场景一：简单文档查询。比如 找最近 10 个用户的注册信息。MongoDB 的 find + sort + limit 直接搞定。

场景二：嵌入文档。用户表的地址字段是嵌入文档。MongoDB 直接 JSON 风格查询。

场景三：地理空间查询。MongoDB 的 geo 索引强。chayuan-desktop 支持地理类查询。

场景四：聚合管道分析。简单到中等复杂的 aggregate。

什么场景不合适。

场景一：复杂 JOIN。MongoDB 的 lookup 跟 SQL JOIN 类似但 LLM 写起来困难。这种场景考虑 ETL 到 SQL 数据库再查。

场景二：跨 collection 复杂关系。MongoDB 不擅长，文档型设计哲学就是一个文档自包含。

场景三：精确数值聚合。MongoDB 的 decimal 处理跟 SQL 数据库稍有差异，精确金额场景用 SQL 更稳。

MongoDB 当文档 KB 的可能性。如果你的 MongoDB 文档是 描述性内容（评论、博客、笔记），把每个文档作为 chunk 入 doc:* 文档库可能更合适。chayuan-desktop 支持从 MongoDB 导出文档建文档库。这种 转结构化为文档 让 RAG 链路工作。

MongoDB 的安全。chayuan-desktop 的字段白名单同样适用，确认 LLM 只能访问授权字段。MongoDB 的认证（auth）配合 chayuan-desktop 的连接字符串处理。

国产化支持下的 MongoDB。MongoDB 在政企信创清单里位置不强（国际开源软件）。但很多中型企业用它做内部数据。chayuan-desktop 接入流程一致。

WPS AI 插件 chayuan-wps 在 MongoDB 场景下用法跟 SQL 数据库类似。在 WPS 里写报告查 MongoDB 数据，加载项调起 sidecar 跑 MongoDB query，返回结果。

MongoDB 当结构化 KB 是 chayuan-desktop 多源支持的一个特殊点。免费开源的AI软件 不被 SQL 限制，对 NoSQL 也提供 text-to-query 能力。chayuan-desktop 在这一面的覆盖让它能扛更多元的数据源。
