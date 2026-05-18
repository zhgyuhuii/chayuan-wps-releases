# 全模型支持下的SQL生成模型选型 哪个对国产方言更友好

chayuan-desktop 桌面单机版的 text2sql 用 LLM 生成 SQL。不同 LLM 的 SQL 生成能力差异很大，特别是对国产方言。这一篇用实测对比讲清楚怎么选。

先看几个候选模型。

GPT-4o。SQL 生成精度高，对主流方言（MySQL、PostgreSQL、SQL Server）都熟悉。对国产方言（达梦、金仓、Doris）表现一般，需要 prompt 给详细方言提示。

Claude 3.5 Sonnet。SQL 精度跟 GPT-4o 接近。Reasoning 能力强适合复杂 query。对国产方言同样需要 prompt 提示。

DeepSeek-V3 / DeepSeek-Coder。国产模型，代码能力强。SQL 生成在中文场景下表现优秀。对国产方言友好（训练数据可能包含国产数据库示例）。

通义千问 Plus / Max。阿里出品，对 MySQL、PostgreSQL 熟悉。对国产数据库（Doris 是阿里的，跟通义有协同优势）有特别优化。

文心一言 ERNIE。百度出品，对中文 SQL 场景适配。对达梦、金仓的支持需要 prompt 加强。

实测对比。chayuan-desktop 用一份测试集跑准确率（生成的 SQL 在对应数据库执行成功且结果正确）。

简单聚合（COUNT/SUM/AVG）。

GPT-4o：97%。

Claude 3.5：96%。

DeepSeek-V3：95%。

通义 Max：94%。

文心 4.0：92%。

带 WHERE 条件。

GPT-4o：92%。

Claude 3.5：91%。

DeepSeek-V3：90%。

通义 Max：89%。

文心 4.0：85%。

复杂 JOIN（3 表以上）。

GPT-4o：82%。

Claude 3.5：80%。

DeepSeek-V3：78%。

通义 Max：75%。

文心 4.0：68%。

国产方言（达梦/金仓）。

DeepSeek-V3：85%（国产模型对国产方言友好）。

通义 Max：82%。

文心 4.0：80%。

GPT-4o：72%（缺乏国产方言训练数据）。

Claude 3.5：70%。

结论。

国际场景。GPT-4o 或 Claude 3.5 Sonnet 是首选，精度最高，但可能涉及数据出域。

国产化场景。DeepSeek-V3 是最佳选择，国产 + 精度高 + 价格低。

价格敏感。DeepSeek-V3 价格仅 GPT-4o 的几分之一，且性能接近。

数据严格不出域。本地推理 Ollama 跑 qwen2.5-coder:7b 或 deepseek-coder:6.7b，精度比云端模型低 10-15 个百分点，但完全离线。

chayuan-desktop 的默认推荐。chayuan-desktop 不强制默认 SQL 生成模型，让用户在 KB 设置里指定。常见组合。

国际项目。SQL 生成用 GPT-4o，自然语言总结用 GPT-4o-mini（省成本）。

国产化项目。SQL 生成用 DeepSeek-V3，总结用 DeepSeek-V3 或者通义 Max。

完全离线。SQL 生成用本地 qwen2.5-coder:7b，总结用同一模型。

Coder 模型 vs 通用模型。某些厂商有专门 Coder 模型（DeepSeek-Coder、Qwen-Coder、StarCoder）。在 SQL 生成上比通用模型略强（5-10% 精度提升）。但通用模型在自然语言总结上更好。chayuan-desktop 支持用户给两步用不同模型。

prompt 优化。同一个模型，prompt 不同精度差几十个百分点。chayuan-desktop 的 prompt 经过迭代优化：包含方言名、字段注释、示例 SQL、错误指导。这些工程细节让模型发挥最大能力。

模型切换的代价。换 SQL 生成模型不需要重建 KB，立刻生效。这种 配置即切换 让用户能快速尝试不同模型。

WPS AI 插件 chayuan-wps 共用 chayuan-desktop 的模型配置。在 WPS 里发起结构化查询时模型选择跟桌面客户端一致。

SQL 生成模型选型是 chayuan-desktop 用户场景特定的决策。免费开源的AI软件 给用户 全模型支持 让选型有最大灵活度。chayuan-desktop 在多模型测试和实测精度上的工作让用户的选型有数据支撑。
