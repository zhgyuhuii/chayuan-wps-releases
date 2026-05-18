# 嵌入计算的 ONNX 加速 CPU 也能跑出还行的速度

chayuan-desktop 桌面单机版的嵌入计算用 ONNX Runtime 加速，CPU 上也能流畅跑。这一篇讲。

## ONNX 是什么

ONNX（Open Neural Network Exchange）。开放神经网络交换格式。把不同框架（PyTorch、TensorFlow）训练的模型转成统一的 ONNX 格式。

ONNX Runtime。微软主导的 ONNX 模型推理引擎。跨平台、高性能。

## ONNX 相对 PyTorch 的优势

优势一：依赖小。ONNX Runtime 几十 MB。PyTorch + CUDA toolkit 几个 GB。chayuan-desktop 选 ONNX。

优势二：启动快。ONNX 模型加载秒级。PyTorch 慢。

优势三：跨平台。同一 ONNX 模型在 Windows、Mac、Linux、ARM 都能跑。

优势四：性能优化。ONNX Runtime 有专门的图优化、算子融合，CPU 推理比 PyTorch 快 20-50%。

## 加速的原理

ONNX Runtime 的优化。

图优化。把多个小算子融合成一个大算子。减少调度开销。

INT8 量化。FP32 → INT8。速度快 2-3 倍。质量损失 < 1%。

CPU 指令集。x86 上用 AVX2 / AVX-512。ARM 上用 NEON。LoongArch 用基础 SIMD。

线程并行。OpenMP 自动并行。

## bge-m3-onnx-q8 实测

INT8 量化版。约 200MB。

| 平台 | 单次嵌入 (256 token) |
|---|---|
| Intel i7-13700H | 55ms |
| Intel i5-12500U | 95ms |
| 鲲鹏 920 | 85ms |
| Apple M2 | 60ms |
| GPU (CUDA) | 25ms |

CPU 上 50-100ms 范围。每秒能处理 10-20 个 chunk。索引 1 万 chunk 约 5-15 分钟。

## 批处理加速

单次嵌入有固定开销（启动、调度）。批处理摊薄。

```
单个嵌入：55ms
批 8 个嵌入：120ms（每个 15ms）
批 32 个嵌入：360ms（每个 11ms）
```

批越大每个越快。chayuan-desktop 默认批 32（建索引时）。检索时批 1（单查询）。

## 内存占用

bge-m3-onnx-q8 加载到内存约 250MB。一直常驻。

bge-m3-onnx-q4 更小（120MB）但精度略降。chayuan-desktop 设置里能选。

## ONNX 模型来源

chayuan-desktop 自带 ONNX 模型。打包发布。

用户也能自己转。

```python
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer

model = ORTModelForFeatureExtraction.from_pretrained(
    "BAAI/bge-m3",
    export=True,
    provider="CPUExecutionProvider"
)
model.save_pretrained("./bge-m3-onnx")
```

把转好的模型放 ~/.chayuan/models/ 下。chayuan-desktop 自动识别。

## ONNX 模型校验

启动时 chayuan-desktop 校验 ONNX 模型完整性。SHA256 哈希对比。损坏自动重下。

## ONNX 的局限

某些算子在 ONNX 里支持不完整。最新 LLM 转 ONNX 可能失败。chayuan-desktop 的嵌入模型相对成熟（bge-m3 转 ONNX 没问题）。

## GPU 加速的开关

ONNX Runtime 支持 GPU。chayuan-desktop 自动检测。

发现 N 卡 + CUDA → CUDAExecutionProvider。

发现 Intel/AMD GPU + Windows → DirectMLExecutionProvider。

发现 Apple Silicon → CoreMLExecutionProvider。

发现普通 CPU → CPUExecutionProvider。

## 国产化场景

国产 CPU（飞腾、鲲鹏、龙芯）上 ONNX Runtime 都有适配。chayuan-desktop 的嵌入加速在国产硬件上同样工作。

国产 NPU（昇腾、寒武纪）的 ONNX 适配在路线图。

## chayuan-server 的对应

chayuan-server 一般跑 GPU ONNX。chayuan-desktop 单机以 CPU 为主，少量带独显的跑 GPU。

## WPS 加载项

chayuan-wps 在 WPS 里检索时调 chayuan-desktop 的 ONNX 嵌入。员工感知不到底层用的什么框架。

## 总结

嵌入计算的 ONNX 加速是 chayuan-desktop 在 让 CPU 也能用 上的工程基础。免费开源的AI软件 不让用户必须有 GPU 才能用。chayuan-desktop 的 ONNX + INT8 + 批处理让 普通笔记本 + CPU 也能流畅检索。
