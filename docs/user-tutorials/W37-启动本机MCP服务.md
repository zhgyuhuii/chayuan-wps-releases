---
id: W37
title: 启动本机 MCP 服务（62588 文档智能体）
entry: npm run mcp:sidecar / start-mcp.cmd
level: P0
tags: [MCP, sidecar, 服务启动, 开机自启]
status: draft
---

## 一句话说明

本机 MCP 服务（sidecar）是察元 AI 文档助手的「文档智能体」底座：它在 `http://127.0.0.1:62588` 提供一套 Streamable HTTP MCP 接口，让 WPS 内的助手面板和 Claude Code、Codex、Cursor 等外部智能体都能读写你本机的 WPS 文档。本篇讲怎么把它跑起来、设成开机自启、以及怎么确认它活着。

## 适用场景

- 想让 Claude Code / Codex / Cursor 直接操作 WPS 文档，第一步是把本机 MCP 服务跑起来；
- 助手窗格里文档智能体显示「未就绪」，需要手动拉起服务；
- 重启电脑后不想每次手动启动，想设成开机自启。

典型提问（chabot 语料视角）：

- 「MCP 端口是多少？怎么启动本机 MCP 服务？」
- 「怎么让服务开机自动启动，不用每次手动跑？」
- 「healthz 一直连不上，MCP 服务到底起没起来？」

## 前置条件

- 已按 [W01](./W01-下载与安装.md)/[W02](./W02-在WPS中启用加载项.md) 装好察元 AI 文档助手加载项（服务要操作文档，还需 WPS 打开且加载项已启用，`agent` 才会在线）。
- 启动方式二选一：
  - **命令行方式**（`npm run mcp:sidecar` 或 `node mcp-sidecar/server.mjs`）：需要本机有 Node.js；
  - **免 Node 方式**：直接运行 `mcp-sidecar/bin/` 下的预编译单文件二进制，或双击 `mcp-sidecar/start-mcp.cmd`（Windows，优先跑二进制，找不到二进制才回落找 node；官方自启说明口径：开发态无二进制时需 Node.js 18+）。
- 服务**只监听 `127.0.0.1`（本机回环）**，这是「涉密不出域」的安全设计——另一台机器不能直接连你的 62588 端口。

## 操作步骤

**方式 A · 在 WPS 里一键启动（最省事）**

1. 在哪：WPS 助手窗格输入区机器人图标（文档智能体下拉），或 设置 → 「MCP 服务管理」。
2. 做什么：服务未运行时，消息区顶部出现软横幅「**本机文档服务未就绪，发送将使用内置助手**」，点横幅右侧「**一键启动**」；或在设置页点「**启动本机服务**」按钮（两条路走同一条启动链路：沿候选链自动选启动方式——Windows 上隐藏启动的 `start-mcp.cmd` 排在二进制之前，再到 `npm run mcp:sidecar`、`node mcp-sidecar/server.mjs`）。
3. 看到什么：按钮变「**正在启动…**」，成功后横幅消失、健康灯变绿、状态为「**本机文档服务已启动**」。详见 [W09](./W09-文档智能体开关.md)。

**方式 B · 命令行启动（开发/排障常用）**

1. 在哪：仓库根目录的终端。
2. 做什么：执行 `npm run mcp:sidecar`（等价于 `node mcp-sidecar/server.mjs`）。
3. 看到什么：终端依次输出 `listening http://127.0.0.1:62588`、`MCP http://127.0.0.1:62588/mcp`、`healthz http://127.0.0.1:62588/healthz`、`dataDir <数据目录>`，以及一行鉴权说明 `auth token-gated: /agent/*, /upstream/allowlist POST, declassify_* tools`。关掉这个终端（Ctrl+C）服务即停止。

**方式 C · 免 Node 直接跑二进制 / 双击脚本**

