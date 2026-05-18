# 本地 OCR 不依赖云 RapidOCR 的部署

chayuan-desktop 桌面单机版的本地 OCR 默认 RapidOCR。完全离线。这一篇讲。

## 为什么用 RapidOCR

OCR（光学字符识别）把图像/扫描件里的文字提取出来。chayuan-desktop 在用户上传扫描 PDF 或图片到 KB 时跑 OCR。

云 OCR（阿里云、腾讯云、百度 OCR）需要联网。chayuan-desktop 单机版要离线。

RapidOCR 是基于 PaddleOCR 的轻量化封装。开源、国产、跨平台。

## RapidOCR 的特点

特点一：基于 PaddleOCR。百度开源的中文 OCR 老品牌，效果好。

特点二：ONNX Runtime 推理。无需 PaddlePaddle 巨大依赖。

特点三：Python / C++ / JS 多语言绑定。

特点四：模型小。3 个模型（检测 + 方向分类 + 识别）总 50MB。轻巧。

特点五：中文识别强。中文场景比 Tesseract 强很多。

## 安装

chayuan-desktop 内置打包 RapidOCR + 模型权重。开箱可用。

用户无需另外安装 PaddleOCR、Tesseract 之类的。chayuan-desktop 解压时把 OCR 模型放 ~/.chayuan/models/rapidocr/。

启动后 chayuan-desktop 验证模型完整性。损坏时从镜像源补下。

## 调用流程

用户上传图片或扫描 PDF。

第一步。chayuan-desktop 检测文件类型。PDF 看是否文字层（可选）。

第二步。如果是扫描件（无文字层）或纯图像。调 RapidOCR。

第三步。RapidOCR 跑 检测 → 方向分类 → 识别 三阶段。

第四步。返回带坐标的文字。chayuan-desktop 拼成段落保存到 KB。

## 性能

主流 CPU（Intel i5/i7）单页 A4 纸 OCR 约 2-4 秒。

GPU 加速（CUDA / DirectML）单页 0.3-1 秒。

100 页扫描 PDF 走 CPU 约 5 分钟。能接受。

## 中文识别质量

RapidOCR 在中文文档（合同、报告、扫描件）上准确率 95%+ 是常见水平。

手写识别相对差（70-85%）。chayuan-desktop 提示用户 手写内容识别准确率有限。

竖排古籍、繁体、特殊字体等小众场景识别质量降低。chayuan-desktop 不专门优化这些。

## 表格识别

RapidOCR 本身只识别字符，不识别表格结构。chayuan-desktop 用 Camelot 或 pdfplumber 处理 PDF 表格。扫描表格走另一个组件（基于 PaddleOCR 的表格结构识别模型）。

## 公式识别

化学公式、数学公式 OCR。chayuan-desktop 集成 LaTeX-OCR 模型（也是 ONNX）。识别后保存为 LaTeX 字符串到 KB。

启用是可选模块（增加约 200MB 依赖）。默认不开。

## 多语言识别

RapidOCR 默认中英文混合。

其他语言（日韩、阿拉伯、俄语等）需要换其他模型。chayuan-desktop 模型仓库提供多语言模型包。用户按需下载。

## OCR 结果的存储

OCR 出的文字直接进 chunk。每个 chunk 标 source=ocr。

chunk metadata 含原图像路径、页码、OCR 置信度。引用气泡能跳回原图。

低置信度 chunk（< 0.7）chayuan-desktop 标记 OCR 质量不确定 警告。LLM 答题时如果命中低置信度内容，回答里加 "（OCR 识别可能有误）" 提示。

## 错误识别的修正

用户在 KB 详情页看 OCR 出的 chunk 时能 编辑修正。修正后 chayuan-desktop 重新嵌入。

也支持 一键替换 OCR 错误词，用本地 LLM 帮助纠错（基于上下文）。

## 国产化场景

党政军单位的纸质档案数字化场景。扫描件入库要 OCR。chayuan-desktop 的 RapidOCR 国产开源、中文好、离线，完美适配。

某些场景文档涉密不能上云。chayuan-desktop 的本地 OCR 是合规必选。

## chayuan-server 的对应

chayuan-server 模式下 OCR 在服务器跑，多用户共享。chayuan-desktop 单机各自跑。

## WPS 加载项

chayuan-wps 在 WPS 里如果用户拖入扫描件文档，chayuan-wps 调 chayuan-desktop OCR 处理后入库。WPS 用户感知就是 拖个扫描件就能问问题。

## 总结

本地 OCR 不依赖云是 chayuan-desktop 在离线场景的核心能力。免费开源的AI软件 不让 OCR 这个基础功能强迫用户上云。chayuan-desktop 选 RapidOCR 让 国产开源 + 中文好 + 完全离线 三者兼顾。
