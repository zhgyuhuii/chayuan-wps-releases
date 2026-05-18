# arXiv 工具 论文摘要的自动化

chayuan-desktop 桌面单机版的 arXiv 工具帮助科研人员快速摘要论文。这一篇讲。

## 工具能力

arxiv_search。按关键词搜索论文。

arxiv_get_paper。某 ID 论文的详情。

arxiv_download_pdf。下载 PDF。

arxiv_recent。某领域最近的论文。

arxiv_summarize。论文自动摘要（需 LLM 配合）。

## 典型场景

用户问 最近 RAG 领域有什么重要论文。

LLM 调 arxiv_search(query="retrieval augmented generation", limit=10)。

返回 10 篇论文标题、作者、摘要。

LLM 整合给用户一份榜单。

用户看了某篇感兴趣，问 第 3 篇详细讲了什么。

LLM 调 arxiv_get_paper(arxiv_id="2310.xxxxx")。

返回完整摘要 + 关键信息。

如果用户想看全文。LLM 调 arxiv_download_pdf。下载到本地。

调 chayuan-desktop 的 PDF 解析工具入 KB。

后续用户能问 这篇论文的 method 是什么。RAG 检索回答。

## 自动摘要

用户问 帮我总结这篇论文 + 提供 PDF。

chayuan-desktop 调 PDF 解析。再调 LLM 摘要。

```
摘要框架：
- 问题
- 方法
- 实验
- 结论
- 局限
```

让 LLM 按结构化框架摘要。比 我看这篇说啥 整段输出更有用。

## 论文入 KB

某用户做 RAG 综述。下载 50 篇相关论文。

chayuan-desktop 一键操作。

```
LLM: 我帮你下载并入 KB 这 50 篇论文。
用户：好。
chayuan-desktop 后台跑：
  - 下载 PDF
  - PDF 解析
  - chunk 切分
  - 嵌入入 KB
进度：12/50 完成...
```

完成后用户能问 哪些论文用了 hybrid retrieval。RAG 检索给答案。

## arXiv API 限制

arXiv 公共 API 限速宽松（约每秒 1 次）。

某些科研机构有自己的镜像（中国部分高校有）。chayuan-desktop 配置可走镜像。

## 元数据丰富

arxiv_get_paper 返回。

标题、作者、摘要、发表日期。

类别（cs.CL、cs.LG 等）。

DOI、版本历史。

引用计数（如果开了 Semantic Scholar 接入）。

LLM 用这些回答用户。

## 跟 Semantic Scholar 协同

arXiv 的引用关系不全。chayuan-desktop 集成 Semantic Scholar API。

```
semantic_scholar_get_citations(paper_id)
semantic_scholar_get_recommendations(paper_id)
```

补全引用网络。便于科研人员追踪相关工作。

## 国产化场景

国内研究机构 chayuan-desktop。arXiv 在国内访问偶尔不稳。chayuan-desktop 内置国内镜像（cn.arxiv.org）作为备选。

某些场景（涉密、国家级研究）不用国外 arXiv，用国家科学技术数字图书馆等。chayuan-desktop 的 OpenAPI 一键导入功能能接这些国产平台。

## chayuan-server 的对应

chayuan-server 多用户场景下论文 KB 集中（一个研究所共享）。chayuan-desktop 单机各自的 KB。

## WPS 加载项

chayuan-wps 在 WPS 里写综述时调用 arxiv_search。论文摘要直接插入 WPS 文档。引用气泡含 arXiv ID。

## 总结

arXiv 工具的论文摘要自动化是 chayuan-desktop 在科研场景的工程能力。免费开源的AI软件 让 找论文、读论文、写综述 在 AI 辅助下高效。chayuan-desktop 的 arxiv + Semantic Scholar + KB 整合让 科研工作流 完整。
