# MCP 工具的审计 回放与重现

chayuan-desktop 桌面单机版的 MCP 工具调用支持审计回放。这一篇讲。

## 审计的目的

目的一：合规。等保和合规场景要求工具调用可审计。

目的二：故障排查。某次工具调用结果不对，回看原始调用排查。

目的三：行为分析。看用户和 LLM 的工具使用模式，优化体验。

目的四：安全。检测异常调用模式。

## 审计记录的字段

每次工具调用记录。

```json
{
  "timestamp": "2026-05-10T14:23:11Z",
  "trace_id": "abc123",
  "user_id": "zhangsan",
  "session_id": "sess_xyz",
  "tool_name": "github_mcp.list_repos",
  "input": {"user": "octocat"},
  "output_full": "{...完整 JSON...}",
  "duration_ms": 234,
  "status": "success",
  "caller": "llm_chat:gpt-4o",
  "user_confirmed": true
}
```

完整可重现。

## 回放的实现

chayuan-desktop 设置 - 审计 - 工具调用历史。

每条记录能展开看完整 input 和 output。

```
[2026-05-10 14:23] github_mcp.list_repos
  Input: {"user": "octocat"}
  Output: [{"name": "...", "stars": 42}, ...]
  Duration: 234ms
  Status: ✓
  
  [回放] [复制 input] [导出]
```

回放 重新跑一次工具调用。看是否结果跟上次一致。

## 上下文回放

某次工具调用是 LLM 多步推理中的一环。审计记录 trace_id 关联整个会话。

```
trace abc123:
  [t=0] LLM 收到用户问题 "帮我查 Octocat 的仓库"
  [t=1] LLM 调 github_mcp.list_repos({"user": "octocat"})
  [t=2] 用户确认
  [t=3] 工具返回 5 个仓库
  [t=4] LLM 整合答案给用户
```

完整链路一目了然。

## 审计的存储

写入本地 SQLite 表。跟普通审计日志分开（避免干扰）。

默认保留 30 天。设置里能调到更长（等保要求 6 个月）。

## 异常检测

chayuan-desktop 内置规则。

短时间大量同一工具调用。可能是脚本爬数据或 LLM 死循环。

非常用时段调用敏感工具（凌晨发邮件）。可疑。

被拒绝后短时间重新尝试。可能 prompt injection 攻击。

异常触发提示用户。

## 导出审计日志

设置 - 审计 - 导出。CSV 或 JSON 格式。

某些政企场景集成到 SIEM 系统。chayuan-desktop 支持配 Syslog forward。

## 审计的不可篡改

审计日志一旦写入只读。chayuan-desktop 不提供修改接口。

更高保证用哈希链（每条记录含前一条哈希）。任何篡改都能检测。

## 删除请求

某些场景用户希望删某段时间的审计（个人隐私需求）。chayuan-desktop 支持删除但记录 删除审计 的元审计（说明谁在什么时候删了什么）。

合规和隐私之间的平衡。

## 国产化场景

党政军等保 2.0 三级要求审计完整、保留 6 个月+。chayuan-desktop 的审计实现满足。

工具调用审计是 AI 系统合规的关键。chayuan-desktop 给政企提供完整审计能力。

## chayuan-server 的对应

chayuan-server 多用户场景下审计集中。chayuan-desktop 单机本地。共享审计记录格式。

## WPS 加载项

chayuan-wps 在 WPS 里调用工具时记录到 chayuan-desktop 审计。target_app=wps 字段区分。

## 总结

MCP 工具的审计与回放是 chayuan-desktop 在合规和可追溯上的工程支持。免费开源的AI软件 让 工具调用 在事后可回看可重现。chayuan-desktop 的完整审计 + 异常检测 + 导出能力让政企采购合规。
