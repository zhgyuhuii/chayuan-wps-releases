# 本地离线知识库为什么不用Postgres 嵌入式SQLite的边界

chayuan-desktop 桌面单机版的存储默认走 SQLite + sqlite-vec，没选 Postgres 之类更强的关系型数据库。很多人会问 嵌入式 SQLite 够用吗、几十万条数据会不会慢、未来不要换成 Postgres 吗。这一篇把边界讲清楚。

先看 SQLite 在桌面单机版上的优势。

零部署。SQLite 是嵌入式的，没有独立服务进程。chayuan-desktop sidecar 直接用 Python 的 sqlite3 库连，不需要额外起 Postgres 服务。这件事对 装到电脑里就能用 至关重要：用户不应该被要求安装数据库服务。

零配置。SQLite 不需要管理用户名密码、不需要配置 max_connections、不需要 vacuum 周期任务。配置项很少，开箱即用。chayuan-desktop 启动时只做几个 pragma 设置（journal_mode=WAL、synchronous=NORMAL）就完事。

单文件存储。一个 KB 一个 .db 文件，对应的 wal 和 shm 是辅助文件。备份就是 cp，恢复就是 cp 回来。删除 KB 就是 rm 文件。这种 文件即数据 的语义对单机版用户最直观。

可移动。把整个 CHAYUAN_ROOT 拷到另一台电脑就能用。Postgres 不行，因为它的数据格式跟服务进程绑定，跨机迁移要 pg_dump + 重导入。

性能上限。SQLite 在百万级数据规模下性能良好，特别是单进程读写。chayuan-desktop 的对话历史、KB 元数据这种规模一般在几十万条以内，SQLite 完全扛得住。sqlite-vec 在百万 chunk 量级下查询延迟在毫秒到几十毫秒，对单机用户够用。

边界一：并发写。SQLite 是 多读单写 模型。一时间只能有一个事务在写，其他写事务等待。这对单机版无所谓，因为单一用户的并发写本来就少。但如果未来要做共享后端，多用户高频并发写，SQLite 会成为瓶颈。这种场景下应该上 Postgres。

边界二：超大数据量。SQLite 单文件大小上限 281 TB（理论值），实际超过几十 G 后维护操作（VACUUM、INDEX REBUILD）会变慢。如果一个 KB 真的需要存几亿条 chunk，SQLite 会力不从心。这种场景下应该把数据外挂到 Milvus 之类的专业向量库。

边界三：网络访问。SQLite 是嵌入式的，不能远程访问。如果要让多个客户端连同一份数据，需要 Postgres 或者通过应用层做远程访问层（chayuan-server 的 HTTP 接口正是干这事）。

边界四：高级 SQL 特性。SQLite 不支持某些 Postgres 的特性，比如完整的窗口函数（早期版本）、更复杂的 JSON 操作、stored procedure。chayuan-desktop 业务上不依赖这些，但接外部数据源做 text2sql 时可能用到，这种场景接外部 PG 即可。

为什么 chayuan-desktop 没选 嵌入式 PostgreSQL（pgsqlite）。技术上 pgsqlite 把 PG 嵌入到客户端可行，但生态不成熟，PyInstaller 打包困难，跨平台兼容性差。SQLite 在打包和兼容性上压倒优势。

为什么不直接走外部 PG。chayuan-desktop 的核心定位是单机版，不依赖外部服务。如果硬要装 PG，发行包要带 PG 服务，启动时要管理 PG 进程，用户要懂 PG 配置。这违背 装到电脑里就能用 的承诺。

未来如果用户场景变了。chayuan-desktop 设计上保留了切换数据库的可能性。SQLAlchemy 的 dialect 机制让代码不依赖具体数据库。如果某个用户真的需要 PG，可以手动切换连接串，前提是接 PG 服务。但这已经超出单机版的设计意图。

sqlite-vec 的边界。sqlite-vec 当前支持 IVF 索引、L2 cosine 距离、metadata 过滤。不支持 HNSW 这种更复杂的 ANN 算法。如果场景需要 HNSW（特定的精度延迟权衡），可以接外部 Milvus。chayuan-desktop 的多源架构让这种切换无缝。

实际测试数据。chayuan-desktop 在一台 i5 加 16G SSD 笔记本上跑过测试：50 万 chunk 的 sqlite-vec 索引大小约 2GB，单次 ANN 查询延迟 30-80ms，重排后整体延迟 100-200ms。这个体验在单机版上完全够用。

国产化支持下的几个细节。麒麟 V10 和 UOS 自带的 SQLite 版本可能比较老，PyInstaller 包带自己的 SQLite 库就绕开这个问题。loongarch64 平台需要专门构建 SQLite 加 sqlite-vec 扩展，chayuan-desktop 的龙芯发行包覆盖了。

WPS AI 插件 chayuan-wps 通过 sidecar 访问 SQLite，加载项不直接读写。这种间接访问让 SQLite 单写的限制不暴露给加载项。

SQLite 在 chayuan-desktop 的边界是清楚的：单用户、几十万到百万级数据、本地访问、跨机迁移友好。在这些边界内 SQLite 完全够用，且体验比任何外部数据库都好。这是 免费开源的AI软件 单机版的合理选择。
