# 本地离线知识库的存储抽象 SQLAlchemy在察元AI做的克制事

chayuan-desktop 桌面单机版的后端用 SQLAlchemy 管 SQLite 操作。SQLAlchemy 是 Python 生态最强的 ORM，但 chayuan-desktop 用得很克制，没用它的全套功能。这一篇讲清楚为什么这么用，以及生产级单机版的存储抽象边界。

先看 SQLAlchemy 提供了什么。两层 API：Core 是底层的 SQL builder，让你用 Python 表达式构造 SQL；ORM 是上层的对象映射，把数据库行映射成 Python 对象，提供关系查询、惰性加载、session 管理等。

chayuan-desktop 的用法以 Core 为主，少量 ORM。

为什么不用 ORM 全套。一是性能开销。ORM 的对象映射、change tracking、惰性加载都有开销，对单机版高频读写不划算。二是行为可预期性。ORM 的隐式行为（比如 lazy load 时偷偷发 SQL）对调试不友好。三是 SQL 可见性。Core 模式下每个 SQL 都是可见的 Python 表达式，调优容易。

具体哪些场景用 Core。所有 KB 检索查询、对话历史读写、配置项更新、审计日志写入。这些场景都是高频的、SQL 形态简单的、不需要复杂关系查询的。

具体哪些场景用 ORM。KB 元数据管理、用户偏好配置、模型供应商配置。这些场景实体之间有少量关联，对象化管理更直观。

一个例子。对话历史的写入路径：chat 模块拿到一段答案要落库，构造一个 dict，调 conn.execute(messages_table.insert().values(**dict)) 一行 SQL。不需要构造 Message 对象走 session.add(msg) 加 session.commit()。简单直接。

另一个例子。模型供应商的管理：用 ORM 形态。ModelProvider 是一个 SQLAlchemy 模型，CRUD 操作通过 session 走。这里实体不多，CRUD 简单，ORM 反而更顺手。

connection pool。SQLAlchemy 默认管理 connection pool，chayuan-desktop 用默认配置即可。SQLite 在 WAL 模式下支持多读单写，pool size 5 足够。

session 管理。chayuan-desktop 不用全局 session，每个请求处理函数自己管理 session 生命周期。FastAPI 的 dependency injection 创建 session，请求结束自动关闭。这种 per-request session 避免了跨请求的 session 状态污染。

事务处理。chayuan-desktop 显式控制事务边界。比如新建 KB 涉及多个表写入（kb 表、kb_settings 表、kb_index 表），要么全成功要么全回滚。代码用 with conn.begin() 包起来。

迁移管理。chayuan-desktop 用 alembic 做 schema 迁移。每次 schema 变更生成一份 migration 文件，启动时自动应用。这是 SQLAlchemy 生态成熟的做法，比手写 SQL migration 稳。

跟 sqlite-vec 的协作。sqlite-vec 是 SQLite 扩展，通过 SQL 调用。chayuan-desktop 用 SQLAlchemy Core 写带 vec_distance 函数的 SQL。SQLAlchemy 不知道 vec0 这个虚拟表的 schema，但能正确传递 SQL 字符串。这种 escape hatch 让特殊扩展能用。

跟其他外部数据源的协作。chayuan-desktop 接外部 SQL 数据库（达梦、金仓、PG、MySQL）走 SQLAlchemy 的 dialect 机制。每种数据库有对应的 dialect 包，SQLAlchemy 抹平了 SQL 方言差异。这件事在 text2sql 场景下重要：生成的 SQL 通过 SQLAlchemy execute 跑在不同方言数据库上，不用手写方言转换。

ORM 的克制不等于不用。当 ORM 用着合适就用，不合适不强求。这种 务实选择 比一刀切更工程化。

SQLAlchemy 的版本。chayuan-desktop 用 SQLAlchemy 2.0+。2.0 重写了 API，type hint 更完整，async 支持原生。chayuan-desktop sidecar 是 async 应用（FastAPI），用 async session 跟整个架构契合。

不用 SQLAlchemy 的备选。直接用 sqlite3 库写原生 SQL 也行，简单直接。但 chayuan-desktop 的多数据源场景（接外部 PG、达梦、金仓）需要方言兼容，SQLAlchemy 是更好的选择。

测试。chayuan-desktop 的单元测试用 SQLAlchemy 的 in-memory SQLite，跑得快。每个测试函数有独立 session，互相隔离。这种测试结构对覆盖率友好。

国产化支持下的 SQLAlchemy 用法。达梦 DM 和金仓 KingbaseES 都有 SQLAlchemy dialect 包（dm-sqlalchemy、kingbase-sqlalchemy）。chayuan-desktop 接入这些数据库时不用专门写代码，用对应 dialect 的连接串就行。这种生态成熟度让国产化适配工作量小很多。

WPS AI 插件 chayuan-wps 不直接用 SQLAlchemy，所有数据访问通过 sidecar HTTP 接口。这种边界让加载项侧不需要懂数据库。

SQLAlchemy 在 chayuan-desktop 的 克制 用法是 务实工程 的体现。免费开源的AI软件 用通用工具时不必把所有花式特性都用上，挑合适的部分用就够。
