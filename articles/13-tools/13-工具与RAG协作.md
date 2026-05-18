# 工具调用与 RAG 的协作 检索结果作为工具输入

chayuan-desktop 桌面单机版的工具调用和 RAG 能协作。检索结果作为工具的输入。这一篇讲。

## 协作的场景

场景一。用户问 帮我把这份合同的关键条款发给法务。

LLM 决策：

第一步。RAG 检索 chunk 找到合同关键条款。

第二步。把 chunk 内容作为 send_email 工具的 body 参数。

第三步。调 send_email 工具。

第四步。告诉用户已发送。

工具调用基于 RAG 结果，链路清晰。

## 链路实现

LLM 收到的上下文。

```
工具列表：
- search_kb(query): 检索知识库
- send_email(to, subject, body): 发邮件

用户问题：帮我把合同关键条款发给法务
```

LLM 输出：

```
{"tool_calls": [
  {"name": "search_kb", "args": {"query": "合同关键条款"}}
]}
```

chayuan-desktop 调 search_kb 返回 chunk。

返回结果作为 tool 消息加到 messages。

```
{"role": "tool", "content": "找到 5 个 chunk: ..."}
```

LLM 第二轮。

```
{"tool_calls": [
  {"name": "send_email", "args": {
    "to": "legal@corp.com",
    "subject": "合同关键条款",
    "body": "<刚才检索到的 chunk 内容>"
  }}
]}
```

chayuan-desktop 调 send_email。

完成。

## 多步链路的常见模式

模式一：检索 → 处理 → 输出。

KB 检索 → LLM 整理 → 写到文件或发邮件。

模式二：检索 → 决策 → 操作。

KB 检索 → LLM 判断 → 调 API 操作（创建 Jira issue、发 Slack 消息）。

模式三：操作 → 检索 → 关联。

调 API 拿数据 → KB 检索关联背景 → 整合回答。

模式四：检索 → 计算 → 可视化。

KB 检索 → 数据处理 → chart_render 工具生成图表。

## kb_search 工具的特别封装

chayuan-desktop 的 kb_search 工具是 RAG 的工具化。LLM 调它就像调任何其他工具。

```
kb_search(query="...", kb_ids=["office:zhangsan:meetings"], top_k=5)
```

返回。

```
[
  {"chunk": "...", "source": "...", "score": 0.92},
  ...
]
```

LLM 拿到 chunk 后能进一步用。

## 跟自动 RAG 的区别

自动 RAG。chayuan-desktop 在每次用户提问前自动检索，把相关 chunk 拼到 prompt。LLM 看到检索结果直接回答。

工具化 RAG。chayuan-desktop 不自动检索。LLM 决定何时调 kb_search。

两种模式可同时存在。

自动 RAG 适合简单 QA。

工具化 RAG 适合复杂多步推理（需要多次检索或检索后做其他事）。

## 用户感知

UI 上显示。

```
[已调用 kb_search]
  查询: "合同关键条款"
  找到: 5 个 chunk

[已调用 send_email]
  收件人: legal@corp.com
  主题: 合同关键条款

回答：
  我已经把合同关键条款发给法务了。
  内容包括 [简要摘要]。
```

清晰展示 chayuan-desktop 干了什么。

## 引用气泡

工具链路中的 RAG chunk 作为引用展示。引用气泡含 chunk 来源。

用户能点引用看完整 chunk 内容。

## 国产化场景

党政军 工作流自动化 场景。员工说 帮我把这份政策的相关解读发给部门。chayuan-desktop 检索 + 整理 + 发邮件全流程跑通。

## chayuan-server 的对应

chayuan-server 多用户场景下工具链路同样工作。chayuan-desktop 共享逻辑。

## WPS 加载项

chayuan-wps 在 WPS 里发起多步任务。比如 帮我从这报告抽出数据生成图表插入文档。chayuan-wps → chayuan-desktop → kb_search + chart_render + WPS API。复杂链路对员工透明。

## 总结

工具调用与 RAG 的协作是 chayuan-desktop 在 AI 工作流编排上的工程能力。免费开源的AI软件 让 检索 + 操作 在 LLM 编排下连贯。chayuan-desktop 的 kb_search 工具化 + 多步链路让 复杂任务自动化 落地。
