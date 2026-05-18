# CPU 推理的可用范围 哪些任务还能本地跑

chayuan-desktop 桌面单机版在没有独显的笔记本和办公机上必须跑 CPU 推理。这一篇讲哪些任务能跑。

## CPU 推理的局限

CPU 推理慢。一般 1-10 tokens/s（看 CPU 和模型大小）。流式时用户感知慢。

CPU 推理只用 RAM。模型大小受限于内存。16GB 内存能跑 7B Q4，4GB 内存只能跑 1.8B。

## 能跑的任务

任务一：实时对话。1.8B-Q4 模型在主流 CPU（Intel i5/i7、AMD Ryzen 5/7）上 15-30 tokens/s。流畅可用。

任务二：摘要。给一段文字让 LLM 摘要 3-5 句。1-3B 模型够。CPU 跑 5-10 秒。

任务三：分类标签。给标题让 LLM 选标签。0.5B 模型即可。CPU 秒级。

任务四：嵌入。bge-m3-onnx 在 CPU 上每次嵌入约 100-200ms。够用。建索引慢但能跑。

任务五：重排。bce-reranker 在 CPU 上每次重排 10 个候选约 500ms。够用。

任务六：意图识别。简单分类任务。0.5B 模型秒级。

任务七：JSON 提取。从文本提取结构化字段。1.8B 模型可。

## 不太行的任务

任务八：长文写作。10000 字报告。CPU 跑 7B 模型要 30 分钟。用户等不及。建议走云模型。

任务九：复杂推理。复杂数学题、代码生成。需要 7B+ 才效果好。CPU 跑 7B 流畅度受限。

任务十：实时翻译。要快。CPU 跑 7B 翻译 1000 字要几分钟。慢。

## 模型选择推荐

CPU 上推荐。

Qwen2.5-1.8B-Instruct-Q4_K_M。约 1GB。日常够用。

Qwen2.5-3B-Instruct-Q4_K_M。约 2GB。质量更好。

bge-m3-onnx-q8。约 200MB。嵌入。

bce-reranker-base-onnx。约 300MB。重排。

## 性能对比

| 模型 | i7-13700H | i5-12500U | 鲲鹏 920 |
|---|---|---|---|
| Qwen-1.8B | 35 tok/s | 18 tok/s | 18 tok/s |
| Qwen-3B | 22 tok/s | 11 tok/s | 12 tok/s |
| Qwen-7B | 11 tok/s | 5 tok/s | 5 tok/s |

主流 CPU 跑 1.8B 流畅。3B 一般。7B 勉强。

## 优化策略

策略一：用 ONNX 格式而非 GGUF。某些场景 ONNX 在 CPU 上快 20%。

策略二：用 INT4 量化（Q4_K_M）。最佳速度 / 质量平衡。

策略三：限制 thread 数。多核 CPU 上不一定开全部线程最快（NUMA 抖动）。chayuan-desktop 自动探测最优。

策略四：限制上下文长度。KV cache 占内存且影响速度。日常对话 4096 上下文够用。

## chayuan-desktop 的智能路由

请求到达。chayuan-desktop 判断本机能力。

CPU 推理。简单任务（聊天、摘要）走本地。

复杂任务自动转云。chayuan-desktop 设置里有 复杂任务转云 开关。开启后用户问长文生成或复杂推理时自动切换到云模型（如果用户配了 OpenAI Key）。

不开就在本地跑慢慢出。

## 与云模型混用

chayuan-desktop 的 fallback 链推荐家用配置。

```
chat fallback:
  1. ollama:qwen2.5:1.8b (本机, 快)
  2. ollama:qwen2.5:7b (本机, 慢但更准)
  3. qwen-plus (云, 网通时用)
```

主用本地 1.8B。复杂任务等用户主动切到 7B 或云。

## 国产化场景

党政军单位电脑普遍是办公机（无独显）。chayuan-desktop 的 CPU 推理在这种场景是核心能力。1.8B + Q4 量化让 完全离线 AI 在普通办公机上可用。

某些等保场景禁止联网。CPU 推理 + 本地知识库是唯一选择。chayuan-desktop 完全覆盖。

## chayuan-server 的对应

chayuan-server 部署在带 GPU 的服务器跑大模型。chayuan-desktop 在 CPU 跑小模型。两者搭配。

## WPS 加载项

chayuan-wps 在 WPS 里调本地小模型快。员工写报告时基础查询用本地秒级响应，复杂请求转云。

## 总结

CPU 推理的可用范围是 chayuan-desktop 在硬件兼容性上的工程边界。免费开源的AI软件 让 没有 GPU 也能用 AI 这件事成立。chayuan-desktop 的 1.8B + Q4 默认 + 智能路由让 CPU 推理 在大多数办公任务上够用。
