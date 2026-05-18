# 私有schema怎么不暴露给模型 SQL生成的脱敏

chayuan-desktop 桌面单机版接外部数据库做 text2sql 时，LLM 必须看到 schema 才能生成 SQL。但完整 schema 可能含敏感信息（业务字段、内部命名约定、表关系）。这一篇讲怎么在不让 LLM 看到私有信息的前提下生成 SQL。

先看 schema 中的敏感信息。

敏感一：表名暗示业务逻辑。比如表名 secret_users_with_high_value、internal_compliance_audit。

敏感二：字段名暗示业务流程。比如字段名 fraud_score、compliance_flag。

敏感三：注释含业务规则。某些字段注释写 这是 X 算法生成的、用于 Y 决策。

敏感四：跨表关系暴露架构。foreign key 揭示业务流程。

如果 schema 完整给 LLM。LLM 可能在回答里 引用这些敏感信息（比如 你们的 fraud_score 字段表明…），意外泄露给用户。或者 LLM 调用方把 schema 上传到云（GPT-4o 调用），相当于发到 OpenAI 服务器。

chayuan-desktop 的脱敏策略。

策略一：白名单。前面文章讲过，只有勾进白名单的表和字段才让 LLM 看到。敏感字段直接不勾。

策略二：表名映射。chayuan-desktop 支持给表起 显示别名，LLM 看到的是别名而不是原表名。SQL 生成后再翻译回原表名执行。

策略三：字段名映射。同样支持字段别名。LLM 看到的是 customer_name，实际表里是 c_nm。

策略四：注释脱敏。chayuan-desktop 让用户给字段写 LLM 看的简化注释，不是原始 schema 注释。原始注释可能含业务规则，简化注释只描述字段含义。

策略五：本地推理优先。最严的场景，让 SQL 生成走本地 Ollama。schema 完全不出 chayuan-desktop sidecar，连本地推理服务都在自己内网。

策略六：日志脱敏。chayuan-desktop 的日志默认对敏感字段值 mask。schema 信息不写到外部可见的日志。

实操配置。

步骤一：进 KB 设置 - 高级 - schema 脱敏。

步骤二：勾选哪些字段要 脱敏后给 LLM。chayuan-desktop 给这些字段一个通用别名（比如 字段_X1），LLM 看到的是这个别名。

步骤三：给字段写 LLM 用注释（简化版本）。

步骤四：保存。

LLM 视角。LLM 看到的 schema 大致：

表 customers（客户信息）字段：id、name（客户姓名）、status（账户状态）。

LLM 不知道还有 fraud_score、compliance_flag 字段（用户没勾白名单）。LLM 不会在 SQL 里引用这些字段。

SQL 生成。LLM 写 SELECT name, status FROM customers WHERE status='active'。chayuan-desktop 执行这个 SQL（白名单内字段），返回结果。

schema 脱敏的局限。某些场景脱敏可能让 LLM 生成不出 SQL。比如用户问 帮我找出可疑客户，但 fraud_score 字段没在白名单。LLM 不知道怎么定义 可疑。chayuan-desktop 让 LLM 老实回答 当前 KB 的字段无法识别可疑客户的判断标准。

跟数据脱敏的区别。schema 脱敏关注 哪些字段名让 LLM 看到。数据脱敏关注 哪些字段值让 LLM 看到。两层独立配置。

适用场景。

场景一：政企部署。生产数据库表名跟内部业务严格关联，不能让外部 LLM 看到。chayuan-desktop 的 schema 脱敏给政企用户安心配置。

场景二：金融场景。fraud_score、anti_money_laundering 这种字段名是商业秘密。脱敏防止 LLM 调用接收方（OpenAI/Anthropic）看到。

场景三：医疗。患者数据相关字段名严格保密，schema 脱敏配合数据脱敏。

国产化支持下的脱敏。完全离线场景下 LLM 在本地 Ollama 跑，schema 不出域。这种情况下 schema 脱敏的必要性下降，但仍是好的纵深防护。

WPS AI 插件 chayuan-wps 在 WPS 里发起结构化查询同样受 schema 脱敏保护。LLM 看到的 schema 就是那个脱敏版本，不会因为加载项绕过保护。

schema 脱敏是 chayuan-desktop 在 LLM 安全方面的高级特性。免费开源的AI软件 在生产敏感场景下要走的路比 演示场景 多得多。chayuan-desktop 的 schema 脱敏让企业用户敢于把 LLM 用在更深的业务场景。
