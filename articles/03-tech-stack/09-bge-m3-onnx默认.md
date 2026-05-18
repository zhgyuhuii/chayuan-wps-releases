# 嵌入模型为什么默认bge-m3-onnx 性能 准确率与体积三看

chayuan-desktop 桌面单机版的本地嵌入模型默认是 bge-m3 的 ONNX 版本。这个选择不是随便挑的，是综合性能、准确率、体积、license 多个维度考虑的结果。这一篇讲清楚为什么是 bge-m3-onnx。

先看几个候选。bge-m3 是智源开源的多语言嵌入模型。bce-embedding 是网易开源的。GTE 系列是阿里开源的。multilingual-e5 是微软开源的。OpenAI 的 text-embedding-3 是闭源 API。chayuan-desktop 在选默认本地模型时把这几个都跑过测试。

bge-m3 的优势。多语言能力强（中英文都好），1024 维向量在常规 RAG 场景精度高，license 是 MIT 商业友好，社区活跃。具体测试数据：在 C-MTEB（中文嵌入评估）上排前列，在 MTEB（英文）上也排前列，长文本支持 8K context。这种 双语都行 的模型对中国市场尤其重要。

bce-embedding 也很好。在中文场景上跟 bge-m3 接近，但英文表现稍弱。如果用户场景纯中文，bce 是好选择。chayuan-desktop 把 bce 列为可选模型，用户可以在设置里切换。

GTE 系列在中文场景下表现优秀。但模型大小偏大，且 ONNX 转换不那么稳。当前 chayuan-desktop 没把 GTE 设为默认，但接入了。

multilingual-e5 多语言全面，但中文不如 bge-m3 精准。

OpenAI text-embedding-3 精度最高之一，但是闭源 API，需要联网，不符合 本地离线知识库 的初衷。

为什么选 ONNX 版本。bge-m3 的官方 PyTorch checkpoint 跑起来需要装 PyTorch，对单机版打包是巨大累赘（PyTorch 几个 G）。ONNX 是模型部署的开放格式，跨框架、跨语言、跨平台。bge-m3 有官方 ONNX 转换，chayuan-desktop 用 ONNX Runtime 跑，CPU 上性能良好，体积小。

ONNX Runtime 的好处。一是体积小，几十兆而不是 PyTorch 那种几个 G。二是 CPU 推理优化好，量化加速做得不错。三是跨平台，Windows/Linux/macOS 都有原生支持。四是 PyInstaller 打包友好。

具体的体积账。bge-m3-onnx 模型权重约 600MB（FP16），跟 PyTorch 版本接近。ONNX Runtime 库约 50MB。加起来约 650MB。如果走 PyTorch + safetensors 做 inference，PyTorch 库约 2-3GB，加权重约 4GB。差几倍。

性能账。在一台 i5 加 16G CPU 上，bge-m3-onnx 嵌入一段 512 token 文本约 30-50ms。批处理 32 段约 400-600ms。这种性能让 RAG 入库不至于太慢。如果换成 GPU（如有），性能再快几倍。

准确率账。在 chayuan-desktop 自己的 KB recall 评估集上，bge-m3-onnx 跟原 PyTorch 版本的差异在 1% 以内。ONNX 转换造成的精度损失可以忽略。

加载启动。bge-m3-onnx 首次加载耗时 1-2 秒（CPU 上），加载后驻留内存。chayuan-desktop sidecar 启动后预加载嵌入模型，避免首次嵌入的冷启动延迟。

国产化支持下的特别考虑。bge-m3 是智源（北京智源人工智能研究院）的产品，国产开源模型。这一点在政企客户的信创清单里加分。bce-embedding 是网易的产品，同样国产。chayuan-desktop 把这两家的模型都接入，作为国产嵌入的双保险。

跟外部嵌入模型的协作。如果用户配了 OpenAI 或厂商的嵌入服务，chayuan-desktop 也能用。但默认推荐本地 bge-m3-onnx，因为本地离线知识库 的精神是数据不出域，连嵌入计算也最好不出域。

升级与替换。chayuan-desktop 的嵌入模型支持热替换。换嵌入模型之前生成的 KB 索引需要重建，因为不同模型的向量维度和分布不同。chayuan-desktop 在用户切换嵌入模型时会提示 是否重建索引。

未来可能的更换。如果智源或其他社区发布更优的嵌入模型（精度高且体积小），chayuan-desktop 可能在某个版本里换默认值。但不会因为 跟新潮 而频繁换，每次换的代价是用户要重建索引。

bce-reranker 配合使用。bge-m3 做向量召回，bce-reranker 做二阶重排。这种 召回 + 重排 的两阶段策略让 RAG 命中精度大幅提升。chayuan-desktop 默认开启重排，用户可在设置里关闭。

WPS AI 插件 chayuan-wps 通过 sidecar 用同一个嵌入模型。在 WPS 里检索 KB 时，背后的嵌入计算跟桌面客户端走同一份 bge-m3-onnx。这种统一让两个产品的检索精度一致。

bge-m3-onnx 是 chayuan-desktop 在 性能 准确率 体积 license 国产化 五个维度综合的最佳选择。免费开源的AI软件 选默认嵌入模型这件事，每一项都要算账。
