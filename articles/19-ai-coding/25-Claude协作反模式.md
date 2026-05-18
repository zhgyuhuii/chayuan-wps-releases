# Claude 协作的反模式 哪些事不要交给它

chayuan-desktop 桌面单机版跟 Claude 协作有边界。这一篇讲反模式。

## 不要交的事

事一：架构最终决策。

Claude 能给建议。最终决策由人。

某次重构讨论 Claude 给三种方案。决策权在工程师 / 架构师。

事二：跨多服务的影响评估。

Claude 看到的是 chayuan-desktop 单仓库。某改动可能影响 chayuan-server / chayuan-wps。Claude 不一定知道。

人来评估全局影响。

事三：业务策略决定。

```
是否上线某新功能？
价格策略？
兼容期长短？
```

业务决策。Claude 提供数据但不做决定。

事四：隐私敏感数据处理。

Claude 是云模型。某些场景代码 / 数据不能发给 Claude。

```
某政企的内部代码。涉密。不能让 Claude 看。
```

走本地 LLM（Qwen-Coder 等）替代。

## 容易出错的协作

错误一：让 Claude 直接合并 PR。

Claude 给的代码可能有 bug。必须人 review。

```
错误的工作流：Claude 写代码 → CI 通过 → 自动合并。

正确：Claude 写代码 → CI 通过 → 工程师 review → 合并。
```

事五：让 Claude 处理用户私人数据。

某用户的私聊给 Claude 看。隐私问题。

chayuan-desktop 团队不该这么做。

事六：让 Claude 处理生产事故。

生产环境（chayuan-server）出故障。让 Claude 直接修。

危险。Claude 的修复可能引入新问题。

正确：Claude 给建议 → 工程师评估 → 工程师执行。

事七：盲信 Claude 的安全分析。

Claude 给的安全建议可能漏。

某些 CVE 是 Claude 训练截止后的。Claude 不知。

人工审视必要。

## 容易过度依赖

过度依赖一：所有代码让 Claude 写。

Claude 写的代码风格 / 模式可能跟项目不一致。

工程师还是要写一些核心代码保持项目调性。

过度依赖二：所有文档让 Claude 写。

Claude 写的文档可能漏关键信息（Claude 不知道）。

某些设计原则 / 历史 / 八卦只有人知道。

过度依赖三：所有审查让 Claude 做。

Claude 审查覆盖很广。但可能漏。

人工审查仍必要（特别是核心 PR）。

## 复杂问题的限制

Claude 的限制。

跨文件理解可能有偏。

历史和现状的差异（Claude 训练有截止）。

某些极端边界情况（罕见 OS、罕见硬件）。

业务规则（chayuan-desktop 特有的）。

工程师补充这些。

## chayuan-desktop 的协作守则

守则一：Claude 是协作者不是替代者。

守则二：Claude 给建议，人做决定。

守则三：Claude 写代码，人 review。

守则四：敏感数据不发给 Claude（用本地 LLM）。

守则五：保持工程师对项目的整体掌控。

## 国产化场景

党政军场景必须用本地 LLM 而非 Claude（数据不出端）。chayuan-desktop 自身用 Qwen-Coder / DeepSeek-Coder 协作开发。

某些场景完全断网开发。本地 LLM 是唯一选择。

## chayuan-server 的对应

chayuan-server 同样的反模式。两项目共享守则。

## 价值的边界

Claude 在边界内极有价值。

代码生成、测试、文档、审查、迁移指南、Runbook、CHANGELOG 等。

边界外（决策、敏感数据、生产事故）需要人。

工程师跟 Claude 找平衡。

## 总结

Claude 协作的反模式是 chayuan-desktop 在 AI 协作上的成熟反思。免费开源的AI软件 让 AI 协作 是工具不是替代。chayuan-desktop 的守则 + 反模式 + 价值边界让协作高效不出错。AI 让工程师专注高价值工作，杂事 AI 处理。
