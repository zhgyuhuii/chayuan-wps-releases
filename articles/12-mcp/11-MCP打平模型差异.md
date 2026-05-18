# 全模型支持下不同模型对 tools 的差异 MCP 怎么打平

chayuan-desktop 桌面单机版的 MCP 工具能在所有支持的模型上一致工作。这一篇讲怎么打平差异。

## 模型间 tools 的差异

OpenAI。原生 tools 协议。tool_calls 字段。

Anthropic Claude。tool_use 字段。结构略不同。

Qwen-2.5 / DeepSeek。OpenAI 兼容 tools。基本一致。

某些早期模型（GLM-3、文心-3 等）不支持原生 tools。

## chayuan-desktop 的统一抽象

MCP 工具描述（参考前面文章）转换成各模型的 tools 格式。

调用时模型返回的 tool_calls 转回中性表示。

LLM 输出格式打平到统一接口。

## 不支持原生的模型

某些模型不支持原生 tools。chayuan-desktop 用文本协议降级。

```
system prompt: 
你能调用以下工具：
- github_mcp.list_repos: 列出 GitHub 仓库
- slack_mcp.send_message: 发送 Slack 消息

如需调用工具，输出格式：
{"tool": "<工具名>", "args": {...}}
```

LLM 输出 JSON 格式的工具调用。chayuan-desktop 解析后调实际工具。

精度低于原生 tools 但能让所有模型用 MCP 工具。

## 工具描述的简化

某些小模型上下文短（4k）。MCP 工具几十个，描述全列进去 prompt 已经满了。

chayuan-desktop 的策略。

策略一：按上下文剪裁。给小模型只列 5-10 个最相关工具。

策略二：动态加载。LLM 第一轮回答说要 工具列表，chayuan-desktop 给一个简版。LLM 选用某工具时再给详细 schema。

## 多步工具调用的差异

OpenAI / Claude 支持多步工具调用（一轮 LLM 调多个工具）。

某些小模型不支持多步。每次只能调一个。chayuan-desktop 多次调 LLM 模拟多步。

## 工具结果的格式

OpenAI tool 消息格式：

```
{"role": "tool", "tool_call_id": "...", "content": "..."}
```

Claude tool_result 格式：

```
{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "...", "content": "..."}]}
```

chayuan-desktop 网关在调每个模型时按对应格式构造。

## 错误传递

工具调用失败。错误信息要传给 LLM。

OpenAI/Claude 都支持 tool_result 含错误内容。LLM 看到错误会尝试调整。

chayuan-desktop 把错误信息格式化成 LLM 易理解的形式。

```
{"error": "rate_limited", "message": "GitHub API limit exceeded, retry in 60 seconds"}
```

LLM 能理解 限速 概念，决定重试或换工具。

## 工具调用次数限制

避免 LLM 无限循环调工具。chayuan-desktop 设置上限。

```
max_tool_iterations: 10
```

某次对话最多 10 次工具调用。超过强制结束。

## 模型路由对工具的影响

chayuan-desktop 的路由（前面文章）选模型时考虑工具支持。

如果当前请求需要工具调用且默认模型不支持原生 tools。chayuan-desktop 自动切到支持原生的模型（如果配置了 fallback）。

## 国产化场景

国产模型对 tools 支持参差。Qwen2.5 / DeepSeek-V2 支持好。早期文心 / GLM 不支持。chayuan-desktop 的统一抽象 + 文本降级让所有国产模型都能用 MCP。

## chayuan-server 的对应

chayuan-server 多用户场景下工具调用差异同样需要打平。chayuan-desktop 共享网关代码。

## WPS 加载项

chayuan-wps 在 WPS 里调工具走 chayuan-desktop。模型差异对 WPS 透明。

## 总结

MCP 在不同模型上打平差异是 chayuan-desktop 在 全模型支持 上的工程能力。免费开源的AI软件 让 工具调用 不被锁定特定厂商模型。chayuan-desktop 的中性抽象 + 文本降级 + 错误格式化让 MCP 工具 在所有模型上一致工作。
