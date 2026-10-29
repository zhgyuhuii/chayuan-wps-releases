---
id: W38
title: 外部智能体接入 MCP（Claude Code / Codex / Cursor 等）
entry: Claude Code/Codex/Cursor 配置
level: P0
tags: [MCP, Claude Code, Codex, Cursor, 接入配置]
status: draft
---

## 一句话说明

本机 MCP 服务跑起来后（见 [W37](./W37-启动本机MCP服务.md)），任何支持 Streamable HTTP MCP 的智能体客户端都可以用**同一个 URL** `http://127.0.0.1:62588/mcp` 接入，直接读写你本机的 WPS 文档——无需 Token、无需命令行参数、无需 stdio。本篇给出各家客户端的具体配置位置与接入后的验证方法。

## 适用场景

- 想让 Claude Code / Codex / Cursor / Claude Desktop / OpenClaw 等外部智能体直接操作当前 WPS 文档；
- 配置写好了但智能体连不上、看不到工具，需要排查；
- 智能体在另一台机器上，想远程调用本机文档服务。

典型提问（chabot 语料视角）：

- 「怎么让 Claude Code 直接操作我的 WPS 文档？」
- 「MCP 端口是多少？连接地址怎么填？」
- 「多文档批量校对怎么做？」（接入后让智能体调 `document_list_open` + `document_activate` 切换文档逐篇校对，工具面见 [W39](./W39-MCP工具面总览.md)）

## 前置条件

- 本机 MCP 服务已启动：`curl http://127.0.0.1:62588/healthz` 返回 `"ok": true`（没起先看 [W37](./W37-启动本机MCP服务.md)）。
- WPS 已打开且察元加载项已启用（[W02](./W02-在WPS中启用加载项.md)）——否则能连上服务，但工具会报 `WPS_AGENT_OFFLINE`。
- 客户端需支持 **Streamable HTTP** 传输的 MCP（不绑定特定 IDE；不支持 stdio/npx 型配置的写法对本服务无效）。

## 操作步骤

连接信息只有一个，所有客户端通用：**`http://127.0.0.1:62588/mcp`**，免 Token。服务名（下例 `chayuan-wps-mcp`）可自定，保持一致便于识别。

**Claude Code**

1. 在哪：终端（任一目录）。
2. 做什么：执行一键注册命令：

   ```bash
   claude mcp add --transport http chayuan-wps-mcp http://127.0.0.1:62588/mcp
   ```

   或在项目/用户级 `.mcp.json` 里写：

   ```json
   {
     "mcpServers": {
       "chayuan-wps-mcp": { "url": "http://127.0.0.1:62588/mcp" }
     }
   }
   ```

3. 看到什么：命令执行完无报错；会话内该 server 可用（验证见下文）。

**OpenAI Codex（codex CLI）**

1. 在哪：配置文件 `~/.codex/config.toml`。
2. 做什么：加入一段 Streamable HTTP MCP server：

   ```toml
   [mcp_servers.chayuan-wps-mcp]
   url = "http://127.0.0.1:62588/mcp"
   ```

3. 看到什么：保存完成后，按「验证」一节的方法确认该 server 已被识别。

**Cursor**

1. 在哪：项目级 `.cursor/mcp.json`，或 Cursor 设置 → MCP → Add。
2. 做什么：写入与上面相同的 JSON（`"mcpServers": { "chayuan-wps-mcp": { "url": … } }`）。
3. 看到什么：设置 → MCP 面板里该服务出现并可展开工具列表。

**Claude Desktop / 其它 JSON 配置型客户端**

配置文件里写同款 `mcpServers` JSON（同上）。

**Hermes / OpenClaw 等 GUI 客户端**

新建 MCP 服务，类型选 **HTTP / Streamable HTTP**，URL 填 `http://127.0.0.1:62588/mcp`（无需 Token、无需命令、无需 stdio）。

**远程机器（智能体不在本机）**

服务固定只监听 `127.0.0.1`，另一台机器不能直连你的 IP:62588——这是「涉密不出域」的安全设计。要让远程机器调用，需在本机做代理转发（如 SSH 隧道把远端端口转到本机 62588），远端再连转发后的地址。

**接入后智能体能做什么**

一句话：读写当前打开的 WPS 文字/表格/演示文档——检查错别字并写成批注、逐段翻译插在段后、批量替换、脱密与复原、按模板生成整套文档、操作表格与幻灯片等。完整工具面见 [W39](./W39-MCP工具面总览.md)；可复制的中提示词素材见 `docs/mcp-connection.md`「常用使用场景与提示词」与 README 同名节。

