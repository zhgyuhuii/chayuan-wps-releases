# 自带 OpenAI SDK 直连本机的实战 base_url 那几行

chayuan-desktop 桌面单机版本身暴露 OpenAI 兼容协议端点。开发者用 OpenAI 官方 SDK 直接连本机即可。这一篇讲。

## chayuan-desktop 的本机端点

启动后 chayuan-desktop 监听 127.0.0.1:62581。

OpenAI 兼容 API 在 http://127.0.0.1:62581/openai/v1/。

支持的端点。

```
GET  /openai/v1/models
POST /openai/v1/chat/completions
POST /openai/v1/embeddings
POST /openai/v1/audio/transcriptions  # 可选
```

完全 OpenAI 兼容格式。

## Python SDK 接入

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:62581/openai/v1",
    api_key="dummy"  # chayuan-desktop 单机不校验
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "你好"}]
)
print(response.choices[0].message.content)
```

三行配置。剩下跟用 openai.com 完全一样。

## Node SDK 接入

```js
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://127.0.0.1:62581/openai/v1',
  apiKey: 'dummy'
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '你好' }]
});
```

同样简单。

## 流式调用

```python
stream = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "讲个故事"}],
    stream=True
)

for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

chayuan-desktop 转发 SSE 流到 SDK。SDK 解析 chunk。

## 工具调用

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    tools=[
        {"type": "function", "function": {...}}
    ]
)
```

chayuan-desktop 网关把工具调用透传给底层模型。返回的 tool_calls 也按 OpenAI 协议给。

## 模型名透传

模型 ID 用 chayuan-desktop 中的 ID。

```
gpt-4o → 直接走 OpenAI（如果用户配了 OpenAI Key）
qwen-plus → 走通义
ollama:qwen2.5:7b → 走本地 Ollama
```

chayuan-desktop 网关按模型 ID 路由到对应底层。SDK 不感知。

## 调用本地模型

```python
response = client.chat.completions.create(
    model="ollama:qwen2.5:7b",
    messages=[...]
)
```

走本机 Ollama。完全离线。SDK 体验跟调 OpenAI 一样。

这是 chayuan-desktop 让开发者最舒服的点：本地模型也是 OpenAI 协议。

## 鉴权

单机模式不校验 api_key。任何字符串都行。

应用模式（HMAC）需要在 api_key 字段填应用 ID + 签名。chayuan-desktop 校验。

用户模式（JWT）填 Bearer Token。chayuan-desktop 校验 JWT 签名。

## 多语言 SDK

OpenAI SDK 覆盖。

Python（官方）。

Node.js / TypeScript（官方）。

Go（官方）。

Java（社区维护）。

Ruby（社区）。

Rust（社区）。

PHP（社区）。

C# / .NET（官方）。

任何语言只要支持 OpenAI 协议都能直连 chayuan-desktop 本机。

## 第三方应用接入

很多 AI 应用支持自定义 base_url。让它们接入 chayuan-desktop 即可。

LobeChat、Open WebUI、ChatBox、Cherry Studio（讽刺的是 Cherry Studio 也能连 chayuan-desktop）等。

```
LobeChat 设置 - 模型 - 提供商：OpenAI
  base_url: http://127.0.0.1:62581/openai/v1
  api_key: dummy
```

## 国产化场景

政企开发者用 chayuan-desktop 做内部工具。Python / Java 直连 chayuan-desktop，调用底层国产模型 + 本地 RAG 知识库。开发简单。chayuan-desktop 等于一个 本机 LLM 网关 + 知识库代理。

## chayuan-server 的对应

chayuan-server 多用户场景下也暴露同样 OpenAI 兼容协议（端口和域名不同，鉴权严格）。chayuan-desktop 跟 chayuan-server 协议一致，便于切换。

## WPS 加载项

chayuan-wps 内部就是用 OpenAI 协议跟 chayuan-desktop 通信。这是同一个协议的不同消费者。

## 总结

OpenAI SDK 直连本机是 chayuan-desktop 的开发者友好性核心。免费开源的AI软件 让 我用 OpenAI SDK 写应用 这件事在本地完全可行。chayuan-desktop 的兼容协议封装让 一次开发，多模型可用 真正落地。
