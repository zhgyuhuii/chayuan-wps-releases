# 把察元AI接进Claude Desktop当MCP server

chayuan-desktop 桌面单机版作为 MCP server 让 Claude Desktop 等客户端能访问 chayuan-desktop 的能力。这一篇讲对接。

Claude Desktop 是什么。Anthropic 出的桌面对话客户端。支持 MCP 协议接外部工具。

接入步骤。

第一步：chayuan-desktop 启用 MCP server。设置 - MCP - 服务端配置。开启 SSE 模式，端口 62582（避免跟主端口 62581 冲突）。

第二步：在 Claude Desktop 配置文件加上 chayuan-desktop server。Claude Desktop 的配置文件在 ~/.claude_desktop_config.json（macOS）。加一段：

```
{
  "mcpServers": {
    "chayuan-desktop": {
      "url": "http://127.0.0.1:62582/sse"
    }
  }
}
```

第三步：重启 Claude Desktop。它会连 chayuan-desktop sidecar，发现可用工具。

第四步：在 Claude 里聊天。问 在 chayuan-desktop 里查找关于压力测试的内容。Claude 通过 MCP 调 chayuan-desktop 的 KB 查询工具。

chayuan-desktop 暴露的 MCP 工具。

工具一：search_kb。在指定 KB 检索。参数：query、ku_ids。返回：命中 chunk 列表。

工具二：list_kbs。列出所有可用 KB。

工具三：get_chunk。按 chunk_id 取详细内容。

工具四：search_history。检索对话历史。

工具五：list_models。列出已配模型。

工具六：execute_sql。在结构化 KB 跑 SQL（受 AST 校验保护）。

更多工具按需扩展。

权限边界。chayuan-desktop 单机版的 MCP server 默认绑 127.0.0.1，只允许本机连。如果要让其他机器连（团队场景），改 host = 0.0.0.0 + 配 token 鉴权。

实际用法。一个开发者同时用 Claude Desktop 跟 chayuan-desktop。Claude 写代码思考能力强。chayuan-desktop 提供本地 KB。开发者在 Claude Desktop 写代码时让它查 chayuan-desktop 里的内部技术规范。两边协同。

WPS AI 插件 chayuan-wps 也通过 sidecar 走，但是用 chayuan-desktop 自家 API 不走 MCP。MCP 主要给 chayuan-desktop 之外的客户端用。

把 chayuan-desktop 接进 Claude Desktop 是 chayuan-desktop 开放姿态的体现。免费开源的AI软件 不抢用户唯一入口，让用户选最适合的客户端。chayuan-desktop 提供后端能力。
