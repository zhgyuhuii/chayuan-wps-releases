# 加载项与 WPS 的稳定性 进程崩溃的相互保护

chayuan-wps 加载项跟 WPS 进程的稳定性相互保护。这一篇讲。

## 稳定性的几个层次

层一：加载项不让 WPS 崩。即使 chayuan-wps 出 bug 不能让 WPS 主程序挂掉。

层二：WPS 崩了 chayuan-wps 重启时能恢复状态。

层三：chayuan-desktop 后端崩了 chayuan-wps 优雅降级。

层四：跨进程通信稳定。

## 加载项不崩 WPS

WPS 加载项跑在 WPS 进程内（某些场景在独立进程）。

如果加载项 JS 错误。WebView 内捕获。不上抛到 WPS 主进程。

WPS 加载项 SDK 提供错误处理框架。chayuan-wps 用 try/catch 包所有 WPS API 调用。

```js
try {
  WpsApplication.ActiveDocument.SaveAs(path);
} catch (e) {
  console.error(e);
  showErrorToUser();
}
```

避免未捕获的异常崩 WPS。

## 加载项的资源限制

加载项过度占用资源也可能让 WPS 卡。chayuan-wps 限制。

不开过多 worker。

不大量 DOM 操作。

不长时间循环（用 setTimeout 拆分）。

定期 GC。

避免内存泄漏。

## WPS 崩了 chayuan-wps 怎么办

WPS 主程序崩。所有加载项跟着死。

WPS 重启后加载项重启。

chayuan-wps 启动时恢复状态。

打开上次会话。

恢复 KB 选择。

提示用户 上次 WPS 异常退出，已恢复会话。

## 状态持久化

chayuan-wps 的状态存哪。

某些状态在 chayuan-desktop 后端（会话历史）。重启后从后端拉。

某些状态在加载项本地（KB 选择、UI 偏好）。存到 WPS 加载项的本地存储或 chayuan-desktop 的设置。

WPS 重启不丢。

## chayuan-desktop 崩了

chayuan-desktop 后端崩。chayuan-wps 检测连接失败。

进入降级模式（前面文章讲）。

UI 提示用户。

chayuan-desktop 重启后 chayuan-wps 自动重连。

## 通信的容错

加载项跟 chayuan-desktop 通过 HTTP 通信。

每次请求超时设置（默认 30 秒）。

失败重试（自动 1 次）。

连接保活（keep-alive）。

## 资源清理

加载项关闭时（用户关 WPS）清理。

取消所有进行中的请求。

释放 WebView 资源。

通知 chayuan-desktop 会话结束。

避免资源泄漏。

## 长时间运行

某些用户 WPS 开一整天。chayuan-wps 长时间运行。

内存监控。chayuan-wps 监测自身内存使用。超过阈值自动 GC 或提示。

无用资源清理。某些不再需要的 KB 数据自动清理。

避免长跑下的性能退化。

## 崩溃日志

chayuan-wps 的崩溃自动记日志。

```
~/.chayuan/logs/wps-addin/
  2026-05-10.log
  crash-2026-05-10-14-23.log
```

包含错误堆栈、当时的状态、用户操作。

便于开发者排查。

## 国产化场景

党政军场景对稳定性要求高。chayuan-wps 不能让 WPS 崩（员工正在写公文如果丢失文档影响大）。

崩溃日志合规。某些等保场景要求保留崩溃日志 6 个月。chayuan-wps 默认 30 天可调。

## chayuan-server 的对应

chayuan-server 模式下 chayuan-wps 跟 chayuan-server 通信。chayuan-server 故障时 chayuan-wps 同样降级。

## 总结

加载项与 WPS 的稳定性相互保护是 chayuan-wps 在工程鲁棒性上的设计。免费开源的AI软件 让 加载项 不破坏宿主应用。chayuan-wps 的错误捕获 + 资源限制 + 状态恢复 + 降级模式让稳定性可控。
