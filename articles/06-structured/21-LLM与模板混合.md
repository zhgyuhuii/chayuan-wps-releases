# 大模型与确定性模板的混合 哪些场景仍走模板

chayuan-desktop 桌面单机版的 text2sql 主要靠 LLM 生成 SQL。但某些常见查询完全可以用模板解决，不一定每次都让 LLM 写。这一篇讲混合策略。

先看模板的优势。

优势一：精度 100%。模板写好之后每次跑都对。LLM 即使精度 95% 仍然有失败。

优势二：延迟低。模板套参数即可，不用调 LLM。延迟从 1-3 秒降到几十毫秒。

优势三：成本零。不用调 LLM API 不耗 token。对企业级使用是真省钱。

模板的劣势。

劣势一：覆盖窄。每个模板只覆盖一种 query 模式。需要为每种常见 query 写模板。

劣势二：维护负担。schema 变化时模板要更新。

劣势三：用户认知门槛。用户得知道有哪些模板可以用。

chayuan-desktop 的混合策略。

策略一：常见 query 走模板。预定义几个常见 query 模式（比如 上个月 X 总数、按 X 分组的 Y、最近 10 条 X）。chayuan-desktop 的 router 识别这些模式自动走模板，不调 LLM。

策略二：罕见 query 走 LLM。意图识别没匹配模板时调 LLM 生成 SQL。

策略三：模板可配置。用户在 KB 设置里可以加自定义模板。比如 我们公司这个查询特别常用 加进模板库。后续这种 query 直接套模板。

策略四：模板加 LLM 配合。模板生成 SQL，LLM 做自然语言总结。两步分工，模板管精度，LLM 管表达。

具体模板示例。

模板一：count_by_field。

匹配模式：query 含 多少、几个 + 实体名。

参数：表名、过滤字段、过滤值。

SQL 模板：SELECT COUNT(*) FROM {table} WHERE {filter_field} = '{filter_value}'。

模板二：sum_by_period。

匹配模式：query 含 上月、本月、上季度 + 实体名。

参数：表名、聚合字段、时间字段。

SQL 模板：SELECT SUM({metric}) FROM {table} WHERE {date_field} BETWEEN ... AND ...。

模板三：top_n_recent。

匹配模式：query 含 最近 N 个 + 实体名。

参数：表名、排序字段、N。

SQL 模板：SELECT * FROM {table} ORDER BY {date_field} DESC LIMIT {n}。

模板的实际跑通率。在常见办公场景下模板能覆盖 30-50% 的 query。这部分 query 用模板，剩下的走 LLM。整体 SQL 生成精度提升 5-10 个百分点。

模板的可观测。chayuan-desktop 的 trace 日志记录每次 query 是走模板还是 LLM。开发者能分析 哪些场景模板覆盖好。

模板的性能。模板套参数耗时几毫秒。LLM 生成耗时 1-3 秒。差几百倍。在高频查询场景下模板节省大量时间。

模板的安全。模板的参数化用 SQLAlchemy 的 bound parameter，避免 SQL 注入。即使用户输入有恶意内容也跑不出危险 SQL。

模板的国产化。chayuan-desktop 内置一组适配中文办公的模板（按地区统计、按部门统计、本月销售）。国产数据库（达梦、金仓）的方言差异在模板内部处理。

LLM 兜底的关键。模板覆盖不到的 query 必须走 LLM。chayuan-desktop 的 router 不会因为有模板就拒绝复杂 query，模板和 LLM 是 covering 关系。

适合用模板的场景。

场景一：高频简单 query。每天数百次的标准报表查询。模板高效。

场景二：大数据库小 query。表很多但每个 query 简单。模板可控。

场景三：合规要求严格。LLM 不可控的 SQL 不能在生产跑。模板的确定性对合规友好。

不适合的场景。

场景一：探索性分析。用户每次问的都不同。模板覆盖不到。

场景二：多表复杂 JOIN。模板写不动。

WPS AI 插件 chayuan-wps 透明用模板/LLM 混合。在 WPS 里发起 query 时不感知背后是模板还是 LLM。

LLM 加模板混合是 chayuan-desktop text2sql 的工程务实选择。免费开源的AI软件 不应该把所有事情都丢给 LLM，能用确定性方法解决的就该用。chayuan-desktop 在这一面体现工程平衡。
