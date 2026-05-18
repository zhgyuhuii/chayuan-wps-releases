# 全模型支持下的嵌入选型 bce-embedding的现实表现

chayuan-desktop 桌面单机版除了默认 bge-m3，也支持 bce-embedding 作为可选嵌入。这一篇讲 bce 的特征。

bce-embedding 是网易于 2024 年开源的嵌入模型。768 维。基于 BGE 衍生，针对中文做了进一步优化。开源 Apache 协议。商业友好。

跟 bge-m3 对比。

中文场景。两家接近。bce 略偏向行业术语（金融、法律等）。bge-m3 通用性强。

英文场景。bge-m3 优于 bce。bce 主要面向中文。

跨语种检索。bge-m3 的多语种能力强。bce 主要中英双语。

体积。bce 模型约 400MB，比 bge-m3 略小。

实测精度。chayuan-desktop 在自家 KB 评估集。

bge-m3：recall@5 0.91。

bce-embedding：recall@5 0.89。

差距 2-3 个百分点。bge-m3 略好但 bce 也够用。

什么场景选 bce-embedding。

场景一：纯中文 KB。文档全是中文，bce 跟 bge-m3 差距小但 bce 体积更小。

场景二：行业专业领域。金融、法律领域 bce 训练数据可能有专门优化。

场景三：偏好国产模型。bce 来自网易，国产开源。

什么场景选 bge-m3。

场景一：中英文混合。bge-m3 跨语种能力强。

场景二：偏好通用模型。bge-m3 在多语种和多领域上更稳定。

场景三：默认。chayuan-desktop 默认 bge-m3，不需要主动切换。

切换。chayuan-desktop 让用户在 KB 创建或重建索引时选嵌入模型。换之后需要重建（向量空间不同）。

WPS AI 插件 chayuan-wps 透明用任意嵌入模型。

bce-embedding 是 chayuan-desktop 的可选嵌入。免费开源的AI软件 给用户多种选择不强制。chayuan-desktop 的多模型支持让用户能按场景选最合适的。
