# 本地离线知识库的向量ANN算法 sqlite-vec与HNSW的差别

向量库的核心算法是 ANN（Approximate Nearest Neighbor，近似最近邻）。chayuan-desktop 桌面单机版默认用 sqlite-vec，它当前主要支持 IVF 类型索引，没有 HNSW。这一篇讲清楚两种 ANN 算法的差别，以及为什么 sqlite-vec 当前的算法对单机版够用。

ANN 解决的问题。给定一个 query 向量和一组 N 个候选向量，找出距离最近的 K 个。暴力做法是计算 query 跟每个候选的距离，O(N) 时间。当 N 到几十万几百万时这种暴力计算太慢。ANN 用索引加速到亚线性时间，代价是 近似（少量偏差容忍）。

IVF 索引。Inverted File Index 的思路是先把所有向量聚类成若干簇（cluster），查询时先找最近的几个簇，再在这些簇里精确比对。建索引时跑一次 KMeans 把向量分成 nlist 个簇。查询时根据 query 找最近的 nprobe 个簇，nprobe 越大召回越准但越慢。

HNSW 索引。Hierarchical Navigable Small World 的思路是建一个多层图，每个节点是一个向量，节点之间根据相似度连边。查询时从顶层入口出发，按贪心策略下降到底层找到最近邻。HNSW 在精度和延迟上常常优于 IVF。

两种算法的取舍。IVF 建索引快、内存占用低、参数直观（nlist、nprobe）。HNSW 查询快、精度高、内存占用高、建索引慢、参数复杂（M、efConstruction、efSearch）。

sqlite-vec 当前的算法。当前 sqlite-vec 主要用 IVF 类型索引（具体实现略有差异），加上 metadata filter。在百万级 chunk 规模下查询延迟毫秒到几十毫秒，召回率达到 0.95 以上。这个性能对单机版常见的 几万到几十万 chunk 场景非常够用。

为什么 sqlite-vec 不优先做 HNSW。sqlite-vec 的设计目标是嵌入式简单可靠，HNSW 的实现复杂度高且对 SQLite 的存储模型适配不那么自然。社区在讨论加 HNSW 支持，但是节奏不快。

如果场景需要 HNSW 怎么办。chayuan-desktop 的 adapter 抽象让换向量库无成本。需要 HNSW 的用户可以接外部 Milvus（HNSW 是 Milvus 的标准选项），把数据放在 src:milvus_local 这种命名空间，业务代码不变。

实际场景的取舍。单机版用户大多是个人或小团队，几万到几十万 chunk 的规模。这种规模下 IVF 跟 HNSW 的性能差异在用户感知上很小（几十毫秒 vs 十几毫秒，都是远低于 LLM 调用本身的延迟）。HNSW 的精度优势在百万级以上才显著。所以单机版用 IVF 完全合理。

精度评估。chayuan-desktop 自己做过一轮评估：在自家文档 KB 上对比 sqlite-vec IVF 跟 Milvus HNSW，相同 top-K 下召回率差异在 2% 以内。重排（rerank）把这个差距进一步抹平。最终用户体感上几乎一致。

距离度量。sqlite-vec 支持 L2、cosine、dot product 三种。chayuan-desktop 默认用 cosine（归一化向量后与 dot product 等价），这是大多数嵌入模型推荐的度量。

metadata filter。sqlite-vec 支持在向量查询的同时按 metadata 过滤，比如 where ku_id='doc:技术资料' and date > '2025-01-01' and vec_distance(emb, ?) < 0.5。这种 filter+ANN 一体的查询能力让 chayuan-desktop 的多 KB 联合检索高效。

未来 sqlite-vec 加 HNSW 的预期。社区路线图上有这个，预期某个版本会加。chayuan-desktop 跟着升级即可，业务代码不动。

国产化支持下的 ANN 算法选择。国产向量库（RT、Relyt 等）大多基于 HNSW 或自家算法。chayuan-desktop 对接这些库时通过 adapter 抹平差异，不暴露算法细节给上层。

embedding 维度对算法的影响。bge-m3 默认 1024 维，跟 IVF 适配良好。如果嵌入维度极高（4096+）或者极低（128 以下），算法选择需要重新评估。chayuan-desktop 用 bge-m3 作为默认，避开这个选择压力。

WPS AI 插件 chayuan-wps 的检索通过 sidecar 调 sqlite-vec，加载项侧不感知 ANN 算法细节。算法的优化对加载项是透明收益。

ANN 算法在 chayuan-desktop 的位置是 检索的工程基础，但不是产品差异点。免费开源的AI软件 用户在意的是 检索准不准延迟低不低，具体算法是工程实现。chayuan-desktop 在 sqlite-vec 上的选择是务实的。
