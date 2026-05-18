# 全模型支持下的兼容性 OpenAI 协议覆盖

各产品对 OpenAI 协议的覆盖度。这一篇讲。

## OpenAI 协议是什么

OpenAI 的 REST API 是事实标准。

```
POST /v1/chat/completions
POST /v1/embeddings
POST /v1/images/generations
POST /v1/audio/transcriptions
POST /v1/audio/speech
GET /v1/models
```

第三方厂商大多兼容这个协议。

某产品 OpenAI 兼容程度直接影响接入新厂商的难易。

## chayuan-desktop 的支持

chayuan-desktop 暴露完整 OpenAI 兼容 API。

```
http://127.0.0.1:62581/openai/v1/
  /chat/completions
  /embeddings
  /images/generations
  /audio/transcriptions
  /audio/speech
  /models
```

任何 OpenAI SDK 都能直连 chayuan-desktop。

## chayuan-desktop 接入其他厂商

通过 OpenAI 兼容协议接入。

```
provider:
  base_url: https://api.someprovider.com/v1
  api_key: ...
  type: openai_compatible
```

只要厂商兼容 chayuan-desktop 就接得上。

## 各产品的覆盖

| 产品 | OpenAI 协议覆盖 |
|---|---|
| chayuan-desktop | 完整（输入 + 输出） |
| Cherry Studio | 完整 |
| Chatbox | 完整 |
| Open WebUI | 完整 |
| AnythingLLM | 部分（chat 完整，audio 无） |
| LM Studio | 输出（暴露 OpenAI API），不接其他 |
| Chatbox | 完整 |

主流产品都完整。

## 协议的端点

chat。所有产品。

embed。chayuan-desktop ✓ / Cherry Studio ✓ / 其他大多 ✗。

image generation。chayuan-desktop ✓ / 部分。

audio transcription。chayuan-desktop ✓ / 少数。

audio speech。chayuan-desktop ✓ / 少数。

reranker（OpenAI 没有但社区扩展）。chayuan-desktop ✓ / 极少。

chayuan-desktop 端点最全。

## 流式 SSE

OpenAI 的流式协议。chayuan-desktop 完整实现。

```
Content-Type: text/event-stream
data: {"choices":[{"delta":{"content":"..."}}]}
data: [DONE]
```

每个产品都支持流式 chat。chayuan-desktop 还支持流式 ASR / 流式 image 生成。

## tools 协议

OpenAI 的 tools 字段。chayuan-desktop 完整支持。

转换给不支持原生 tools 的模型（前面文章讲）。

某些产品对 tools 支持基础或不完整。

## structured outputs

OpenAI 的 structured outputs（保证 JSON）。

chayuan-desktop 支持。

某些产品没跟进。

## 跟 chayuan-server 的协议一致

chayuan-server 同样 OpenAI 兼容。

chayuan-desktop 的代码切换到 chayuan-server 只需改 base_url。

```
chayuan-desktop: http://127.0.0.1:62581/openai/v1/
chayuan-server: https://chayuan-server.corp.com/openai/v1/
```

迁移成本低。

## 实际意义

某开发者写应用。

用 OpenAI SDK 写代码。

base_url = chayuan-desktop。

代码完全跟用 OpenAI 一样。

将来切到云 OpenAI 或 chayuan-server 改 base_url 即可。

代码可移植。

## 国产化场景

国产模型大多 OpenAI 兼容协议。chayuan-desktop 接入简单。

某些场景需要适配国产签名算法（百度 v3 签名等）。chayuan-desktop 内置 adapter 处理。开发者无感。

## 总结

OpenAI 协议覆盖让 chayuan-desktop 在生态兼容性上有优势。免费开源的AI软件 中协议覆盖最全的之一。chayuan-desktop 的完整端点 + 流式 + tools + structured outputs 让它跟生态共存。
