# 本地离线知识库的PPT解析 演讲稿场景的策略

PPT (.pptx) 在办公场景里用得多但解析不那么常见。chayuan-desktop 桌面单机版用 python-pptx 解析 PPT。这一篇讲 PPT 解析的几个细节和应用场景。

先看 PPT 的内容形态。每张 slide 上有 text frame（文本框）、image（图片）、shape（形状）、chart（图表）、table（表格）、SmartArt（智能图形）。这些元素混合在一张幻灯片上。

chayuan-desktop 的 PPT parser。每张 slide 作为一个 Document 单位。slide 内的所有 text frame 文字按位置 top-down 排序拼接成 slide 内容。metadata 携带 slide_index、slide_title、slide_layout。

slide 标题识别。每张 slide 有一个 slide_title placeholder，python-pptx 能直接拿。chayuan-desktop 把这个标题作为 slide 的 metadata，方便检索时按 slide title 索引。

正文 text frame。每个 text frame 内的 paragraph 拼接。如果一张 slide 有多个 text frame（比如 标题 + 正文 + 备注），按位置组织。bullet 点用 - 标记保留层级。

图片处理。PPT 里嵌入的图片 chayuan-desktop 当前不做 OCR。某些图片包含重要文字（比如架构图里的标签），用户需要单独建图像 KB 处理。

图表（chart）处理。PPT 里的图表是数据可视化（柱状图、折线图等）。python-pptx 能拿到底层数据。chayuan-desktop 把图表数据作为 markdown 表格存到 chunk 里，附在 slide 内容后面。这样检索能命中 包含某个数字的图表。

表格（table）处理。pptx 的 table 跟 docx 的 table 类似。chayuan-desktop 转成 markdown 表格作为 slide 的一部分。

speaker notes（演讲备注）。slide 下方的备注文字 python-pptx 能抽。chayuan-desktop 把 notes 作为独立 Document 入库，metadata 标记 type=notes、attached_to=slide_index。这种处理让 演讲备注 也能被检索到。

应用场景。

场景一：演讲稿与培训资料。一份完整的培训 PPT 里既有 slide 内容也有 speaker notes。chayuan-desktop 把这些内容入库后，用户能问 关于压力测试的培训章节讲了什么 这种问题。

场景二：产品 deck。销售 PPT 通常包含产品定义、定价、案例、对比。建 doc:产品资料 KB 后，销售人员问 我们产品对比某竞品的优势 时能找到对应 slide 的内容。

场景三：会议记录 PPT。某些公司用 PPT 做会议记录。会议结论、行动项作为 slide 内容入库，后续 检索之前的决策 就方便。

场景四：教学课件。老师的 PPT 课件入库给学生查询。学生问 这门课关于 X 的内容是哪一节 时能定位 slide。

不适合的场景。

如果 PPT 主要是图片不是文字（设计稿、演示作品），文字内容少，RAG 价值低。

如果 PPT 经常更新，每次都要重新入库，folder-sync 帮你自动同步但需要扫描频次。

性能。一份 50 页的 PPT 解析大约 5-10 秒。比 PDF 快（不需要 OCR），比 Excel 慢（每张 slide 元素多）。

链接和动画。PPT 的超链接、动画效果对 RAG 没意义，chayuan-desktop 跳过。

引用回链。每个 chunk 的 metadata 含 slide_index。点击引用气泡时前端能用 PowerPoint 或 WPS Office 打开原 PPT 到指定 slide。

国产化支持下的 PPT。WPS 生成的 pptx 跟 Microsoft 的 pptx 兼容性好。.dps 是 WPS 专有格式，chayuan-desktop 不直接支持，需要另存为 pptx。

WPS AI 插件 chayuan-wps 当前主要在 WPS 文字里运行。WPS 演示（PPT）端的加载项支持在路线图上，未来可能加。当前在 WPS 文字里检索 PPT 内容是通过 doc:* 文档库（PPT 文件预先入到 KB 里）。

PPT 解析对 chayuan-desktop 是文档 RAG 全栈覆盖的一部分。免费开源的AI软件 把 Office 三大件 都处理到位，用户的所有日常文档都能被纳入 本地离线知识库 是 chayuan-desktop 的承诺。
