# MCP 工具的故障恢复 进程崩溃的拉起

chayuan-desktop 桌面单机版的 MCP 工具进程崩溃时自动拉起。这一篇讲。

## 崩溃的常见原因

原因一：工具自身 bug。某些 MCP 工具实现质量参差。某种输入导致空指针或 panic。

原因二：依赖出问题。Node.js / Python 运行时异常。

原因三：内存溢出。工具处理大输入时 OOM。

原因四：网络问题（SSE 模式）。底层连接断。

每种都需要应对。

## 自动拉起策略

chayuan-desktop 监督每个 MCP 工具子进程。

策略一：进程退出 → 自动重启。

```python
def supervise(tool_name):
    while True:
        process = start_tool(tool_name)
        process.wait()  # 阻塞直到进程结束
        log_warning(f"{tool_name} exited, restarting...")
        sleep(2)
```

策略二：连续失败 → 退避。

每次重启间隔指数增长（2s → 5s → 15s → 60s）。避免疯狂重启浪费 CPU。

策略三：累计失败超阈值 → 停用。

某工具 1 小时内崩 10 次。chayuan-desktop 临时停用，UI 提示用户 工具异常，已停用。

## 当前请求的处理

工具处理某请求时崩溃。

第一步。chayuan-desktop 检测到子进程异常退出。

第二步。当前请求标记为 失败。

第三步。返回错误给 LLM 作为 tool 消息内容。LLM 看到错误能尝试其他工具或告诉用户。

第四步。后台拉起工具新实例。

第五步。下次请求用新实例。

## SSE 模式的故障

SSE 长连接断。chayuan-desktop 自动重连。

重连失败几次（默认 3 次）后停用工具。提示用户检查网络或服务端。

## 资源限制

避免某工具吃光资源拖垮 chayuan-desktop。

CPU 限制。chayuan-desktop 用 cgroups（Linux）或 Job Object（Windows）限制工具最多用 50% CPU。

内存限制。每工具最多 2GB（默认）。超限被 OS 杀掉。

文件描述符。每工具最多 1024 个。

打开过多被拒绝。

## 工具的健康检查

chayuan-desktop 定期发 ping（MCP 协议的 heartbeat）。

正常响应。健康。

不响应（10 秒）。重启工具。

## 用户感知

UI 上显示工具状态。

```
github_mcp: ✓ 健康
slack_mcp: ⚠ 不响应（30 秒）
jira_mcp: ✗ 已停用（频繁崩溃）
```

让用户清晰看到。

## 重启的代价

子进程重启需要 1-2 秒（Node 启动、初始化）。

某些工具有大量初始化数据（加载本地索引、启动 LLM 客户端）。重启更慢（5-10 秒）。

chayuan-desktop 在重启期间显示 工具初始化中... 让用户知道。

## 状态的恢复

某些 MCP 工具有持久状态（缓存、登录态）。重启后状态丢失。

工具自身负责持久化。chayuan-desktop 的重启不能保证状态恢复。

如果工具不支持状态恢复，重启后可能要重新登录。chayuan-desktop 提示用户。

## 国产化场景

党政军内网部署。某些 MCP 工具受网络限制可能不稳定。chayuan-desktop 的故障恢复让 网络抖动 不破坏 AI 体验。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 工具是企业级。崩溃影响多用户。chayuan-server 有更激进的健康检查和告警。chayuan-desktop 单机简化。

## WPS 加载项

chayuan-wps 在 WPS 里调用工具。如果工具崩溃恢复中，WPS 收到 工具暂时不可用 提示。员工能等或换工具。

## 总结

MCP 工具的故障恢复是 chayuan-desktop 在工程鲁棒性上的设计。免费开源的AI软件 让 工具崩溃 不让 chayuan-desktop 跟着挂。chayuan-desktop 的自动拉起 + 退避 + 资源限制 + 健康检查让 工具调用 在工程上有保障。
