# 本地TTS Piper的取舍

chayuan-desktop 桌面单机版可选内嵌 Piper 作为本地 TTS。这一篇讲 Piper 的特征和适用场景。

Piper 是什么。开源轻量 TTS 引擎。基于 ONNX。社区维护。免费商业友好。

特征。

体积小。每个声音模型约 30-100MB。比 大模型 TTS 小一两个数量级。

CPU 友好。CPU 跑得动，不强求 GPU。

延迟低。短文本 TTS 几百毫秒。

精度。声音质量良好但不如商业 TTS（OpenAI tts-1、Eleven Labs）。中文 Piper 模型质量一般，英文质量更好。

接入到 chayuan-desktop。chayuan-desktop 的 settings 里有 内嵌 TTS 选项。开启后下载 Piper 中英文模型。

模型下载。

中文：zh_CN-huayan-medium（约 60MB）。

英文：en_US-amy-medium（约 60MB）。

调用。在对话里点 朗读 按钮，chayuan-desktop 调 Piper 把回答转音频，前端播放。

性能。

CPU 上一段 200 字中文：约 1-2 秒生成完。

GPU 上：几百毫秒。

比商业 TTS 慢但本地。

适用场景。

场景一：完全离线。不联网用 TTS。

场景二：成本敏感。OpenAI tts-1 按字符计费，长期累计不少。Piper 本地零成本。

场景三：隐私敏感。文字内容不上传给厂商。

不适合的场景。

不适合一：高质量音频要求。Eleven Labs 的声音几乎跟真人无别，Piper 比不上。

不适合二：多种音色。商业 TTS 有几十上百种音色可选，Piper 选择有限。

不适合三：情感丰富的播音。Piper 偏机械。

跟其他本地 TTS 对比。

XTTS-v2。声音克隆能力强。但模型大（几个 G），CPU 跑不动。

OpenVoice。声音克隆。模型中等。

Piper。轻量，质量中等。

国产 TTS。chayuan-desktop 路线图里有 cosyvoice（阿里开源）和 paddleTTS（百度）的接入。这些质量更好但模型大。

国产化支持下的 TTS。Piper 中文模型够基础办公用。需要更高质量考虑接 cosyvoice 等国产 TTS。

WPS AI 插件 chayuan-wps 在 WPS 里能用 TTS 朗读文档段落。chayuan-wps 调 sidecar 的 TTS 能力，背后是 Piper 或别的。

Piper 本地 TTS 是 chayuan-desktop 多模态的低成本选项。免费开源的AI软件 想给用户 完全离线 选项，本地 TTS 是必备。chayuan-desktop 的内嵌 Piper 让这件事零额外配置。
