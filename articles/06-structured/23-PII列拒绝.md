# 数据敏感字段的查询拒绝 PII列的策略

chayuan-desktop 桌面单机版对 PII（个人可识别信息）列有专门的处理策略。某些字段（身份证号、手机号、邮箱、银行卡号、社保号）即使在白名单内也不应该让 LLM 在结果里看到原值。这一篇讲清楚 PII 处理。

先看 PII 的范围。

直接 PII：可以直接识别个人。身份证号、手机号、邮箱、家庭住址、银行卡号、社保号、护照号、医保号。

间接 PII：组合可以识别。比如生日 + 邮编 + 姓名首字母。

非 PII：不直接识别个人。订单 ID、产品名、状态码、统计聚合数。

chayuan-desktop 的 PII 策略。

策略一：默认不入白名单。chayuan-desktop 在 KB 创建时扫描字段名，对常见 PII 模式（password、id_card、phone、email 等关键词）默认不勾白名单。用户主动勾才进。这种 默认安全 让用户不会无意暴露 PII。

策略二：脱敏读取。某些场景必须能查 PII 但不能完整看到。比如客服需要 后 4 位手机号。chayuan-desktop 支持给字段配 mask 规则。读出来的值是 138****1234 而不是完整 13800001234。

策略三：聚合可见但行级不可见。某些场景允许统计 PII 字段（比如手机号去重计数），但不允许列出每个手机号。chayuan-desktop 通过 SQL 模板限制只能 SELECT COUNT(DISTINCT phone) 不能 SELECT phone。

策略四：日志脱敏。审计日志里如果 SQL 涉及 PII 字段，参数值自动 mask。

具体配置。

进入 KB 设置 - 字段管理。每个字段可以选 normal / pii / mask。

normal：白名单内字段，正常可读。

pii：识别为 PII，不进白名单（即使 LLM 想用也用不到）。

mask：白名单内但读取时 mask（用于半可见场景）。

mask 规则。chayuan-desktop 内置几种规则。

phone：留前 3 后 4，中间 ****（13800001234 → 138****1234）。

id_card：留前 6 后 4（110101199001011234 → 110101********1234）。

email：留 @ 前 2 字符 + @ 后域名（zhangsan@example.com → zh****@example.com）。

name：留姓 + *（张三 → 张*；张三丰 → 张**）。

address：留省市 + ****（北京市朝阳区某街道 → 北京市朝阳区****）。

bank_card：留前 4 后 4（6228000000001234 → 6228********1234）。

custom：用户自定义正则。

PII 跨多列的间接识别。即使每个字段单独脱敏，多个字段组合可能识别个人。比如 姓 + 邮编 + 生日 三个 mask 字段拼起来也能定位某人。chayuan-desktop 当前不做这种跨字段隐私分析，但建议用户在 KB 创建时就把这种间接 PII 字段也按 pii 处理。

LLM 调用方的处理。如果用户用 GPT-4o（云端）做 SQL 生成，schema 中的 PII 字段名可能被 OpenAI 看到（如果在白名单里）。chayuan-desktop 推荐对 PII 字段做表名/字段名脱敏（schema 脱敏，前面文章讲过）。LLM 看到的是 字段_X1，不知道是 phone。

PII 跟数据本身的边界。chayuan-desktop 的 PII 处理对字段名和字段值。schema 元数据（注释里的 这是 X 算法）这种业务规则也属于敏感信息，配合 schema 脱敏处理。

实际场景。

场景一：客服查工单。客服需要 后 4 位手机号 +姓 + 订单号。chayuan-desktop 的 mask 规则让客服能查到这些信息但看不到完整 PII。

场景二：财务对账。财务需要银行卡号去重计数（统计有多少张唯一的卡）。chayuan-desktop 通过 SQL 模板限制只能聚合不能列出。

场景三：合规审查。审计员查 谁访问了 PII 字段。chayuan-desktop 的审计日志记录所有 PII 相关查询，能给报告。

国产化支持下的 PII。中国《个人信息保护法》对 PII 处理有明确要求。chayuan-desktop 的 PII 策略符合主流合规要求，具体合规细节按客户单位规定。

WPS AI 插件 chayuan-wps 在 WPS 里发起涉及 PII 字段的查询同样受策略保护。LLM 看到的是脱敏后的数据。

数据敏感字段的查询拒绝是 chayuan-desktop 合规能力的核心一环。免费开源的AI软件 想在金融、医疗、政府这些 PII 严格场景下落地，PII 处理必须做对。chayuan-desktop 在这一面投入的细节让企业级合规可达成。
