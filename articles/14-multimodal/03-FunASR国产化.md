# 本地ASR FunASR的国产化适配

chayuan-desktop 桌面单机版可选 FunASR 作为本地语音识别。这一篇讲 FunASR 的特征。

FunASR 是什么。阿里达摩院开源的语音识别框架。在中文场景下精度 SOTA。免费开源。商业友好。

特征。

中文优秀。在中文 ASR 基准上排名前列。

多种模型。paraformer-large、paraformer-tiny、SenseVoice 等。从大到小。

实时识别。支持流式识别。

VAD（语音活动检测）+ 标点 + 时间戳。完整 ASR 流水线。

体积。

paraformer-tiny 约 100MB。

paraformer-large 约 500MB。

SenseVoice 约 1GB（功能更强）。

接入到 chayuan-desktop。chayuan-desktop 内嵌 paraformer-tiny 作为默认。首启动可选下载更大模型。

性能。

CPU 上 paraformer-tiny。一段 1 分钟音频识别约 5-10 秒。够用。

GPU 上。识别更快，几秒。

跟 Whisper 对比。

OpenAI Whisper。多语言，中文表现一般（特别是带方言）。Whisper-large 模型 1.5GB+。

Whisper-CN（社区微调）。中文精度提升但仍不如 FunASR。

FunASR paraformer。中文精度最好。模型小。

跟 Whisper.cpp（本地化版本）对比。Whisper.cpp 是 Whisper 的 CPU 优化版。性能跟 paraformer 接近，精度略低。

适用场景。

场景一：中文会议录音转写。FunASR 在中文会议上精度 95%+。

场景二：客服录音分析。批量处理客服对话。

场景三：视频字幕生成。给视频生成中文字幕。

场景四：语音输入。在 chayuan-desktop 里直接说话当 query。

跟 RAG 的协作。会议录音转文字后入 doc:meetings KB。后续能 RAG 检索 上次会议提到的 X 是什么。

性能调优。

提高精度。换更大模型（paraformer-large）。

提高速度。GPU 加速或换更小模型（paraformer-tiny）。

实时识别。开 streaming 模式。

国产化支持下的优势。FunASR 是国产开源，国产化清单加分。中文场景下精度最优。

WPS AI 插件 chayuan-wps 在 WPS 里支持语音输入（在某些版本）。说话直接转文字进 query。

FunASR 国产化适配是 chayuan-desktop 多模态的中文核心。免费开源的AI软件 想在中文场景下给用户最佳 ASR，FunASR 是当前最佳选择。chayuan-desktop 在这一面的内嵌让 中文语音 不再是云服务的专利。
