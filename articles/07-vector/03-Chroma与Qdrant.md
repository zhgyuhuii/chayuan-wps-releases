# Chroma与Qdrant怎么选 数据规模决定

chayuan-desktop 桌面单机版的外部向量库支持除了 Milvus 之外还有 Chroma、Qdrant 等。这一篇讲 Chroma 跟 Qdrant 怎么选，以及跟 sqlite-vec、Milvus 的对比。

先看四个候选。

sqlite-vec。嵌入式。百万级以下数据。完全本地。

Chroma。可嵌入式可独立服务。中小规模（百万到千万）。Python 友好。

Qdrant。Rust 写的，独立服务。中到大规模。性能好。

Milvus。分布式。大规模（亿级）。功能最全。

数据规模的取舍。

10 万 chunk 以下。sqlite-vec 完全够。零部署。

10-100 万 chunk。sqlite-vec 仍够用。Chroma 也合适但要起服务。

100 万-1000 万 chunk。Chroma 跟 Qdrant 是好选择。sqlite-vec 仍能扛但不那么舒服。

1000 万-亿级。Qdrant 或 Milvus。

亿级以上。Milvus 集群。

Chroma 的特征。

优势：API 简洁、Python 生态友好、嵌入式可选。

劣势：性能不如 Qdrant 和 Milvus 在超大规模上。

适合：开发者快速搭建 RAG 原型。

Qdrant 的特征。

优势：Rust 实现性能好、HNSW 实现优秀、支持 metadata filter 高级语法。

劣势：需要单独部署服务。

适合：生产中等规模 RAG 应用。

接入到 chayuan-desktop。

Chroma。chayuan-desktop 用 chromadb-client 接入。配 Chroma server 地址（可以是本地 localhost 或者远程内网）。指定 collection 名。

Qdrant。chayuan-desktop 用 qdrant-client 接入。配 host:port、collection、embedding_dim。

跟 Milvus 的差别。

差别一：API 风格。Milvus 偏 SQL/数据库风。Chroma 偏对象映射（collection.add、collection.query）。Qdrant 偏 REST。chayuan-desktop 的 adapter 抽象掉这些差异。

差别二：HNSW 实现。Qdrant 的 HNSW 性能略好于 Milvus（基准测试）。Chroma 用 hnswlib 也可。

差别三：filter 表达式。Qdrant 的 filter DSL 更灵活，支持复杂条件。Milvus 在某些版本上 filter 性能不如 Qdrant。

差别四：维度上限。三家都支持几千维向量。

性能对比。chayuan-desktop 在内部测试集上跑过简单对比（百万 chunk，1024 维）。

Chroma standalone：查询延迟 30-80ms。

Qdrant：查询延迟 20-60ms。

Milvus standalone：查询延迟 30-80ms。

sqlite-vec：查询延迟 50-150ms。

数据：在百万规模下四家都能用，Qdrant 略快。差距不到两倍。

部署复杂度。

Chroma 嵌入式。一行 import，零部署。

Chroma server。docker run 一下，简单。

Qdrant standalone。docker 部署，配置不复杂。

Qdrant cluster。需要 sharding 配置。

Milvus standalone。docker compose，几个服务一起起。

Milvus cluster。复杂。需要专门 ops。

适合的场景。

场景一：个人开发者。sqlite-vec（默认）或 Chroma 嵌入式。

场景二：小团队 RAG 系统。Chroma server 或 Qdrant standalone。

场景三：中等企业。Qdrant 或 Milvus standalone。

场景四：大企业。Milvus cluster。

chayuan-desktop 的策略。默认用 sqlite-vec（嵌入），让用户在需要时无缝接外部库。adapter 抽象让不同库的接入成本相近。

国产化支持下的向量库。RT、Relyt 等国产向量库 chayuan-desktop 也支持。adapter 写一份即接入。性能跟 Qdrant Milvus 接近。

WPS AI 插件 chayuan-wps 透明用任何向量库。在 WPS 里发起检索时不感知是哪种向量库。

Chroma 跟 Qdrant 的选型主要看 部署偏好 和 数据规模。免费开源的AI软件 给用户多种选择不锁定。chayuan-desktop 的 adapter 设计让选型决定不被工程束缚。
