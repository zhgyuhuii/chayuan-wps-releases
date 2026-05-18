# 本地嵌入 ONNX 与 GPU 嵌入的取舍

chayuan-desktop 桌面单机版的本地嵌入默认 ONNX CPU 路径，但也支持 GPU 路径。这一篇讲取舍。

## ONNX CPU 路径

chayuan-desktop 默认。

bge-m3-onnx-q8 模型。约 200MB。

ONNX Runtime 推理。跨平台（Windows、Mac、Linux）。

CPU 上每次嵌入 100-200ms。批处理时更快（每次 batch 32）。

## GPU 路径

CUDA。N 卡上 ONNX Runtime 能用 CUDAExecutionProvider。每次嵌入 20-50ms。比 CPU 快 5 倍。

DirectML。Windows 上 Intel/AMD 集显也能跑 GPU。chayuan-desktop 支持。

Metal。Mac 上 Apple Silicon 用 CoreMLExecutionProvider 或 MPSGraph。

国产 GPU。华为昇腾、寒武纪走对应推理框架（在路线图）。

## 何时用 GPU

场景一：大批量索引。建库时几万 chunk 要嵌入。GPU 跑 5 分钟，CPU 跑 1 小时。GPU 明显更好。

场景二：实时高频检索。每秒几次检索请求。CPU 来得及但有延迟感。GPU 流畅。

场景三：服务器端使用。chayuan-server 模式下多用户共享，GPU 必须。

## 何时用 CPU

场景一：日常使用。个人单机用户每天几十次检索。CPU 完全够用。延迟可忽略。

场景二：无独显机器。集成显卡上 CUDA 不可用。CPU 是唯一选择。

场景三：低功耗场景。笔记本不接电源。GPU 耗电快。CPU 推理省电。

## chayuan-desktop 的自适配

启动时检测。

发现 N 卡 + CUDA 11+。自动启用 GPU 嵌入。

发现 N 卡 + 无 CUDA。提示用户安装 CUDA。或回退 CPU。

发现 AMD/Intel 显卡 + Windows。启用 DirectML。

发现 Mac M 系列。启用 CoreML。

发现普通笔记本。CPU 推理。

用户能在设置里手动覆盖。

## 嵌入质量的对比

GPU 和 CPU 跑同一 ONNX 模型，结果完全一致（数值精度差 < 1e-6）。

不同精度的 ONNX 模型（FP32 / FP16 / INT8）才有质量差。chayuan-desktop 默认 INT8 量化（速度快，质量损失 < 1%）。

## 显存占用

bge-m3 在 GPU 上加载。

FP32：约 1.2GB 显存。

FP16：约 600MB。

INT8：约 300MB。

INT8 跟 GGUF 的 LLM 共用 GPU 时显存够用。

## 跟 LLM 推理共用 GPU

家用 8GB 显存。同时跑 LLM 7B Q4 + bge-m3 INT8。需要 4GB + 0.3GB = 4.3GB。够用。

显存紧张时 chayuan-desktop 按需切换。检索时把嵌入模型 unload，加载 LLM 处理对话；需要嵌入时切换。

## ONNX vs PyTorch 路径

PyTorch 路径。原生 .pt 模型。灵活但启动慢，依赖大（PyTorch + CUDA toolkit 几个 GB）。

ONNX 路径。chayuan-desktop 选这个。

依赖小。ONNX Runtime 几十 MB。

启动快。模型加载秒级。

跨平台。同一个 ONNX 模型 Windows、Mac、Linux 都能跑。

## 模型转换

chayuan-desktop 自带的模型已是 ONNX 格式。用户想用其他模型可以走自己转换（torch.onnx.export 或 optimum-cli export）。

转换好的 ONNX 模型放 ~/.chayuan/models/ 目录，chayuan-desktop 启动时扫描。

## 国产化场景

党政军用国产硬件。chayuan-desktop 的 ONNX 路径在飞腾鲲鹏龙芯上都跑。CPU 嵌入对国产化场景是稳定方案。GPU 路径等国产 GPU 推理框架成熟（昇腾的 ATC + ACL）。

## chayuan-server 的对应

chayuan-server 跑在 GPU 服务器上，嵌入用 GPU。chayuan-desktop 单机以 CPU 为主。

## WPS 加载项

chayuan-wps 在 WPS 里检索发请求给 chayuan-desktop。chayuan-desktop 嵌入用什么路径透明对 WPS。

## 总结

本地嵌入的 ONNX 与 GPU 取舍是 chayuan-desktop 在性能和兼容性上的工程平衡。免费开源的AI软件 在不同硬件上都能跑嵌入。chayuan-desktop 的 ONNX 默认 + 自动检测 GPU 加速让 嵌入 在主流硬件上自适应最优。
