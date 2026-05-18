# 向量库结果不是文档 UI上要不要给下载按钮

chayuan-desktop 桌面单机版的引用气泡按 KB 类型分类展示。文档来源能下载原文件，向量来源不一定能。这一篇专门讲向量库结果在 UI 上的特殊处理。

先看为什么向量库结果不是文档。doc:* 类型的 KB 是 chayuan-desktop 自己用 PyMuPDF/python-docx 解析过的，每个 chunk 关联到原文件路径。点击下载能拿到完整原文。但 src:* 向量库（Milvus、Chroma、Qdrant、ES、pgvector）的数据是用户在外部系统里灌进去的，每个 vector 关联的可能只有：vector ID、payload（一段文本片段）、metadata（一些字段）。可能没有 完整原文件 的概念。

举个例子。

例子一：技术文档向量库。用户在 Milvus 里存了一组技术文档的 chunk，每个 chunk 是一段文本 + metadata（含 source_file 字段）。chayuan-desktop 接入后命中某个 chunk，气泡能展示文本 + metadata，但 source_file 字段如果记录的只是 文件名 而不是 完整路径，下载按钮点了之后 chayuan-desktop 不知道去哪找原文件。

例子二：产品向量库。用户存了 1000 万产品的 embedding（基于产品名 + 描述）。每个 vector 对应一个产品，没有 文件 概念。命中后显示产品名跟描述就行，没下载按钮的语义。

chayuan-desktop 的 UI 处理。

处理一：按 kind 分流渲染。doc:* 来源的引用渲染成蓝色气泡，含下载按钮、跳页按钮。src:* 向量来源渲染成紫色气泡，含 collection 信息、vector ID、metadata 摘要，没有下载按钮（默认）。

处理二：metadata 智能展示。如果向量库的 metadata 含 source_file 字段且文件本机可访问，chayuan-desktop 展示一个 跳转 按钮（用 OS 协议打开）。如果文件不可访问，按钮置灰提示 文件位置不在本机。

处理三：payload 主体。向量来源的引用气泡主要展示 payload（文本片段）。这是用户最关心的内容。

CLAUDE.md 里的硬要求。vector/source 结果不能显示成可下载文档附件。这条规则反映在 UI 上就是：默认不给 src:* 来源加下载按钮。

例外。如果用户主动配置某个 src:* 库 含完整原文件（在 metadata 里指明文件路径），chayuan-desktop 才给 src 引用加下载按钮。这种 显式配置 避免误导。

不要让用户混淆。早期某个版本的 chayuan-desktop 给所有引用都加下载按钮，结果用户点 src 来源的下载按钮发现没文件下来，体验不好。新版本严格按 kind 区分。

UI 层级。

doc 来源。蓝色边框、星级、跳页按钮、下载按钮。点击展开看原文段落。

struct 来源。绿色边框、SQL 摘要、表格预览、行数。点击展开看完整 SQL + 数据。

vec 来源。紫色边框、collection、vector ID、payload 摘要、metadata。点击展开看完整 metadata。

office 来源。橙色边框、文件路径、owner、密级标记。功能跟 doc 类似但加 owner。

web 来源。灰色边框、网页标题、URL、摘要。点击 URL 在外部浏览器打开。

vec 来源的下载补偿。如果用户希望 vec 来源也有 下载、chayuan-desktop 提供两种方式。

方式一：把 vec 库当 doc:* 双重接入。同一份资料既建 src:milvus 又建 doc:files。文档来源跟向量来源一起命中，文档来源给下载按钮。

方式二：自定义 metadata 含 source_file_url。vec 库每个 vector 的 metadata 加一个 url 字段（指向原文件的 https URL 或者本机路径）。chayuan-desktop 检测到这个字段后给气泡加 跳转链接 按钮。

国产化支持下的考虑。国产向量库（RT、Relyt）的 metadata 字段支持自定义，跟 Milvus 一致。处理逻辑相同。

WPS AI 插件 chayuan-wps 在 WPS 里展示 vec 引用气泡时同样按 kind 分流。不会让用户在 WPS 里看到 vec 来源的虚假下载按钮。

向量库结果不是文档这件事是 chayuan-desktop 在 UI 上做的诚实区分。免费开源的AI软件 不应该给用户假象，每种来源能做什么不能做什么必须如实展示。chayuan-desktop 在这一面的 UI 设计是 数据透明 的体现。
