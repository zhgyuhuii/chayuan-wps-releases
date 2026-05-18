# 本地离线知识库的Word文档批注与修订处理

Word 文档（.docx）是办公场景里跟 PDF 同等常见的格式。chayuan-desktop 桌面单机版用 python-docx 解析，但 Word 比 PDF 多了一些特殊元素：批注、修订、链接批注、目录、脚注。这一篇讲 Word 解析的特殊处理。

先看 python-docx 的能力。它把 docx 文档解析成 paragraphs、tables、headers/footers、images、comments、track_changes 这几类元素。每个元素能拿到文字、样式、位置。chayuan-desktop 的 Word parser 在此基础上做业务逻辑。

正文段落。普通 paragraph 直接抽文字，按段落作为一个 Document 喂给 chunker。每个段落记录 paragraph_index 元数据，便于回链。

标题层级。docx 的 paragraph style 含 Heading 1 / Heading 2 等。chayuan-desktop parser 识别这些 style，给对应段落加 heading_level metadata（1-6）。后续 chunk 的展示能区分主标题和副标题。

表格。docx 的 table 用 python-docx 抽 cell 文字。chayuan-desktop 把每个 table 转成 markdown 表格字符串作为一个 Document，metadata 标记 type=table。这样 chunk 里能看到表格结构。如果表格很大（几十行以上），考虑另存为 Excel 走结构化 KB。

批注（comments）。docx 里的批注是某段话的备注，比如同事的审阅意见。chayuan-desktop 把批注作为独立 Document 入库，metadata 标记 type=comment、attached_to=被批注段落的 paragraph_index、author=批注作者。这样检索时能找到 这份合同里关于第 5 条的批注。

修订（track_changes）。文档开了修订模式后所有改动都被跟踪。chayuan-desktop 当前不展开修订历史（比如 X 把 A 改成了 B），只取最终接受版本作为正文。修订的 metadata 简单记录 含修订 标记。

链接批注。WPS Office 特有的功能，把批注链接到外部 URL 或文档。chayuan-desktop 当前作为普通批注处理，URL 保留在 metadata 里。

页眉页脚。重要程度因文档而异。法律合同的页眉可能写 合同编号 + 页码。chayuan-desktop 默认抽页眉页脚但 metadata 标记 type=header/footer，chunker 不会跟正文混合。

目录（TOC）。docx 的目录是自动生成的字段。chayuan-desktop 跳过目录不入库（避免重复），但保留 文档结构 metadata 描述目录的层级。

脚注。docx 脚注是 paragraph 的引用。chayuan-desktop 把脚注作为独立 Document 入库，metadata 标记 type=footnote、attached_to=主段落 ID。

图片。Word 文档里嵌入的图片当前 chayuan-desktop 不抽出来做 OCR。如果图片里有重要文字（比如截图含数据），用户需要单独处理（截屏后建图像 KB）。这是当前的局限。

旧 .doc 格式。.doc 是 Word 97-2003 旧格式，python-docx 不支持。chayuan-desktop 当前需要先用 LibreOffice 或 WPS 转成 .docx 再处理。或者本地装 antiword 这种工具做转换。

WPS 生成的 docx。WPS Office 生成的 docx 跟 Microsoft Office 大体兼容，但偶尔有微妙差异（字体引用、表格属性、批注格式）。chayuan-desktop 实际跑过大量 WPS docx，兼容性良好。极少数边界情况报警告，正文仍能抽。

样式信息保留。docx 的字体、颜色、加粗这些样式信息 chayuan-desktop 不保留到 chunk 里，因为对 RAG 检索没价值。但是 标题层级 这种结构化样式信息保留，影响 chunk 的组织。

引用回链。每个 chunk 的 metadata 含 paragraph_index 和 file_path。点击引用气泡时前端能用 OS 默认应用打开原 docx 文档，并尝试定位到对应段落（取决于 Word 阅读器的支持）。

国产化支持下的 Word。WPS Office Linux 版本生成的 docx 跟 Windows 版基本一致。麒麟 UOS 上 chayuan-desktop 解析这些文档不出问题。

WPS AI 插件 chayuan-wps 在 WPS 文字里写文档时可以直接把当前文档发给 sidecar 解析。加载项里勾选 当前文档作为知识 选项，sidecar 把 docx 内容当作 RAG 上下文。这种 即写即查 的工作流是 chayuan-desktop 加 chayuan-wps 的特色。

Word 解析的批注修订处理是 chayuan-desktop 在办公场景下的细节投入。免费开源的AI软件 想做出 真办公场景能用 的体验，把 Word 这种 看起来普通但细节复杂 的格式处理好是基础工作。
