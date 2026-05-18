# Elasticsearch也是结构化源 全文检索如何接入

chayuan-desktop 桌面单机版把 Elasticsearch（ES）作为一种特殊的结构化数据源。ES 既是全文搜索引擎又是结构化数据库，chayuan-desktop 利用它的两面性。这一篇讲清楚 ES 接入和用法。

先看 ES 的位置。它是 Lucene 之上的搜索 + 分析引擎。索引（index）类似 SQL 的表。文档（document）是基本单位，类似 MongoDB。但 ES 强在全文检索（基于倒排索引）和聚合分析（aggregation）。

接入到 chayuan-desktop。chayuan-desktop 用 elasticsearch-py 驱动连接。KB 创建时选 结构化数据 - Elasticsearch 类型。填 hosts、user、password、indices 选择。

ES 跟 SQL 数据库的差异。

差异一：查询语言。ES 用 DSL（JSON 风格的 Query DSL）或 SQL（ES 7+ 支持 SQL 风格查询）。chayuan-desktop 优先让 LLM 生成 ES SQL（学习成本低），实在不行用 DSL。

差异二：全文检索强。ES 的 match 查询、phrase 查询、模糊查询是 SQL 数据库不擅长的。chayuan-desktop 在意图识别时识别 全文场景 用 ES 的全文能力，结构化场景用 SQL。

差异三：聚合分析。ES 的 aggs 跟 SQL GROUP BY 类似但更灵活。histogram、terms、percentile 这些聚合 chayuan-desktop 在 prompt 里给 LLM 提示。

差异四：分页和排序。ES 的 from + size 类似 LIMIT + OFFSET，但深分页有性能限制。chayuan-desktop 用 search_after 做大数据分页。

ES 当结构化 KB 的具体能力。

能力一：聚合查询。比如 按地区统计销售单数，ES 的 terms agg 直接出。chayuan-desktop 的 LLM 生成 ES SQL 跟 PG SQL 类似。

能力二：全文检索。比如 查含某个关键词的所有日志。ES 的 match query 命中精度高。chayuan-desktop 在 RAG 场景下也能用 ES 当文档源（src:* 命名空间）。

能力三：时间序列分析。比如 每天的访问量。ES 的 date_histogram agg。chayuan-desktop 让 LLM 生成 SQL 风格的 GROUP BY。

ES 也能当向量库。ES 8+ 支持 dense_vector 字段和 kNN 查询。chayuan-desktop 把这种 ES 当 src:* 向量源。但这种用法不那么常见。

实测精度。ES 上的 text2sql/DSL 准确率。

简单查询：90%。

聚合查询（aggs）：80%。

全文 + 聚合混合：70%。

LLM 对 ES SQL 的熟悉度低于 PG/MySQL，但比 MongoDB 高。

应用场景。

场景一：日志分析。公司日志聚合到 ES，chayuan-desktop 接入后能问 上周服务 X 的错误率。

场景二：产品搜索。电商产品索引在 ES。问 价格 100-200 元的商品 直接出。

场景三：内容检索。新闻、文章、博客存 ES。问 含某个关键词的文章 用 ES 的全文能力。

场景四：用户行为分析。用户行为日志 ES + 实时分析。问 上个月活跃用户数 通过 ES 聚合。

ES 的几个特别注意。

注意一：mapping 严格。ES 的 mapping 决定字段类型和分析行为。chayuan-desktop 在 KB 创建时拉取 mapping 作为 schema 提示。

注意二：分词器。ES 中文分词需要装 ik 或者 jieba 插件。chayuan-desktop 不替你装插件，假设 ES 已经配好。

注意三：版本差异。ES 5/6/7/8 各版本 API 略有差异。chayuan-desktop 当前主要支持 ES 7+，老版本兼容性看需求。

国产化支持下的 ES。某些政企客户用国产 ES 替代品（Easysearch、OpenSearch 中国版）。chayuan-desktop 接 OpenSearch 通过同样的 elasticsearch-py 协议（OpenSearch 跟 ES 7 协议兼容）。

ES 当向量库的实测。chayuan-desktop 把 ES 8 dense_vector 接入 src:* 向量 KB，查询精度跟 sqlite-vec 接近。但 ES 部署复杂度更高，单机版用户一般不会接 ES，更多是企业场景。

WPS AI 插件 chayuan-wps 在 ES 场景下用法跟其他结构化 KB 一致。在 WPS 里写报告分析 ES 里的数据，加载项调起查询返回结果。

ES 作为结构化源是 chayuan-desktop 多源支持的扩展。免费开源的AI软件 把 ES 这种 半结构化 + 全文 + 向量 三合一 能力纳入 KB 抽象，让用户能用一套 chayuan-desktop 应对很多场景。
