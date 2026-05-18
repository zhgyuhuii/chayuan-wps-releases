# 本地离线知识库的HTML网页归档 把正文从噪声里挑出来

HTML 是网页内容的存档格式，chayuan-desktop 桌面单机版支持 HTML 文件入 KB。但 HTML 跟其他文档格式有个特殊问题：导航栏、侧边栏、广告、评论这些噪声很多，怎么把正文挑出来。这一篇讲 HTML 解析的去噪策略。

先看 HTML 的常见结构。一个网页通常有 header（导航）、nav（菜单）、main 或 article（正文）、aside（侧边栏）、footer（页脚）、script 和 style（资源）。chayuan-desktop 想要的是 main 或 article 里的内容。

第一种策略：基于 HTML5 语义标签。如果网页用了 HTML5 语义标签（<article>、<main>、<aside>），chayuan-desktop 直接取 article 或 main 标签内容，跳过其他。这种策略对现代网页有效。

第二种策略：readability 库。Mozilla 的 readability.js 算法专门做 网页内容提取。chayuan-desktop 用 readability-lxml 这种 Python 移植版本。给一段 HTML，它返回 干净正文。算法基于密度、链接比、文字长度等启发式规则识别正文。

第三种策略：自定义规则。某些网页 readability 处理不好（比如 SPA 应用动态加载、页面布局非常规）。chayuan-desktop 支持用户配 CSS 选择器规则，比如 取 div.article-body 的内容，让特定网站走自定义路径。

实际效果。chayuan-desktop 在常见博客、新闻网站、技术文档站上 readability 提取效果好（90%+ 准确）。在某些复杂电商页或论坛页上可能不准，需要自定义规则。

HTML 入库的几种来源。

来源一：保存的网页。用户用 ctrl+s 保存网页到本地，chayuan-desktop folder-sync 一个目录扫描这些 .html 文件。

来源二：归档工具。SingleFile、ArchiveBox 这种工具把网页打包成单 HTML 或 WARC 文件。chayuan-desktop 当前支持单 HTML，WARC 暂不支持。

来源三：导出工具。某些工具（Notion、印象笔记）支持导出 HTML。chayuan-desktop 接收这些导出文件入库。

来源四：Web search 工具调用结果。chayuan-desktop 的 web search 内置工具调云搜索后拿回的可能是 HTML 片段，自动入临时 KB。

HTML 解析后的 chunk 结构。每个 HTML 文件作为一个 KB 单元。文章标题（<title> 或 <h1>）作为 chunk metadata 的 doc_title。正文按 heading（h1-h6）分段，跟 markdown 处理一致。链接、图片、表格分别处理。

去噪具体规则。chayuan-desktop 跳过的 HTML 元素：<nav>、<aside>、<footer>、<script>、<style>、<header>（除非它包含主标题）、<form>、<button>。某些 class 名（'sidebar'、'ad'、'related-posts'、'comments'）也跳过。

链接处理。HTML 里的内部链接（<a href="...">）chayuan-desktop 取文字加 URL 到 metadata。外部链接如果指向另一份已入库的文档，可以做跨文档关联。这种 link graph 当前不深度利用，未来可能加。

图片 OCR。HTML 里的图片如果是核心内容（比如截图带文字），用户可以选择对图片做 OCR。chayuan-desktop 支持配置 是否对 HTML 内嵌图片 OCR 选项。

iframe 内容。某些网页用 iframe 嵌入第三方内容。chayuan-desktop 当前不跨 iframe 抓取，因为可能涉及外部网络请求。

JavaScript 渲染的内容。SPA 应用（React、Vue、Svelte）的 HTML 文件在保存时可能只有空 div，真正的内容在 JS 运行时生成。chayuan-desktop 不跑 JS，处理不了这种页面。建议用户用 readability 浏览器插件先静态化页面再保存。

应用场景。

场景一：技术博客归档。开发者把读过的技术博客保存到本地，chayuan-desktop 入库后能问 之前读过的关于 React 性能的文章。

场景二：研究资料收集。研究人员把相关网页归档到一个目录，chayuan-desktop folder-sync 自动建 KB。

场景三：内部文档。某些公司用 Confluence 或 Notion 写内部文档，导出 HTML 后入 chayuan-desktop。

国产化支持下的 HTML。中文网页 chayuan-desktop 处理无问题。GBK 或 GB2312 编码的老网页 chayuan-desktop 自动识别编码并转 UTF-8。

WPS AI 插件 chayuan-wps 不直接处理 HTML（WPS 文字主要是 docx），但能检索已经入了 chayuan-desktop KB 的 HTML 内容。引用气泡展示 doc_title 加 URL。

HTML 网页归档对个人知识管理用户有价值。免费开源的AI软件 把这种 临时阅读 转成 长期可查的资料 是 chayuan-desktop 给个人用户的一种用法。
