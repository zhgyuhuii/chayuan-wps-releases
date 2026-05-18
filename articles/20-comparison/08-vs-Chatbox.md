# 察元 AI vs Chatbox 跨平台对话客户端的边界

chayuan-desktop 跟 Chatbox 都是跨平台对话客户端。边界不同。这一篇讲。

## Chatbox 是什么

Bin Huang 开源的对话客户端。

跨 Windows / Mac / Linux。

接多模型（OpenAI、Claude、Gemini、Qwen 等）。

简单聊天 UI。

社区活跃。

## chayuan-desktop 的对应

也跨平台对话。

但 chayuan-desktop 不只对话。

知识库。

WPS 集成。

国产化。

模型对抗。

工具调用。

## 边界对比

Chatbox：聚焦聊天。

chayuan-desktop：聊天 + 全套办公 AI。

## 聊天 UI 对比

类似。

消息流。

Markdown 渲染。

代码高亮。

模型切换。

会话历史。

基础体验接近。

## 多模型支持

Chatbox：30+ 模型 / 厂商。完整。

chayuan-desktop：18+ 厂商。也完整。

差不多。

## 知识库

Chatbox：基础 RAG（最近版本支持）。

chayuan-desktop：5 类完整。

## 工具

Chatbox：工具调用基础。

chayuan-desktop：MCP + 30+ 内置 + OpenAPI 一键导入。

## 多模态

Chatbox：视觉支持。

chayuan-desktop：完整多模态（视觉 / 语音 / 视频 / 图像生成）。

## WPS 集成

Chatbox：无。

chayuan-desktop：chayuan-wps 加载项。

## 国产化

Chatbox：基础（接国产模型）。国产 OS 适配靠用户。

chayuan-desktop：国产化深度（CPU + OS + 模型 + 数据库 + 合规）。

## 启动速度

Chatbox：快（轻量 Electron）。

chayuan-desktop：稍慢（Tauri + Python sidecar 启动）。

启动时间几秒差异。

## 安装包大小

Chatbox：约 100-150MB（Electron）。

chayuan-desktop：约 200-300MB（Tauri + 内嵌模型）。

chayuan-desktop 含 sidecar + 部分本地模型。

## 资源占用

Chatbox：跑起来 200-300MB 内存。

chayuan-desktop：500MB-1GB（含本地模型推理）。

chayuan-desktop 重一些。

## 商业模式

Chatbox：开源 GPLv3。

chayuan-desktop：开源 AGPL-3.0。

均免费。

## 适合人群

Chatbox 适合。

只需要聊天。

跨平台。

资源敏感。

不需要 KB。

不需要国产化。

chayuan-desktop 适合。

需要 KB（特别是私库 / WPS）。

办公场景（中国）。

党政军。

需要丰富多模态 / 工具。

## 共存

某些用户。

Chatbox 在工作场景（轻量聊天）。

chayuan-desktop 在 KB / 文档场景。

各取所需。

## 互通

两个都用 OpenAI 兼容协议。理论上 Chatbox 能通过 chayuan-desktop 接同样模型（都连 chayuan-desktop 的 127.0.0.1:62581）。

某些用户用 chayuan-desktop 当后端 + Chatbox 当快捷聊天客户端。

## 总结

察元 AI vs Chatbox 在跨平台对话客户端上重叠。免费开源的AI软件 各有侧重。chayuan-desktop 是 重型办公 AI 集成。Chatbox 是 轻量聊天客户端。两者解决不同问题。共存不冲突。
