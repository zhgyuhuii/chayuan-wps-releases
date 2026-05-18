# 察元 AI vs Kimi 桌面 长上下文的对照

chayuan-desktop 跟 Kimi 桌面在长上下文上的对照。这一篇讲。

## Kimi 桌面是什么

Moonshot 月之暗面出的桌面端 AI 助手。

主打长上下文（200k - 2M token）。

接 Kimi 自家模型。

## chayuan-desktop 的对应

接多模型（包括 Kimi）。

长上下文模型支持（Qwen-1M、Claude-200k、Kimi）。

但不限于长上下文。

## 长上下文体验

Kimi 桌面：每次对话默认长上下文。整文档塞 prompt。

chayuan-desktop：默认 RAG（检索 chunk）。也支持长上下文（用户选）。

两种思路不同。

## 长上下文 vs RAG

Kimi 思路：把所有文档丢进 prompt。LLM 在长上下文里理解 + 回答。

```
prompt = system + 整文档（200k token） + 用户问题
LLM 处理。
```

chayuan-desktop 思路：检索相关 chunk。LLM 看少量精准内容回答。

```
prompt = system + 检索的 5 个 chunk + 用户问题
LLM 处理。
```

各有优劣。

## 长上下文的优势

理解全局更全。

不会漏（RAG 检索可能漏命中）。

不需要预处理（直接丢文档）。

## 长上下文的劣势

成本高。200k 上下文每次贵。

延迟高。处理长文档慢。

注意力衰减（lost in middle）。

无法精确引用（知道 LLM 答的依据在哪）。

## RAG 的优势

成本低。

精准引用。

可扩展（无限文档）。

便于审计。

## RAG 的劣势

可能漏（检索不准）。

需要预处理（嵌入 + 索引）。

复杂。

## 混合方案

某些场景两者结合。

第一步：RAG 检索 50 个候选。

第二步：把 50 chunk（约 50k token）一起塞 prompt 给长上下文模型。

第三步：长上下文 LLM 回答。

成本中。精度高。chayuan-desktop 支持。

## 引用

Kimi 桌面：长上下文回答含引用（基于上下文位置）。

chayuan-desktop：RAG 回答含引用（精准 chunk_id + page + bbox）。

chayuan-desktop 引用更精细。

## 国产化

Kimi 桌面：国产（Moonshot）。但 Kimi 模型主要在云。

chayuan-desktop：国产化栈（接 Kimi 也接其他）。

## 价格

Kimi 桌面：免费 + Kimi 探索版收费。

chayuan-desktop：免费。

## 适合人群

Kimi 桌面适合。

需要长上下文（读长文档、长论文）。

接受用 Kimi 模型。

不需要 KB 概念。

主要在线使用。

chayuan-desktop 适合。

需要 KB + RAG。

需要离线。

需要 WPS。

需要多种模型。

党政军合规。

## 互补

某些用户两个都用。

Kimi 桌面：跨产品长上下文阅读。

chayuan-desktop：自家工作场景 KB + WPS。

## chayuan-desktop 接 Kimi

chayuan-desktop 能接 Kimi API 作为 LLM 选项。同样享受 Kimi 长上下文。

```yaml
provider:
  - name: Kimi
    base_url: https://api.moonshot.cn/v1
    auth: bearer_token
```

无需额外装 Kimi 桌面。

## 总结

察元 AI vs Kimi 桌面在长上下文上的对照展示两种 AI 思路。免费开源的AI软件 不绑定单一思路。chayuan-desktop 的 RAG + 长上下文混合让两者优势都用上。Kimi 桌面在纯长上下文场景专注。
