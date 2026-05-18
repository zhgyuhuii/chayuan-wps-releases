# 全模型支持包括本地Ollama一键对接

chayuan-desktop 桌面单机版的 全模型支持 不只是云端厂商，也包括本地推理服务。Ollama 是最简单的本地推理工具。这一篇讲一键对接。

先看 Ollama 是什么。把模型权重的下载、运行、API 暴露这三件事打包了。装一个 Ollama 服务即得到本地版 OpenAI 兼容 API。

安装 Ollama。

macOS。下载 .dmg 拖到 Applications。

Windows。下载 .msi 装。

Linux。一行 curl https://ollama.com/install.sh | sh。

国产化场景下，先在内部镜像放好 Ollama 安装包，员工电脑装内网版本。

下载模型。

ollama pull qwen2.5:7b（国产模型，7B 参数，约 5GB）。

ollama pull deepseek-r1:7b（推理模型）。

ollama pull llama3.1:8b（Meta Llama）。

ollama pull mistral:7b（Mistral 法语友好）。

每个模型几 GB，提前规划磁盘。

跑服务。

ollama serve（默认端口 11434）。

或者 systemd 托管让 Ollama 开机自启。

接到 chayuan-desktop。

设置 - 模型供应商 - 新建 - OpenAI 兼容路由。

base URL：http://127.0.0.1:11434/v1。

API key：随便填一个非空字符串（Ollama 默认不验证）。

保存。chayuan-desktop 自动探测 /v1/models，把已下载的模型拉回。

测试。新建对话，挑刚配的本地模型，发一句话。

性能。

CPU 上跑 7B 模型。tokens/s 6-15（取决于 CPU）。一段几百字回答需要 30-60 秒。慢但完全离线。

GPU 上跑 7B 模型。tokens/s 30-100。一段几百字回答几秒。流畅。

GPU 上跑 14B 模型。tokens/s 15-30。质量更高但慢一点。

跟云端模型混用。chayuan-desktop 同时配 Ollama 和厂商。某些场景用本地（隐私敏感、想省成本），某些场景用云端（追求精度、不在意延迟）。模型对抗 arena 能把它们并行对比。

KB 配合。chayuan-desktop 的 doc:* 文档 KB 走本地 sqlite-vec + bge-m3-onnx 嵌入 + bce-reranker 重排，跟 Ollama 一起完全离线。整套链路不联外网。

Ollama 的几个细节。

细节一：默认 host 是 127.0.0.1。如果想从其他机器连，需要 OLLAMA_HOST=0.0.0.0 ollama serve。

细节二：模型路径在 ~/.ollama。磁盘空间预留。

细节三：并发能力有限。同时多个对话排队。

WPS AI 插件 chayuan-wps 透明用本地 Ollama。在 WPS 里调起对话走本地推理。

Ollama 一键对接是 chayuan-desktop 给本地推理用户的便利。免费开源的AI软件 加本地推理 = 完全离线 AI 工作站。chayuan-desktop 在这一组合上的工程化让 装到电脑里就能用 真正成立。
