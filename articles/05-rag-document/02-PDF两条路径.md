# 本地离线知识库的PDF解析 两条路与OCR兜底切换

PDF 是办公场景里最常见的文档格式，也是解析最复杂的格式之一。chayuan-desktop 桌面单机版用 PyMuPDF 加 RapidOCR 双轨处理。这一篇专门讲 PDF 解析的细节。

先看 PDF 的两类。文本层 PDF：内容是真实可选可拷的文字，PyMuPDF 直接抽。扫描 PDF：内容是图像，PyMuPDF 抽不到文字，需要 OCR。

混合 PDF 也常见。某些 PDF 一部分页是文本层（电子合同的正文），一部分页是扫描（盖章页或附件扫描件）。chayuan-desktop 按页判断走哪条路。

文本层判定逻辑。PyMuPDF 抽出该页的文本字符数 vs 该页面积的预期字符密度。比例够高判定为有效文本层。比例低判定为 文本层缺失，走 OCR。具体阈值可调，默认情况下能正确判定大多数 PDF。

OCR 兜底的具体过程。判定 文本层缺失 后，chayuan-desktop 把该页用 PyMuPDF 渲染成 image（默认 300 DPI），调 RapidOCR 识别。识别结果是若干文本块带坐标，chayuan-desktop 按坐标位置组织成段落。

性能差异。文本层抽取一页几毫秒。OCR 一页 1-3 秒（CPU 上 RapidOCR）。一份 100 页全 OCR 的 PDF 需要 2-5 分钟。这个差距决定了 文本层 PDF 入库快得多。

文本层质量的常见问题。

问题一：文本顺序错乱。某些 PDF 的文本对象顺序不是阅读顺序（设计师排版乱）。PyMuPDF 抽出来的文字按对象顺序，可能跟阅读顺序不一致。chayuan-desktop 按坐标重排（top-down，left-right），大多数情况修复。

问题二：表格被打散。PDF 表格在文本层是一堆位置散落的 cell 文字。chayuan-desktop 当前不专门重建表格结构，表格在 chunk 里看起来是散落的字段。如果你的 PDF 表格很重要，建议另存为 Excel 单独建结构化 KB。

问题三：双栏排版。学术论文常见。PyMuPDF 默认按对象顺序抽，可能把左栏第一段和右栏第一段交替输出。chayuan-desktop 用 sort=True 参数让 PyMuPDF 按 top-down 排序，但仍可能有边界场景。

问题四：标题层级丢失。PDF 没有显式的标题层级，只有字号差异。chayuan-desktop 按字号阈值识别 标题段，给 chunk metadata 加 heading 字段。

OCR 路径的常见问题。

问题一：OCR 精度。RapidOCR 在中文清晰扫描件上 95%+ 精度，但模糊或低分辨率扫描件下降到 80% 左右。chayuan-desktop 的诊断会展示每页 OCR 的平均置信度，低于阈值的提示用户 OCR 质量低。

问题二：印章识别。盖章在扫描件上是常见元素。RapidOCR 对印章里的文字识别精度有限（通常 70%）。chayuan-desktop 在 chunk metadata 里标记 含印章 让用户知道。

问题三：手写体。扫描件里的签名或者手写注释 RapidOCR 识别精度差。chayuan-desktop 当前不强化手写处理，识别的就识别，识别不了的跳过。

第三种特殊 PDF：受保护 PDF。

加密 PDF。需要密码才能打开。chayuan-desktop 检测到加密 PDF 提示用户输密码。输对的话正常解析。

数字签名 PDF。PDF 上有数字签名验证。chayuan-desktop 不验证签名，把签名作为 metadata 记录。

权限受限 PDF。某些 PDF 设了 不允许复制内容 权限。PyMuPDF 默认尊重这些权限，抽不出文本。chayuan-desktop 的 ignore_permissions 选项让 PyMuPDF 强制抽取，但这违反原始 PDF 的意图，建议用户慎用。

引用回链。每个 chunk 的 metadata 里有 page_number、bbox（文本块坐标）、offset。点击引用气泡时前端能精确跳到原 PDF 的指定页指定位置。这是 chayuan-desktop 文档 RAG 的核心体验。

性能优化。chayuan-desktop 在解析大 PDF 时按页并发处理（CPU 多核利用），整体速度比串行快几倍。OCR 也是多页并发但受 ONNX Runtime 单卡限制。

国产化支持下的 PDF 处理。中文公文常用 仿宋 黑体 等字体，PyMuPDF 都正常处理。盖章扫描件走 RapidOCR 兜底。某些政府发的 红头文件 PDF 在表格、印章、签字这些方面比一般文档复杂，chayuan-desktop 的处理流程能覆盖大部分。

WPS AI 插件 chayuan-wps 在 WPS 里可以直接处理 PDF，加载项把 PDF 路径发给 sidecar，走同一套解析。引用气泡能跳到原 PDF 页。

PDF 解析双轨是 chayuan-desktop 文档 RAG 的基础。免费开源的AI软件 想真的覆盖中国办公场景，PDF 这一关必须做透。chayuan-desktop 在 PyMuPDF 加 RapidOCR 这套组合上的工程化，让它能扛住实际场景的复杂性。
