# 本地离线知识库的Markdown解析 公式与代码块的切分

Markdown 是技术文档最常见的格式。chayuan-desktop 桌面单机版用 markdown 库解析。这一篇讲 Markdown 解析的几个细节，特别是公式和代码块。

先看 Markdown 的特征。结构化标记简单：标题用 # 表示层级、列表用 - 或 1. 表示、表格用 | 表示。但是嵌入的公式（LaTeX）和代码块对 RAG 切分有影响。

普通 Markdown 解析。chayuan-desktop 的 markdown parser 把 .md 文件按 heading 分段。每个 heading 下的内容作为一个 Document，metadata 携带 heading_text、heading_level、parent_heading。这种结构化让 RAG 检索能精准命中 关于 X 章节 的内容。

代码块的特别处理。Markdown 里的代码块用三个反引号包起来，可能含语言标记（比如 ```python）。chayuan-desktop 把代码块作为一个特殊 Document，metadata 标记 type=code、language=python。chunk 时不切分代码块（避免破坏代码完整性）。

为什么不切分代码块。代码的语义需要完整结构（class 定义、function 体）。如果按字符数硬切，半截 if 语句没有意义。chayuan-desktop 的 chunker 把代码块作为一个不可拆分的单元，即使它超过 chunk_size 也作为单独 chunk。

代码块的检索。当用户问 关于 chayuan-desktop sidecar 的 Python 代码示例，向量召回会命中含相关代码的 chunk。引用气泡里展示完整代码块（语法高亮）。

公式（LaTeX）的处理。技术文档里常见 $E=mc^2$ 这种行内公式或 $$...$$ 块公式。chayuan-desktop 把公式作为文本存（不试图渲染），向量召回基于公式的字符串模式。这对 找出含某个公式的内容 是够用的，对 计算公式 不够（那是另一种能力）。

表格的处理。Markdown 表格用 | --- | 形式。chayuan-desktop 把表格作为一个 Document，metadata 标记 type=table、columns=表头列表。表格不切分（保持完整结构）。

链接的处理。Markdown 的 [文字](URL) 链接 chayuan-desktop 取链接文字进 chunk，URL 存到 metadata。如果 URL 是本地文件路径，可能转成相对路径方便回链。

图片的处理。Markdown 的 ![alt](src) 图片 chayuan-desktop 跳过图像本身，把 alt 文字作为 chunk 的一部分，src 存 metadata。如果用户想做图片 OCR，要单独建图像 KB。

引用块（blockquote）。> 开头的引用块 chayuan-desktop 作为独立 Document，metadata 标记 type=quote。

列表（list）。- 或 1. 开头的列表项作为段落处理。如果列表很长，按 chunk_size 拆分。

标题层级（heading）。# 一级、## 二级、### 三级。chayuan-desktop 在 chunk metadata 里完整保留 标题路径，比如 第三章 - 安装与部署 - 国产 OS。这种 path 让检索结果展示更有上下文。

Markdown 的方言差异。GitHub Flavored Markdown（GFM）支持表格和任务列表。CommonMark 标准更严格。chayuan-desktop 用的库是 python-markdown 加 GFM 扩展，覆盖大多数现实场景。

特殊 Markdown 文件类型。

README.md。开源项目的 README 通常含项目介绍、安装、用法、贡献。这些内容入库后能让 AI 快速回答 这个项目是干嘛的。

技术文档。Sphinx 或 MkDocs 生成的 markdown 站点。chayuan-desktop folder-sync 整个文档目录作为 KB。

笔记。个人笔记用 Markdown 写。chayuan-desktop 的 doc:个人笔记 KB 是常见用法。

混合 Markdown。某些 .md 文件混合了 ipynb 风格（代码 + 输出）。chayuan-desktop 当前作为普通 Markdown 处理。

国产化支持下的 Markdown。中文 Markdown 内容跟英文处理一致，chayuan-desktop 全 UTF-8。

WPS AI 插件 chayuan-wps 在 WPS 文字里间接通过 sidecar 检索 markdown KB。当前 WPS 文字本身不专门展示 Markdown 格式，但加载项里的引用气泡能展开 markdown 段落。

Markdown 解析对开发者用户尤其重要。免费开源的AI软件 在技术文档场景下的支持深度，靠的是 markdown 这种 看起来简单 的格式的细节处理。chayuan-desktop 在这一面做得稳。
