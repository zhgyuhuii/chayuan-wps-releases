# tools 调用在不同厂商间的差异 网关的统一封装

chayuan-desktop 桌面单机版的模型网关把不同厂商的 tools 调用差异统一封装。这一篇讲。

## tools 调用的概念

模型在生成过程中决定调外部工具（搜索、计算器、SQL 查询、API 调用）。

工作流。

第一步。用户提问。

第二步。LLM 决定调工具。返回 tool_calls 而不是直接答案。

第三步。chayuan-desktop 执行工具，拿结果。

第四步。结果回填给 LLM，让 LLM 基于结果生成最终回答。

## 各厂商的 tools 协议差异

OpenAI。tool_calls 字段。每个 tool_call 含 id、function.name、function.arguments（字符串化的 JSON）。

Anthropic。content 数组里的 tool_use 类型。含 id、name、input（直接 JSON 对象）。

Qwen。tool_calls 类似 OpenAI 但部分字段命名不同。

Gemini。functionCall 字段。结构又不同。

DeepSeek、智谱、文心。各有微小差异。

总之多家不一致。

## chayuan-desktop 的中性表示

```
{
  "tool_calls": [
    {
      "id": "call_xyz",
      "name": "search_web",
      "arguments": {"query": "..."}
    }
  ]
}
```

统一格式。上层应用只对接这个。

## 网关的转换适配器

每个厂商有 to_provider 和 from_provider 两个函数。

调用前。chayuan-desktop 上层用中性表示构造请求。网关 to_provider 转成厂商格式。

调用后。厂商返回里的 tool_calls 通过 from_provider 转回中性表示。

## 工具定义的统一

工具的 schema 定义也有厂商差异。OpenAI 用 function 数组含 name / description / parameters。其他厂商有变体。

chayuan-desktop 内部维护工具的 OpenAPI 风格 schema。网关按厂商需要转。

## 多步工具调用

某些任务模型连续调多个工具。先 search 再 calculator 再 summarize。

chayuan-desktop 的实现循环。

```
while not final_answer:
  call LLM with messages
  if response has tool_calls:
    execute tools
    append results to messages
    continue
  else:
    final_answer = response.content
    break
```

每轮往 messages 加 assistant 消息和 tool 消息。

## 厂商对工具支持的差异

某些模型不支持工具调用（早期 Claude-2、早期 GLM）。chayuan-desktop 的网关检测到不支持时降级到 文本协议。

文本协议。让模型在 system prompt 里看到工具列表，要求模型在需要调工具时输出特定 JSON 格式。chayuan-desktop 解析这种格式作为虚拟 tool_calls。

不如原生 tools 准但能让不支持的模型 也能用。

## 工具调用的安全

某些工具有副作用（删文件、发邮件）。chayuan-desktop 在执行前弹用户确认 LLM 想调用 send_email，是否允许。

只读工具（搜索、计算器）默认放行。

写操作类工具默认询问。设置里能调整每个工具的默认策略。

## 错误处理

工具调用失败（API 错误、参数错误）。chayuan-desktop 把错误返回给 LLM 作为 tool 消息内容。LLM 看到错误能尝试重试或换工具。

如果连续失败 3 次，chayuan-desktop 终止循环，告诉用户工具一直失败。避免无限重试。

## 国产化场景

国产模型对 tools 支持参差。Qwen-2.5、DeepSeek-V2 较好。早期文心、ChatGLM-3 不支持原生 tools。chayuan-desktop 的降级到文本协议让所有模型都能用工具，只是质量有差。

## chayuan-server 的对应

chayuan-server 模式下 tools 调用同样统一。chayuan-desktop 共享网关代码。

## WPS 加载项

chayuan-wps 在 WPS 里调用走 chayuan-desktop 网关。WPS 文档操作工具（插入文本、修改格式）也走 tools 协议，chayuan-desktop 统一封装。

## 总结

tools 调用在不同厂商间的差异是 chayuan-desktop 网关层最复杂的封装之一。免费开源的AI软件 让 tools 能力不锁定单一厂商。chayuan-desktop 的中性表示 + 适配器 + 文本协议降级让 工具调用 跨所有模型可用。
