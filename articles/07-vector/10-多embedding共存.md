# 全模型支持下不同embedding维度怎么共存

chayuan-desktop 桌面单机版的多 KB 可能用不同 embedding 模型。doc:* 默认 bge-m3（1024 维），src:milvus_finance 可能用 bce-embedding（768 维），src:qdrant_products 可能用 OpenAI text-embedding-3-large（3072 维）。这种异构怎么共存？这一篇讲清楚。

先看为什么会异构。

异构原因一：历史。某个 collection 早期用 bge-large（1024 维）建的，后来又有新 collection 用 bge-m3。两边维度都 1024 但模型不同。

异构原因二：业务需要。产品向量化用专门的产品模型，文档用通用模型。两边维度可能不同。

异构原因三：成本。某些场景为节省存储用低维模型（768 维），其他场景追求精度用高维（3072 维）。

异构带来的问题。

问题一：query 向量怎么算。同一个 query 要查多个 KB，每个 KB 用不同 embedding。chayuan-desktop 必须给每个 KB 用对应模型给 query 算向量。

问题二：score 怎么比较。不同 embedding 的距离尺度不一样。跨 KB 的 score 比较需要归一化。

问题三：存储维度。在同一个数据库里存多种维度向量是否可行（特别是 sqlite-vec 一个 KB 一种维度）。

chayuan-desktop 的处理。

处理一：每个 KB 独立 embedding 配置。KB 元数据里记录 embedding_model_name 字段。每个 KB 知道自己用什么模型。

处理二：query 时分别算嵌入。一次问答涉及多个 KB 时，chayuan-desktop 给每个 KB 用对应 embedding 模型生成 query 向量。比如 query 文本是 关于压力测试的内容，bge-m3 算一份 1024 维向量给 doc:技术规范，bce-embedding 算一份 768 维向量给 src:milvus_finance。两份向量并发生成，毫秒级。

处理三：score 归一化。每个 KB 内部 score 按自身分布归一到 0-1，跨 KB 比较时基于归一化后的值。

处理四：sqlite-vec 一文件一维度。chayuan-desktop 不在同一 sqlite-vec 文件里混合多维度向量。每个 KB 独立 sqlite-vec 文件，文件内部维度统一。

处理五：外部库灵活。Milvus、Qdrant 在不同 collection 里可以有不同维度。chayuan-desktop 接入时按 KB 配置走。

embedding 模型的可用性检查。chayuan-desktop 启动时检查每个 KB 配的 embedding 模型是否可用（本地权重存在或外部 API 配好）。如果某个 KB 的 embedding 模型不可用，KB 标记 unavailable，前端展示警告。

跨 embedding 的回链一致性。引用气泡按 KB 类型展示，不展示 embedding 模型。用户感知不到背后用的什么模型。

embedding 模型升级的影响。如果某个 KB 升级 embedding 模型（比如从 bge-m3 升 bge-m4），需要重建索引（向量空间变了）。这种升级是 KB 级别的，不影响其他 KB。

embedding 性能的差异。

bge-m3-onnx CPU 上 30-50ms/chunk。

bce-embedding-base 类似。

GTE-large CPU 上 50-80ms/chunk。

OpenAI text-embedding-3-large 调云端 100-200ms/chunk。

异构 embedding 的 query 阶段。chayuan-desktop 用 asyncio 并发给所有 KB 算 query 向量。整体延迟接近 max（最慢那个），不累加。如果四个 KB 用四种 embedding，query 嵌入阶段大约 200-300ms。

存储成本的差异。1024 维 vs 3072 维存储差 3 倍。100 万 chunk 4GB 还是 12GB 区别大。chayuan-desktop 不强求维度统一，但建议按数据规模选合适维度。

国产化支持下的 embedding 异构。bge-m3 加 bce-embedding 是国产代表组合。chayuan-desktop 默认推荐这两家。在国产化场景下混用没问题。

实际场景。chayuan-desktop 团队的内部 KB 配置。

doc:* 文档库：默认 bge-m3-onnx 1024 维。本地推理。

src:milvus_corporate：bge-large-zh 1024 维。专门中文优化。

src:qdrant_products：OpenAI text-embedding-3-small 1536 维。云端。

src:pgvector_logs：bce-embedding-base 768 维。本地。

四种异构 KB 共存，混选检索时 chayuan-desktop 自动处理 embedding 差异。用户感觉一致。

WPS AI 插件 chayuan-wps 透明用异构 embedding。

异构 embedding 共存是 chayuan-desktop 多源能力的高级形态。免费开源的AI软件 给用户的灵活度，让不同业务用不同 embedding 成为可能。chayuan-desktop 的统一抽象让这种灵活度不增加用户认知负担。
