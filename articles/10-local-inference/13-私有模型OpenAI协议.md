# 私有模型如何加载 自家微调模型走 OpenAI 兼容协议

chayuan-desktop 桌面单机版支持加载用户自家微调的私有模型。走 OpenAI 兼容协议接入。这一篇讲。

## 私有模型的来源

来源一：用户基于开源模型微调。比如 Qwen2.5-7B 经 LoRA 微调适配自家行业。

来源二：公司内部预训练模型。比如某金融公司基于 GLM-4 微调的金融问答模型。

来源三：科研机构的私有模型。

不公开的模型用户想在 chayuan-desktop 里用。

## 接入方式一：vLLM/Xinference 部署 + 接入

最常见。

第一步。用户在自己的服务器跑 vLLM 加载私有模型。vLLM 暴露 OpenAI 兼容协议在某端口。

第二步。chayuan-desktop 设置 - 模型 - 添加自定义厂商。

```
name: 公司金融模型
base_url: http://internal.corp.com:8000/v1
api_key: secret-key
type: openai_compatible
```

第三步。chayuan-desktop 拉 /v1/models 看到自家模型 ID（比如 corp-finance-7b）。

第四步。在聊天界面选 corp-finance-7b 即可使用。

## 接入方式二：Ollama 加载本地 GGUF

某些用户把私有模型转 GGUF 格式（llama.cpp 自带工具），用 Ollama 加载。

```
ollama create corp-model -f Modelfile
```

Modelfile 指向本地 GGUF 文件。

chayuan-desktop 自动从 Ollama 拉模型列表。corp-model 出现在模型选择器。

## 接入方式三：直接走 chayuan-desktop 内嵌 llama.cpp

把 GGUF 文件放到 ~/.chayuan/models/llm/gguf/。chayuan-desktop 启动时扫描。

```
~/.chayuan/models/llm/gguf/
  corp-finance-7b-q4.gguf
  corp-legal-13b-q4.gguf
```

每个文件作为一个模型。chayuan-desktop 用内嵌 llama.cpp 加载。

## 模型卡片配置

私有模型的卡片用户手动配。

```yaml
id: corp-finance-7b
display_name: 公司金融模型 v1
description: 基于 Qwen2.5-7B 微调，专攻金融问答
context_window: 8192
input_price: 0
output_price: 0
capabilities: [chat, tools]
custom: true
```

放到 ~/.chayuan/model_cards/corp-finance-7b.yaml。

## 鉴权

私有部署的鉴权方式不一定是 Bearer Token。chayuan-desktop 的自定义厂商支持。

Bearer Token。最常见。

x-api-key header。

Basic Auth。

Custom header。用户能配自定义 header。

## 推理参数

私有模型的推荐参数（temperature、top_p 等）chayuan-desktop 配置里能默认设。每次请求自动应用。

```yaml
defaults:
  temperature: 0.3
  top_p: 0.95
  max_tokens: 2048
```

这跟通用模型不同（通用是用户每次设）。

## 工具调用支持

某些微调模型支持原生 tools。chayuan-desktop 配置里开 tools_supported: true。

不支持原生的走 chayuan-desktop 的文本协议降级。

## 视觉模型支持

如果私有模型是视觉模型。chayuan-desktop 配置 capabilities: [vision]。请求时把图像按 OpenAI 多模态格式传给后端。

## 流式支持

vLLM、Ollama 都支持流式。chayuan-desktop 默认开。

某些奇怪的私有部署不支持流式，chayuan-desktop 探测后切非流式。

## 安全

私有模型的 base_url 和 api_key 是敏感信息。chayuan-desktop 用 Stronghold 加密存储。

私有部署 HTTPS 自签证书。chayuan-desktop 配置里能信任。

## 国产化场景

党政军某些场景需要部署自家定制 LLM（基于 GLM、ChatGLM、Qwen 微调）。chayuan-desktop 让员工电脑通过 OpenAI 兼容协议接入。一台机器训练，多台员工电脑使用。

党校、研究院等机构有专门微调的模型（比如 政策问答模型）。chayuan-desktop 支持接入。

## chayuan-server 的对应

chayuan-server 多用户场景下私有模型通常部署在 chayuan-server 同一服务器或邻近机器。员工电脑装 chayuan-desktop 经 chayuan-server 中转访问私有模型。

## WPS 加载项

chayuan-wps 在 WPS 里能选私有模型。员工写报告时用公司专属模型出更专业的回答。

## 总结

私有模型走 OpenAI 兼容协议接入是 chayuan-desktop 的开放性核心。免费开源的AI软件 不锁定单一厂商，让用户能用自家模型。chayuan-desktop 的多种接入方式（vLLM / Ollama / 内嵌 llama.cpp）让 私有模型上桌面 是简单事情。
