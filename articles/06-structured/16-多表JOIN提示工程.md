# 多表JOIN的提示工程 让模型不跑死你

chayuan-desktop 桌面单机版的 text2sql 在多表 JOIN 场景下出错率比单表查询高一倍以上。这一篇讲怎么通过提示工程让 LLM 写好 JOIN。

先看 JOIN 难在哪。

难点一：找对关联字段。两张表怎么关联（users.id ← orders.user_id）。LLM 不一定知道。

难点二：选对 JOIN 类型。INNER 还是 LEFT 还是 FULL。LLM 倾向 INNER 但有时候应该 LEFT。

难点三：避免笛卡尔积。多表没 JOIN ON 条件造成笛卡尔积。LLM 偶尔写错。

难点四：性能。多表 JOIN 在大表上可能慢。LLM 不优化。

chayuan-desktop 的应对。

应对一：foreign key 标注。在 KB 创建时让用户标注表之间的关联（users.id 是 orders.user_id 的外键）。chayuan-desktop 把这些关系作为 schema prompt 一部分给 LLM。

应对二：sample JOIN 示例。在 prompt 里给几个 多表 JOIN 的示例 SQL，让 LLM 学会模式。

应对三：JOIN 类型提示。prompt 提示 LLM 默认用 INNER JOIN，需要保留左表全部数据时用 LEFT JOIN。

应对四：JOIN 数量限制。chayuan-desktop 在 AST 校验阶段限制单 SQL 的 JOIN 数量（默认最多 5 张表）。超过的拒绝执行。

应对五：执行超时。多表 JOIN 慢的 SQL 30 秒超时，避免拖累 sidecar。

实际示例。

示例一：简单 INNER JOIN。query 用户的订单。chayuan-desktop 让 LLM 看到 users 和 orders 表 + foreign key 标注。LLM 生成 SELECT u.name, o.amount FROM users u JOIN orders o ON u.id = o.user_id LIMIT 100。简单可行。

示例二：LEFT JOIN。query 所有用户和他们的订单（没订单的用户也要列）。LLM 在 prompt 提示下用 LEFT JOIN。

示例三：多表 JOIN。query 用户、订单、产品的关联。三表 JOIN，需要两个 ON 条件。LLM 学示例后能正确生成。

示例四：跨数据库 JOIN（不支持）。两张表在不同数据库，标准 SQL 不能直接 JOIN。chayuan-desktop 拒绝这种 SQL，建议用户在应用层合并。

应对失败的几种情况。

失败一：foreign key 没标注。LLM 不知道关联字段，瞎猜。建议用户给 KB 加 foreign key 元数据。

失败二：表名相似。两张表都有 user_id，LLM 在 ON 条件里写错。建议用户给字段加注释明确。

失败三：复杂 JOIN（自关联、递归）。LLM 写起来困难。建议简化 query 或者分步问。

跨方言 JOIN 差异。

MySQL/PG/SQL Server JOIN 语法标准。

ClickHouse 的 JOIN 性能差，建议用 IN 或 subquery 替代。chayuan-desktop 在 ClickHouse 场景的 prompt 里给这条提示。

Hive 的 JOIN 老版本只支持 EQ JOIN（等值连接）。chayuan-desktop 限制 LLM 在 Hive 上不生成不等连接。

国产数据库（达梦、金仓）。JOIN 语法跟 PG 一致，没特殊处理。

实测精度。chayuan-desktop 在多表 JOIN 测试集上跑过对比。

不带 foreign key 标注：JOIN 准确率 60%。

带 foreign key 标注：准确率 80%。

带 标注 + 示例 + JOIN 类型提示：准确率 88%。

提示工程对 JOIN 准确率影响巨大。

prompt 模板的优化。chayuan-desktop 的 prompt 经过几轮迭代。当前版本含。

第一段：方言名 + 数据库类型。

第二段：表 schema（含字段注释）。

第三段：foreign key 关系列表。

第四段：常见 JOIN 模式示例（3-5 个）。

第五段：约束（只读、必须 LIMIT、JOIN 数量限制）。

第六段：当前 query。

第七段：要求输出纯 SQL，不要解释。

LLM 拿到这种结构化 prompt 生成 JOIN 的成功率显著提升。

国产化支持下的 JOIN。中国办公场景常见多表 JOIN（订单 + 用户 + 产品 + 仓库）。chayuan-desktop 在这种场景下的提示工程做了专门优化。

WPS AI 插件 chayuan-wps 在 WPS 里发起多表 JOIN 查询同样受 chayuan-desktop 的提示工程保护。

多表 JOIN 的提示工程是 chayuan-desktop text2sql 在复杂场景下可用的关键。免费开源的AI软件 想让 LLM 写出生产级 SQL，prompt 这一层的细致打磨不可少。chayuan-desktop 的实测数据让这种打磨有方向。
