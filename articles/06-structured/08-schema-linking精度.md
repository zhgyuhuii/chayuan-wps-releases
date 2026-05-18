# 本地离线知识库的schema linking 大表上的精度技巧

chayuan-desktop 桌面单机版的 text2sql 链路里 schema linking 这一步决定 LLM 能不能正确选择表和字段。在小表上没问题，大表（几十张表几百个字段）上精度容易掉。这一篇讲提升精度的技巧。

先看 schema linking 是什么。把 query 里的概念（实体、字段、属性）映射到数据库的表和字段。比如 query 用户名 映射到 users.username 字段。query 订单金额 映射到 orders.amount 字段。

简单场景的 schema linking。表和字段名跟 query 词义直接相关。LLM 一眼就能链对。chayuan-desktop 把 schema 作为 prompt 一部分给 LLM，LLM 写出正确 SQL。

复杂场景的挑战。

挑战一：字段命名不规范。表有 cust_nm（缩写）字段，query 问 客户名字。LLM 不知道 cust_nm 是 customer_name 缩写。

挑战二：表名跟实体不匹配。比如表叫 t_001（旧系统遗留），实际存用户数据。LLM 不知道 t_001 跟 用户 关联。

挑战三：跨表字段。query 涉及 用户的订单。需要 JOIN users 和 orders 表。LLM 要识别这种关系。

挑战四：表数量多。一个数据库 100+ 张表，每张几十字段，schema 总长度可能超过 LLM 上下文窗口。

chayuan-desktop 的应对。

应对一：字段注释。在白名单里给每个字段写中文注释。比如 cust_nm 注释 客户名字。chayuan-desktop 把注释作为 schema prompt 一部分。LLM 看到注释就能链接 query 概念。

应对二：表注释。每张表也支持中文描述。比如 t_001 描述 用户信息表。LLM 看到描述就知道用什么表。

应对三：sample data。chayuan-desktop 在 schema prompt 里附几行 sample data，让 LLM 看到字段的实际值，加深理解。

应对四：schema 选择性提示。如果 KB 的表太多 schema 长，chayuan-desktop 用一层 LLM 先粗筛 哪些表跟 query 相关，再把这些表的 schema 详细描述给生成 SQL 的 LLM。这种 二阶段 schema 让大数据库也能精准。

应对五：foreign key 关系。chayuan-desktop 在 KB 创建时让用户标注表之间的关联（users.id ← orders.user_id）。LLM 看到关联关系能正确生成 JOIN。

实测精度。在一份测试数据库（30 张表 200+ 字段）上跑评测。

只给表和字段名（不带注释）。schema linking 准确率约 60%。

加字段中文注释。准确率提升到 80%。

加表描述 + 字段注释。准确率 88%。

加 sample data。准确率 92%。

加 foreign key 标注。复杂 JOIN 场景准确率从 70% 提升到 88%。

实测教训。投入半小时给关键字段加注释，对 text2sql 精度提升明显。这种 schema 准备 是用户 KB 入库时的最大杠杆。

字段注释的几种形式。

形式一：直接含义。客户名字、订单金额、创建时间。

形式二：业务含义。is_active=1 表示启用、status=0 表示草稿、type=A 表示正式。

形式三：单位。amount 单位是分还是元、weight 单位是 kg 还是 g。

形式四：时区。created_at 是 UTC 时间还是北京时间。

国产化支持下的 schema 注释。中文注释让 LLM 链接中文 query 时直接对应。这是中国办公场景的优势。

schema 长度的硬限制。即使二阶段筛选，如果筛后的表仍超 LLM 上下文，会截断。chayuan-desktop 给用户提示 KB 太大，建议拆分 或 query 太宽泛，建议明确实体名。

保留字段的处理。某些字段是数据库保留字（id、type、order）。chayuan-desktop 在生成 SQL 时给这些字段加引号或反引号，避免语法冲突。

schema 演化。数据库 schema 改了（加字段、删字段），KB 元数据要同步。chayuan-desktop 提供 刷新 schema 操作，重新拉数据库当前 schema 替换 KB 里的快照。这种主动更新避免 schema 漂移。

WPS AI 插件 chayuan-wps 在 WPS 里发起 SQL 查询时 schema linking 在 sidecar 完成，加载项不需要懂 schema。

schema linking 的精度直接决定 text2sql 的可用性。免费开源的AI软件 给用户 KB 准备的工具（注释、描述、sample data、关系标注）让普通用户也能配出高质量结构化 KB。chayuan-desktop 在这一面的细致设计让用户的投入有回报。
