# 工具调用与RAG的协作 检索结果作为工具输入

chayuan-desktop 桌面单机版的 tools 跟 RAG 不是孤立的。某些场景 RAG 检索结果作为工具输入。这一篇讲清楚。

典型场景。

场景一：先 RAG 拿背景再调工具。用户问 帮我对比这两份合同的差异条款，帮我标注到 WPS 文档里。chayuan-desktop 先 RAG 检索两份合同的相关 chunk，再调 WPS write 工具把对比结果写入文档。

场景二：先 web 搜再 RAG。用户问 关于压力测试的最新行业标准。chayuan-desktop 先 web_search 拿到最新外部信息，再 doc_search 在本地 KB 找企业内部规范。综合后回答。

场景三：先工具调用拿数据再 RAG。LLM 先调 calendar 工具看用户日程，知道 这周有 X 会议，再 doc_search 找相关项目背景。

场景四：跨工具串联。LLM 调 GitHub 工具拿仓库列表，再对每个仓库调 file_read 看 README，再 RAG 在内部 KB 找相似项目。

工具结果回流到上下文。每次工具调用结果存到 LLM 的对话上下文。后续 RAG 检索可以基于这些数据。

prompt 设计。chayuan-desktop 的 system prompt 提示 LLM。

如果用户问题需要外部数据，先调相应工具拿数据。

如果数据来自 KB，调 KB 检索。

可以多次工具调用串联。

返回最终答案前确认数据完整。

性能影响。多工具调用让单次回答延迟累加。一次 RAG + 一次 web_search + 生成可能 5-10 秒。chayuan-desktop 在前端展示进度条让用户知道 在调哪个工具。

并发工具调用。LLM 在同一回合可能要调多个独立工具。chayuan-desktop 并发执行，节省时间。比如同时调 doc_search 跟 web_search，结果都到了再 LLM 综合。

错误隔离。某个工具失败不影响其他。LLM 决定怎么处理（重试、换工具、告诉用户）。

国产化支持下的工具协作。chayuan-desktop 内置工具大多支持中文场景。中文 query 走完整工具链没有语言障碍。

WPS AI 插件 chayuan-wps 在 WPS 里发起对话时同样能让 LLM 用工具。在 WPS 文字写报告时让 LLM 调 KB + 调外部 API + 调 Excel 数据，综合写出有数据支撑的报告。

工具调用与 RAG 的协作是 chayuan-desktop 让 LLM 真办事的关键。免费开源的AI软件 把工具跟知识结合，让 LLM 从 聊天 升级为 干活。chayuan-desktop 在这一面的工程化让 复杂任务 在 LLM 上能完成。
