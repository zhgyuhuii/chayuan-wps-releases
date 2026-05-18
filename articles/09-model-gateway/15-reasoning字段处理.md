# reasoning 字段的处理 深度思考的折叠展示

chayuan-desktop 桌面单机版的模型网关对 OpenAI o1、DeepSeek-R1、Qwen-QwQ 等推理模型的 reasoning 字段做特别处理。这一篇讲。

## reasoning 字段的来源

OpenAI 的 o1 模型生成时有 内部推理 步骤。o1 接口的输出含 reasoning_content（思考过程）和 content（最终答案）两段。

DeepSeek-R1 类似。返回 reasoning_content。

Qwen-QwQ 同上。

这种 思考过程 通常很长（几千 token），用户不一定每次都想看。

## chayuan-desktop 的展示

UI 默认折叠 reasoning。回答区显示。

```
[展开思考过程 (3854 字)]
最终答案：...
```

用户点 展开思考过程 看完整推理链。看完点收起。

## 流式中的 reasoning

reasoning 通常先于最终答案生成。chayuan-desktop 流式接收。

```
1. 收到 reasoning_content delta，累积到 思考过程 框，灰色文本流式打字。
2. reasoning 完成后开始 content delta，黑色文本流式打字到回答框。
3. 用户看到先思考再回答的视觉流程。
```

## 折叠的设计

折叠状态默认关闭。但是。

用户开过一次后，下次同会话同消息保持展开。让用户对感兴趣的回答保留展开状态。

某些场景（比如用户是开发者要 debug 模型）能在设置里开 默认展开 reasoning。

## reasoning 不参与上下文

chayuan-desktop 在多轮对话时不把 reasoning 作为上下文传给后续请求。只传 content。

理由。reasoning 太长，重复传浪费上下文窗口。reasoning 也不是模型的最终答案，传给后续可能误导。

## reasoning 不计入 Token 计费给用户

OpenAI 的 o1 计费包含 reasoning tokens。用户看到 token 数会比 content 看起来多。chayuan-desktop 在成本预估时把 reasoning 估算包含进去（按经验比例输出 token 的 5-10 倍）。

让用户对实际成本有数。

## 长 reasoning 的截断

某些 reasoning 极长（5000+ token）。chayuan-desktop 在 UI 上不截断（让用户能看完整）。但导出聊天记录时如果用户选 简洁模式 自动跳过 reasoning，只导 content。

## 不支持 reasoning 的模型

普通模型（gpt-4o、claude-3.5）没有 reasoning 字段。chayuan-desktop 的网关识别 reasoning 字段缺失时不渲染折叠区。UI 直接显示 content。

## reasoning 模型的成本提示

reasoning 模型贵（o1 比 gpt-4o 贵 6 倍）。chayuan-desktop 在用户切换到 reasoning 模型时弹提示 该模型推理过程消耗大量 Token，单次请求可能 ¥1+，是否继续。

让用户知情决策。

## reasoning 失败的处理

某些 reasoning 模型偶尔在 reasoning 阶段卡住或超时。chayuan-desktop 的超时设置默认 5 分钟。超过提示用户 思考超时。

## 国产化场景

国产 DeepSeek-R1 是开源 reasoning 模型，用户能本地部署。chayuan-desktop 完全支持。本地 R1 推理慢（CPU 版本上 1 小时一题），适合非时效性深度问题。

## chayuan-server 的对应

chayuan-server 模式下 reasoning 同样处理。chayuan-desktop 共享 UI 组件。

## WPS 加载项

chayuan-wps 在 WPS 里发起调用如果用户选了 reasoning 模型，思考过程也展示在加载项侧栏。员工写复杂分析报告时能看 AI 的推理逻辑。

## 总结

reasoning 字段的处理是 chayuan-desktop 在新模型时代的工程更新。免费开源的AI软件 跟上 LLM 的能力进化，reasoning 模型是 2025-2026 的主流之一。chayuan-desktop 的折叠展示 + 流式接收 + 上下文剥离让 深度思考 模型在产品上自然落地。