### 验证

由易到难，任选其一：

1. **健康检查**：浏览器或 `curl http://127.0.0.1:62588/healthz` 返回含 `"ok": true` 的 JSON——服务活着。
2. **客户端侧列出工具**：Claude Code 执行 `claude mcp list` 应列出 `chayuan-wps-mcp`；Codex 在会话内输入 `/mcp` 查看已连 server；Cursor 在设置 → MCP 面板看该服务的状态与工具列表。
3. **让智能体自报状态**：在智能体里让它调用 `wps_status`（不给参数），返回里 `agent.agentOnline` 为 `true` 表示 WPS 加载项在线，`document.*` 是当前活动文档信息。
4. **一句话冒烟**：打开任意 WPS 文档，在智能体里说「用察元读一下当前文档的前三段，告诉我大致在讲什么」——读到了你屏幕上的内容即接入成功。
5. **MCP Inspector（不依赖 IDE）**：`npx @modelcontextprotocol/inspector`，传输选 Streamable HTTP，填上述 URL 点 Connect，能看到完整工具列表并手动调用。

## 常见问题

**Q1：`claude mcp add` 或客户端连接报错？**
按顺序查：先 `curl http://127.0.0.1:62588/healthz` 确认服务在跑（没跑看 [W37](./W37-启动本机MCP服务.md)）；再确认 URL 以 `/mcp` 结尾、传输类型是 http（Streamable HTTP），不是 stdio/npx；本机回环地址不要写成 `localhost` 以外的 IP。

**Q2：连上了，但调工具报 `WPS_AGENT_OFFLINE`？**
sidecar 活着、WPS 加载项没连上：打开 WPS、确认加载项已启用（[W02](./W02-在WPS中启用加载项.md)），加载项会自动重试注册；也可在助手窗格健康灯处确认（[W09](./W09-文档智能体开关.md)）。

**Q3：需要填 Token 吗？看到文档说 `/agent/*` 要 token？**
外部智能体不需要。`/mcp` 上的文档工具对回环连接开放；要 token 的是加载项内部的 `/agent/*` 长任务通道和脱密等敏感通道，那由 WPS 加载项自己持有，外部客户端无需关心。

**Q4：智能体报 `DOCUMENT_TOO_LARGE`？**
文档太长（约 8 万字符以上）不允许一次拉全文。让它改用 `document_chunks` 分块读，或用 `document_meta` 先看建议——这是设计行为，不是故障（见 [W39](./W39-MCP工具面总览.md) 的长文剧本）。

**Q5：写操作怎么避免智能体乱改文档？**
协议内置「预览→确认」：`document_replace`/`document_insert`/`document_apply_ops` 不带 `confirmed: true` 时只返回预览不落盘；加批注、脱密等硬性要求 `confirmed: true` 才执行。可直接给智能体下规则：「先 dryRun/预览汇总给我，我确认后再写」。

## 形态差异

- 三平台（Windows/macOS/Linux）配置方法完全一致，只是 WPS 端宿主不同；服务地址恒为 `127.0.0.1:62588`。

## 事实来源

- `docs/mcp-connection.md`（各客户端配置原文：Claude Code `claude mcp add --transport http …` 与 `.mcp.json`、Codex `~/.codex/config.toml`、Cursor `.cursor/mcp.json` 与「设置 → MCP → Add」、Hermes/OpenClaw HTTP 类型、Claude Desktop JSON、MCP Inspector、免 Token 说明）
- `docs/user-manual.zh-CN.md`（「服务固定监听 127.0.0.1:62588……要让另一台机器调用，需经本机代理转发……涉密不出域」；验证四法：healthz / `wps_status` / 一句话冒烟 / Inspector；技能文件投放位置 `~/.claude/skills/wps-skill-chayuan` 等）
- `mcp-sidecar/server.mjs`（`/mcp` 免 token、仅监听 127.0.0.1、`/agent/*` token 门禁为内部通道、CORS）
- `mcp-sidecar/lib/mcpHandler.mjs`（`WPS_AGENT_OFFLINE`、`DOCUMENT_TOO_LARGE`、`CONFIRMATION_REQUIRED` 等错误码出口；`document_replace/insert/apply_ops` 未 confirmed 走预览）
- 互链：`docs/user-tutorials/W37-启动本机MCP服务.md`、`W39-MCP工具面总览.md`
