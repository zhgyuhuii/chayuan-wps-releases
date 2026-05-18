# vLLM部署 给团队共享的本地推理服务

chayuan-desktop 桌面单机版接 vLLM 服务作为团队共享的本地推理。这一篇讲清楚。

vLLM 是什么。Berkeley 开源的高性能 LLM 推理引擎。专门为生产场景设计，吞吐量比 Ollama 高几倍。专用于 GPU 服务器。

vLLM 的优势。

性能。tokens/s 比 Ollama 高几倍。同一卡能扛更多并发。

并发。专门优化批量推理，多请求一起跑提高吞吐。

OpenAI 兼容。原生 OpenAI 协议接口。

劣势。

部署复杂。需要懂 GPU 配置、CUDA 版本、Python 环境。

不适合个人单机。资源消耗大，对个人电脑不友好。

部署 vLLM。

第一步：GPU 服务器（建议 NVIDIA A10/A100/H100/4090 等）。

第二步：装 vLLM。pip install vllm。

第三步：跑模型。python -m vllm.entrypoints.openai.api_server --model qwen/Qwen2.5-7B-Instruct --port 8000。

第四步：vLLM 在 8000 端口暴露 OpenAI 兼容 API。

接到 chayuan-desktop。

第一步：员工电脑装 chayuan-desktop。

第二步：设置 - 新建供应商 - OpenAI 兼容路由。base URL http://gpu_server_ip:8000/v1。

第三步：测试。chayuan-desktop 调 vLLM 的接口工作正常。

团队场景。一台 GPU 服务器跑 vLLM。10-20 个员工的 chayuan-desktop 都连这台服务器。每人自己的 chayuan-desktop 单机版前端，共享后端 vLLM。

并发表现。一台 4090 跑 7B 模型大约能扛 10-20 个并发对话（每个对话 tokens/s 适度）。一台 A100 能扛 50+ 并发。

跟 Ollama 的对比。

性能。vLLM 高。

部署。Ollama 易。

适用规模。Ollama 个人或小团队。vLLM 中大团队。

成本。vLLM 需要 GPU 服务器（几万到几十万）。Ollama 在普通电脑跑。

国产化部署。

国产 GPU。某些场景用昇腾、寒武纪等国产加速卡。vLLM 对国产卡的支持需要专门版本。

国产模型。vLLM 跑 DeepSeek、qwen、文心 都可以。直接 from huggingface 或 modelscope 拉权重。

完全离线。GPU 服务器在内网，不联外网。模型权重提前下载到内部镜像。chayuan-desktop 跟 vLLM 之间走内网。

WPS AI 插件 chayuan-wps 透明用 vLLM。在 WPS 里发起对话时不感知后端是 Ollama 还是 vLLM。

vLLM 团队共享部署是 chayuan-desktop 在中等规模团队的合理形态。免费开源的AI软件 给用户从个人到团队的多种部署选项。chayuan-desktop 的统一接入让选哪种后端都不影响用户体验。