1. 在哪：`mcp-sidecar/bin/` 目录（按平台取用：`chayuan-mcp-windows-x64.exe`、`chayuan-mcp-macos-arm64`、`chayuan-mcp-macos-x64`、`chayuan-mcp-linux-arm64`、`chayuan-mcp-linux-x64` 共 5 个；源码仓库可用 `npm run mcp:build-binary` 重新构建）。
2. 做什么：直接运行对应平台二进制；Windows 也可双击 `mcp-sidecar/start-mcp.cmd`（macOS/Linux 对应 `mcp-sidecar/start-mcp.sh`）——脚本会先探测 62588 是否已健康（已健康就静默退出），再优先启动二进制、失败回落 node，日志写在脚本旁的 `sidecar-start.log`。

**设为开机自启**

- **安装包用户**：安装器已自动注册 OS 级自启，无需操作——Windows 写注册表 `HKCU\...\Run\ChayuanWpsMcp` 并释放二进制到 `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\`，另建每 2 分钟一次的看门狗计划任务 `ChayuanWpsMcpWatch`；macOS 注册 LaunchAgent `com.chayuan.mcp`（`RunAtLoad` + `KeepAlive`）；Linux 注册 systemd 用户单元 `chayuan-mcp.service`（`Restart=on-failure`）。
- **手动注册/卸载**：运行对应平台脚本 `mcp-sidecar/autostart/install-windows-user.cmd`（卸载加 `/uninstall` 参数）、`install-macos-launchagent.sh`、`install-linux-user.sh`。

**启动后自动发生的几件事**

- 数据目录被创建（下称 dataDir）：Windows 为 `%LOCALAPPDATA%\chayuan-wps\mcp\`，macOS/Linux 为 `~/.config/chayuan-wps/mcp/`（可用环境变量 `CHAYUAN_MCP_DATA_DIR` 改）。
- 发现文件 `mcp-server.json` 写入 dataDir，含服务地址（url/port）与探测到的 WPS 可执行文件路径。
- 写入审计与运行日志 `audit.jsonl`（dataDir 下），每 3 秒刷新心跳文件 `runtime/sidecar-heartbeat.json`。
- 同一时刻只允许一个实例：重复启动会提示 `already running` 并退出；端口被占（`EADDRINUSE`）会退出并提示 port in use。

### 验证

1. 浏览器或终端访问 `curl http://127.0.0.1:62588/healthz`：应返回 JSON，含 `"ok": true` 和 `"name": "chayuan-wps-mcp"`。
2. 同一返回里的 `agent.agentOnline` 为 `true` 表示 WPS 加载项已连上（没开 WPS 时为 `false`，属正常——开了 WPS 并启用加载项后即变 true）。
3. `curl http://127.0.0.1:62588/token`：返回服务 `url` 与 `port`（`/mcp` 本身免 token，外部客户端无需它）。

## 常见问题

**Q1：启动时报端口被占 / `already running pid=…`？**
服务是单实例的，说明已经有一个 sidecar 在跑（可能来自自启或加载项自动拉起）。先用 `/healthz` 确认——健康就直接用，不必再起一个；确实是僵死进程就结束它（见 Q4）再启动。改端口用环境变量 `CHAYUAN_MCP_PORT`，改了端口客户端连接地址也要跟着改。

**Q2：`/healthz` 返回正常，但助手面板仍显示未就绪？**
服务活着、是 WPS 加载项没连上：确认 WPS 已打开且加载项已启用（见 [W02](./W02-在WPS中启用加载项.md)）；若横幅显示「**本机服务在运行，但应用安全层拦截了加载项的连接——请在设置中信任察元AI加载项（或确认安全弹窗）后重启应用**」，按提示信任后重启应用（这条横幅没有一键启动按钮，拉起服务解决不了拦截）。

**Q3：外部智能体连接报 401 / `unauthorized`？**
普通文档工具走 `/mcp`，不需要 token；401 出现在 `/agent/*` 等内部通道（加载项专属）。外部智能体只需配置 `http://127.0.0.1:62588/mcp`（见 [W38](./W38-外部智能体接入MCP.md)）；若你确实在调内部通道，token 在 dataDir 的 `token` 文件里，请求头带 `X-Chayuan-Token`。

