# 向量检索的score归一化 跨库结果可比

chayuan-desktop 桌面单机版的多 KB 并联检索经常涉及不同向量库。每家库的 score 尺度不同，跨库结果直接比较没意义。chayuan-desktop 需要做归一化。这一篇讲。

先看不同库的 score 差异。

cosine distance。范围 0-2（正常情况下 0-1，反向向量到 2）。距离越小越相似。Milvus、Chroma、Qdrant、sqlite-vec 默认 cosine。

L2 distance。范围 0-无限。距离越小越相似。但实际上向量经归一化后 L2 跟 cosine 等价。

dot product。范围 -1 到 1（归一化向量）。值越大越相似。某些库默认。

不同库的 score 表达方式。

Milvus 返回 distance 字段。低值=高相似。

Chroma 返回 distances 数组。低值=高相似。

Qdrant 返回 score 字段。值越大越相似（dot product 时）或越小越相似（cosine 时）。

ES 8 kNN 返回 _score。0-1 范围，1=最相似。

sqlite-vec 用 distance 函数。低值=高相似。

直接拿这些不同 score 比较是错的。同一个 query，Milvus 命中 0.3 distance，ES 命中 0.7 _score，谁更相关？没法直接比。

chayuan-desktop 的归一化策略。

策略一：每库内部归一。chayuan-desktop 拿到每个 KB 的 top-K 命中后，把每个命中的 raw score 转换为 0-1 范围的 normalized score。归一公式按库类型不同。

cosine distance 库（Milvus 等）：normalized = 1 - (distance / 2)。distance 0 → score 1，distance 2 → score 0。

dot product 库：normalized = (raw + 1) / 2。raw -1 → score 0，raw 1 → score 1。

ES _score 0-1：normalized = _score（已经是合适范围）。

L2 距离：用 max-min normalization 在批次内归一化。

这套归一化让每个库内部 score 都在 0-1 范围且语义一致：1 = 最相似，0 = 最不相似。

策略二：跨库聚合。chayuan-desktop 把多个 KB 的归一化 score 收齐，按 score 排序聚合。这种 跨库排序 让回答里引用的优先级合理。

策略三：可信度展示。前端把归一化 score 转成 5 颗星或百分比（前面信任度文章讲过）。用户看到的是统一表达。

策略四：重排消除差异。如果 KB 开了重排（chayuan-desktop 默认开），重排模型给所有候选 chunk 重新打分。重排 score 跟 raw score 完全独立，所以重排相当于把不同来源的 score 重置到同一尺度。这是消除 score 差异的最有效手段。

实战例子。一次问答涉及三个 KB。

doc:技术规范（sqlite-vec）。命中 5 个 chunk，distance 范围 0.15-0.45。归一化 score 0.78-0.93。

src:milvus_finance（Milvus）。命中 5 个 chunk，distance 范围 0.20-0.50。归一化 score 0.75-0.90。

src:es_logs（ES）。命中 5 个 chunk，_score 0.60-0.95。归一化 score 0.60-0.95。

聚合排序后前 10 个 chunk 跨三个 KB 混合。每个 chunk 的 score 都在 0-1，可比较。

如果开了重排。重排模型对所有 15 个候选 chunk 重新打分（基于 query 跟 chunk 的 cross-encoder 计算），生成新 score。这个新 score 跟原向量 score 无关，反映 query-chunk 的真实语义关联。

加权策略。chayuan-desktop 让用户给 KB 设置权重。某个 KB 重要度高，权重 1.5；某个普通，权重 1.0。最终 score = normalized_score × weight。这种加权让用户能影响排序。

跨 score 类型的混合（向量 + BM25）。如果 ES KB 用了 hybrid search（BM25 + 向量），ES 内部已经做了 fusion。chayuan-desktop 拿到的 _score 是 fused 后的，直接归一即可。

国产化支持下的 score 归一化。RT、Relyt 等国产向量库的 score 表达方式不同，chayuan-desktop 的 adapter 内部做归一化。用户体验一致。

WPS AI 插件 chayuan-wps 在 WPS 里展示引用气泡时按归一化 score 排序。用户感知 跨 KB 一致。

向量 score 归一化是 chayuan-desktop 多源 RAG 的细节工作。免费开源的AI软件 想让 多源结果跨库可比，归一化是工程关键。chayuan-desktop 在这一面的统一处理让用户不用懂背后的复杂性。
