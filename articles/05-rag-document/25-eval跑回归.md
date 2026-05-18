# 本地离线知识库的RAG评测 单机版eval模块怎么自己跑回归

chayuan-desktop 桌面单机版自带一个 eval 模块，用来评测 KB 检索精度。这一篇讲清楚 eval 模块的具体用法，让用户能自己跑 RAG 回归。

先看为什么要 eval。chayuan-desktop 升级时 RAG 链路可能变化（嵌入模型升级、切分策略调整、重排参数变化），用户希望知道 这些变化对自己的 KB 影响多大。eval 模块给量化答案。

eval 的核心思路。用户提供一组 (query, expected_chunks) 配对作为 ground truth。系统跑 RAG，比对实际命中和 expected_chunks 的重合度，算 recall、precision、f1 等指标。

ground truth 怎么来。用户自己整理。常见做法：把过去用户问过的问题（已经知道答案在哪）作为 query，把对应的 chunk_id 列表作为 expected。这种 真实场景采样 比合成数据更靠谱。

ground truth 的格式。chayuan-desktop 的 eval 模块接受 JSON 格式：[{"query": "压力测试要求", "expected_chunks": ["chunk_42", "chunk_57"], "kb_id": "doc:技术规范"}]。每条记录一个 case。

跑 eval。chayuan-desktop 的命令行工具 chayuan-eval 跑评测。命令大致 chayuan-eval run --kb doc:技术规范 --groundtruth ./eval.json --output report.html。结果输出 HTML 报告含 recall@K、precision@K、平均 score。

跑哪些指标。

recall@K：前 K 个命中里包含 expected 的比例。最常用，反映 召回率。

precision@K：前 K 个命中里 expected 的占比。反映 命中精度。

mrr（mean reciprocal rank）：第一个正确命中的位置倒数。反映排序质量。

平均 score：所有 query 的平均综合分数。

p99 latency：99 分位延迟。性能指标。

eval 模式。chayuan-desktop 支持几种模式。

dry run：跑评测但不写 KB（只读）。

with rerank：开重排跑评测。

without rerank：关重排对比。

baseline：用上一版本的配置跑。新版本对比 baseline 看变化。

回归测试。用户在 chayuan-desktop 升级前跑一遍 baseline，升级后再跑一遍，对比看哪些指标涨了哪些跌了。这种 数据驱动 的回归比 凭感觉觉得变好/变差 靠谱。

定期跑。chayuan-desktop 推荐用户每月跑一次 eval，跟踪 KB 检索精度的长期变化。如果 KB 内容大量更新（新增很多 chunk），精度可能漂移，eval 能及时发现。

eval 报告的解读。

recall@5 0.91 → 0.92 提升约 1%。涨幅小但稳定。

precision@5 0.45 → 0.40 下降 5%。说明前 5 命中里有效 chunk 比例下降。可能召回了更多不相关 chunk。

mrr 0.85 → 0.83 略降。意味着第一个正确命中位置稍微靠后。

p99 latency 200ms → 180ms 改善。性能略好。

跨 KB 的 eval。chayuan-desktop 支持给多个 KB 跑评测。每个 KB 一份报告。但不要混在一份 ground truth 里跑（query 跟 KB 关联会乱）。

eval 的限制。

限制一：ground truth 主观。某个 query 的正确答案在哪些 chunk 里，人工判断有主观因素。chayuan-desktop 的 eval 接受多个 expected_chunks 列表（任一命中算成功）。

限制二：评测集要更新。KB 内容变了 expected_chunks 可能失效。chayuan-desktop 不自动更新 ground truth。

限制三：覆盖率有限。100 条 ground truth 不一定能代表全部使用场景。建议至少 50 条覆盖主要主题，理想 200+ 条。

eval 数据的隐私。eval 数据可能含敏感 query 和 chunk。chayuan-desktop 默认本地跑，不上传任何东西。但 eval 报告里可能含敏感片段，分享时注意脱敏。

国产化支持下的 eval。chayuan-desktop 的 eval 模块在中文 KB 上跑得到位。中文 query 跟 chunk 的精度评估跟英文一致。

WPS AI 插件 chayuan-wps 的 eval 跟桌面客户端共用。在 WPS 加载项里发起检索时质量跟桌面客户端一致，eval 结果直接适用。

eval 模块是 chayuan-desktop 给认真用户的高级工具。免费开源的AI软件 不只给用户产品，还给用户评估产品的工具。这种 透明可量化 的态度是 chayuan-desktop 的工程价值观。
