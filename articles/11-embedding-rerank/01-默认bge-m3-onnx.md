# 本地离线知识库的嵌入默认 bge-m3-onnx为什么是它

chayuan-desktop 桌面单机版的本地嵌入模型默认是 bge-m3-onnx。这一篇简要回顾选型理由。

bge-m3 是智源（北京智源人工智能研究院）2024 年开源的多语言嵌入模型。1024 维向量，支持 100+ 种语言。MIT 协议商业友好。在 C-MTEB（中文嵌入评估）上排前列。

ONNX 格式。原始 PyTorch 模型转成 ONNX，跨框架跨语言跨平台。chayuan-desktop 用 ONNX Runtime 跑，CPU 推理速度好，体积小。

跟其他选项对比。

bce-embedding-base（网易）。中文优秀但英文稍弱。768 维。

bge-large-zh（智源旧版）。纯中文，混合语种弱。

multilingual-e5-large（微软）。多语言均衡，中文专业领域略弱。

OpenAI text-embedding-3-large。精度最高但闭源云端。

性能。CPU 上嵌入一段 512 token 文本约 30-50ms。批处理 32 段约 400-600ms。100 万 chunk 嵌入约 1-2 小时（CPU）。GPU 加速 5-10 倍。

体积。模型权重约 600MB。加 ONNX Runtime 约 50MB。chayuan-desktop 安装包不带权重，首启动下载到 CHAYUAN_ROOT/models。

精度。chayuan-desktop 内部 KB recall 评估。bge-m3 + bce-reranker：recall@5 约 0.91-0.93。优秀。

国产化属性。智源是国内研究机构，bge-m3 完全国产开源。在政企信创清单里加分。

替代选择。chayuan-desktop 让用户在 KB 设置里改默认嵌入模型。bce-embedding、GTE、自训练模型都支持。

WPS AI 插件 chayuan-wps 透明用 bge-m3。

bge-m3-onnx 是 chayuan-desktop 的 性能 体积 精度 国产 综合最佳选择。免费开源的AI软件 默认推荐这种 务实最优 让大多数用户开箱即用。
