# 异常score的诊断 为什么命中的不是相关内容

chayuan-desktop 桌面单机版的向量检索偶尔出现 命中的 chunk 跟 query 不相关 这种情况。这一篇讲怎么诊断异常 score。

先看异常的几种表现。

表现一：高 score 但内容不相关。比如向量 score 0.9 但 chunk 内容跟 query 无关。

表现二：低 score 但内容相关。本应该高 score 但反而低。

表现三：跨 KB 不一致。同一 query 在两个 KB 都应该命中，但只有一个高 score。

表现四：score 集中。所有 chunk score 都在很窄范围（比如 0.45-0.55），区分度低。

诊断思路。

诊断一：嵌入模型不匹配。query 用 bge-m3 算嵌入，但 KB 用了 bge-large-zh 建索引。两者向量空间不同，距离计算无意义。chayuan-desktop 在 KB 元数据里记录 embedding_model，确保 query 和 KB 用同一模型。如果误配置，结果就是 score 看起来正常但内容完全不相关。

诊断二：归一化未做。某些向量库的向量没归一化（比如 OpenAI text-embedding 是已归一化，但用户自家训练的可能没）。cosine 距离对未归一化向量结果不稳定。chayuan-desktop 在使用前自动归一化。

诊断三：维度匹配但内容偏差。两个 1024 维向量都用 bge 系列但不同子模型，向量空间不同。chayuan-desktop 检查 model_name 严格匹配。

诊断四：chunk 切分不当。chunk 太短（10-30 token）信息量低，向量分布乱。建议 chunk_size 至少 128。chunk 太长（2000+ token）信息混杂，相关度被稀释。

诊断五：query 太短。query 1-2 个字向量信息量太低。建议 query 长一些。

诊断六：训练数据偏差。某些嵌入模型训练数据偏向特定领域。比如 OpenAI text-embedding-3 在英文优秀但中文专业领域略弱。换 bge-m3 能提升精度。

诊断工具。

工具一：trace 日志。chayuan-desktop 的 trace 记录每次检索的 query 向量、命中 chunk 向量、原始 distance、归一化 score。开发者能看到中间值。

工具二：手动验证。用 chayuan-eval 跑一组 query 测 recall，看具体哪些 query 命中差。

工具三：跨 KB 对比。同一 query 在不同 KB 测试，看哪个 KB 表现差，定位问题。

异常处理。

异常一：嵌入模型不匹配。重建 KB 索引用正确模型。

异常二：chunk 切分问题。重新切分（chayuan-desktop 支持 KB 重新 chunk）。

异常三：训练偏差。换嵌入模型（重建索引）。

异常四：query 太短。改 prompt 让 LLM 把短 query 改写成长 query 再检索。chayuan-desktop 路线图里有 query rewriting 功能。

异常五：metadata 过滤太严。本来是 filter 让命中变少，但 score 看起来异常。检查 filter 表达式。

实际诊断流程。

第一步：从前端引用气泡看具体命中 chunk。如果 chunk 内容明显不相关，记下 chunk_id。

第二步：进 trace 日志看这次检索的详细信息。query 向量、KB embedding 模型、命中 chunk 的原始 distance。

第三步：对比 KB 元数据 embedding_model 字段跟当前默认嵌入模型。如果不一致，查为什么（用户主动换过模型？升级时变了？）。

第四步：跑一组对照 query 测试。看是个别 query 异常还是全部异常。个别异常多半是 query 边界问题，全部异常是 KB 配置问题。

第五步：必要时重建索引。

国产化支持下的诊断。中文 query 跟英文一致诊断流程。某些极端情况下（古文、生僻字、行业黑话）嵌入模型表现差，可能需要换专门模型。chayuan-desktop 支持自定义嵌入模型注册。

预防。

预防一：KB 创建时记录所有元数据（embedding_model_name、embedding_model_version、chunk_size）。

预防二：升级 chayuan-desktop 时跑一遍 eval 评估 KB 健康。

预防三：定期 sample query 测试。不是出问题才发现。

WPS AI 插件 chayuan-wps 在异常 score 场景下展示一致。用户在 WPS 里看到不相关引用时跟桌面客户端走同样的诊断路径。

异常 score 的诊断是 chayuan-desktop 用户深度使用时的必备技能。免费开源的AI软件 把内部信号暴露给用户，让 出问题能修 这件事变得可能。chayuan-desktop 在诊断这一面的工具让用户能自助。
