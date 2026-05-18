# Milvus接入察元AI 用作外部库的最简配置

chayuan-desktop 桌面单机版除了内嵌 sqlite-vec，也支持接外部 Milvus 集群作为向量源。这一篇讲 Milvus 接入的最简配置。

先看为什么要接 Milvus。

理由一：超大数据规模。sqlite-vec 在百万到千万 chunk 规模够用，超大数据（亿级）需要 Milvus。

理由二：HNSW 算法。Milvus 标准支持 HNSW，精度延迟权衡更好。sqlite-vec 当前还不支持。

理由三：复用现有数据。如果公司已有 Milvus 集群跑其他业务，chayuan-desktop 接进来直接复用。

理由四：分布式扩展。Milvus 支持集群部署、replica、partition，单机 sqlite-vec 做不到。

接入步骤。

步骤一：确认 Milvus 实例。Milvus 服务运行的 host:port，比如 127.0.0.1:19530（standalone 默认）或者公司内网的 Milvus 集群地址。

步骤二：在 Milvus 准备 collection。collection 类似 SQL 表。chayuan-desktop 不会在 Milvus 里建 collection，它是 接入已有 collection 模式。先在 Milvus 建好 collection，定义字段（必须有 vector 字段 + metadata 字段）。

步骤三：在 chayuan-desktop 创建外部源。设置 - 知识库 - 新建 - 结构化数据 - Milvus。填 host、port、collection_name、embedding_field、metadata_fields 等。

步骤四：测试连接。chayuan-desktop 用 pymilvus 客户端试连。失败原因常见：网络不通、认证错（如果 Milvus 开了 auth）、Milvus 版本不兼容。

步骤五：选 embedding_model。chayuan-desktop 知道 Milvus collection 用什么 embedding 模型才能给 query 算同维度向量。如果 collection 是 bge-m3 嵌入的，chayuan-desktop 这边查询时也用 bge-m3 算 query 向量。

步骤六：建 src:milvus_xxx 命名空间的 KB。

实际查询。用户问 跟产品 A 类似的内容。chayuan-desktop 用 bge-m3 算 query 向量，调 pymilvus.search() 在 Milvus collection 里 ANN 检索。返回 top-K 命中。chunk 文本和 metadata 拿到后，chayuan-desktop 走重排（如果 KB 配了），最后 LLM 总结。

跟 sqlite-vec 的差别。

差别一：网络调用。Milvus 是远程调用，每次查询有网络延迟（毫秒到几十毫秒）。sqlite-vec 是本地调用零网络延迟。

差别二：连接管理。chayuan-desktop 给 Milvus 维护连接池（pymilvus 默认池）。sqlite-vec 是内嵌不需要。

差别三：数据所有权。Milvus 里的数据归用户的 Milvus 集群管，chayuan-desktop 只读访问。sqlite-vec 文件归 chayuan-desktop 管。

差别四：写入。chayuan-desktop 不主动往外部 Milvus 写入数据。如果要在 Milvus 加新数据，用户自己用 pymilvus 或其他工具。chayuan-desktop 只读。

Milvus 配置的几个细节。

细节一：consistency level。Milvus 支持 strong、bounded、eventually 几种一致性。chayuan-desktop 默认 bounded（性能好且足够新）。

细节二：索引类型。Milvus collection 在创建时选了 HNSW、IVF_FLAT、IVF_PQ 等索引。不同索引性能不同。chayuan-desktop 不参与索引选择，遵循 collection 配置。

细节三：partition。某些 Milvus collection 用 partition 分组数据。chayuan-desktop 默认查全部 partition，如果用户要按 partition 过滤，可以在 KB 配置里指定 partition 名。

细节四：batch 查询。chayuan-desktop 的 multi-KB 查询时如果同一个 Milvus collection 收到多个 query 向量，可以用 batch search 一次查多个，提升效率。

故障处理。Milvus 服务挂了或网络不通时，chayuan-desktop 这一边的检索失败，但其他 KB 的检索不受影响。前端展示 该外部源不可用 标记。

国产化支持下的 Milvus 替代。某些政企客户用国产向量库（RT、Relyt 等）。chayuan-desktop 的 adapter 抽象让接其他向量库跟接 Milvus 一样，写一个 adapter 即可。

WPS AI 插件 chayuan-wps 透明使用 Milvus 后端。在 WPS 里发起检索时不感知是 sqlite-vec 还是 Milvus。

Milvus 接入是 chayuan-desktop 在大规模向量场景下的扩展能力。免费开源的AI软件 不被单机能力锁定，给用户接外部专业向量库的口子，让大数据场景也能用 chayuan-desktop。
