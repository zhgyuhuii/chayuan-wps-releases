# 流式协议为什么选SSE不选WebSocket 单机版的简单收益

chayuan-desktop 桌面单机版的流式响应用 SSE（Server-Sent Events），不用 WebSocket。这一篇讲两种协议的差别，以及单机版选 SSE 的具体理由。

先看协议本身。SSE 是 HTTP 之上的单向流式协议，服务端推消息给客户端。Connection: keep-alive，Content-Type: text/event-stream，每条消息以 data: 开头一行 \n\n 结尾。WebSocket 是独立协议，从 HTTP upgrade 升级而来，全双工双向通信。

聊天 AI 场景的常见选择。OpenAI 用 SSE，Anthropic 用 SSE，国内大厂大多用 SSE。WebSocket 在某些实时协作场景（多人编辑、实时游戏）更合适。流式 LLM 输出本质是 服务端推 + 单次请求，SSE 完全够用。

chayuan-desktop 选 SSE 的理由。

理由一：单向通信够。chayuan-desktop 的对话场景是 客户端发一个完整请求，服务端流式回。客户端不需要在流式过程中再发其他消息（比如打断、继续）。SSE 的单向模型契合这种场景。

理由二：HTTP 兼容。SSE 是 HTTP 之上的协议，跟 fetch、curl、httpx 等 HTTP 工具天然兼容。前端用原生 fetch + ReadableStream 就能消费。后端用 FastAPI 的 StreamingResponse 直接吐。WebSocket 需要专门客户端库。

理由三：调试友好。SSE 流可以用 curl 直接看，浏览器开发工具的 Network 面板能展开看每条消息。WebSocket 的 frame 调试相对麻烦。

理由四：代理兼容。某些公司网络代理对 WebSocket 不友好，会断开长连接。SSE 是普通 HTTP，代理基本都能透。chayuan-desktop 的某些用户在受限网络环境下，SSE 体验更稳。

理由五：自动重连。SSE 标准里有 自动重连 机制，服务端可以指定重连间隔。WebSocket 需要客户端自己处理重连。SSE 在网络抖动场景下用户感知更小。

理由六：实现简单。SSE 服务端就是 HTTP 接口，长连接 yield 消息。客户端就是 fetch + read stream。WebSocket 需要专门的握手、心跳、关闭流程。简单意味着 bug 少。

不选 WebSocket 的具体场景。chayuan-desktop 没有 多人协作 的实时场景。模型对抗 arena 看起来像实时但实际是 同时发一个请求等多个响应，仍是单方向流。如果未来加多人对话或者协作编辑，WebSocket 才有意义。

SSE 的具体格式。chayuan-desktop 的 SSE 事件都是 JSON 格式：data: {"type": "delta", "content": "你"}\n\n。每个事件有 type 字段区分（delta / reasoning_delta / tool_call_delta / citation_delta / done / error）。前端按 type 分发处理。

SSE 在 Tauri webview 里的兼容。Tauri webview 是系统 webview（WebView2 / WebKit），都原生支持 EventSource 和 fetch。chayuan-desktop 用 fetch + ReadableStream 而不是 EventSource，因为 fetch 支持自定义 header（虽然 chayuan-desktop 单机版当前不需要，但保持灵活性）。

SSE 的 keepalive。长连接（几十秒到几分钟）需要 keepalive。chayuan-desktop 在 SSE 中间偶尔发 ping 事件防止连接被中间网关超时。客户端识别 ping 事件忽略不渲染。

SSE 的中断。用户点 停止 按钮想停掉模型生成。chayuan-desktop 的做法是客户端 abort fetch（AbortController），服务端检测到连接关闭后停止上游 LLM 调用。这种 客户端关闭触发后端关闭 在 SSE 上自然实现。

SSE 错误处理。SSE 流中间出错（比如 LLM 返回错误），chayuan-desktop 在流里推一个 error 事件，包含错误类型和消息。前端识别 error 事件展示给用户。流仍然正常关闭，不抛异常。

WebSocket 用在哪。chayuan-desktop 当前没有 WebSocket 用法。如果未来加多人协作场景或者 server push 通知（除了对话流之外），WebSocket 是合适的。但单机版用不上。

国产化支持下的 SSE。SSE 在国产 OS 和国产浏览器内核上都支持。麒麟 UOS 上的 webview 跟主流 WebKit 一致，无兼容问题。

WPS AI 插件 chayuan-wps 也用 SSE 跟 sidecar 通信。在 WPS 里发起的对话流式输出走的是同一个协议。两个产品的流式协议一致。

SSE 在 chayuan-desktop 的选型是 简单契合场景，没必要追求 双向能力。免费开源的AI软件 想长期稳定，协议选简单的、被验证的，比追新潮更划算。
