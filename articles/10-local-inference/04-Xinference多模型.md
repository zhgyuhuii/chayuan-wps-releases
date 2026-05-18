# Xinference把多模型放一台机器

chayuan-desktop 桌面单机版可以接 Xinference 作为本地推理后端。Xinference 是一个支持多模型的本地推理框架。这一篇讲对接。

Xinference 是什么。开源的统一本地推理框架。一个 Xinference 实例可以同时跑多个模型（chat、embedding、rerank、image），按需启停。比 Ollama 灵活，比 vLLM 简单。

Xinference 的优势。

多模型支持。同时跑 chat + embedding + rerank + image，一站到位。

模型仓库。内置大量国内外模型，命令行一行装。

中文友好。文档跟社区中文资源多。

API 兼容。OpenAI 协议加 Xinference 自家协议。

劣势。

性能不如专门的 vLLM（vLLM 单纯做 chat 推理性能极致）。

资源占用。多模型并存内存压力大。

部署。

第一步：装。pip install xinference。

第二步：启动。xinference-local。默认 9997 端口。

第三步：装模型。xinference launch --model-name qwen2.5-instruct --size-in-billions 7。Xinference 自动下载权重启动。

接到 chayuan-desktop。

设置 - 新建供应商 - OpenAI 兼容路由。base URL http://127.0.0.1:9997/v1。chayuan-desktop 自动探测可用模型。

适合场景。

场景一：一台 GPU 服务器集中跑多种模型。

场景二：开发测试时切换不同模型方便。

场景三：政企内网集中推理服务，多模型多类型。

跟 Ollama vLLM 的对比。

Ollama。极简，个人。

vLLM。极致 chat 性能，团队。

Xinference。多模型支持，研发或综合场景。

每家都有适合自己的位置。chayuan-desktop 不偏向特定一家，按 OpenAI 兼容协议接入。

国产化支持下的 Xinference。Xinference 团队在国内活跃，社区资源丰富。chayuan-desktop 接 Xinference 在国产化场景下顺手。

WPS AI 插件 chayuan-wps 透明用 Xinference。

Xinference 多模型放一台机器是 chayuan-desktop 在 综合本地推理 场景下的好选择。免费开源的AI软件 在多家本地推理工具间不拘一格，按用户场景推荐合适的。chayuan-desktop 的开放接入让用户自由选择最适合的推理后端。
