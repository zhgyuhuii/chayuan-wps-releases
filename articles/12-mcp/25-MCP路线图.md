# MCP 路线图 v3 v4 的演化预期

chayuan-desktop 桌面单机版对 MCP 协议的演化预期。这一篇讲未来。

## 当前 v1.0

MCP 1.0（2024 年发布）功能。

stdio 和 SSE 两种传输。

list_tools 和 call_tool 基础能力。

JSON Schema 输入校验。

工具描述含 name、description、parameters。

## v1.1 - v1.x 的改进

1.1+ 新增。

resources。工具能暴露资源（文件、URL 等）。

prompts。工具能暴露 prompt 模板。

logging。工具能输出结构化日志。

sampling。工具能让 LLM 采样（reverse direction）。

完善基础能力。

## v2.0 预期

预期的演进方向。

方向一：传输升级。

WebTransport 替代 SSE。性能更好。

二进制协议（替代 JSON）。延迟降低。

方向二：批量调用。

一次请求多个工具调用。减少往返。

方向三：流式工具结果。

工具结果流式返回（避免大结果阻塞）。

方向四：会话状态。

工具能持久化跨调用状态。

## v3.0 预期

更前瞻的方向。

方向一：联邦工具。

一个 mcp client 能聚合多个 mcp server 成一个 super-server。简化客户端配置。

方向二：工具组合。

某 tool 能调用其他 tool（嵌套）。tools-in-tools 嵌套调用。

方向三：自适应工具发现。

LLM 根据问题动态发现需要的工具，不必预先列全部工具。降低 prompt 上下文消耗。

方向四：跨设备协议。

mcp 工具在 A 设备运行，B 设备的 LLM 调用。便于 家里跑工具，办公调用。

## v4.0 预期

更远期。

方向一：完整的 agent 协议。

不只是工具调用，是完整的 agent 协作协议。

方向二：分布式工具网络。

类似 P2P 网络的工具发现和调用。

方向三：标准化能力分类。

工具能力按类别（read、write、search、execute）标准化。便于 LLM 决策。

## chayuan-desktop 的跟进策略

策略一：跟进 1.x 最新。每个 minor 版本及时支持。

策略二：实验性支持 2.0+。某些用户提前体验。但稳定版仍是 1.x。

策略三：贡献回上游。chayuan-desktop 在落地中遇到的问题反馈给 MCP 社区，推动协议演进。

## 协议碎片化的风险

MCP 协议演进中可能分裂。某些厂商加自家扩展（vendor-specific capabilities）。

chayuan-desktop 的应对。

中性抽象。chayuan-desktop 内部用自己的工具表示，不绑定 MCP 特定版本。

兼容性测试。每次升级测试现有工具是否仍工作。

降级模式。某工具用新版协议，chayuan-desktop 客户端老。chayuan-desktop 检测后降级用通用部分。

## 跟其他协议的关系

OpenAI Function Calling。chayuan-desktop 长期都支持。

Anthropic tool_use。同上。

LangChain tools。某些场景兼容。

LangGraph。同上。

各协议会逐步收敛。chayuan-desktop 的中性抽象层让任何变化都能适应。

## 国产化场景

国产 AI 厂商也在尝试自己的工具协议。文心、智谱、Qwen 各有探索。

希望未来收敛到 MCP 这种开放标准。

chayuan-desktop 在国产生态推动 MCP 普及（工具开放性、跨厂商）。

## chayuan-server 的对应

chayuan-server 跟随相同路线图。两者协同演进。

## WPS 加载项

chayuan-wps 跟随 chayuan-desktop 的 MCP 演进。WPS 用户感知就是 工具能力越来越强。

## 总结

MCP 路线图的演化是 chayuan-desktop 在协议层面长期投资的方向。免费开源的AI软件 跟随协议进化但不绑死。chayuan-desktop 的中性抽象 + 跟进 + 兼容性策略让 MCP 在察元生态长期可演进。
