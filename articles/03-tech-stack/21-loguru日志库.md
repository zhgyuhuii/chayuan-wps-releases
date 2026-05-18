# 免费开源的AI软件的日志库选型 loguru替换标准logging的代价

chayuan-desktop 桌面单机版后端用 loguru 做日志，没用 Python 标准库的 logging。这一篇讲清楚选 loguru 的考虑。

先看 logging 的优缺。优是标准库不需要装，跨平台稳定。缺是 API 设计偏老（90 年代风格），配置复杂，filter 和 formatter 写起来啰嗦，多线程多进程下偶尔有怪问题。

loguru 是社区流行的日志库。API 简洁，开箱即用，自动 colorize，支持文件 rotation、压缩、保留策略。chayuan-desktop 用它的几个理由。

理由一：API 简单。logger.info("server started on port {port}", port=62581) 就能写出结构化日志。logging 要 logger.info("server started on port %s", 62581) 加之前的复杂配置。

理由二：开箱配置好。logger.add(file, rotation="500 MB", retention="30 days", compression="zip") 一行配好滚动和清理。logging 的 RotatingFileHandler 配置项更繁琐。

理由三：异常 traceback 漂亮。loguru 默认带 better-exceptions 风格的 traceback 输出，能看到每行的局部变量。chayuan-desktop 调试 sidecar 偶发崩溃时这个特性救命。

理由四：跟 asyncio 友好。loguru 的 logger.complete() 在 async 上下文里能等所有日志写完。chayuan-desktop 优雅关闭时用得上。

替换 logging 的代价。第三方库（FastAPI、SQLAlchemy、httpx）内部用 logging。chayuan-desktop 通过 logging.basicConfig 加上 InterceptHandler 把 logging 的输出重定向到 loguru，实现 全局只用 loguru。这个 intercept 模式是 loguru 文档里的标准做法。

PyInstaller 兼容。loguru 是纯 Python 库，PyInstaller 打包友好。比某些用了 native 扩展的日志库省心。

性能。loguru 的写盘性能跟 logging 差不多，对 sidecar 这种日志量适中的应用不构成瓶颈。

日志格式。chayuan-desktop 默认日志格式 [时间] [级别] [模块] 消息。生产环境写到 CHAYUAN_ROOT/logs/server.log，开发态额外打到 stderr。

按等级分流。chayuan-desktop 的 logger 配了多个 sink：server.log（INFO+）、error.log（ERROR+）、debug.log（DEBUG+，仅开发态）。每种文件保留时长不同。

结构化日志。某些场景需要结构化字段（比如 trace ID、user ID、request ID）。loguru 支持 logger.bind(trace_id=xxx) 给当前 logger 绑定上下文字段，后续输出自动带上。chayuan-desktop 的 HTTP 中间件给每个请求绑 trace ID，方便排查。

跟前端日志的关系。前端 console.log 在 Tauri webview 里打到 webview 的 console，不会自动到 sidecar 日志。chayuan-desktop 不做前端日志聚合到后端，因为单机版用户能直接打开 webview 控制台看。如果是企业版本可以加日志上报通道。

日志的可观测性。chayuan-desktop 在主界面 帮助 - 打开日志目录 一个按钮跳转到 CHAYUAN_ROOT/logs。用户给社区反馈问题时可以直接附日志文件。

国产化支持下的日志。loguru 支持 utf-8 默认，中文日志没问题。麒麟 UOS 的中文 locale 下 loguru 输出无乱码。

logger 的版本。chayuan-desktop 用 loguru 0.7+。社区维护活跃，bug 修得及时。

不用 structlog 的原因。structlog 是另一个流行的结构化日志库。chayuan-desktop 评估过，觉得对 chayuan-desktop 的简单场景过度设计。loguru + bind 已经够用。

WPS AI 插件 chayuan-wps 不用 loguru，加载项的日志走浏览器 console。两边的日志策略独立。

loguru 在 chayuan-desktop 的位置是 让日志写起来不痛苦。免费开源的AI软件 用日志库这种基础设施，选 API 顺手的库能让开发者每天少几次烦躁。
