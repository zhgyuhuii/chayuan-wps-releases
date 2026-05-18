# 察元AI vs LM Studio 谁更像本地离线知识库

LM Studio 是流行的本地推理 GUI 工具。chayuan-desktop 桌面单机版跟 LM Studio 对比。这一篇讲。

定位。

LM Studio。本地推理 GUI 工具。强在 跑大模型本地。GUI 让模型管理简单。

chayuan-desktop。本地 AI 工作站。强在 RAG、知识库、多源、国产化。

共同点。

都强调本地。

都跨平台桌面。

都支持 OpenAI 兼容 API。

差异。

差异一：核心能力。

LM Studio。本地推理引擎 + GUI。模型仓库跟管理。

chayuan-desktop。完整 AI 工作站。本地推理是接的，自己不跑（接 Ollama / vLLM / LM Studio）。

差异二：模型管理。

LM Studio。模型市场 + GUI 下载、加载、卸载。

chayuan-desktop。前端配模型供应商。模型本身由 Ollama / LM Studio 等管。

差异三：知识库。

LM Studio。基本无（最近版本加了基础 RAG）。

chayuan-desktop。五类知识源完整。

差异四：text2sql。

LM Studio。无。

chayuan-desktop。完整支持。

差异五：工具调用。

LM Studio。基础（看 LLM 是否支持 function calling）。

chayuan-desktop。30+ 内置工具 + MCP。

差异六：体积。

LM Studio。GUI 几百 MB，模型权重几 GB（用户下载）。

chayuan-desktop。约 800MB（含本地嵌入和 OCR 权重，不含 LLM）。

差异七：联网。

LM Studio。模型下载需要联网（除非内部镜像）。运行时本地。

chayuan-desktop。本地嵌入和 OCR 自动下载（首启动）。运行时本地（如果配本地推理）。

差异八：国产化。

LM Studio。国际产品。基本无国产化适配。

chayuan-desktop。完整国产化。

互补使用。chayuan-desktop + LM Studio 一起用。LM Studio 跑本地大模型，chayuan-desktop 当前端 + RAG + 工具。两个产品互补。chayuan-desktop 设置里把 OpenAI 兼容路由指向 LM Studio 的 1234 端口。

类似 chayuan-desktop + Ollama 的搭配。Ollama 比 LM Studio 部署轻量，LM Studio 比 Ollama GUI 友好。

什么场景选 LM Studio。

场景一：只关心本地推理。

场景二：GUI 偏好。

场景三：试验各种模型权重。

什么场景选 chayuan-desktop。

场景一：要本地知识库。

场景二：要工具调用、模型对抗、多源。

场景三：要 WPS 集成。

场景四：政企国产化。

场景五：开发者集成。

WPS AI 插件 chayuan-wps 跟 LM Studio 不直接交互。chayuan-wps 通过 chayuan-desktop sidecar，sidecar 可以接 LM Studio 当推理后端。

LM Studio 跟 chayuan-desktop 不是竞争而是互补。免费开源的AI软件 各自有自己定位。chayuan-desktop 的 本地 AI 工作站 跟 LM Studio 的 本地推理工具 在产品边界上清楚。
