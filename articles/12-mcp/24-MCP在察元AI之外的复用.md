# MCP 在察元 AI 之外的复用 给团队工具链一个标准

chayuan-desktop 桌面单机版用的 MCP 工具能在 chayuan-desktop 之外复用。这一篇讲。

## MCP 的开放性

MCP（Model Context Protocol）。Anthropic 开源协议。任何 AI 应用都能用。

工具一次开发，所有 MCP 客户端都能用。

## 已支持 MCP 的 AI 应用

Claude Desktop（Anthropic 官方）。

Cline（VS Code 扩展）。

Continue（VS Code 扩展）。

Goose（block 公司开源）。

Zed（编辑器）。

chayuan-desktop。

每个都能用同一套 MCP 工具。

## 团队工具链的统一

某团队写了内部 MCP 工具（如 corp-jira-mcp、corp-oa-mcp）。

部署到团队 npm 私服。

不同员工用不同 AI 应用。

写 PR 的开发者用 Cline + corp-jira-mcp。

PM 用 chayuan-desktop + corp-jira-mcp。

设计师用 Claude Desktop + corp-jira-mcp。

同一个工具，不同使用方。投资单点开发，多点收益。

## chayuan-desktop 跟其他 MCP 客户端的差异

差异一：chayuan-desktop 重在 知识库 + RAG。其他客户端轻在 RAG。

差异二：chayuan-desktop 集成 WPS。其他不集成办公软件。

差异三：chayuan-desktop 支持本地推理（Ollama 集成）。Claude Desktop 必须用 Anthropic API。

差异四：chayuan-desktop 国产化适配。其他不针对中国市场。

每个客户端各有侧重。MCP 工具复用是协同。

## chayuan-desktop 当 MCP server

chayuan-desktop 也能 当 MCP server。它的某些能力暴露给其他 MCP 客户端用。

```
chayuan-desktop 暴露的 MCP server:
  - kb_search: 检索 chayuan-desktop 的本地 KB
  - office_search: 检索办公私库
  - kb_create: 创建新 KB
```

某开发者在 Cline 里需要查 chayuan-desktop 的 KB。配置 chayuan-desktop 作为 Cline 的 MCP server。Cline 通过 MCP 调 chayuan-desktop 的 kb_search。

数据互通。

## 双客户端模式

某员工同时用 chayuan-desktop 和 Claude Desktop。

chayuan-desktop 重日常办公（WPS、私库、RAG）。

Claude Desktop 重高质量长文写作。

两者用同一套 MCP 工具（github、slack、jira）。

也通过 MCP 互通（Claude Desktop 能查 chayuan-desktop 的 KB）。

## 团队 MCP 工具的治理

工具治理建议。

第一：仓库集中。所有内部 MCP 工具放公司 GitLab 私库。

第二：版本规范。语义化版本号。breaking change 要发 major 版本通知。

第三：文档。每个工具有 README 说明用途、参数、限制。

第四：测试。每个工具有测试集（chayuan-desktop 内置 MCP 工具测试框架）。

第五：审批。新工具上线前管理员审批（安全性、合规性）。

## 跨团队工具共享

某团队的 sales-mcp（接销售系统）。其他团队也想用。

发布到内部 npm 共享。其他团队 chayuan-desktop 配置相同 npm 源能拉。

跨团队工具复用降低重复开发。

## 标准的力量

MCP 在快速演进成业界标准。

工具开发者投资 MCP 工具有保障（多客户端可用）。

AI 应用开发者投资 MCP 集成有保障（无限工具生态）。

用户投资 MCP 工具熟练度有保障（换 AI 应用工具仍能用）。

chayuan-desktop 加入 MCP 生态是合理选择。

## 国产化场景

党政军场景内部 MCP 工具治理。chayuan-desktop 的工具市场 + 内网仓库 + 审批让 国产 MCP 生态 在内部建立。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 是企业级（管理员统一管理）。chayuan-desktop 单机用户级。两者协同。

## WPS 加载项

chayuan-wps 调 chayuan-desktop 的 MCP 工具。如果某工具被多 AI 应用复用，chayuan-wps 跟着受益。

## 总结

MCP 在察元 AI 之外的复用是 chayuan-desktop 在生态开放性上的工程定位。免费开源的AI软件 让 工具一次开发多 AI 应用受益。chayuan-desktop 的双角色（client + server）让团队工具链有标准。
