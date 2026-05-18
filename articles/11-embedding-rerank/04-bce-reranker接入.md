# 重排模型bce-reranker的接入

chayuan-desktop 桌面单机版默认重排模型是 bce-reranker。这一篇简要讲接入。

bce-reranker 是网易开源的中文重排模型。基于 cross-encoder 架构。约 300MB ONNX 权重。商业友好。

接入方式。

chayuan-desktop 默认下载 bce-reranker-base 到 CHAYUAN_ROOT/models/reranker/bce/。首启动下载约 1-2 分钟。

无需用户配置。chayuan-desktop 启动时自动加载，KB 创建时默认开启重排。

性能。

每个 chunk 重排约 30-50ms（CPU 上）。

GPU 加速 5-10 倍（约 5-10ms）。

跟向量召回的协作。

第一阶。向量召回 top-30。

第二阶。重排 30 个候选 → 选 top-5。

最终给 LLM 5 个 chunk 作为上下文。

精度提升。前面 重排实测 文章讲过。recall@5 从 0.78 升到 0.91。

可关闭。在 KB 设置里有 enable_rerank 开关。关掉之后 KB 检索只走向量召回。延迟从 1-2 秒降到 200-400ms。

跟其他重排模型对比。

bce-reranker：中文优秀。

bge-reranker：智源出品，多语言。

Cohere reranker：云端 API，闭源。

chayuan-desktop 默认 bce 因为国产开源 + 中文好。

WPS AI 插件 chayuan-wps 透明用重排。

bce-reranker 是 chayuan-desktop 默认重排的合理选择。免费开源的AI软件 在重排这一面的国产开源依赖让国产化场景完整。
