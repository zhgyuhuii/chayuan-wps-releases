# 本地离线知识库的OCR选RapidOCR-ONNX 国产票据上的真实指标

chayuan-desktop 桌面单机版的内嵌 OCR 是 RapidOCR 的 ONNX 版本。OCR 这件事看起来普通，但在中文办公场景里精度差异巨大。这一篇讲 chayuan-desktop 选 RapidOCR-ONNX 的理由，以及它在国产票据上的实际表现。

先看 OCR 的几个候选。Tesseract 是开源 OCR 老牌，但中文精度一般。PaddleOCR 是百度开源的，中文精度高，但依赖 PaddlePaddle 框架。RapidOCR 把 PaddleOCR 的模型转成 ONNX，跟 PaddlePaddle 解耦，依赖小。EasyOCR、ocrmypdf 等也是候选。

为什么不选 PaddleOCR。PaddlePaddle 框架体积大（几百兆），跟 chayuan-desktop 的 PyInstaller 打包冲突严重。RapidOCR 用 ONNX Runtime，体积小（几十兆），打包友好。这是单机版优先级最高的考虑。

为什么不选 Tesseract。Tesseract 在中文精度上跟 PaddleOCR 系列差距明显。中文公文、票据、发票的 OCR 用 Tesseract 经常出错，特别是手写体和印刷小字。chayuan-desktop 直接放弃。

RapidOCR 的几个版本。RapidOCR 有多个模型版本（v1、v2、v3、v4），精度逐代提升。chayuan-desktop 用最新稳定版。模型权重总大小约 100MB（检测模型 + 识别模型 + 方向分类模型），可控。

国产票据上的实测。chayuan-desktop 团队收集了一组国产场景测试集：增值税发票、海关单证、行政公文（红头文件）、合同扫描件、银行流水、医院检查单。对每种文档跑 RapidOCR 评估识别精度。

测试结果分类。增值税发票字段识别准确率 95%+（关键字段如金额、税号、发票号），整体文本识别 90%+。海关单证类似，关键字段精度 92%+。红头文件（标题、正文、印章）正文 95%+，印章识别相对弱（70-80%）。合同扫描件正文 92%+，签字章识别弱。银行流水（表格密集）90%+。医院检查单（专业术语多）85%+。

精度的边界。RapidOCR 对印刷体识别强，对手写体识别弱（手写中文准确率 60-70%）。对清晰扫描件好，对低分辨率或拍照倾斜文档弱。这些边界对真实办公场景大多够用，但极端场景需要专门处理。

加速优化。RapidOCR-ONNX 在 ONNX Runtime 下跑 CPU 推理。一张 A4 PDF 页面识别耗时约 1-3 秒（取决于文字密度）。批处理多页时整体吞吐量大约每分钟 30-60 页。这个速度对 chayuan-desktop 的 RAG 入库场景（用户拖一份 PDF 过来等几分钟）合适。

GPU 加速。如果用户机器有 NVIDIA GPU，可以装 ONNX Runtime GPU 版本，OCR 速度快 5-10 倍。chayuan-desktop 默认装 CPU 版（覆盖广），GPU 是可选升级。

跟 PyMuPDF 的协作。PDF 解析时 PyMuPDF 先尝试提取文本层。文本层缺失或不完整（少于阈值）的页面走 RapidOCR。这种 双轨 减少 OCR 调用次数，文本层完整的 PDF 不浪费 OCR 计算。

OCR 结果的回填。RapidOCR 识别每个文本块的文字 + 坐标。chayuan-desktop 把这些文本块按位置组织成 chunk，metadata 里带原图坐标，引用气泡能标注 这段文字来自图像的哪个位置。

OCR 失败的兜底。RapidOCR 识别失败（图片损坏、内容空）时，chayuan-desktop 跳过这一页，记录到诊断日志。用户在 KB 详情页看到 X 页未成功识别 的提示，可以选择手动处理或忽略。

国产化支持下的 RapidOCR。RapidOCR 本身国产开源（基于 PaddleOCR 转 ONNX）。在政企客户的信创清单里加分。

WPS AI 插件 chayuan-wps 的 OCR 调用通过 sidecar，加载项把图像上传，sidecar 跑 RapidOCR。在 WPS 里插入扫描件 PDF 时同样能 RAG 检索文字。

RapidOCR 在 chayuan-desktop 的位置是 默认本地 OCR，覆盖中文办公场景的大部分需求。免费开源的AI软件 想做出 真本地 的体验，OCR 这一关必须自带，否则扫描件场景就只能联网。chayuan-desktop 把 OCR 塞进发行包，让 完全离线 这件事真的成立。
