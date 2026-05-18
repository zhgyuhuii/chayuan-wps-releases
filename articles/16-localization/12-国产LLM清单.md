# 国产 LLM 的接入 全模型支持的国产清单

chayuan-desktop 桌面单机版的国产 LLM 接入清单。这一篇盘点。

## 一线大厂

文心（百度）。

ERNIE 4.0 / 4.0 Turbo。

ERNIE Speed（小模型）。

ERNIE Lite（更小）。

通义千问（阿里）。

Qwen-Max。

Qwen-Plus。

Qwen-Turbo。

Qwen2.5 系列（开源）。

Qwen-Coder。Qwen-VL。

豆包（字节）。

Doubao-Pro。

Doubao-Lite。

Doubao-Vision。

腾讯混元。

Hunyuan-Standard。

Hunyuan-Pro。

智谱（GLM）。

GLM-4 Plus。

GLM-4 Flash。

GLM-4V Plus。

ChatGLM-3 / 4 开源版。

## AI 创业公司

DeepSeek。

DeepSeek-Chat。

DeepSeek-Coder。

DeepSeek-V3 系列。

R1 推理模型。

Moonshot（月之暗面）。

Kimi。

Kimi-Vision。

Yi（零一万物）。

Yi-Lightning。

Yi-Vision。

阶跃星辰。

Step-2 / Step-1V。

MiniMax。

abab6.5 / abab7。

## 接入协议

大多数兼容 OpenAI 协议。chayuan-desktop 直接接入。

```yaml
provider:
  - name: 通义千问
    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    auth: bearer_token
  - name: 智谱
    base_url: https://open.bigmodel.cn/api/paas/v4
    auth: bearer_token
```

部分需要自家签名（百度文心 v2 走 v3 签名）。chayuan-desktop 的 adapter 内置实现。

## 鉴权管理

每个国产 LLM 自家 Key。

chayuan-desktop 设置里能加。

```
API Keys:
  通义千问: sk-xxx
  智谱: xxx
  豆包: xxx
  ...
```

每个 Key 加密存储（Stronghold）。

## 默认模型推荐

chayuan-desktop 给国产用户的默认模型推荐（根据对抗结果）。

Chat 默认：DeepSeek-V2.5（性价比好）。

中文写作：Qwen-Plus（中文流畅）。

代码：DeepSeek-Coder。

视觉：Qwen2.5-VL。

embed：bge-m3-onnx（本地）。

国产优先一键开关。

## 国产 LLM 的优势

中文强。训练数据中文比例大。

价格便宜（参考前面对抗成本对比）。

合规友好。本土合规审查。

服务器在国内。低延迟。

支持 国密算法（部分 API）。

## 国产 LLM 的短板

通用知识不及 GPT-4。某些专业领域（前沿科研）不如 Claude。

工具调用能力较弱。

某些模型上下文较短。

但中国场景下国产模型已经够用。

## 完全国产 chat 栈

chayuan-desktop + 通义 / 文心 / DeepSeek（云）+ Qwen 本地 + bge-m3 + bce-reranker + RapidOCR + FunASR + Piper。

完整国产化。chayuan-desktop 全套接入。

## 国产 LLM 的演进

每月都有新版。chayuan-desktop 跟进。

新模型出来 1-2 周内适配。

模型卡片更新。

加入 Arena 对抗。

让国产用户能第一时间用上新国产模型。

## chayuan-server 的对应

chayuan-server 多用户场景下国产 LLM 集中接入。chayuan-desktop 单机本地。两者协议一致。

## WPS 加载项

chayuan-wps 在 WPS 里调国产 LLM 写报告。员工享受国产 LLM 中文优势。

## 总结

国产 LLM 的接入是 chayuan-desktop 在国产生态完整支持上的工程能力。免费开源的AI软件 让 国产用户能选所有主流国产 LLM。chayuan-desktop 的统一封装 + 鉴权适配 + 默认推荐 + 持续跟进让国产 LLM 在桌面端开箱即用。
