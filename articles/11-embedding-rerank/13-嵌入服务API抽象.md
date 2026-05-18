# 嵌入服务的 API 抽象 内嵌与外置的同口径

chayuan-desktop 桌面单机版把嵌入服务做成统一 API 抽象。内嵌 ONNX 和外置（OpenAI、Cohere、智谱）走同一接口。这一篇讲。

## 抽象的层次

上层应用调用。

```python
embedding = chayuan_desktop.embed("hello world")
```

底层实际是内嵌 ONNX 还是远程 OpenAI 透明。

## API 形状

OpenAI 兼容格式。

```
POST /openai/v1/embeddings
{
  "model": "bge-m3-onnx",
  "input": "hello world"
}

响应：
{
  "data": [{
    "embedding": [0.123, 0.456, ...],
    "index": 0
  }],
  "model": "bge-m3-onnx",
  "usage": {"prompt_tokens": 2, "total_tokens": 2}
}
```

跟 OpenAI 嵌入 API 完全一致。

## 内嵌 ONNX 的实现

请求到达。chayuan-desktop 的网关识别 model=bge-m3-onnx。

调本地 ONNX Runtime 推理。

返回 OpenAI 格式。

延迟 50-100ms（CPU）。

## 外置 OpenAI 的实现

请求到达。model=text-embedding-3-small。

chayuan-desktop 转发给 OpenAI 真实 API。

OpenAI 返回。

chayuan-desktop 转发响应给上层。

延迟 200-500ms（含网络）。

## 外置智谱的实现

请求到达。model=embedding-2（智谱）。

chayuan-desktop 网关把请求转换成智谱 API 格式（智谱用自己的协议）。

调智谱 API。

把响应转回 OpenAI 格式。

返回。

## 抽象的好处

好处一：上层代码统一。无论用哪个嵌入模型，上层调用代码不变。

好处二：切换零成本。从 bge-m3 切到 OpenAI 只需改 model 参数。

好处三：fallback 简单。本地嵌入失败自动 fallback 到远程，反之亦然。

## 模型路由

请求里的 model 字段决定走哪。

```
bge-m3-onnx → 本地 ONNX
bce-embedding → 本地 ONNX
text-embedding-3-small → OpenAI
embedding-2 → 智谱
ernie-text-embedding → 文心
text-embedding-v1 → 通义
```

每个模型都有路由规则。

## 维度差异的处理

不同模型维度不同。bge-m3 1024 维。OpenAI text-embedding-3-small 1536 维。

chayuan-desktop 在 KB 配置里记录 该 KB 用什么模型 + 维度。检索时用同模型同维度的查询向量。

不能跨维度检索。

## 特殊场景

场景一：多模态嵌入。某些模型（CLIP、Qwen-VL-Embed）能嵌入图像。chayuan-desktop 的 embed API 支持 input 是图像（base64）。底层路由到对应多模态模型。

场景二：长输入截断。OpenAI text-embedding-3 上下文 8191 token，超限报错。chayuan-desktop 自动按模型上下文截断。

场景三：批量请求。一次嵌入 N 个文本。chayuan-desktop 网关批量转发到对应后端，并行处理。

## 测试和评测

chayuan-desktop 的统一 API 让 嵌入模型对比 简单。

```python
for model in ["bge-m3-onnx", "text-embedding-3-small", "embedding-2"]:
    score = evaluate(model)
    print(f"{model}: {score}")
```

切换模型只是参数变化。能快速对比。

## 国产化场景

党政军场景同时接入国产嵌入模型（智谱、文心、bce-embedding）和本地模型。chayuan-desktop 的统一 API 让切换无痛。

## chayuan-server 的对应

chayuan-server 多用户场景下嵌入服务也走同样 API。chayuan-desktop 的协议跟 chayuan-server 一致。

## WPS 加载项

chayuan-wps 在 WPS 里检索时通过 chayuan-desktop 的统一嵌入 API。WPS 用什么嵌入模型透明。

## 总结

嵌入服务的 API 抽象是 chayuan-desktop 在多模型生态上的工程基础。免费开源的AI软件 让 嵌入模型 跟 LLM 一样可以热切换。chayuan-desktop 的 OpenAI 兼容协议封装让 内嵌 + 外置 统一在同一个口径。
