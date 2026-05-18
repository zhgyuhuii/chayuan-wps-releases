# 引用回链 chunk偏移到原文页码的实现

chayuan-desktop 桌面单机版的引用气泡能精确跳到原文档的具体页和段落。这种 引用回链 是 文档 RAG 体验的核心。这一篇讲实现这个功能的具体机制。

先看回链的目标。用户问一句话，AI 回答下面有引用气泡。点击气泡，能在右侧抽屉看到原 chunk 文本，并提供 跳到原文 按钮。点击跳到按钮后，OS 默认 PDF 阅读器打开原 PDF 到指定页，光标位置接近原 chunk 的开头。

实现回链的关键数据。每个 chunk 在入库时记录几个 metadata：file_path（原文件绝对路径）、page_number（页码，PDF 的话）、paragraph_index（段落序号，Word 的话）、offset_start（chunk 在原文的起始字符偏移）、offset_end（结束偏移）、bbox（PDF 文本块的坐标，可选）。

PDF 的回链。PyMuPDF 抽文本时能拿到每个文本对象的页码和坐标。chayuan-desktop 把这些信息写到 chunk metadata。点击 跳到原文 时调用 OS 协议 file:///path/to/file.pdf#page=N 打开 PDF。Adobe Reader、PDF Expert、福昕都支持这种锚点。

部分 PDF 阅读器不支持页锚点。比如某些老版本 PDF 阅读器。chayuan-desktop 在用户系统默认 PDF 阅读器不支持时退化为 只打开 PDF 不跳页，用户手动翻到指定页。

WPS Office 的 PDF 跳页。WPS Office 的 PDF 阅读器支持 #page= 锚点。chayuan-desktop 在国产化场景下推荐用户用 WPS 作为默认 PDF 阅读器。

Word 文档的回链。docx 没有页码概念（页码是渲染后的视图），但有 paragraph_index。chayuan-desktop 用 file://path.docx 打开 Word 文档，用户手动定位到对应段落。Word 没有标准锚点协议。

某些场景下 chayuan-desktop 生成 临时高亮版本。比如把 PDF 的指定 chunk 用红框标记输出新 PDF。这种增强的回链当前在路线图上，未实现。

链回原文的两个层级。

层级一：跳到文件。能正确打开 PDF/Word/Excel 的原文件。chayuan-desktop 当前层级一全部支持，前提是原文件路径仍有效。

层级二：跳到位置。能正确定位到原文件内的具体页/段落/cell。PDF 走 #page=N 锚点。Word/Excel 当前层级二只到文件。

原文件的查找。chayuan-desktop 在 chunk metadata 里存的是绝对路径。如果用户后来移动了原文件（删了或者搬到别的目录），路径失效。chayuan-desktop 在引用气泡里检测路径有效性，无效时给提示 原文件不存在。

如果用 保留原文件 选项。chayuan-desktop 在建库时把原文件副本保存到 CHAYUAN_ROOT/uploads。即使用户后来移动原始文件，副本仍在。回链跳到副本路径而不是原始路径。这种冗余以防万一。

引用气泡里的原文展示。点击气泡之后右侧抽屉展示 chunk 文本，高亮命中的句子。如果是 PDF，还能展示 PDF 渲染的预览图（chayuan-desktop 用 PyMuPDF 渲染指定页的截图作为预览）。这种 文字 + 截图 双重展示让用户对内容有快速判断。

跨 chunk 的回链。某些回答跨多个 chunk（同一段落被切到两个 chunk）。chayuan-desktop 的引用展示按 chunk 单独显示，每个一个气泡。用户能看到 这段答案来自第 5 页的两段连续 chunk。

检索结果的去重对回链的影响。如果两份相似资料都命中，chayuan-desktop 在 results 阶段去重，但回链会展示主要那一份的来源。次要的可能丢失，避免冗余气泡堆叠。

国产化支持下的回链。麒麟 UOS 上 WPS Office 是默认 PDF 阅读器，#page=N 锚点支持良好。某些 RHEL/CentOS 系发行版默认 evince，也支持。回链体验跟 Windows 一致。

WPS AI 插件 chayuan-wps 的回链有特殊优势。如果命中的 chunk 来自当前 WPS 文字打开的文档，加载项可以直接定位 WPS 文字的光标到对应段落。如果是另一份 PDF，加载项调用 OS 协议打开。这种 同应用内跳转 比跨应用更顺。

引用回链是 chayuan-desktop 文档 RAG 的体验高地。免费开源的AI软件 让用户能 一键回原文 是 trust 的基础。chayuan-desktop 在 metadata 携带 + 跳转协议 + 原文件副本 三层做的工作让回链稳定。
