# 办公场景下的引用回链 链回WPS文档原段落

chayuan-desktop 桌面单机版的 office:* 私库引用回链支持跳到 WPS Office 文档的具体段落。这一篇讲实现。

## 标准 PDF 跳转

跟前面文章讲的 doc:* 一样。chayuan-desktop 的引用气泡含 page_number。点击跳转用 OS 协议 file:///path.pdf#page=N 打开。WPS Office 的 PDF 阅读器、Adobe Reader、福昕都支持。

## Word 文档的跳转挑战

docx 文件没有标准 锚点协议。点击 file:///path.docx 只能打开文件，不能跳到具体段落。

## chayuan-wps 加载项的方案

如果当前 WPS 文字打开的就是命中的那份 docx，chayuan-wps 通过 WPS 加载项 API 直接定位光标到对应段落。

具体实现。

第一步。chayuan-desktop 的 chunk metadata 含 paragraph_index 和 file_path。

第二步。引用气泡传给 chayuan-wps 加载项。

第三步。chayuan-wps 检测当前打开的 WPS 文档路径。如果跟 file_path 一致，调 WPS API 把光标移到 paragraph_index 段落。

第四步。WPS API 用 selection.MoveToParagraph(N) 之类的方法定位。

## 跨文档跳转

如果命中 chunk 来自另一份 docx（不是当前打开的），chayuan-wps 调 WPS 应用打开那份文档，再定位段落。这种 同应用跨文档 的跳转比 OS 默认应用打开 流畅。

## 链接批注的特殊用法

WPS 文字支持 链接批注（批注里挂一个 URL）。chayuan-desktop 可以让 chayuan-wps 在引用插入到 WPS 时用链接批注形式。批注内容是引用气泡预览，链接指向原文档加段落锚点。这种 批注链接 让 WPS 文档自身带 来源引用。

## 实战例子

员工写月报。在 WPS 文字里调 chayuan-wps 加载项，问 上次会议关于产品 X 的讨论。

回答给出几段引用，来自 office:zhangsan:meetings 的 docx。

员工点 插入引用 按钮。chayuan-wps 在 WPS 月报当前光标位置插入一段引用 + 链接批注。

链接批注的 URL 指向原 docx 的某段落锚点。

后续读月报的人点击批注链接能跳到原会议纪要的具体段落。

## OS 协议的限制

OS 协议（file://、ms-word://）的实现各家不一致。chayuan-wps 在 Windows WPS 上跳转最稳。macOS WPS 协议支持有限。Linux 上看 WPS Office Linux 版本。

## 国产化场景

WPS Office 在政企办公里覆盖率高。chayuan-wps 在 WPS 里的回链体验是 chayuan-desktop 的核心差异。豆包、Cherry Studio 等不进 WPS。

## 当前限制

chayuan-wps 当前主要支持 WPS 文字（docx）。WPS 表格（xlsx）的回链支持基础。WPS 演示（pptx）的支持在路线图。

## 总结

WPS 文档原段落回链是 chayuan-desktop + chayuan-wps 在办公场景的体验高地。免费开源的AI软件 想真嵌入办公流程，跟 WPS 这种主流办公软件的深度集成是必由之路。chayuan-desktop 在这一面的工程让 写报告时引用 KB 真正流畅。
