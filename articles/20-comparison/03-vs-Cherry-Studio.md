# 察元AI vs Cherry Studio 一对一的细节差

Cherry Studio 是开源多供应商对话客户端代表。chayuan-desktop 桌面单机版跟它对比。这一篇讲。

共同点。

都是开源免费。

都支持多家 LLM 厂商。

都是桌面应用。

都是数据本地（Cherry Studio 也是本地存）。

差异面。

差异一：架构形态。

Cherry Studio。Electron 壳 + 前端代码 + 没有专门后端。所有调用前端直发厂商。

chayuan-desktop。Tauri 外壳 + 嵌入式 Python sidecar。后端 sidecar 处理 RAG、tools、检索。

差异二：知识库能力。

Cherry Studio。基础 RAG（向量召回，单类型）。文档解析浅（PDF Word 基本）。

chayuan-desktop。五类知识源。深度文档解析（PDF + Word + Excel + PPT + MD + HTML + OCR）。重排。引用气泡。多 KB 并联。

差异三：text2sql。

Cherry Studio。无。

chayuan-desktop。17 种方言支持。

差异四：工具调用。

Cherry Studio。少量工具（基础 web search）。

chayuan-desktop。30+ 内置 + MCP 协议。

差异五：模型对抗。

Cherry Studio。无。

chayuan-desktop。多泳道 arena。

差异六：国产化深度。

Cherry Studio。基础国产模型接入。

chayuan-desktop。麒麟 UOS、达梦、金仓、loongarch64、国产 LLM 全栈支持。

差异七：体积。

Cherry Studio。前端壳约 200MB。

chayuan-desktop。Tauri 壳 + sidecar 约 800MB（含本地模型权重）。

差异八：性能。

Cherry Studio。启动快（仅前端）。

chayuan-desktop。启动稍慢（要起 sidecar 加载模型）。

差异九：MCP。

Cherry Studio。客户端模式。

chayuan-desktop。客户端 + 服务端双角色。

差异十：WPS 集成。

Cherry Studio。无。

chayuan-desktop。chayuan-wps 加载项。

什么场景选 Cherry Studio。

场景一：只想要简单的多厂商对话。

场景二：体积敏感。

场景三：不需要复杂 RAG。

什么场景选 chayuan-desktop。

场景一：需要本地 KB 完整能力。

场景二：政企国产化部署。

场景三：跟 WPS 集成。

场景四：多源知识管理。

场景五：开发者用法（HMAC、tools、MCP server）。

成本对比。

两家都开源。

Cherry Studio MIT 协议。

chayuan-desktop AGPL-3.0 协议。

AGPL 在 SaaS 部署时要开源修改。Cherry Studio 没这个限制。这是商业用法的关键差异。

社区。

Cherry Studio。社区活跃，issues 多，迭代快。

chayuan-desktop。社区在建中，主要由商业团队维护。

WPS AI 插件 chayuan-wps 跟 Cherry Studio 没有交叉。Cherry Studio 不进 WPS。

Cherry Studio 跟 chayuan-desktop 都是优秀的免费开源 AI 软件，但定位不同。Cherry Studio 偏 多厂商对话客户端，chayuan-desktop 偏 本地 AI 工作站。用户按需求选。