**Q4：想停掉服务怎么办？**
前台方式启动的在终端按 Ctrl+C；找不到终端就结束 `chayuan-mcp`（二进制）或 `node server.mjs` 进程。设置页在端口冲突时也会提示：「请在运行 sidecar 的终端按 Ctrl+C 停止，或结束 chayuan-mcp / node server.mjs 进程。」设了自启的先卸载自启（autostart 脚本 `/uninstall` 或删对应 LaunchAgent/服务），否则看门狗会再拉起来。

**Q5：另一台电脑能直接连我这台的 62588 吗？**
不能。服务固定只监听 `127.0.0.1`（涉密不出域的设计）。跨机使用需在本机做代理/SSH 转发，见 [W38](./W38-外部智能体接入MCP.md) 的「远程机器」节。

## 事实来源

- `package.json`（`mcp:sidecar` = `node mcp-sidecar/server.mjs`；`mcp:build-binary` = `node scripts/build-mcp-binary.mjs`）
- `mcp-sidecar/lib/config.mjs`（`DEFAULT_PORT = 62588`、`/mcp`、`/healthz`、dataDir 三平台路径、`CHAYUAN_MCP_PORT/CHAYUAN_MCP_DATA_DIR/CHAYUAN_MCP_TOKEN`、token 文件、单实例锁文件）
- `mcp-sidecar/server.mjs`（监听 `127.0.0.1`、启动输出、`/healthz` 返回结构、`/mcp` 免 token、`/agent/*` token 门禁与 401 留痕、`GET /token?bootstrap=1`、`already running` 退出码、`EADDRINUSE` 退出、audit 兼运行日志、`runtime/sidecar-heartbeat.json` 每 3 秒、`mcp-server.json` 写入）
- `mcp-sidecar/lib/auditLog.mjs`（`audit.jsonl` 落盘 dataDir）
- `mcp-sidecar/start-mcp.cmd`、`mcp-sidecar/start-mcp.sh`（健康静默退出、二进制优先、node 回落、`sidecar-start.log`）
- `mcp-sidecar/autostart/README.md` 及 `install-windows-user.cmd`（HKCU Run `ChayuanWpsMcp` + 计划任务 `ChayuanWpsMcpWatch` 每 2 分钟 + `%LOCALAPPDATA%\chayuan-wps\mcp\runtime\` + `/uninstall`）、`install-macos-launchagent.sh`（`com.chayuan.mcp`，`RunAtLoad`+`KeepAlive`）、`install-linux-user.sh`（`chayuan-mcp.service`，`Restart=on-failure`）、开发态无二进制需 Node.js 18+ 口径
- `mcp-sidecar/bin/`（5 个预编译二进制实名）
- `src/services/mcpBridge/sidecarLauncher.js`（加载项侧启动候选链：Windows 隐藏启动 `start-mcp.cmd` 排在二进制之前，另有 `npm run mcp:sidecar`/`node` 兜底；「请在运行 sidecar 的终端按 Ctrl+C 停止，或结束 chayuan-mcp / node server.mjs 进程。」）
- `src/components/SettingsDialog.vue`（设置页「启动本机服务」「运行 Spike」按钮、「本机 MCP sidecar（127.0.0.1:62588）未运行…」提示）
- `src/components/AIAssistantDialog.vue`（软横幅「一键启动/正在启动…」与授权自动拉起）
- `docs/mcp-connection.md`、`docs/user-manual.zh-CN.md`（安装器自启三平台与回环口径；两文档写 `mcp-sidecar/start-mcp.cmd`，与本目录实名一致——仓库根目录并无该文件）
- 互链：`docs/user-tutorials/W09-文档智能体开关.md`（横幅与自动拉起细节）
