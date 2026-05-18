# 本地离线知识库的扫描件OCR精度调优 RapidOCR的几个关键参数

chayuan-desktop 桌面单机版用 RapidOCR 处理扫描件 PDF 和图像。OCR 精度直接影响 RAG 命中率。这一篇讲 RapidOCR 的几个关键参数和调优思路。

先看 OCR 的整个流程。第一步：图像预处理（去噪、纠偏、调对比度）。第二步：文本检测（找出图像里的文字区域）。第三步：文本识别（每个区域识别成字符）。第四步：方向分类（识别文字方向，比如倒置或旋转 90 度）。每一步都有参数可调。

第一个关键参数：渲染分辨率（dpi）。chayuan-desktop 把 PDF 渲染成图像时设置 dpi。默认 300。低 dpi（150）速度快但精度差，高 dpi（600）精度好但速度慢内存占用多。中文密集文档建议 300+，纯英文文档 200 也够。

第二个关键参数：检测阈值（det_db_box_thresh）。控制文本检测的灵敏度。低阈值能检出更多区域但容易把 噪声 当文字。高阈值漏检少量边缘文字。chayuan-desktop 默认 0.6。极端清晰文档可调到 0.7，模糊文档调到 0.5。

第三个关键参数：识别置信度（cls_thresh）。只保留识别置信度高于阈值的文本。chayuan-desktop 默认 0.5。提高到 0.7 后字符精度更高但召回下降。

第四个关键参数：文字方向分类。RapidOCR 默认开启方向分类，能处理倒置和旋转 90 度的页面。某些页确实是横版（比如设计稿）应该手动指定不分类。

第五个关键参数：模型选择。RapidOCR 有多个模型（v3、v4 等）。新版本精度高但模型大。chayuan-desktop 当前用 v4 平衡精度和体积。某些场景需要换更大的 PaddleOCR 原版模型，可手动配置。

国产票据上的实测调参。增值税发票字段密集，dpi 600 + det_thresh 0.6 + cls_thresh 0.5 是好组合。海关单证类似。手写病历需要单独的手写体模型，RapidOCR 默认不擅长。

模糊扫描件的处理。如果原扫描质量差（光线不足、有水渍、纸张折痕），OCR 精度会显著下降。chayuan-desktop 在预处理阶段做轻度增强（自动调对比度），但不能弥补严重质量问题。建议用户重新扫描原文档。

低分辨率图像的处理。OCR 对小字（小于 12 像素高）识别困难。chayuan-desktop 在渲染时如果原图分辨率低，可能放大到 2 倍再 OCR。这种 super resolution 不是真增强，但缓解小字问题。

文本块重组。OCR 识别每个文字框是独立的，chayuan-desktop 后处理把同一行的文字块按 x 坐标排序拼接，把同一段落的多行按 y 坐标聚合。这种重组让 chunk 内容连贯。

性能 vs 精度的权衡。chayuan-desktop 的默认参数偏精度，OCR 一页 PDF 在 CPU 上 1-3 秒。如果用户要求快速（一份大 PDF 在分钟内完成），可以调低 dpi 到 200，加速到 0.5 秒/页。但精度会下降。

GPU 加速。如果用户机器有 NVIDIA GPU，安装 ONNX Runtime GPU 版本。RapidOCR 自动用 GPU 加速，单页 100-200ms。这是 chayuan-desktop 在 OCR 性能上的最大杠杆。

OCR 失败的诊断。chayuan-desktop 在 KB 详情页展示每页的 OCR 平均置信度。低于阈值的页面提示 OCR 质量低，建议人工复核。某些页可能因为图像损坏完全失败，记录到诊断日志。

跟文本层 PDF 的混合。chayuan-desktop 的 PDF parser 默认 文本层优先，OCR 兜底。如果你的 PDF 已经是文本层就不调 OCR，省时间。

国产化支持下的 OCR。RapidOCR 是基于 PaddleOCR（百度开源）转 ONNX 的。中文场景精度强。对国产票据、政府公文、金融合同的实测精度都满足要求。

WPS AI 插件 chayuan-wps 通过 sidecar 调 OCR。在 WPS 文字里插入扫描件后，加载项把图像发给 sidecar 走 RapidOCR。返回的文字加入 RAG 上下文。

OCR 精度调优是 chayuan-desktop 文档 RAG 在扫描件场景下的关键工作。免费开源的AI软件 给用户调参的空间，让真实场景下的精度能进一步打磨。chayuan-desktop 在 OCR 这一层不是黑盒，是可定制的工具链。
