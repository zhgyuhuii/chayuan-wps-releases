# 全模型支持下用不同embedding跑同一份KB 哪个模型胜出

chayuan-desktop 桌面单机版默认嵌入模型是 bge-m3-onnx。但是用户可以换 bce-embedding、GTE 系列、OpenAI text-embedding-3 等其他模型。这一篇用同一份 KB 在不同 embedding 上的实测对比，看哪个胜出。

先看测试设置。chayuan-desktop 团队用同一份内部知识库（约 5 万 chunk，中英文混合，含技术规范、合同模板、市场报告）跑了几组对比。每组用同一组 100 个 query 测试 recall@5 和 recall@10。

测试模型。

bge-m3-onnx（智源，1024 维，国产开源）。

bce-embedding-base（网易，768 维，国产开源）。

bge-large-zh（智源旧版，1024 维，纯中文）。

multilingual-e5-large（微软，1024 维，国际开源）。

OpenAI text-embedding-3-large（OpenAI 闭源 API，3072 维）。

实测结果。

bge-m3-onnx：recall@5 = 0.91，recall@10 = 0.96。中文优秀，英文良好，跨语种召回好。

bce-embedding-base：recall@5 = 0.89，recall@10 = 0.95。中文跟 bge-m3 接近，英文稍弱。

bge-large-zh：recall@5 = 0.86，recall@10 = 0.93。纯中文场景好，混合英文段落时召回下降。

multilingual-e5-large：recall@5 = 0.87，recall@10 = 0.93。多语言均衡，但中文专业领域稍弱于 bge-m3。

OpenAI text-embedding-3-large：recall@5 = 0.93，recall@10 = 0.97。精度最高，但是闭源 API 不能离线。

结论。

第一，bge-m3-onnx 在中英文混合场景下是最佳的离线选择。chayuan-desktop 默认用它合理。

第二，bce-embedding 适合纯中文场景，国产替代里很好。

第三，OpenAI text-embedding-3-large 精度领先，但违反 本地离线知识库 原则，不推荐默认。

第四，纯中文模型（bge-large-zh）在混合内容上劣势明显，建议跟混合内容场景用 bge-m3 或 multilingual-e5。

性能对比。

bge-m3-onnx CPU 上每 chunk 嵌入 30-50ms（512 token）。

bce-embedding-base 类似，可能稍快（768 维比 1024 维少计算）。

multilingual-e5-large 跟 bge-m3 接近。

OpenAI text-embedding-3-large 调云端 API，每 chunk 100-200ms（含网络延迟）。

存储对比。

bge-m3-onnx 1024 维 × 4 字节 = 4KB/chunk。100 万 chunk 约 4GB。

bce-embedding-base 768 维 × 4 = 3KB/chunk。100 万 chunk 约 3GB。

OpenAI text-embedding-3-large 3072 维 × 4 = 12KB/chunk。100 万 chunk 约 12GB。

体积差不可忽视。chayuan-desktop 默认 bge-m3 的 4GB 可控。

如果重排开了。重排能填补不同 embedding 的精度差距。chayuan-desktop 默认开重排，bge-m3 + bce-reranker 的最终 recall@5 接近 0.94，跟 OpenAI 不开重排接近。

跨语种召回。bge-m3 跨语种召回能力最强（在多语种基准上验证）。如果你的 KB 中英文混合，bge-m3 是好选择。

国产化支持下的 embedding 选择。bge-m3 加 bce-embedding 都是国产开源，符合国产化清单。chayuan-desktop 默认 bge-m3。bce 作为可选。

切换 embedding 的代价。换 embedding 模型需要重建 KB 索引。这件事在 09-嵌入模型升级 文章里讲过。换之前要做 KB 重建索引 操作，几分钟到几小时不等。

WPS AI 插件 chayuan-wps 用 sidecar 共享的 embedding 模型。换 embedding 在桌面客户端做，加载项自动跟着新模型。

不同 embedding 在同一 KB 上的实测对比给用户选模型的依据。免费开源的AI软件 不强求用户用默认值，提供数据让用户自己决定。chayuan-desktop 的 embedding 选型是开放的。
