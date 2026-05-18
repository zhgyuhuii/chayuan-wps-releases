# PII脱敏 governance redact在察元AI的位置

chayuan-desktop 桌面单机版的 governance 模块下有 redact 子模块负责 PII 脱敏。这一篇讲。

PII 脱敏的多场景。

场景一：入库时脱敏。文档 RAG 入库前把 PII 替换成 mask。原 chunk 不含明文 PII。

场景二：查询时脱敏。从外部库检索回来的内容含 PII，chayuan-desktop 在传给 LLM 前脱敏。

场景三：日志脱敏。每次查询的 trace 日志、audit_log 都对识别的 PII 做 mask。

场景四：导出脱敏。export 工具默认对 PII 做 mask，避免备份文件泄露。

PII 识别规则。

中国 PII。

身份证号。18 位数字（最后一位可能是 X）。正则匹配。

手机号。1 开头 11 位数字。

邮箱。@ 符合的字符串。

银行卡号。16-19 位数字。

固定电话。区号 + 8 位数字。

国际 PII。

SSN（美国社保）。9 位数字（XXX-XX-XXXX）。

护照号。

信用卡号。

mask 规则。

mask all。完全替换成 ****。

partial mask。留前几位 + 后几位。比如 138****1234。

format-preserving。保持字段长度 + 字符类型，但替换值。

custom 规则。用户自定义。

实施位置。

入库时。chayuan-desktop 的 parser 在 chunk 文本生成后跑一遍 redact。识别到 PII 就替换。原文件副本仍含 PII（用户能看到），但 chunk 索引不含。

查询返回时。chunk 文本如果含 PII（比如用户没在入库时脱敏），返回前 redact 一遍。

LLM prompt 时。给 LLM 的 prompt 是已脱敏版本。LLM 不会在回答里出现 PII。

引用气泡时。展示给用户的引用 chunk 是已脱敏版本。

性能影响。redact 对每个 chunk 跑一遍正则匹配。耗时几毫秒。整体 RAG 流程影响微小。

误报和漏报。

误报。某些字符串误匹配（比如不是身份证的 18 位数字）。chayuan-desktop 的规则可以加白名单避免。

漏报。某些 PII 没被识别（罕见格式、外文名字）。需要补充规则。

LLM 辅助识别。chayuan-desktop 路线图里有 LLM 辅助 PII 识别。给一个轻量模型识别更多模式。当前默认用规则。

跟数据脱敏的边界。

数据脱敏。对字段值做处理。PII 是数据脱敏的一种。

schema 脱敏。前面文章讲过。对字段名做处理。两者独立。

合规支持。

GDPR。chayuan-desktop 的 PII 脱敏满足 GDPR 主要要求。

PIPL。中国《个人信息保护法》。chayuan-desktop 的脱敏覆盖。

HIPAA。医疗记录。chayuan-desktop 规则可扩展支持 HIPAA。

国产化支持下的 PII。中国 PII 规则是 chayuan-desktop 默认覆盖的核心。

WPS AI 插件 chayuan-wps 在 WPS 里展示的引用气泡按 PII 脱敏后显示。员工不会无意看到完整 PII。

PII 脱敏 governance redact 是 chayuan-desktop 在敏感场景下的合规工具。免费开源的AI软件 想真正服务金融、医疗、政府这些 PII 严格场景，PII 脱敏是必备。chayuan-desktop 在这一面的工程化让企业级合规可达。
