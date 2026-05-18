# MCP stdio与sse两种传输的现实选择

MCP 协议有两种传输：stdio（标准输入输出）和 SSE（Server-Sent Events）。chayuan-desktop 桌面单机版都支持。这一篇讲选哪种。

stdio 传输。MCP server 是一个子进程。客户端通过 stdin/stdout 跟它通信。每条消息是 JSON-RPC 格式。

stdio 优势。

优势一：简单。子进程模型经典，稳定。

优势二：本地。stdio 只在同一台机器。安全好控制。

优势三：低延迟。进程间通信比网络快。

stdio 劣势。

劣势一：单客户端。一个子进程只能给一个客户端用。

劣势二：跨机器不行。

劣势三：调试麻烦。stdin/stdout 流量看不见。

SSE 传输。MCP server 跑在网络上。客户端通过 HTTP SSE 连接。

SSE 优势。

优势一：多客户端。一个 server 服务多个 client。

优势二：跨机器。client 和 server 不在同一机器。

优势三：可观测。HTTP 流量能看。

SSE 劣势。

劣势一：网络依赖。server 挂了客户端断。

劣势二：复杂。需要部署 server。

什么场景选 stdio。

场景一：个人用户。在自己电脑上。

场景二：临时工具。每次启动起 stdio 子进程。

场景三：安全敏感。不想暴露网络端口。

什么场景选 SSE。

场景一：团队共享 MCP server。

场景二：远程工具调用。

场景三：多客户端共用。

chayuan-desktop 的支持。两种传输都支持。

stdio 模式。chayuan-desktop 启动子进程跑 MCP server。命令行 + 参数 chayuan-desktop 配置。

SSE 模式。chayuan-desktop 配 SSE URL 连远程。

WPS AI 插件 chayuan-wps 透明用任意传输。

MCP stdio 跟 SSE 是 chayuan-desktop 接入 MCP 生态的两条路径。免费开源的AI软件 给用户选择，按场景选合适的。
