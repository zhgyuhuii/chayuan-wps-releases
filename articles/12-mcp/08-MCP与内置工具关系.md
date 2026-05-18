# MCP 与内置工具的关系 谁是谁的子集

chayuan-desktop 桌面单机版同时有 内置工具 和 MCP 工具。两者关系需要厘清。这一篇讲。

## 内置工具是什么

chayuan-desktop 自带的 30+ 工具。

web_search。web_fetch。kb_search。kb_create。kb_add_doc。code_execute。file_read。file_write。data_query（SQL）。chart_render。等等。

这些工具直接打包在 chayuan-desktop 二进制里。开箱即用。

## MCP 工具是什么

通过 MCP 协议接入的外部工具。一般作为子进程（stdio）或独立服务（SSE）。

例如。github-mcp-server。slack-mcp。filesystem-mcp。jira-mcp。等等。社区生态丰富。

需要用户安装 + 配置。

## 重叠的部分

某些功能两边都有。

web_search。chayuan-desktop 内置一个（基于多搜索引擎）。社区也有 web-search-mcp。

filesystem。chayuan-desktop 内置 file_read/write。社区有 filesystem-mcp 同样功能。

重叠时该用哪个。

## chayuan-desktop 的策略

策略一：内置优先。日常基础功能（搜索、文件、SQL、图表）走内置。性能好，无外部依赖。

策略二：MCP 补充。专有系统（GitHub、Slack、Jira、特定企业系统）走 MCP。这些功能 chayuan-desktop 自己实现成本高，社区已有现成的。

策略三：用户偏好。用户能在配置里指定。比如禁用内置 web_search 走 web-search-mcp。

## 工具命名空间

避免冲突。chayuan-desktop 给每个工具加命名空间前缀。

```
builtin.web_search
builtin.kb_search
mcp.github_mcp.list_repos
mcp.slack_mcp.send_message
```

LLM 在工具列表里看到完整命名空间，不会混淆。

## 工具描述的统一

不管是内置还是 MCP，工具的元数据格式一致。

```json
{
  "name": "...",
  "description": "...",
  "parameters": { ... }
}
```

OpenAI tools 格式或 MCP 格式互转。chayuan-desktop 内部统一表示。

## 调用差异

内置工具。chayuan-desktop 进程内调用。低延迟（毫秒级）。

MCP 工具。子进程 / 远程调用。延迟 10-100ms（stdio）或 50-500ms（SSE）。

延迟差异不大。用户感知不到。

## 安全模型

内置工具。chayuan-desktop 控制安全。能严格限制（如禁止任意路径文件访问，必须在 KB 范围内）。

MCP 工具。第三方实现。chayuan-desktop 不知道工具内部什么权限。靠 进程隔离 + 用户确认 控制风险。

某些极敏感场景用户只允许内置工具。设置里有 仅内置 模式。

## 演化方向

MCP 协议在演进。某些功能可能从内置迁到 MCP（让 chayuan-desktop 更精简）。

也可能某些热门 MCP 工具被 内置化（默认装）。

策略灵活。

## 国产化场景

党政军内网部署。MCP 第三方工具接入需要审批。chayuan-desktop 内置工具开箱即用免审批。

某些场景部门有专门 MCP 工具（接 OA、ERP 等）。chayuan-desktop 接入按规范配置。

## chayuan-server 的对应

chayuan-server 多用户场景下工具管理更精细（不同用户工具权限不同）。chayuan-desktop 单机简化。

## WPS 加载项

chayuan-wps 在 WPS 里调用 chayuan-desktop 的工具。内置和 MCP 在 WPS 里都能用。透明。

## 总结

MCP 与内置工具的关系是 chayuan-desktop 在工具生态上的工程取舍。免费开源的AI软件 让 默认开箱即用 + 社区扩展 兼顾。chayuan-desktop 的命名空间 + 统一描述 + 用户偏好让两者协同共存。
