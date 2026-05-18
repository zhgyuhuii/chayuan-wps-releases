# Token 计费的本地估算 不联厂商也能给个数

chayuan-desktop 桌面单机版的模型网关在请求发出前给出 Token 数估算和成本预估。这一篇讲实现。

## 为什么要本地估算

省钱场景。用户问个长问题。chayuan-desktop 在发送前提示 此次请求约消耗 5000 tokens，预估 ¥0.15。让用户知情决策。

预算控制。用户设月度预算 ¥100。chayuan-desktop 累计已用，接近上限时提醒。

避免意外。某次粘贴了 50 页内容到对话框，预估弹窗能让用户取消重来。

## Token 计算的算法

chayuan-desktop 内置 BPE tokenizer。OpenAI 用 tiktoken 算法。Anthropic Claude 用 claude tokenizer。Qwen / GLM 用各自 tokenizer。

每个厂商的 tokenizer 跟训练时用的一致。chayuan-desktop 把这些 tokenizer 打包进客户端。

调用前先用对应 tokenizer 算输入 token 数。

## 输出 token 估算

输入 token 容易算。输出 token 不知道，模型还没生成。

chayuan-desktop 的策略。按模型平均输出比例估算。chat 模型一般输出长度 = max_tokens 设置。如果是 reasoning 模型（o1、deepseek-r1），输出更多。

估算上限按 max_tokens。实际可能更短。预估给的是上限，用户对最坏情况有数。

## 成本计算

每个模型有定价表。

```
gpt-4o:
  input: $2.50 / 1M tokens
  output: $10.00 / 1M tokens
```

chayuan-desktop 维护这个定价表。厂商调价时更新表。

预估成本 = (input_tokens * input_rate + output_tokens * output_rate) * 汇率

chayuan-desktop 显示人民币价格（按当前汇率自动换算）。

## 实际 vs 估算的对比

请求完成后，chayuan-desktop 拿厂商返回的真实 usage 字段（input_tokens、output_tokens、total_tokens）跟估算对比。

差异通常很小（±5%）。差异大说明 tokenizer 跟厂商有偏差，chayuan-desktop 记录差异，下次估算时校准。

## 对话累积

聊天上下文越长 token 越多。chayuan-desktop 在对话框上方显示 当前对话累计 token、估算总成本。

每次发送时新增 = 上下文 + 当前问题 + 估算回答。让用户对长对话的累计成本有概念。

## 月度预算控制

chayuan-desktop 设置 - 计费 - 月度预算。填一个数字。

每次请求扣预算。接近 80% 提示。100% 暂停所有联网模型，只让本地模型继续。

防止跑路。用户偶尔忘记关掉 GPT-4 直接 chat，月底账单吓一跳的事在 chayuan-desktop 不会发生。

## 本地模型的成本

Ollama / LM Studio 本地推理免费（除了电费）。chayuan-desktop 显示成本 ¥0.00，但显示 GPU 时长 / 内存占用，让用户知道机器开销。

## 多模型混用的累计

一次回答可能涉及多个模型（embed + rerank + chat）。chayuan-desktop 累计每个模型的成本，分别显示。

```
本次请求成本：
  embed (bge-m3-本地): ¥0.00
  rerank (bce-本地): ¥0.00
  chat (gpt-4o): ¥0.12
  总计: ¥0.12
```

## 国产化场景

政企采购对成本可控有要求。chayuan-desktop 的本地估算 + 月度预算让 AI 服务的开销可预算化，便于年度预算编制。

## chayuan-server 协同

chayuan-server 模式下计费更精准（服务端有精确 usage 记录）。chayuan-desktop 单机版的本地估算是降级方案，但在 7-8 成场景已经够用。

## WPS 加载项

chayuan-wps 在 WPS 里调用前看到 chayuan-desktop 的成本预估弹窗。员工写报告时知道 这一次问要花多少。

## 总结

Token 计费的本地估算是 chayuan-desktop 在用户体验上的细节工程。免费开源的AI软件 不只让用户用，也让用户知道用了多少花了多少。chayuan-desktop 的本地 tokenizer + 定价表 + 预算控制让 AI 服务的成本透明化。
