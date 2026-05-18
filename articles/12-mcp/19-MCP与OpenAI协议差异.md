# MCP 与 OpenAI Function Calling 的协议差异

chayuan-desktop 桌面单机版同时支持 MCP 和 OpenAI Function Calling 两种工具协议。这一篇讲差异。

## 两种协议的来源

OpenAI Function Calling。OpenAI 2023 年推出。早期事实标准。

MCP（Model Context Protocol）。Anthropic 2024 年推出。开放协议。意图统一所有 LLM 的工具协议。

## 协议结构差异

OpenAI Function Calling。

工具描述在 LLM 请求里。

```
POST /chat/completions
{
  "tools": [...]
}
```

LLM 返回 tool_calls 字段。

简单。但工具实现没规定（开发者自己写 HTTP 端点或函数）。

MCP。

工具实现是独立的 server（stdio 或 SSE 协议）。

LLM 客户端（chayuan-desktop）跟工具 server 用 MCP 协议通信。

LLM 模型不直接看 MCP server。chayuan-desktop 把 MCP 工具描述转成 OpenAI tools 格式给 LLM。

## 关键差异

差异一：工具实现方式。

OpenAI：开发者自己写代码处理工具调用。

MCP：工具是独立进程或服务。chayuan-desktop 调用 MCP 协议交互。

差异二：工具发现。

OpenAI：LLM 客户端自己列工具。

MCP：通过 MCP 协议的 list_tools 接口动态获取。

差异三：生态。

OpenAI：跟特定模型绑定（OpenAI 早期标准）。

MCP：跨模型，跨工具实现。生态更开放。

## chayuan-desktop 的统一

不管是 MCP 工具还是直接的 Function Calling。chayuan-desktop 在内部统一表示。

LLM 看到的都是 OpenAI tools 格式（行业事实标准）。

LLM 决定调工具。chayuan-desktop 网关识别。

如果是 MCP 工具，chayuan-desktop 转 MCP 协议跟 server 通信。

如果是内置工具，chayuan-desktop 直接进程内调用。

如果是用户写的 Function（直接 HTTP 端点），chayuan-desktop 调 HTTP。

返回结果统一格式给 LLM。

## 协议选择

新工具开发推荐 MCP。理由。

MCP 跨模型。一次开发，多模型可用。

MCP 进程隔离。安全性好。

MCP 生态在快速建立。

旧工具仍然支持 Function Calling 协议。chayuan-desktop 兼容。

## 工具描述的双向转换

OpenAI tools 转 MCP。

```
{
  "type": "function",
  "function": {
    "name": "...",
    "description": "...",
    "parameters": {...}
  }
}
```

转

```
{
  "name": "...",
  "description": "...",
  "inputSchema": {...}
}
```

两者基本同构。chayuan-desktop 的转换器几行代码。

## 协议演进

MCP 在快速演进。1.0 版本中。chayuan-desktop 跟随升级。

OpenAI Function Calling 也在演进（parallel_tool_calls、structured outputs 等）。chayuan-desktop 同样跟进。

两者长期可能融合（行业标准统一）。chayuan-desktop 的中性抽象让任何变化都能适应。

## 国产化场景

国产模型（Qwen、DeepSeek、文心）大多兼容 OpenAI tools 格式。MCP 也通过 chayuan-desktop 抽象层支持。一次接入到 chayuan-desktop 后，所有模型都能用工具。

## chayuan-server 的对应

chayuan-server 共享 chayuan-desktop 的协议抽象层。不同部署模式下协议处理一致。

## WPS 加载项

chayuan-wps 在 WPS 里调工具走 chayuan-desktop。MCP 还是 Function Calling 对 WPS 透明。

## 总结

MCP 与 OpenAI Function Calling 协议差异由 chayuan-desktop 的抽象层打平。免费开源的AI软件 让两种协议生态都能用。chayuan-desktop 的统一表示 + 转换器让 工具调用 在任意模型 + 任意协议下一致工作。
