# 文档库与结构化库混选 router的意图判定逻辑

chayuan-desktop 桌面单机版的 router 模块负责决定一次问答怎么跑。如果你的查询里只有文档库，那就走文档 RAG。如果只有结构化数据库，就走 text2sql。但实际场景经常混选，router 要做更细的判定。这一篇讲 router 的判定逻辑。

先看 router 的输入。一个 list of KnowledgeRef 加上用户问句。输出是查询 plan，告诉 orchestrator 要派哪些任务。

判定的几个步骤。

第一步，按 KnowledgeRef 类型分组。把列表分成 document 组、structured 组、vector 组、office 组、web 组。每组的 ref 列表传给后面分别处理。

第二步，识别问题意图。chayuan-desktop 用一个轻量分类模型（或规则启发）把问题分到几类：document_qa（文档问答）、structured_aggregate（结构化聚合）、structured_lookup（结构化查找）、vector_semantic（向量语义检索）、multi_source（多源混合）、tool_invocation（工具调用）。

意图识别的具体规则。问句包含 多少 几个 多少个 总和 平均 这种聚合关键词时，倾向 structured_aggregate。问句包含具体的字段名（用户名、订单号、合同编号）时，倾向 structured_lookup。问句是开放式描述（关于 X 的内容、X 是什么）时，倾向 document_qa。问句涉及外部行为（搜索、发邮件、查股价）时，倾向 tool_invocation。

第三步，判定 KB 与意图的匹配。如果意图是 structured_aggregate 但当前 KB 列表里没有结构化库，router 把意图退化为 document_qa（找最接近的 KB 类型）。如果意图是 document_qa 但当前只有结构化库，router 退化为 structured_lookup。这种 fallback 让用户在 KB 选择不全的情况下也能得到合理结果。

第四步，多源混合的判定。如果 KB 列表既有文档库又有结构化库，router 根据问题意图选主路径。比如 我们去年的销售数据怎么样，结合最新的市场分析报告 这种问题，router 判定 multi_source 意图，同时跑文档库和结构化库的检索，结果合并喂给 LLM。

第五步，构造 plan。plan 是一个数据结构，描述要派哪些任务。每个任务包括 adapter 类型、KnowledgeRef、查询参数。orchestrator 拿到 plan 直接执行。

CLAUDE.md 里的硬约束。聚合意图必须命中 structured_aggregate 加 SQL 生成路径，不能退化成文档检索后让 LLM 编答案。chayuan-desktop 的合同测试里专门有这条。比如 有几个用户 必须走 SQL COUNT，不能查文档 chunk 然后让模型猜。

意图识别的失败处理。某些 corner case 下意图识别不准。chayuan-desktop 的应对是 多策略并行：在意图不确定时同时跑两条路径（比如 document_qa 和 structured_lookup），结果合并。这种 hedge 增加少量延迟换准确率。

router 的可观测性。每次 router 决策落到 trace 日志，包括识别到的意图、选择的 plan、回退的原因。开发者排查 为什么这个问题走错路径 时这些日志救命。

router 的可配置。chayuan-desktop 把意图识别规则放在配置文件里。企业部署可以微调规则，比如把某些行业特定关键词加到 structured_aggregate 触发词。

router 与 LLM。某些复杂问题用规则识别不准，可以让 LLM 做意图分类。chayuan-desktop 默认走规则启发，配置开关可以切到 LLM 分类（用一个小模型）。LLM 分类精度更高但延迟增加 200-500ms。

router 与工具调用。如果意图是 tool_invocation，router 不调 KB 检索，而是把工具列表喂给 LLM 让它选工具。这条路径跟 KB 检索是平行的。

国产化支持下的 router。中文意图识别在 chayuan-desktop 上做了专门优化。聚合关键词的中文表达（多少个、几位、总数、合计、共有）都被覆盖。

WPS AI 插件 chayuan-wps 共用同一个 router。在 WPS 里发起的问题经过同样的意图识别和 plan 生成。这种统一让两个产品的检索决策一致。

router 的判定逻辑是 chayuan-desktop 多类型 KB 检索的智能层。免费开源的AI软件 想做到 用户不用懂哪个 KB 该用什么方式查，router 就要承担这个判断。chayuan-desktop 的 router 把这件事做得对，多源混选才有意义。
