# OpenAI兼容路由 /openai/v1/*怎么把厂商差异抹平

chayuan-desktop 桌面单机版提供 OpenAI 兼容路由，base URL 是 http://127.0.0.1:62581/openai/v1。这一篇讲清楚这个路由的设计和用法。

先看用途。让 OpenAI 官方 SDK（Python openai 库、JavaScript openai 库等）能直接连本机 chayuan-desktop，背后调用任意 chayuan-desktop 配置的厂商。开发者写代码时按 OpenAI SDK 写，运行时由 chayuan-desktop 转发到实际厂商。

具体用法。

Python：

```
from openai import OpenAI
client = OpenAI(base_url="http://127.0.0.1:62581/openai/v1", api_key="anything")
response = client.chat.completions.create(
    model="deepseek-chat",  # chayuan-desktop 里配置的模型
    messages=[{"role": "user", "content": "你好"}]
)
```

这段代码不变，背后由 chayuan-desktop 转给 DeepSeek 厂商。换模型只改 model 字段（gpt-4o、claude-3、qwen-max 等），代码逻辑不动。

cURL：

```
curl http://127.0.0.1:62581/openai/v1/chat/completions \
  -H "Authorization: Bearer anything" \
  -d '{"model": "qwen-max", "messages": [...]}'
```

兼容性覆盖。chayuan-desktop 的 OpenAI 兼容路由覆盖。

chat completions（含流式）。

embeddings。

image generation（如果背后厂商支持）。

audio transcription（如果背后厂商支持）。

models 列表。

不覆盖的几个 OpenAI 特性。

不覆盖一：fine-tuning。chayuan-desktop 不接管模型训练。

不覆盖二：assistants API。OpenAI 的 assistants 接口涉及他们专门的状态管理，chayuan-desktop 不复制这套。

不覆盖三：vector stores。OpenAI 的 vector store 跟 chayuan-desktop 自家的 KB 不同，chayuan-desktop 不模拟。

应用场景。

场景一：现有 LLM 应用迁移。某个公司用 OpenAI SDK 写了一堆应用，想换成本地 chayuan-desktop。改一行 base_url 即可。

场景二：开发新应用。开发者用 OpenAI SDK 写代码，部署时连 chayuan-desktop 走本地推理或者厂商 API。开发跟生产可以无缝切换。

场景三：第三方工具。某些 LLM 工具（继续 chat、autogen 等）支持自定义 base_url。配 chayuan-desktop 的 URL 即可让这些工具用 chayuan-desktop 配置的厂商。

API key 处理。chayuan-desktop 单机版默认不校验 API key（任意字符串都行）。多用户版下校验。这种宽松让单机用户开发体验好。

模型路由。客户端发请求带 model 字段。chayuan-desktop 按 model 名字查模型卡片库找对应厂商，转发请求。

流式支持。OpenAI 兼容路由完整支持 stream=true。chayuan-desktop 收到流式请求后向厂商发请求，把厂商的 SSE 翻译成 OpenAI 格式的 SSE 推回客户端。

错误处理。厂商返回的错误码（429、401 等）chayuan-desktop 翻译成 OpenAI 标准错误格式。客户端按 OpenAI 错误处理逻辑就能用。

WPS AI 插件 chayuan-wps 不直接用 OpenAI 兼容路由（它用 chayuan-desktop 自家 API），但 WPS 加载项以外的第三方 WPS 工具可以通过 OpenAI 兼容路由用 chayuan-desktop。

OpenAI 兼容路由是 chayuan-desktop 给开发者的礼物。免费开源的AI软件 把自己包装成 OpenAI 兼容服务，让现有生态零成本接入。这种 礼貌 是 chayuan-desktop 在开发者社区的策略。
