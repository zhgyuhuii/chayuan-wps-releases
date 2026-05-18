# 本地 ASR 与 TTS 内嵌 Piper FunASR 的代价

chayuan-desktop 桌面单机版可选模块支持本地 ASR（语音识别）和 TTS（文字转语音）。这一篇讲技术选型和代价。

## 为什么需要本地 ASR/TTS

场景一：会议录音转写。员工录会议，转文字入 KB。云 ASR 要上传录音，敏感内容不合适。

场景二：语音聊天。用户对 chayuan-desktop 说话，转文字提问。

场景三：朗读回答。老人或视力不便用户听 LLM 回答。

云方案（讯飞、阿里云）效果好但要联网。本地方案有代价但完全离线。

## ASR 选型 FunASR

FunASR。阿里达摩院开源。中文 ASR 强。模型主流是 Paraformer。

ONNX 版本小。Paraformer-large-onnx 约 800MB。

CPU 上实时因子（RTF）约 0.3-0.5（处理 1 分钟音频耗时 18-30 秒）。流式实时识别可用。

GPU 上 RTF 0.05（实时识别延迟 50ms 内）。

## TTS 选型 Piper

Piper。开源 TTS，基于 VITS 模型。轻量。

中文 Piper 模型约 100-200MB。

CPU 上实时因子 0.1（合成 1 分钟语音耗时 6 秒）。

音质中等。不如 ElevenLabs 自然但可用。中文 Piper 模型有 zh_CN-huayan-medium、zh_CN-huayan-x_low 等。

## 代价分析

代价一：包大小。chayuan-desktop 默认不内置 ASR/TTS 模型（额外 1GB）。用户在设置里开启时按需下载。

代价二：内存。ASR/TTS 模型加载时占 1-2GB 内存。低配机器吃紧。

代价三：CPU。OCR + ASR + LLM 同时跑会让 CPU 100% 持续。chayuan-desktop 顺序排队，避免冲突。

代价四：质量。本地模型不如云。专业场景仍可能选云。

## 启用方式

chayuan-desktop 设置 - 语音 - 启用本地 ASR/TTS。

第一次开启 chayuan-desktop 下载模型（约 1GB），用户确认。

下载后启用。语音聊天按钮、录音转写按钮可见。

## 流式 ASR

会议转写场景需要流式（边说边转）。FunASR 支持流式。chayuan-desktop 用 SSE 或 WebSocket 把语音 chunk 流给本地 FunASR，每秒返回部分识别结果。

UI 上显示 实时字幕 效果。会议结束按 完成 拿到完整转写文本。

## ASR 后处理

ASR 出的文本是连续字串无标点。chayuan-desktop 调本地 LLM 加标点。

```
原文: 我觉得这个方案挺好的我们可以试试
处理后: 我觉得这个方案挺好的，我们可以试试。
```

加标点后 chunk 入库可读性更好。

## 多人对话识别

某些 ASR 模型支持声纹分离（区分说话人）。FunASR 的某些版本支持。chayuan-desktop 把会议转写的每段标 [说话人 1]、[说话人 2] 等。

不区分人名（无法识别张三李四）。需要用户后期手动标注。

## TTS 的应用

读 LLM 回答。点 朗读 按钮。chayuan-desktop 调本地 Piper 生成 wav，前端播放。

读引用内容。在引用气泡上点 朗读，听原文。

## 国产化场景

党政军会议转写场景敏感，必须本地。chayuan-desktop 的 FunASR 国产开源中文好。完全合规。

老干部用 chayuan-desktop 时朗读功能解决视力问题。Piper 中文音质够用。

## chayuan-server 的对应

chayuan-server 部署 ASR/TTS 在服务器，员工电脑只发音频。chayuan-desktop 单机本地跑。两者协议一致。

## WPS 加载项

chayuan-wps 在 WPS 里支持语音输入（按钮在 WPS 侧栏）。chayuan-wps 调 chayuan-desktop 的 ASR 接口转文字。

## 总结

本地 ASR/TTS 内嵌是 chayuan-desktop 在多模态完整性上的工程能力。免费开源的AI软件 想替代云 AI 全套，语音也要离线。chayuan-desktop 选 FunASR + Piper 让 离线语音 在国产开源生态内完整。代价是包大小和性能要求。
