# 让Claude做代码审查 一次KB重构的复盘

chayuan-desktop 桌面单机版的某次 KB 重构涉及 ku_id 合同变更跟 retrieval/query 模块的分层。这种大改动用 Claude 协助审查。这一篇复盘。

重构背景。早期版本前端用 KB 显示名 作为合同主字段。后来发现重名问题。决定换成 ku_id（带类型前缀的稳定 ID）。

重构涉及的代码量。

前端：~30 个文件改动（packages/api、packages/transport、packages/app）。

后端：~50 个文件改动（kb_query schemas、service、retrieval/query 各模块）。

测试：~20 个测试文件改动。

总变更 100+ 文件。

人工审查的挑战。100+ 文件审起来累，容易漏。怕漏的地方包括 边界情况、是否还有用旧 KB 名作主键的代码、合同测试是否完整。

让 Claude 协助。开发者把整个重构 PR 给 Claude，让 Claude 做几件事。

任务一：检查 ku_id 合同的一致性。所有 API 接口都改了吗。前端 packages 用的都是 ku_id 不是 KB 名。

任务二：检查后端各 adapter 是否都按 KnowledgeRef 接口工作。

任务三：检查合同测试的覆盖。每种 ku_id 解析失败场景都有测试吗。

任务四：找出可能漏掉的旧代码（用 KB 名做主键的残留）。

任务五：检查 CLAUDE.md 的红线是否被遵守。

Claude 的审查输出。

输出一：发现 3 处后端代码仍用 kb_name 作为主键查 KB。建议统一改成 kb_id。

输出二：发现 1 处前端代码漏掉了 office:* 类型的 ku_id 解析。

输出三：发现合同测试缺一种边界（office:owner: 后面 group 为空字符串）。

输出四：发现 router 模块某条规则里硬编码了 doc:* 字符串，建议改成 KIND 常量。

输出五：检查通过的部分。绝大多数代码都符合规范。

人工 review Claude 的输出。开发者看 Claude 给的清单，决定哪些必须改、哪些可以 follow up。

修改后再让 Claude 跑一遍。Claude 确认所有问题都处理。

最后人工合并 PR。

这种协作的效率。一次 100+ 文件重构，靠人工 review 可能花 4-6 小时。Claude 协助下 30 分钟看完 + 修改 1-2 小时 + 再审 30 分钟，总共 2-3 小时。提速 50% +。

哪些事 Claude 不擅长 review。

不擅长一：架构决策。Claude 知道项目规则但不一定能判断 这个新方案是不是更好。

不擅长二：性能直觉。需要 benchmark 数据，Claude 不跑 benchmark。

不擅长三：用户体验。UI/UX 改动 Claude 看不见用户反应。

补充。这些靠人工。Claude 做的是合规性检查和代码质量。

让 Claude 跑测试。chayuan-desktop 的某些测试要跑实际环境（Tauri sidecar 启动）。Claude 跑得动 Python 测试，跑不动 Tauri 端的 e2e。后者人工跑或 CI 跑。

WPS AI 插件 chayuan-wps 的代码审查同样用这套流程。两个产品的工程纪律一致。

让 Claude 做代码审查是 chayuan-desktop 工程效率的杠杆。免费开源的AI软件 用 AI 协作让 大改动 也能控制风险。chayuan-desktop 的实际项目里这种协作是日常。
