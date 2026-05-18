# GPU 嵌入与 CPU 嵌入的取舍 单机版谁是默认

chayuan-desktop 桌面单机版的嵌入默认走 CPU。但 GPU 也支持。这一篇讲选谁的取舍。

## 默认 CPU 的理由

理由一：兼容性。绝大多数办公本没有独显。默认 CPU 让 chayuan-desktop 在所有机器上都能跑。

理由二：稳定性。CPU 推理无 CUDA 环境问题。开箱即用。

理由三：足够快。bge-m3-onnx-q8 在主流 CPU 上 50-100ms 单次嵌入。日常使用流畅。

理由四：低门槛。新用户安装即可用，无需配 CUDA。

## 何时换 GPU

场景一：大批量索引。建库 10 万 + chunk。CPU 几小时，GPU 几分钟。GPU 显著更好。

场景二：高频检索。每秒 10+ 检索。CPU 来得及但延迟感明显。GPU 流畅。

场景三：服务器部署。chayuan-server 模式。GPU 必备。

场景四：用户带独显。家里游戏本闲置 GPU 资源不用浪费。

## 自动检测

chayuan-desktop 启动时检测。

发现 N 卡 + CUDA 11+ → 嵌入默认走 GPU。

发现集成显卡（Intel UHD、AMD Vega） → 默认走 CPU（集显跑嵌入提升不明显，反而占电）。

发现 Apple Silicon → 默认走 GPU（CoreML）。

未发现 GPU → CPU。

用户能在设置里覆盖。

## 性能差异

bge-m3-onnx-q8。

CPU（i7-13700H）：55ms。

GPU（RTX 4060）：25ms。

差 2 倍。

bce-reranker-base-onnx。

CPU：500ms（10 候选）。

GPU：150ms。

差 3 倍。

差距明显但都能用。

## 显存代价

GPU 嵌入 bge-m3 占 0.3-0.5GB 显存。

如果 GPU 同时要跑 LLM 推理（7B Q4 占 4GB）。共占 4.5GB。8GB 显存够。

GPU 紧张时 chayuan-desktop 自动切回 CPU 嵌入。

## 功耗代价

GPU 满载约 100-200W（独显）。

CPU 嵌入约 30-50W。

笔记本电池续航考虑。chayuan-desktop 检测电池模式时自动切 CPU。

## 切换策略

chayuan-desktop 设置 - 模型 - 嵌入加速。

```
auto: 自动选择（默认）
gpu: 强制 GPU
cpu: 强制 CPU
hybrid: 大批量走 GPU，单次走 CPU
```

hybrid 模式适合带独显但显存紧的场景。建库时 GPU 加速，平时检索 CPU 不占显存。

## 跨任务的 GPU 资源调度

如果 GPU 同时要跑 LLM + 嵌入。chayuan-desktop 的调度。

策略一：抢占。LLM 流式生成时嵌入请求等。LLM 完成后跑嵌入。

策略二：协同。某些 GPU（24GB+）能同时加载 LLM 和嵌入模型。直接并行。

家用 8GB 显存大多走策略一。

## 异步嵌入

某些场景嵌入可以异步。比如建索引可以后台跑，不影响交互。chayuan-desktop 设置里能开 后台嵌入。

后台跑时优先级低，不抢 GPU。用户聊天时 GPU 给 LLM 用。聊天空闲时 GPU 给嵌入用。

## 国产化场景

国产硬件大多无独显或弱独显。chayuan-desktop 的 CPU 默认在国产硬件上稳定可用。

国产 NPU（昇腾、寒武纪）走专门推理框架（CANN、MagicMind），ONNX 兼容性在补全中。

## chayuan-server 的对应

chayuan-server 部署在 GPU 服务器，嵌入走 GPU 是标配。chayuan-desktop 单机以 CPU 为主。

## WPS 加载项

chayuan-wps 在 WPS 里检索时 chayuan-desktop 的嵌入是 GPU 还是 CPU 透明对 WPS。员工感知不到。

## 总结

GPU 与 CPU 嵌入取舍是 chayuan-desktop 在硬件多样性上的工程平衡。免费开源的AI软件 默认 CPU 让所有机器都能用，自动检测 GPU 让高配机器跑得更快。chayuan-desktop 的 自动 + 手动覆盖 + hybrid 三种模式覆盖各种场景。
