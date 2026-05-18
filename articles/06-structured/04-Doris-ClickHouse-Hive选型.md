# 本地离线知识库的Doris ClickHouse Hive 三种分析型数据源选型

chayuan-desktop 桌面单机版支持 Doris、ClickHouse、Hive 这三种 OLAP 分析型数据库。这三种各有所长，怎么选是用户经常问的。这一篇讲选型决策。

先看三家的定位。

Doris（百度开源 + Apache 顶级项目）。MySQL 协议兼容，OLAP 引擎，支持向量字段（部分版本）。国产数据库代表之一，在国内政企覆盖广。

ClickHouse（俄系开源）。列式存储，单机超高性能，OLAP 标杆。SQL 方言略特殊（不是完全标准 SQL）。国际项目但在国内大量用于日志分析、用户行为分析。

Hive（Apache，Hadoop 生态）。HQL 接近 SQL 但有差异，跑在 Hadoop 集群上，PB 级别数据规模。慢但能扛大数据。

应用场景的差别。

场景一：交互式 BI 查询。用户问销售数据、库存数据，秒级响应。ClickHouse > Doris > Hive。Doris 跟 ClickHouse 都能毫秒到秒级，Hive 通常几秒到几分钟。

场景二：超大数据离线分析。PB 级别历史数据。Hive > Doris > ClickHouse。Hive 在超大数据集上仍可用，ClickHouse 通常单机或小集群。

场景三：实时数据仓库。Doris 强于这个，支持实时写入和实时查询。ClickHouse 也行但写入吞吐稍弱。

场景四：日志分析。ClickHouse 是经典选择，毫秒级查询海量日志。

场景五：政企国产化。Doris 在国产数据库清单里位置好，跟金仓、达梦组合是常见信创组合。

chayuan-desktop 接入的细节。

Doris。MySQL 协议兼容，chayuan-desktop 当 MySQL 处理（用 mysql-connector-python 驱动）。SQL 方言以 MySQL 为基础，加上 Doris 特有的几个分析函数。

ClickHouse。chayuan-desktop 用 clickhouse-driver 或 clickhouse-sqlalchemy。SQL 方言要专门处理，比如 GROUP BY 后 SELECT 的字段必须是 GROUP BY 字段或聚合函数（比 MySQL 严格）。chayuan-desktop 的 LLM prompt 里给 ClickHouse 专门提示。

Hive。chayuan-desktop 用 PyHive 驱动。HQL 跟 SQL 大体一致但有差异（比如 RLIKE 而不是 REGEXP）。chayuan-desktop 的 prompt 给 Hive 专门提示。

text2sql 的方言适配。chayuan-desktop 在生成 SQL 前给 LLM 一段方言描述。比如 ClickHouse 的 prompt 里写 注意 ClickHouse 的 GROUP BY 严格性，分析型函数用 anyHeavy quantile 等。这种方言提示让 LLM 生成的 SQL 在对应数据库上能跑。

性能对比。chayuan-desktop 自己跑过简单测试。1000 万行的销售数据，问 上个月华南销售总额。

ClickHouse 单机：80ms。

Doris 单机：150ms。

Hive 集群（小集群）：3-5 秒。

性能差距明显。但 Hive 是为更大数据规模设计的，在亿级行上 Doris ClickHouse 可能力不从心。

数据规模的取舍。

百万行以下。chayuan-desktop 的 sqlite-vec 内嵌结构化 KB 完全够。把 CSV 上传转 SQLite 表，几乎零部署。

百万到亿行。Doris 或 ClickHouse 是好选择。建议接外部 src:* 类型 KB。

亿到千亿行。Hive 或者 Doris 集群。chayuan-desktop 接外部 KB。

千亿行以上。这个规模 chayuan-desktop 不是最优工具，可能要专业 BI 工具配合。

Hive 的 LLM 友好度。Hive 的 HQL 跟标准 SQL 差异大，LLM 生成时偶尔出错。chayuan-desktop 在 Hive 上的精度比 Doris ClickHouse 略低。建议在 Hive 上的 query 简单一些，复杂查询人工修正。

ClickHouse 的特别能力。ClickHouse 有大量分析型函数（quantile、histogram、moving average）。chayuan-desktop 的 prompt 提示 LLM 这些函数的存在，让生成的 SQL 能用上 ClickHouse 的强项。

Doris 的国产化优势。在政企信创场景下 Doris 是国产 OLAP 代表。chayuan-desktop 接 Doris 在政企信创场景里加分。

WPS AI 插件 chayuan-wps 在 OLAP 场景下用得最多的是 BI 类查询。在 WPS 文字写月度分析报告时调起加载项查 src:doris_dwd KB 问聚合数据，把结果直接引用到报告里。

三种 OLAP 数据源的选型决策综合数据规模、性能要求、国产化要求。免费开源的AI软件 给用户选择，但要让用户知道每种工具的适用边界。chayuan-desktop 的多源支持让用户的实际选型不被工具限制。
