# collection与namespace在察元AI里的映射

不同向量库有不同的 数据组织 概念。Milvus 用 collection、Chroma 用 collection、Qdrant 用 collection 加 namespace、Elasticsearch 用 index。chayuan-desktop 桌面单机版怎么把这些不同概念统一映射？这一篇讲清楚。

先看每家的概念。

Milvus。collection 是基本单位（类似 SQL 表）。每个 collection 有 schema（字段定义、向量维度）。collection 下可以有 partition（分区，按 metadata 字段分组）。

Chroma。collection 是基本单位。每个 collection 含一组 documents（chunk）。没有 partition 概念。

Qdrant。collection 是基本单位。每个 collection 含一组 points（向量）。没有 partition，但 metadata 可以用作隐式分组。

Elasticsearch。index 是基本单位。一个 index 可以含多个 type（旧版本，新版本不用）。每个文档有 _source 字段。

PostgreSQL pgvector。table 是基本单位。每张表的某个字段是 vector。

chayuan-desktop 的统一抽象。

抽象一：每个外部源连接对应一个 src:* KB。比如 src:milvus_local 是一个 chayuan-desktop KB，背后是 Milvus 的某个 collection。这种一对一映射让用户在 KB 选择器里看到的就是熟悉的概念。

抽象二：collection 名作为 KB metadata。chayuan-desktop 在 KB 元数据里记录 collection_name 字段。检索时按这个字段调外部 API。

抽象三：partition 通过 metadata filter 模拟。如果 Milvus 的 collection 用 partition 分组，chayuan-desktop 在创建 KB 时指定要查哪些 partition，或者通过 metadata filter 实现 隐式 partition 选择。

抽象四：跨多个 collection 怎么办。如果用户想一次问答查 Milvus 的多个 collection，chayuan-desktop 让用户建多个 KB（每个 KB 对应一个 collection），检索时勾上多个 KB 即可。这种 显式建多个 KB 的方式简单但管理略繁琐。

namespace 概念的处理。

Milvus 没原生 namespace。如果用户用 metadata 字段做隐式 namespace（比如 metadata.tenant_id），chayuan-desktop 通过 filter 实现 namespace 查询。

Qdrant 也类似，metadata 字段做隐式 namespace。

ES 的 index 本身就是隔离单位。多个 index 对应多个 KB。

PG pgvector 的 schema 概念可以做 namespace。chayuan-desktop 创建 KB 时指定 schema + table 组合。

KB 命名规范。chayuan-desktop 的 src:* 命名空间下，KB 名建议带上数据库类型 + 来源 + collection。比如 src:milvus_finance（Milvus 的 finance collection）、src:qdrant_products（Qdrant 的 products collection）。命名清楚便于管理。

跨向量库的概念差异。

差异一：embedding 维度。每家库的 collection 有自己的维度（用户建库时指定）。chayuan-desktop 在 KB 元数据里记录维度，检索时确认 query 向量维度匹配。

差异二：距离度量。不同 collection 可能用不同度量（cosine vs L2 vs dot product）。chayuan-desktop 在 KB 元数据里记录度量，调外部 API 时按对应度量。

差异三：metadata schema。每家库的 metadata 字段命名约定不同。chayuan-desktop 不强求统一，按用户配置的字段名称工作。

差异四：写入语义。某些库支持写入（chayuan-desktop 把数据写进去），某些只支持读。chayuan-desktop 默认所有 src:* KB 是只读，写入由用户在外部系统操作。

国产化支持下的概念映射。RT、Relyt 等国产向量库的 collection 概念跟 Milvus 一致。chayuan-desktop 的统一抽象覆盖。

实际示例。

src:milvus_documents → Milvus 的 documents collection。chunk_text 字段、embedding 字段、source、page_number 字段。

src:qdrant_products → Qdrant 的 products collection。每个 point 是产品，payload 含产品名、描述、价格。

src:es_logs → ES 的 logs index。每个 doc 含日志内容 + dense_vector 字段。

src:pgvector_users → PG 的 users 表 + embedding 字段。

四种不同的后端，统一成 src:* 命名空间的 chayuan-desktop KB。用户感知一致。

WPS AI 插件 chayuan-wps 透明用任意向量库后端。在 WPS 里挑 KB 时看到的是 ku_id 不是后端类型。

collection 和 namespace 的统一映射是 chayuan-desktop 多源抽象的一部分。免费开源的AI软件 想让用户不被向量库类型差异困扰，统一抽象是关键。chayuan-desktop 在这一面的设计让 接哪种向量库 变成 配置问题 而不是 工程问题。
