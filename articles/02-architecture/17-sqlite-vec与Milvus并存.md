# 本地离线知识库 sqlite-vec与外部Milvus怎么并存 一致的adapter接口

chayuan-desktop 桌面单机版默认用 sqlite-vec 做内嵌向量库，但用户也可以接外部 Milvus、Chroma、Zilliz、Elasticsearch 等多种外部源。两类向量库形态完全不同，一个是单文件嵌入式，一个是独立服务，但在 chayuan-desktop 内部它们走同一个 adapter 接口。这一篇讲这种统一是怎么做到的。

先看两类库的差别。sqlite-vec 是 SQLite 扩展，跟 chayuan-desktop sidecar 同进程，调用方式是 SQL（select * from chunks where vec_distance(embedding, ?) < 0.5）。Milvus 是独立服务，跑在网络上，调用方式是 gRPC 或 REST API。Chroma 在两者之间，可以嵌入也可以独立服务。

两类库的能力差。sqlite-vec 能力相对基础，支持 IVF 索引、L2 / cosine 距离、metadata 过滤；性能在几万到几十万 chunk 量级够用。Milvus 支持复杂 ANN 算法（HNSW、IVF_PQ）、亿级向量、分布式、partition、TTL；性能上限远高。

统一的 adapter 接口。chayuan-desktop 在 retrieval/query/adapters 目录下定义了一个抽象 vector adapter 类，接口包括：search(query_vector, top_k, filters)、insert(vectors, metadata)、delete(ids)、count()、explain(query_id)。每个具体 vector 库实现这个接口，sqlite-vec adapter、milvus adapter、chroma adapter 等。

接口背后的语义统一。distance 度量都映射到 cosine（如果原始是 L2 自动转换）。filter 表达式都接受同样的字典格式（{"field": "value", "field2": {"$gt": 0.5}}），各 adapter 内部翻译成各自的查询语言。返回结果都是统一的 RetrievalHit 结构，包含 id、score、payload、metadata。这种统一让上层 router 和 orchestrator 不感知具体后端。

ku_id 命名空间区分。sqlite-vec 的 KB 是 doc:* 命名空间，外部库是 src:* 命名空间。比如 doc:技术资料 走 sqlite-vec adapter，src:milvus_local 走 milvus adapter。同一个查询里可以混合多个 ku_id，orchestrator 派给不同 adapter 并发跑。

embedding 维度不统一怎么办。sqlite-vec 默认用 bge-m3 的 1024 维，Milvus 上用户自己 collection 用什么维度都可能。chayuan-desktop 在创建外部源连接时会问 embedding 模型 字段，按这个字段判断查询时该用什么模型生成 query 向量。同一个查询里可能涉及多种维度，每个 adapter 按自己 collection 的维度跑。

这种 跨维度并发 在 orchestrator 里怎么处理。orchestrator 把查询的 plan 拆成 per-adapter 任务，每个任务带自己需要的 embedding 模型。embedding 在 sidecar 内部预先生成好对应维度的 query 向量，再分发给各 adapter。这样多个 adapter 不需要重复算 embedding。

外部库连接管理。Milvus、Chroma、ES 这些外部服务的连接信息（地址、用户名、密钥）保存在 CHAYUAN_ROOT/data 的 connectors 表里，加密存储。每次启动时 sidecar 不立刻建连，按需 lazy 连接。连接失败时单一 adapter 退化为不可用，不影响其他 adapter。

外部库的健康检查。每分钟一次轻量 ping，记录每个外部源的可达状态。前端 KB 列表里展示绿点（健康）或红点（不可达），用户能一眼看到哪个源出问题。这个机制在多源场景下尤其重要，否则用户问一个问题，某个外部源挂了导致整体延迟，原因看不到。

数据一致性边界。sqlite-vec 的内嵌库跟 chayuan-desktop 的事务一致；外部库各自独立，不参与本地事务。这意味着 跨多源原子写入 不可行。chayuan-desktop 没有承担分布式事务，只承担读时编排。写入主要发生在内嵌 KB（doc:* 类型），外部源的写入由用户自己在源系统里完成。

外部库的迁移工具。chayuan-desktop 提供工具把 sqlite-vec 的内容导出为 Milvus 可导入的格式，反向也支持。用户从单机版升级到企业级部署时这个工具能用上。免费开源的AI软件 在数据可携性上的这种支持很重要，避免被产品锁定。

WPS AI 插件 chayuan-wps 通过 sidecar 调 KB，对外部库的接入是无感的。加载项里挑一个 src:milvus_local 的 KB 跟挑一个 doc:技术资料 的 KB 体验一致，引用气泡渲染按 kind 区分。

国产化支持下的几个外部源。RT 私有向量库、Relyt 阿里云、Zilliz Cloud（国内节点）、ES 私有部署，这些都通过同一个 adapter 接口接入。新增一种私有向量库只需要写一个 adapter，不动核心代码。

sqlite-vec 与 Milvus 并存的设计是 chayuan-desktop 一个核心策略：本地优先 但 不限制扩展。免费开源的AI软件 用户从一台电脑上的几万 chunk 开始，需要时可以无缝接外部库到几亿 chunk，业务代码不变。
