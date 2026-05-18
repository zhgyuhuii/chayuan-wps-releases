# text2sql失败的可观测 日志看哪几条

chayuan-desktop 桌面单机版的 text2sql 偶尔会失败。失败时怎么定位原因是用户的实际需求。这一篇讲日志和诊断信息看哪几条。

先看失败的几种类型。

类型一：意图识别错。query 是聚合问题但 router 走了 document_qa。

类型二：schema linking 失败。LLM 找不到对应的表或字段。

类型三：SQL 生成失败。LLM 生成了不合法的 SQL。

类型四：AST 校验失败。SQL 不安全（含写操作或非白名单字段）。

类型五：执行失败。SQL 在数据库上跑出错。

类型六：结果验证失败。结果不合理。

类型七：自然语言总结失败。LLM 总结不出来。

每种失败的诊断位置。

诊断一：router 决策日志。CHAYUAN_ROOT/logs/router.log 记录每次意图识别的输入 query 和输出意图。如果意图错了能看到。

诊断二：schema linking 日志。CHAYUAN_ROOT/logs/schema-linking.log 记录 LLM 看到的 schema 提示和生成的 SQL。如果 schema 提示不全或者 LLM 误解，能定位。

诊断三：SQL 生成日志。生成阶段的 prompt 和模型输出。如果模型生成了 random SQL，能看到原始输出。

诊断四：AST 校验日志。CHAYUAN_ROOT/logs/sql-validator.log 记录每次校验的 SQL、违反的规则、错误码。

诊断五：SQL 执行日志。CHAYUAN_ROOT/logs/sql-execution.log 记录执行时间、影响行数、连接信息、数据库返回错。

诊断六：结果验证日志。验证规则和触发的 warning。

诊断七：总结日志。LLM 总结的 prompt 和输出。

集中诊断面板。chayuan-desktop 的 帮助 - 查看日志 一栏聚合所有这些日志，按时间倒序展示。每条日志带类别标签和级别标签。

实际排查例子。

例子一：用户问 上个月销售额 但回答说 没找到数据。

排查路径。打开 router.log 看意图识别为 structured_aggregate 还是 document_qa。如果是后者就找到原因（router 没识别为聚合）。

例子二：聚合问题但回答异常。

排查路径。看 schema-linking.log，确认 LLM 看到了正确的 schema。看 sql-execution.log，确认 SQL 跑出了什么。

例子三：执行超时。

排查路径。sql-execution.log 显示 30 秒超时。看 SQL，发现是大表全表扫描。建议用户优化 query 或加索引。

例子四：执行报错。

排查路径。sql-execution.log 显示数据库返回错。错误信息可能是 字段不存在、语法错、权限不足。各对应不同处置。

LLM 模型自身原因。某些失败是 LLM 模型水平限制（比如复杂 JOIN 写不对）。这种情况 chayuan-desktop 在日志里标记 generation_failed 让用户知道是模型问题，建议换更强的模型试试。

诊断的脱敏。日志里可能含敏感数据（query 内容、SQL 字段值）。chayuan-desktop 默认对日志做脱敏（敏感字段值 mask 处理）。用户分享日志给社区时不会泄露隐私。

日志保留时长。chayuan-desktop 默认日志按天滚动保留 30 天。重要 audit_log 保留更久（按合规要求）。

实时排查工具。chayuan-desktop 的 帮助 - 实时日志 实时显示当前 sidecar 的日志输出。用户跑一次失败查询时能现场看到原因。

国产化支持下的诊断。中文 query 跟英文一样的诊断流程。中文错误信息按 i18n 设置展示对应语言。

LLM trace。如果用户开启了 Langfuse 集成，每次 LLM 调用的完整 prompt 和 response 都上传到 Langfuse。这是 高级用户 的可观测性能力，单机版默认关。

WPS AI 插件 chayuan-wps 的失败诊断展示在加载项里。简化提示给用户，详情链到 chayuan-desktop 的日志。

text2sql 失败的可观测性是 chayuan-desktop 用户支持的基础。免费开源的AI软件 没有客服 24x7 帮你排查，靠的是 日志清晰、定位明确。chayuan-desktop 在诊断这一面的投入让用户能自助。
