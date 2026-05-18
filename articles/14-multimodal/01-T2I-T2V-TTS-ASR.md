# 全模型支持包括多模态 T2I T2V TTS ASR的统一接口

chayuan-desktop 桌面单机版的多模态能力覆盖文生图、文生视频、文本转语音、语音转文本。这一篇讲统一接口设计。

四类多模态。

T2I（Text to Image）。文生图。输入文字，输出图像。

T2V（Text to Video）。文生视频。输入文字，输出短视频。

TTS（Text to Speech）。文本转语音。输入文字，输出音频。

ASR（Automatic Speech Recognition）。语音转文本。输入音频，输出文字。

每类有多家厂商和本地选项。

T2I。OpenAI DALL-E 3、Stable Diffusion（本地或云端）、Midjourney（间接）、文心一格（百度）、通义万相（阿里）。

T2V。Sora（OpenAI 受限）、可灵（快手）、Vidu（生数）、Runway。

TTS。OpenAI tts-1、Eleven Labs、Piper（本地开源）、阿里 cosyvoice、字节 doubao-tts。

ASR。OpenAI whisper、Whisper-CN（本地）、FunASR（达摩院开源，中文优秀）、阿里 paraformer。

chayuan-desktop 的统一接口。每类有自己的 OpenAI 兼容协议（或者类 OpenAI 协议）。chayuan-desktop 用同一组 adapter 抽象。

T2I 的统一调用。

```
client.images.generate(
    model="dall-e-3",  # 或者 stable-diffusion、文心一格
    prompt="一只猫坐在窗户边看夕阳",
    size="1024x1024"
)
```

切换 model 字段就切换厂商。

ASR 的统一调用。

```
client.audio.transcriptions.create(
    model="whisper-1",  # 或者 funasr、paraformer
    file=audio_file
)
```

跟 OpenAI SDK 一致。

本地多模态。

T2I。chayuan-desktop 接 ComfyUI 或 Automatic1111 跑本地 SD。模型权重在用户机器（GPU 必备）。

ASR。chayuan-desktop 内嵌 FunASR 可选。CPU 上跑得动，中文识别精度高。

TTS。chayuan-desktop 内嵌 Piper 可选。开源轻量。中文质量一般。

用法。

例子一：用户在对话里问 给我画一张办公室场景的插画。LLM 调 image_generate 工具，背后用 default vision 模型。生成图后插入对话。

例子二：用户上传一段 5 分钟会议录音。chayuan-desktop 调 ASR 把音频转成文字，再调 LLM 总结要点。

例子三：用户问 给我把这段总结读出来。chayuan-desktop 调 TTS 生成音频，前端播放。

集成深度。chayuan-desktop 的多模态跟 RAG 配合。比如音频转文字后入 KB（doc:* 含音频转写），后续可检索。

WPS AI 插件 chayuan-wps 在 WPS 里能直接用多模态。比如让 AI 给报告生成插图。

四类多模态的统一接口是 chayuan-desktop 全模型支持 的具体落地。免费开源的AI软件 想覆盖现代 AI 生态，多模态不能缺。chayuan-desktop 在这一面的覆盖让 用户场景 不被限制。
