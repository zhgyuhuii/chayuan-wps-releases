# MCP 协议 谁是客户端谁是服务端

chayuan-desktop 桌面单机版的 MCP 双角色（client + server）。其他产品对比。这一篇讲。

## MCP 角色

client：调用 MCP 工具的一方。

server：提供 MCP 工具的一方。

## 各产品角色

| 产品 | client | server |
|---|---|---|
| chayuan-desktop | ✓ | ✓ |
| Claude Desktop | ✓ | ✗ |
| Cline (VS Code) | ✓ | ✗ |
| Continue | ✓ | ✗ |
| Goose | ✓ | ✗ |
| Zed | ✓ | ✗ |
| Cursor | ✓ | ✗ |
| AnythingLLM | ✗ | ✗ |
| LM Studio | ✗ | ✗ |

chayuan-desktop 是 MCP 双角色。其他大多只 client。

## 双角色的意义

chayuan-desktop 当 server。

其他 MCP client（Claude Desktop、Cline 等）能调用 chayuan-desktop 的能力。

```
chayuan-desktop 暴露的 MCP server:
  - kb_search: 检索 chayuan-desktop 的本地 KB
  - office_search: 检索 office:* 私库
  - kb_list: 列出可用 KB
```

某开发者在 Cline 里用 chayuan-desktop 的 KB 检索。

数据互通。

## 为什么不只 client

MCP 生态早期所有产品都做 client。简单。

chayuan-desktop 的 KB 能力强（5 类）。让其他产品也能用。

愿意分享。

也是 chayuan-desktop 的差异化。

## 实战例子

某开发者。

写代码时用 Cline + chayuan-desktop（作为 MCP server）。

Cline 调 kb_search → chayuan-desktop → 返回项目文档相关 chunk。

Cline 整合到代码生成。

无需切应用。

## chayuan-desktop 当 client

跟其他 client 一样。能装第三方 MCP 工具。

```
chayuan-desktop 的 MCP 工具：
  - github-mcp
  - slack-mcp
  - jira-mcp
  - corp-oa-mcp（自家）
  - ...
```

LLM 调用时 chayuan-desktop 是 client，工具是 server。

## 协议一致

chayuan-desktop 当 client 和当 server 用同一 MCP 协议。

代码复用。

## 双角色的实现

实现 server。

```python
from mcp.server import Server
chayuan_server = Server("chayuan-desktop")

@chayuan_server.list_tools()
async def list_tools():
    return [Tool(name="kb_search", ...), ...]

@chayuan_server.call_tool()
async def call_tool(name, args):
    if name == "kb_search":
        return search_kb(args)
```

实现 client（调外部）。

```python
from mcp.client import StdioClient
client = StdioClient(["github-mcp"])
await client.connect()
tools = await client.list_tools()
```

## 协议演进

MCP 1.0 已稳定。chayuan-desktop 跟进 2.0+ 时双角色一并升级。

## 国产化场景

党政军内部场景。chayuan-desktop 当 server 让其他工具用其 KB。建立内部 AI 协作。

某些场景禁止用 Claude Desktop（外国软件）。chayuan-desktop 既当客户端也当服务端，自给自足。

## chayuan-server 的对应

chayuan-server 多用户场景下双角色更价值（多客户端共享数据）。chayuan-desktop 单机也能做但场景限于本机。

## 总结

MCP 协议双角色让 chayuan-desktop 在 AI 工具生态中独特。免费开源的AI软件 当 client 普遍。当 server 少。chayuan-desktop 的双角色让它既消费工具也提供能力，是 AI 生态中的活跃节点。
