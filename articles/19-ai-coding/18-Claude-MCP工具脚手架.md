# 让 Claude 接入 MCP 工具 一份新工具的脚手架

chayuan-desktop 桌面单机版接入新 MCP 工具。Claude 帮生成脚手架。这一篇讲。

## 场景

某团队要接公司内部 OA 系统到 chayuan-desktop。

需要写一个 corp_oa_mcp 工具。

Claude 协助快速从空白到可用。

## Claude 的输入

工程师告诉 Claude。

```
我需要一个 MCP 工具。
- 名称：corp-oa-mcp
- 功能：查询 OA 待办、审批、查找会议室
- 后端：公司 OA 系统的 REST API（http://oa.corp.com）
- 鉴权：Bearer Token
- 语言：Python
```

## Claude 输出

完整脚手架。

```
corp-oa-mcp/
├─ pyproject.toml
├─ corp_oa_mcp/
│   ├─ __init__.py
│   ├─ server.py            # MCP server 入口
│   ├─ tools/
│   │   ├─ list_todos.py
│   │   ├─ approve.py
│   │   └─ list_meeting_rooms.py
│   ├─ oa_client.py         # OA API 客户端
│   └─ config.py
├─ tests/
│   ├─ test_list_todos.py
│   ├─ test_approve.py
│   └─ ...
└─ README.md
```

每个文件 Claude 写好基础代码。

## server.py 主入口

```python
from mcp.server import Server
from mcp.types import Tool, TextContent
from corp_oa_mcp.tools.list_todos import list_todos_handler, list_todos_schema
# ...

server = Server("corp-oa-mcp")

@server.list_tools()
async def list_tools():
    return [
        Tool(name="list_todos", **list_todos_schema),
        # ...
    ]

@server.call_tool()
async def call_tool(name, arguments):
    if name == "list_todos":
        return await list_todos_handler(arguments)
    # ...
```

干净结构。

## 单个工具的实现

list_todos.py。

```python
from corp_oa_mcp.oa_client import OAClient

list_todos_schema = {
    "description": "列出当前用户的 OA 待办事项",
    "inputSchema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["pending", "completed", "all"],
                "default": "pending"
            }
        }
    }
}

async def list_todos_handler(args):
    status = args.get("status", "pending")
    client = OAClient()
    todos = await client.get_todos(status=status)
    return [TextContent(type="text", text=str(todos))]
```

清晰。

## 测试覆盖

Claude 帮写测试。

```python
import pytest
from unittest.mock import AsyncMock

async def test_list_todos_default():
    handler = list_todos_handler
    result = await handler({})
    assert result is not None
    assert "todos" in result[0].text.lower()

async def test_list_todos_with_status():
    result = await handler({"status": "completed"})
    # 验证传递的 status 正确
```

## README

Claude 帮写。

```markdown
# corp-oa-mcp

公司 OA 系统的 MCP 工具。

## 安装
[步骤]

## 配置
[环境变量]

## 工具列表
- list_todos: 列出待办
- approve: 审批
- list_meeting_rooms: 查找会议室

## 接入 chayuan-desktop
[配置步骤]
```

## 接入 chayuan-desktop

工程师把工具发布到 npm 私服。

chayuan-desktop 设置 - MCP - 添加。

填配置。

测试调用。

工作。

## 时间

Claude 协助下从空白到可用。

代码生成：5 分钟。

测试：5 分钟。

接入：5 分钟。

总共 15 分钟。比纯手写快 10 倍。

## 国产化场景

党政军内部 OA / ERP 接入。Claude 协助生成 MCP 工具是采购落地后的开发任务标配。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 工具集中。chayuan-desktop 的开发流程经验复用。

## 总结

让 Claude 接入 MCP 工具是 chayuan-desktop 在生态扩展上的工程便利。免费开源的AI软件 让 写 MCP 工具 变成 Claude 协作的简单事。Claude 的脚手架 + 实现 + 测试 + 文档让接入 MCP 工具高效。
