# 全模型支持下的任务调度 APScheduler还是Celery 单机不需要broker

chayuan-desktop 桌面单机版的后台任务调度（folder-sync 定时扫描、KB 重建、日志清理）用 APScheduler，没用 Celery 那种 broker-based 任务队列。这一篇讲为什么这么选。

先看两个候选的差别。Celery 是分布式任务队列，需要外部 broker（RabbitMQ、Redis）。任务发到 broker，worker 从 broker 取任务执行。优点是分布式、可扩展、生产级稳定。缺点是需要 broker 服务、配置复杂、开销大。

APScheduler 是嵌入式调度器，跑在应用进程里。任务直接在进程内执行。优点是嵌入式、零配置、零外部依赖。缺点是单机、不能跨进程分发任务。

chayuan-desktop 选 APScheduler 的理由。

理由一：单机不需要分布式。chayuan-desktop 是单机版，所有任务都在同一台电脑上跑。Celery 的分布式能力用不上。如果硬上 Celery，要装 Redis 或 RabbitMQ，单机版的 装到电脑里就能用 立刻破功。

理由二：零外部依赖契合 PyInstaller。APScheduler 是纯 Python 库，PyInstaller 打包友好。Celery + Redis 要外部进程，单机版根本塞不进发行包。

理由三：调度场景简单。chayuan-desktop 的后台任务不复杂：folder-sync 每 10 分钟扫一次、日志每天清理一次、可选的 KB 增量索引。这种简单调度 APScheduler 完全够。

理由四：跟 FastAPI 同进程。APScheduler 跑在 FastAPI 应用启动时，跟 sidecar 同进程。任务执行可以直接调用 sidecar 内部函数，不需要跨进程 RPC。

APScheduler 的具体使用。chayuan-desktop 在 sidecar 启动时初始化 APScheduler 实例，注册几个 job：folder_sync_job 每 10 分钟一次、log_cleanup_job 每天 03:00 一次、kb_index_refresh_job 按需触发。每个 job 是一个 Python async 函数。

调度方式。APScheduler 支持 interval、cron、date 三种触发方式。chayuan-desktop 大多用 interval（间隔）和 cron（定时）。

任务的并发控制。APScheduler 默认每个 job 同时只能跑一个实例（max_instances=1）。chayuan-desktop 的 folder_sync_job 设置成最多 1 个，避免上一次扫描没完下一次又开始。

任务持久化。APScheduler 支持 in-memory 和 SQLAlchemy 两种 jobstore。chayuan-desktop 用 in-memory（启动时按代码注册 jobs，不需要持久化）。这种用法简单，不需要管 jobstore 数据库表。

任务失败处理。APScheduler 任务抛异常时不会让 sidecar 进程崩，只会记录日志并下一次按调度重试。chayuan-desktop 在每个任务里有 try-except 包裹，把异常转成结构化日志写到 CHAYUAN_ROOT/logs/scheduler.log。

任务的执行时间。每次任务执行时间记录到调度日志，便于诊断 是不是任务执行越来越慢。chayuan-desktop 的 folder_sync_job 在大型 KB 上可能跑几分钟，超过下一次调度的话 APScheduler 默认跳过下一次（max_instances=1 的语义）。

不需要 broker 的好处。一是部署简单。二是没有 broker 单点故障。三是没有 broker 内存占用。四是没有 broker 持久化磁盘占用。这些对单机版都是真实好处。

如果未来需要分布式。chayuan-server 多用户版本可能需要 Celery 或类似工具。chayuan-desktop 的同源代码里 scheduler 模块抽象出接口，多用户版本可以替换实现成 Celery，单机版仍用 APScheduler。

定时任务的事件 trigger。某些任务不只是定时，还有 事件触发（比如用户上传文件后自动入库）。chayuan-desktop 把事件触发和定时调度结合，事件队列由 asyncio.Queue 管，APScheduler 做兜底重试。

GUI 跟 scheduler 的交互。前端不直接跟 APScheduler 通信，所有任务调度通过 sidecar HTTP 接口。前端能看到任务状态（运行中、上次完成时间、下次执行时间），可以手动触发 立刻同步。

国产化支持下的 APScheduler。APScheduler 是纯 Python 库，跨平台跨架构通用。loongarch64 麒麟 UOS 都没问题。

WPS AI 插件 chayuan-wps 不直接接触 scheduler，但通过 sidecar 接口可以查看 KB 同步状态、触发立刻同步。

APScheduler 在 chayuan-desktop 的位置是 单机优先的轻量调度器。免费开源的AI软件 想做到 装到电脑里就能用，每一处选择都要想 这个组件能不能塞进 PyInstaller 包。APScheduler 完美符合。
