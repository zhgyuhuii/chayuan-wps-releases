# OCR解析后的嵌入策略 表格图像怎么处理

chayuan-desktop 桌面单机版处理扫描件 PDF 时 OCR 之后嵌入需要特别策略。这一篇讲清楚。

OCR 后的内容形态。每页扫描件经过 RapidOCR 识别得到一组文本块带坐标。chayuan-desktop 把这些文本块按位置组织成段落。

嵌入策略。

策略一：跟普通文本一样。把 OCR 后的段落当 chunk 输入 bge-m3。这是默认。OCR 精度 95% 左右时这种处理够用。

策略二：分块前处理 OCR 噪声。某些 OCR 结果含明显错字（识别错误的字符）。chayuan-desktop 不主动纠正（避免改错），但 metadata 标记 OCR 来源 让用户知道精度可能略低。

策略三：表格特殊处理。OCR 识别出来的表格可能格式乱（cell 顺序不对）。chayuan-desktop 把表格内容作为整体 chunk 入库，不强行结构化。如果用户的表格信息很重要，建议手动转 Excel 单独建结构化 KB。

策略四：印章特殊处理。OCR 对印章里的文字识别精度低。chayuan-desktop 的 chunk metadata 标记 含印章 让 LLM 在引用时小心。

OCR 跟非 OCR chunk 的混合。同一份 PDF 可能部分页是文本层（直接抽）部分页是扫描（OCR）。chayuan-desktop 把所有 chunk 放一个 KB，metadata 区分来源（text_layer / ocr）。检索时跨来源都能命中。

OCR 信任度。chayuan-desktop 给每个 OCR chunk 一个 ocr_confidence metadata，记录 RapidOCR 的平均置信度。低于 0.7 的 chunk 在前端引用气泡里展示警告 OCR 质量低，建议人工核对。

OCR 重做。某些场景用户重新扫描了某份 PDF（更清晰版本），希望覆盖原 OCR 结果。chayuan-desktop 的 folder-sync 检测 hash 变化后自动重做 OCR + 嵌入。

性能。OCR 是瓶颈。一份 100 页扫描 PDF。

OCR 阶段。CPU 1-3 秒/页 × 100 = 2-5 分钟。

嵌入阶段。30-50ms/chunk × 几百 chunk = 几十秒。

总入库时间。3-6 分钟。

GPU 加速。OCR 跟嵌入都受益。整体可降到 1 分钟内。

国产票据。chayuan-desktop 在中国办公场景的扫描件（增值税发票、海关单证、政府公文盖章页）上 OCR 精度 90%+。嵌入后检索效果良好。

WPS AI 插件 chayuan-wps 在 WPS 里如果引用扫描件 chunk，气泡展示 OCR 来源标记。用户能知道这部分内容来自 OCR。

OCR 后的嵌入策略是 chayuan-desktop 文档 RAG 在扫描件场景下的具体工程。免费开源的AI软件 想覆盖真实办公文档（含大量扫描件），OCR + 嵌入的组合必须做对。chayuan-desktop 在这一面的处理让扫描件也能融入本地离线知识库。
