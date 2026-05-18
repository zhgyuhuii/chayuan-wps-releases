# text2sql的AST校验 把不安全的SQL拒在执行之外

chayuan-desktop 桌面单机版的 text2sql 路径里有一道关键防线：AST 校验。LLM 生成的 SQL 不直接执行，先解析成抽象语法树，做安全检查，确认安全才让真跑。这一篇讲清楚 AST 校验做的事。

先看为什么需要。LLM 生成 SQL 不可控，可能写出 DELETE、UPDATE、DROP TABLE、TRUNCATE 这种破坏性语句。如果 chayuan-desktop 直接把生成的 SQL 跑在用户的生产数据库上，后果不堪设想。

AST 校验的工具。chayuan-desktop 用 SQLGlot 这个 SQL 解析库。它能把 SQL 解析成 AST（抽象语法树），并支持多方言（MySQL、PostgreSQL、Oracle、达梦等）。每个 AST 节点是一个 SQL 子结构（SELECT、FROM、WHERE 等）。

校验的具体规则。

规则一：只读。所有 chayuan-desktop 的 text2sql 生成 SQL 必须是 SELECT 或 WITH 语句。任何 INSERT、UPDATE、DELETE、DROP、TRUNCATE、ALTER、CREATE 都直接拒绝。

规则二：表白名单。每个 KB 在创建时记录了允许查询的表列表。AST 里的 FROM 子句涉及的表必须都在白名单里。命中其他表（哪怕是同一数据库的）直接拒绝。

规则三：列白名单。每个表也有列白名单。AST 里的 SELECT 字段必须在白名单。这条对脱敏很重要：用户不希望 LLM 看到 password_hash、IDcard、phone 这种 PII 字段。

规则四：禁用函数。某些 SQL 函数有副作用（pg_sleep、benchmark、INTO OUTFILE 等）。chayuan-desktop 维护一份禁用函数列表，AST 里命中这些直接拒绝。

规则五：行数预估。AST 解析时不能直接预估行数，但可以检查 LIMIT 子句。chayuan-desktop 强制要求生成的 SQL 含 LIMIT（默认 100），避免 LLM 生成 SELECT * FROM huge_table 这种灾难。

规则六：执行超时。即使 SQL 通过了静态校验，执行阶段还有超时（默认 30 秒）。慢 SQL 不至于让 sidecar 卡死。

规则七：嵌套深度。某些 SQL 嵌套层级太深（10 层子查询）容易让数据库性能崩。chayuan-desktop 限制嵌套深度（默认 5 层）。

校验失败的处理。AST 校验失败时不执行 SQL，给用户一个明确的错误：SQL 涉及未授权的表、SQL 包含写操作、SQL 缺 LIMIT 等。chayuan-desktop 让 LLM 重新生成（最多重试 3 次），仍失败的话告诉用户 无法生成安全的 SQL。

具体例子。

例子一：LLM 生成 DELETE FROM 销售 WHERE 日期 < '2020-01-01'。AST 校验识别出这是 DELETE 语句，直接拒绝。给用户的错误是 不允许写操作。

例子二：LLM 生成 SELECT password_hash FROM users。AST 校验识别 password_hash 不在 users 表的列白名单里，直接拒绝。错误是 字段未授权。

例子三：LLM 生成 SELECT * FROM secret_table（用户没把 secret_table 加白名单）。表白名单检查不通过，拒绝。错误是 表未授权。

例子四：LLM 生成 SELECT * FROM products。表通过白名单但缺 LIMIT，校验添加 LIMIT 100 后再执行。这种 自动补 LIMIT 是温和的处置。

例子五：LLM 生成 SELECT pg_sleep(60)。禁用函数命中，拒绝。错误是 SQL 包含禁用函数。

每种 SQL 方言的特殊处理。

MySQL：禁用 LOAD_FILE、INTO OUTFILE、SET 命令。

PostgreSQL：禁用 pg_sleep、COPY 命令、子事务。

达梦/金仓：禁用相应的存储过程调用。

ClickHouse：禁用某些可能造成大表扫描的函数。

跨表 JOIN 的处理。多表 JOIN 时每张表都要在白名单。chayuan-desktop 让 LLM 在 schema linking 阶段只看白名单内的表，避免 LLM 生成涉及非白名单表的 JOIN。

CLAUDE.md 里的硬要求。所有 SQL 必须只读、表和列必须来自白名单、聚合意图必须校验 SQL shape。这条规矩 chayuan-desktop 严格执行。

诊断信息。AST 校验失败时给用户的诊断包括：原 SQL、违反的规则、可能的修正方向。开发者级日志里还有 AST 树本身。

国产化支持下的 AST 校验。SQLGlot 支持达梦的 SQL 方言（虽然有些边界情况），chayuan-desktop 在达梦场景下尽量用 SQLGlot 解析。如果遇到 SQLGlot 不支持的方言特性，退化为字符串规则匹配（不如 AST 精确）。

WPS AI 插件 chayuan-wps 通过 sidecar 走同一套 AST 校验。在 WPS 里发起结构化查询同样受 AST 校验保护。

AST 校验是 chayuan-desktop text2sql 的安全底线。免费开源的AI软件 让用户把生产数据库接入 LLM 是有风险的，AST 校验把这种风险压到接近零。chayuan-desktop 在这件事上的工程严谨度让 text2sql 真的可用。
