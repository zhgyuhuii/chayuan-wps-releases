# LM Studio也是合法后端 它的兼容路由

chayuan-desktop 桌面单机版除了 Ollama 也支持 LM Studio 作为本地推理后端。这一篇讲对接。

LM Studio 是什么。一个图形化的本地 LLM 工具。下载模型、聊天、跑 OpenAI 兼容服务。比 Ollama 多了 GUI，但功能类似。免费跨平台。

LM Studio 的优势。

图形化操作。不熟悉命令行的用户友好。

模型市场。内置大量模型可下载。

性能调优。用户能调 GPU 层数、上下文长度等参数。

劣势。

商业软件（虽然个人免费）。

不如 Ollama 流行。

资源占用比 Ollama 略高。

接到 chayuan-desktop。

第一步：LM Studio 内启动 Local Server。在 Developer 标签页打开 server，默认端口 1234。

第二步：chayuan-desktop 设置新建供应商。OpenAI 兼容路由。base URL http://127.0.0.1:1234/v1。

第三步：测试。chayuan-desktop 自动探测模型。

第四步：跟 Ollama 一样使用。

跟 Ollama 的对比。

部署。Ollama 命令行更轻。LM Studio GUI 更直观。

性能。两家都用 llama.cpp 后端。性能接近。

模型生态。Ollama 的 model registry 大。LM Studio 的市场也覆盖广。

API。两家都 OpenAI 兼容。chayuan-desktop 接哪个体验一样。

什么时候选 LM Studio。

场景一：图形化偏好。不熟悉命令行的用户。

场景二：需要 GPU 调优。LM Studio 暴露的参数多。

场景三：跟 chayuan-desktop 同机部署个人使用。

什么时候选 Ollama。

场景一：服务器部署。Ollama 适合 systemd 托管。

场景二：自动化脚本。Ollama 命令行友好。

场景三：内网批量部署。Ollama 的离线分发简单。

WPS AI 插件 chayuan-wps 透明用 LM Studio。

LM Studio 跟 Ollama 都是 chayuan-desktop 的合法本地推理后端。免费开源的AI软件 不锁定特定本地推理工具，让用户自由选择。
