# MCP 工具的可观测 调用日志怎么写

chayuan-desktop 桌面单机版的 MCP 工具调用记录详细日志便于排查。这一篇讲。

## 日志记录的字段

每次 MCP 工具调用记录。

```json
{
  "timestamp": "2026-05-10T14:23:11Z",
  "tool_name": "github_mcp.list_repos",
  "input": {"user": "octocat"},
  "output_summary": "Returned 5 repos",
  "duration_ms": 234,
  "status": "success" | "failed",
  "error": null | "...",
  "caller": "session_xyz / chat_msg_abc"
}
```

完整调用链可追溯。

## 输入脱敏

某些工具输入含敏感信息（密码、token 不会，但可能查询里有 PII）。chayuan-desktop 日志里默认对输入做脱敏。

```
原: search_email(query="张三的电话 13800138000")
脱敏: search_email(query="[姓名]的电话 [电话号码]")
```

设置里能开 完整日志（不脱敏）便于调试。

## 输出摘要

工具输出可能很大（几 KB JSON）。日志记摘要不记完整。

```
returned 5 items, total 2.3KB
```

完整输出存到独立文件（仅在调试模式）。

## 实时查看

chayuan-desktop 设置 - MCP - 调用监控。

实时显示当前工具调用。

```
[14:23:11] github_mcp.list_repos → 234ms ✓
[14:23:15] github_mcp.get_repo("xxx") → 156ms ✓
[14:23:22] slack_mcp.send_message(...) → 1240ms ✗ rate_limited
```

便于实时排查。

## 历史聚合

按工具名聚合统计。

```
github_mcp:
  调用次数：120
  平均延迟：280ms
  成功率：95%
  最近错误：5 次 rate_limited
```

知道哪个工具频繁出问题。

## 错误分类

错误细分。

工具进程崩溃。子进程 SIGSEGV 等。chayuan-desktop 自动拉起。

工具返回错误。工具自身报错（API 限速、参数无效）。

工具超时。chayuan-desktop 设的超时（默认 30 秒）。

参数 schema 校验失败。LLM 给的输入不符合 schema。

每种错误对应处理。

## 调用链追踪

某次用户提问触发多个工具调用。chayuan-desktop 用 trace_id 关联。

```
trace_id: abc123
  → llm.chat (gpt-4o, 800ms)
    → tool_call: github_mcp.list_repos (234ms)
    → tool_call: web_fetch (450ms)
  → llm.chat (gpt-4o, 1200ms) 整合结果
  → 最终回答
```

便于看完整流程。

## 性能瓶颈识别

某些工具一直慢。日志聚合显示。

slack_mcp.send_message 平均 1.5 秒。

github_mcp.* 平均 300ms。

如果 slack_mcp 慢拖累整体响应。chayuan-desktop 提示用户考虑切到其他工具或检查网络。

## 日志保留

默认保留 30 天。设置里能调。

超过保留期自动归档（压缩）或删除。

## 导出

日志能导出 JSON 或 CSV。某些用户想用自家分析工具。

某些政企场景集成到 SIEM 系统。chayuan-desktop 支持配 Syslog forward。

## 国产化场景

党政军场景对工具调用审计是合规要求。chayuan-desktop 的 MCP 调用日志包含完整审计信息。等保 2.0 三级要求保留 6 个月，chayuan-desktop 默认 30 天可调到更长。

## chayuan-server 的对应

chayuan-server 多用户场景日志集中。chayuan-desktop 单机本地。共享日志格式。

## WPS 加载项

chayuan-wps 在 WPS 里调用 MCP 工具记录到 chayuan-desktop 日志。target_app=wps 字段区分。

## 总结

MCP 工具的可观测让 chayuan-desktop 的工具调用 不是黑盒。免费开源的AI软件 让用户对每次工具调用心中有数。chayuan-desktop 的实时 + 聚合 + 错误分类让 排查 工具问题简单。
