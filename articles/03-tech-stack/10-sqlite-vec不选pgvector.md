# 国产化支持下选sqlite-vec而不是pgvector的理由

向量数据库这件事在 2024-2026 年特别热。Postgres 的 pgvector 扩展、Milvus、Chroma、Qdrant、Weaviate 一堆名字。chayuan-desktop 桌面单机版选的不是这些，是 sqlite-vec。这一篇讲清楚选 sqlite-vec 而不是 pgvector 的几个理由。

先看 pgvector 是什么。Postgres 的官方扩展，在 PG 表上加向量列，支持 ANN 索引（HNSW、IVFFlat），SQL 一体化查询。pgvector 的优势是跟 Postgres 完整生态结合，事务、约束、索引、备份这些工具都能用。

pgvector 的劣势在桌面单机版语境下。

需要 Postgres 服务。pgvector 是 Postgres 的扩展，必须先有 PG 服务。chayuan-desktop 的核心定位是 不依赖外部服务的单机版，装一个 PG 太重。要么用户自己装 PG（不可能），要么 chayuan-desktop 发行包内嵌一个 PG（包变大且管理复杂）。

服务进程开销。即使内嵌 PG，跑一个 PG 进程会持续占用几百 MB 内存，对办公电脑不友好。SQLite 是进程内嵌入式，跟 sidecar 同进程，零额外开销。

跨机迁移成本。PG 的数据是绑定服务实例的，跨机器要 pg_dump 加 reimport。SQLite 是文件，cp 即可。chayuan-desktop 用户经常需要换电脑，这件事 SQLite 优势明显。

选 sqlite-vec 的理由。

零部署。sqlite-vec 是 SQLite 扩展，加载之后跟普通 SQL 一样用。chayuan-desktop sidecar 启动时一行 conn.load_extension('vec0') 加载完事。

跨平台。sqlite-vec 给 Windows、Linux、macOS、ARM、x86 都有预编译。PyInstaller 打包时按平台带对应的 .dll/.so 即可。

资源占用低。sqlite-vec 跟 SQLite 共享文件，零额外进程。索引数据写在同一个文件里，备份就是备份这个文件。

性能足够。sqlite-vec 在百万级 chunk 规模下 ANN 查询毫秒到几十毫秒。对单机版的常见用户场景（几万到几十万 chunk）远远够用。

ANN 算法。sqlite-vec 当前主要支持 IVF 类型的索引，HNSW 在 roadmap 上。这是 sqlite-vec 的短板，但对桌面单机版的使用场景影响有限。如果用户真的需要 HNSW（极高精度低延迟），可以接外部 Milvus 走 src:milvus_local 这种命名空间。

对国产化支持的具体好处。sqlite-vec 的源代码完全开源（Apache 2.0），可以审计。pgvector 也开源，但前提是要审计整个 PG 体系，工作量大得多。chayuan-desktop 在政企部署时审计材料的提交，sqlite-vec 这一边比较轻。

sqlite-vec 在 loongarch64 上的支持。需要从源码 build，但 build 过程不复杂。chayuan-desktop 的龙芯发行包带预编译的 sqlite-vec 共享库。pgvector 在 loongarch64 上的官方支持滞后。

sqlite-vec 的版本节奏。当前活跃维护，发布频繁。chayuan-desktop 锁定具体版本（避免 breaking change），跟随上游升级。

数据持久性。sqlite-vec 数据写到 SQLite 文件，跟 SQLite 同等持久性。WAL 模式下崩溃恢复完整。

同一文件多 KB。chayuan-desktop 把每个 KB 存在独立的 sqlite-vec 文件，这种 一个 KB 一个文件 的模式让 KB 删除直接 rm 文件，备份也容易。pgvector 是表级别隔离，多个 KB 在同一个 PG 实例里。

未来 sqlite-vec 跟不上场景怎么办。chayuan-desktop 的 adapter 抽象让换向量库非常自然。如果某个企业用户真的需要更复杂的 ANN 算法或者更大数据规模，可以接外部 Milvus、Chroma 等。sqlite-vec 是默认，但不是唯一。

存储格式的稳定性。sqlite-vec 的存储格式跟 SQLite 一样稳定。chayuan-desktop 升级 sqlite-vec 版本时数据通常不需要迁移，向后兼容。pgvector 跨大版本升级有时需要重建索引，对用户感知更重。

不用 Chroma 嵌入式模式。Chroma 也支持嵌入式跑，是 sqlite-vec 的潜在竞品。chayuan-desktop 没选 Chroma 嵌入式的原因：Chroma 的嵌入式部署要起一个独立 server 进程（即使是嵌入式），架构上跟 sqlite-vec 的扩展形态不同；Chroma 的 API 是 REST，sqlite-vec 是直接 SQL，性能更好。

WPS AI 插件 chayuan-wps 不直接接触向量库，所有检索通过 sidecar HTTP 接口。sqlite-vec 还是 Milvus 对加载项是透明的。

sqlite-vec 在 chayuan-desktop 的位置是 单机优先的默认本地向量库，不是为了挑战 Milvus。免费开源的AI软件 单机版的存储选择，符合 装到电脑里就能用、不依赖外部服务、跨机能搬走 这三条原则。
