# Zilliz云端向量库当外部源 数据出域的边界

chayuan-desktop 桌面单机版可以接 Zilliz Cloud 这种云端向量库作为外部源。但是 chayuan-desktop 的核心定位是 单机本地、不出域。接云端是不是矛盾？这一篇讲清楚边界。

先看 Zilliz Cloud 是什么。Zilliz 是 Milvus 的商业母公司，Zilliz Cloud 是托管在云上的 Milvus 服务。用户不用自己部署 Milvus，购买云资源即可。在中国有 阿里云节点，海外有 AWS、GCP 节点。

接 Zilliz 跟单机理念的关系。

立场一：纯单机优先。所有数据完全本地，连 Zilliz 这种云端都不用。chayuan-desktop 默认 sqlite-vec 走这条路。

立场二：可选外接。chayuan-desktop 不强求所有用户走纯单机。如果用户已经在用 Zilliz Cloud，让他们能接进来，让 chayuan-desktop 跟现有基础设施配合，比强迫迁移更现实。

立场三：用户清楚。接 Zilliz 之后，那部分数据在云端，跟单机本地的 KB 不同。chayuan-desktop 在 KB 详情页明确标记 该 KB 数据存在云端，让用户知道边界。

数据出域的几个维度。

维度一：原 chunk 数据。如果用户在 Zilliz 里建了 collection，chunk 数据已经在 Zilliz 那边。chayuan-desktop 接入只是查询，不主动上传新数据。

维度二：query 向量。每次查询，query 文本经过 chayuan-desktop 的本地 bge-m3 算成向量，发到 Zilliz 做 ANN。query 向量本身是数字数组，但能通过反向工程部分恢复 query 含义。这部分数据出域了。

维度三：检索结果。Zilliz 返回的 chunk metadata + payload 回到 chayuan-desktop。这部分数据原来就在 Zilliz，回流到本机不是 新出域。

维度四：LLM 调用。如果用户的 LLM 选了云端模型（GPT-4o），整个 prompt（含 chunk 内容）发到 OpenAI。这部分独立于向量库选择。

什么场景接 Zilliz 合适。

场景一：已有 Zilliz 投入。公司已买 Zilliz 服务，chayuan-desktop 复用现有资产。

场景二：数据规模超大。亿级以上 chunk，sqlite-vec 不够，自建 Milvus 运维成本高，Zilliz Cloud 是托管服务省心。

场景三：跨地域协作。多地团队共用一份向量数据，云端便于共享。

什么场景不该接 Zilliz。

不该一：单机优先用户。整个 chayuan-desktop 就是为了不上云。接 Zilliz 矛盾。

不该二：数据严格不出域。政企合规要求所有数据本地。Zilliz 即使有国内节点也是 第三方云。

不该三：数据规模小。sqlite-vec 完全够，不需要云端。

接入步骤。

步骤一：在 Zilliz Cloud 控制台拿到 endpoint 和 API key。

步骤二：在 chayuan-desktop 设置新建外部源。Zilliz Cloud 类型。填 endpoint、API key、collection 名。

步骤三：测试连接。

步骤四：建 src:zilliz_xxx 命名空间的 KB。

注意：API key 是敏感信息。chayuan-desktop 加密存到 credentials。但 API key 一旦泄漏可以访问 Zilliz 数据，敏感程度高。

国产化支持下的 Zilliz。Zilliz 在中国有阿里云节点，数据在国内。但仍是 第三方云 不是 自建本地。政企严格信创场景下不算合规。

国产替代。RT、Relyt、阿里云 ANNS 等国产向量库可以替代 Zilliz。chayuan-desktop 都支持。如果要严格国产化，建议自建国产向量库而不是用 Zilliz。

混合策略。某些用户的做法。把不敏感的 KB 放 Zilliz（业务规模大）。把敏感的 KB 放 sqlite-vec（本地）。chayuan-desktop 的多 KB 并联让混合检索可行。

WPS AI 插件 chayuan-wps 不感知后端是 sqlite-vec 还是 Zilliz。引用气泡按 KB 类型展示，用户能从 ku_id 看到 来自云端 还是 本地。

Zilliz 接入是 chayuan-desktop 给用户的灵活度。免费开源的AI软件 不强求所有用户都走 极致单机 路径。但用户必须清楚每种选择的边界。chayuan-desktop 的 KB 标记和文档让这种边界显式。
