# MCP 与本地 RPA 的结合点 桌面自动化的边界

chayuan-desktop 桌面单机版能通过 MCP 工具做本地 RPA（桌面自动化）。这一篇讲结合点和边界。

## RPA 是什么

机器人流程自动化（Robotic Process Automation）。让程序代替人操作 Windows / macOS / Linux 桌面。

点鼠标。

输入键盘。

读取屏幕文字。

调用应用 API。

UI Path、Automation Anywhere、Power Automate 都是。

## chayuan-desktop + RPA 的场景

场景一。用户问 帮我把每天 9 点的销售报表发邮件给老板。chayuan-desktop 调用 RPA 工具自动跑流程。

场景二。LLM 决定 我需要从 ERP 系统下载某报表。RPA 工具自动登录 ERP 点击下载。

场景三。重复性数据录入。LLM 分析后让 RPA 录入。

## RPA 的 MCP 工具

社区有。

playwright-mcp。Web 自动化。

pyautogui-mcp。桌面级鼠标键盘控制。

uipath-mcp。商业 UIPath 集成。

power-automate-mcp。微软 Power Automate。

每个有自己擅长场景。

## chayuan-desktop 的 RPA 边界

边界一：仅本机。chayuan-desktop 的 RPA 只控制本机 GUI。不远程控制其他机器。

边界二：用户授权。每次 RPA 操作前 chayuan-desktop 弹用户确认。

边界三：可中断。用户能随时按 ESC 终止。chayuan-desktop 监控键盘事件。

边界四：审计。每次 RPA 操作记录详细日志。

## 安全风险

RPA 操作有副作用。能。

发邮件。

删文件。

提交订单。

调系统 API。

LLM 误操作或 prompt injection 攻击可能让 RPA 干坏事。

chayuan-desktop 的策略。

策略一。RPA 工具默认 require_confirm。每次执行前用户必须 OK。

策略二。RPA 操作分级。读取屏幕、移鼠标 = 低风险，自动允许。点击、输入、提交 = 高风险，确认。

策略三。某些极敏感操作（删文件、转账、发文档）即使用户 总是允许 也每次确认。

## 实际工作流示例

用户问 帮我登录 ERP 把今天的订单导出到 Excel。

LLM 决策。

调 playwright-mcp.open_url（打开 ERP）。

用户确认（首次）。

playwright 调用 evaluate（执行 JS 输入用户名）。

需要密码。chayuan-desktop 从 Stronghold 安全存储拉。

playwright 自动填表单提交。

playwright 截图（调试）。

playwright 点击 订单管理 - 今日订单 - 导出。

playwright 等待下载完成。

调 file_read 读 Excel 内容验证。

用 chart_render 生成可视化。

回答用户。

整个流程 LLM 编排，用户在关键节点确认。

## 国产化场景

党政军场景的 RPA 接入内部 OA、ERP、财务系统。chayuan-desktop 的 MCP RPA 让 AI 能 做事 而非只是 答题。

某些场景对自动化有合规要求（操作审计）。chayuan-desktop 的审计满足。

## chayuan-server 的对应

chayuan-server 多用户场景下 RPA 跑在用户的桌面（不在服务器）。chayuan-desktop 是 RPA 的执行端。即使用户连 chayuan-server，本地 RPA 仍然是 chayuan-desktop 跑。

## WPS 加载项

chayuan-wps 在 WPS 里发起的某些请求需要 RPA。比如 帮我把这报告发邮件给老板。chayuan-wps → chayuan-desktop → email-mcp 或 RPA。员工感知就是 AI 帮我跑完了流程。

## 总结

MCP 与本地 RPA 的结合是 chayuan-desktop 在 AI 实操能力上的工程探索。免费开源的AI软件 让 AI 不只是问答助手 也是 自动化执行器。chayuan-desktop 的边界控制（仅本机 + 用户授权 + 审计）让 RPA 安全。
