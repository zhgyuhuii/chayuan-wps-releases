# 自定义一个 MCP 工具 从空白到接入察元的 30 分钟

chayuan-desktop 桌面单机版接入自定义 MCP 工具的实操教程。30 分钟从空白到接入。这一篇讲。

## 场景

某员工想把内部 OA 系统的 我的待办 接入 chayuan-desktop。这样问 AI 我有什么待办 时能直接调用 OA。

需要写个 MCP 工具。

## 第一步 选语言

MCP 协议本身语言无关。常见 SDK。

Python。MCP 官方 Python SDK 完善。

Node.js / TypeScript。同样官方支持。

Rust / Go。社区有但生态弱。

我们选 Python。30 分钟内能搞定。

## 第二步 项目结构

```
my_oa_mcp/
  pyproject.toml
  my_oa_mcp/
    __init__.py
    server.py
```

## 第三步 安装 SDK

```bash
pip install mcp
```

## 第四步 写 server.py

```python
from mcp.server import Server
from mcp.types import Tool, TextContent
import asyncio
import httpx

server = Server("my-oa-mcp")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="list_todos",
            description="列出当前用户的 OA 待办事项",
            inputSchema={
                "type": "object",
                "properties": {},
                "required": []
            }
        )
    ]

@server.call_tool()
async def call_tool(name, arguments):
    if name == "list_todos":
        # 调内部 OA API
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://oa.corp.com/api/todos",
                headers={"Authorization": f"Bearer {get_oa_token()}"}
            )
            data = resp.json()
        return [TextContent(type="text", text=str(data))]

def get_oa_token():
    import os
    return os.environ.get("OA_TOKEN", "")

if __name__ == "__main__":
    asyncio.run(server.run_stdio())
```

代码 30 行。功能齐全。

## 第五步 测试

```bash
OA_TOKEN=xxx python -m my_oa_mcp.server
```

启动后 stdio 等待 chayuan-desktop 通信。

## 第六步 接入 chayuan-desktop

chayuan-desktop 设置 - MCP - 添加 MCP 服务器。

```yaml
name: my-oa-mcp
command: python
args: ["-m", "my_oa_mcp.server"]
env:
  OA_TOKEN: <your_token>
cwd: /path/to/my_oa_mcp
```

保存。chayuan-desktop 启动子进程。

## 第七步 验证

聊天界面问 我有什么待办。

LLM 决定调 list_todos。chayuan-desktop 转发给 my-oa-mcp 子进程。子进程调 OA API 拿数据。返回。LLM 整合答案。

成功。

## 时间估算

第一步选语言：1 分钟。

第二步项目结构：2 分钟。

第三步安装 SDK：2 分钟（含 pip install）。

第四步写代码：10 分钟。

第五步本地测试：5 分钟。

第六步接入 chayuan-desktop：3 分钟。

第七步验证：5 分钟。

加上调试时间：30 分钟内。

## 进阶

工具一：参数化。让 list_todos 支持 status 参数（pending/done）。

工具二：多工具。同一个 MCP 服务器内含多个工具。create_todo、complete_todo、delete_todo。

工具三：错误处理。OA API 失败时返回明确错误给 LLM。

工具四：缓存。短时间内多次相同调用走缓存。

工具五：流式返回。某些工具结果大，流式返回。

## 分享给同事

把 my-oa-mcp 发布到内部 git 或 npm 私服。其他同事 chayuan-desktop 配置克隆 + 安装。

## 国产化场景

党政军内网场景。MCP 工具开发跟外网差不多。安装走内网镜像。审批通过的工具可纳入部门标准 MCP 列表。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 工具部署在服务器，多用户共享。chayuan-desktop 单机各自跑。开发流程一致。

## WPS 加载项

chayuan-wps 在 WPS 里调用自定义 MCP 工具走 chayuan-desktop。员工写报告时用 OA 待办数据。

## 总结

自定义 MCP 工具从空白到接入 chayuan-desktop 30 分钟内完成。免费开源的AI软件 让 业务系统接入 AI 是简单事。chayuan-desktop 的 MCP 接入流程让员工自己也能写工具。
