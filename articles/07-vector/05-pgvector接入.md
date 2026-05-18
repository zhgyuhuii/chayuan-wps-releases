# PostgreSQL pgvector的接入实操 已有PG的复用

chayuan-desktop 桌面单机版支持接 PostgreSQL + pgvector 扩展作为向量源。pgvector 让 PG 也能做向量库。这一篇讲接入流程和适合场景。

先看 pgvector 是什么。Postgres 的官方扩展，给 PG 加上向量字段类型和 ANN 索引（HNSW、IVFFlat）。开源 BSD 协议。Postgres 16+ 原生支持，老版本需要单独编译。

什么场景用 pgvector。

场景一：已有 PG 数据库。公司已经在用 PG，加个 pgvector 扩展就能用做向量库。比起再起一个 Milvus 服务，复用 PG 更省事。

场景二：向量 + 结构化字段一体。pgvector 让你能在同一张表里存向量字段和业务字段，SQL 直接查。比如 SELECT id, name FROM products WHERE embedding <=> ? < 0.5 这种 SQL。chayuan-desktop 接 pgvector 时既能当向量源也能当结构化源（双重接入）。

场景三：金仓 KingbaseES。金仓基于 PG，部分版本支持 pgvector。chayuan-desktop 接金仓的向量能力跟接 PG 一致。

接入步骤。

步骤一：确认 PG 装了 pgvector。命令行 SELECT * FROM pg_extension WHERE extname='vector'。如果没装 CREATE EXTENSION vector。

步骤二：在 PG 建带向量字段的表。CREATE TABLE chunks (id serial, content text, embedding vector(1024))。建索引 CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)。

步骤三：往表里写 chunk 数据。这一步 chayuan-desktop 不替你做，用户用其他工具或脚本灌进去。

步骤四：在 chayuan-desktop 建外部源。设置 - 知识库 - PostgreSQL pgvector 类型。填连接信息、表名、向量字段名、metadata 字段。

步骤五：测试。chayuan-desktop 拉一次 ANN 查询确认能跑。

跟 sqlite-vec 的差别。

差别一：服务形态。pgvector 是 PG 服务的一部分，需要 PG 服务运行。sqlite-vec 是嵌入式没服务。

差别二：性能。pgvector 在大规模上性能不如专业向量库（Milvus、Qdrant）。但比 sqlite-vec 强。chayuan-desktop 实测百万 chunk 上 pgvector HNSW 查询 10-30ms。

差别三：数据规模。pgvector 在中等规模（百万到千万）友好。超大规模（亿级）不如专业向量库。

差别四：跟业务字段一体。pgvector 的优势：你 PG 里的业务表加个 embedding 字段就成了向量库。不用单独维护一份数据。

实际查询。chayuan-desktop 的 pgvector adapter 用 SQLAlchemy 加 psycopg2 连 PG，查询 SQL 大致：

SELECT id, content, embedding <=> ? AS distance 
FROM chunks 
WHERE department = 'finance' 
ORDER BY distance 
LIMIT 10;

这种 filter + ANN 的组合在 pgvector 上跑得很自然。

距离运算符。pgvector 支持 <=>（cosine distance）、<->（L2 distance）、<#>（dot product）。chayuan-desktop 默认用 cosine（跟 bge-m3 嵌入归一化向量配合）。

索引选择。HNSW 索引精度高速度快但内存占用多。IVFFlat 内存少但需要训练。chayuan-desktop 不参与 PG 端的索引选择，遵循表已有索引。

性能调优。pgvector 的 hnsw.ef_search 参数控制查询时搜索深度，越大越准越慢。chayuan-desktop 默认值即可，特殊场景调。

跟 chayuan-desktop 内嵌结构化的关系。pgvector 在 PG 里，跟 chayuan-desktop 内嵌的 sqlite-vec 是 平行 的。一个 KB 选一种向量后端。如果用户希望文档库走 pgvector，chayuan-desktop 创建 doc:* KB 时选 后端=pgvector，把 chunk 写到外部 PG 的 vector 表里。这是 文档库 + 外部向量库 的组合。

国产化支持下的 pgvector。金仓 KingbaseES 部分版本带 pgvector 兼容。如果不带，chayuan-desktop 当普通 PG 接，不用向量能力（只用结构化）。这种降级策略让兼容性问题不会让 KB 完全不可用。

WPS AI 插件 chayuan-wps 不感知后端是 pgvector 还是 sqlite-vec。

pgvector 接入是 chayuan-desktop 给现有 PG 用户的便利。免费开源的AI软件 不要求用户切换基础设施，能复用就复用。chayuan-desktop 的多后端支持是这种 务实接入 的体现。
