# 流式响应的全链路 SSE在React 19下的事件分发

chayuan-desktop 桌面单机版的对话体验跟厂商客户端最像的一点是 流式输出：模型一边生成一边显示，不用等整段答案完才呈现。背后是 SSE（Server-Sent Events）这条传输协议从 sidecar 一直流到 React 渲染。这一篇拆开看这条链路。

先看为什么不用 WebSocket。WebSocket 是双向通道，但 chayuan-desktop 的对话场景大部分是 客户端发一句话，服务端流式回 这种半双工。SSE 单向通道足够，且 SSE 是 HTTP 之上的标准协议，浏览器和 fetch API 都原生支持，部署简单。WebSocket 在某些公司网络代理下偶尔失效，SSE 走 HTTP 兼容性好。

链路第一段：模型厂商到 sidecar。各家 LLM 厂商的流式响应大都是 SSE 格式，data: {...} 一行一行推。chayuan-desktop 的网关层用 httpx 客户端订阅这些事件，按内部协议归一化。每家厂商的事件结构不同，归一化器把它们都映射成 chayuan-desktop 自己的事件格式。

归一化后的事件类型。delta 是文本增量；reasoning_delta 是深度思考增量；tool_call_delta 是工具调用增量；citation_delta 是引用气泡增量；done 是流结束；error 是异常。每个事件都带一个 sequence 字段方便前端排序。

链路第二段：sidecar 到前端。sidecar 把归一化后的事件再编码成 SSE 推给前端 webview。HTTP 响应头 Content-Type: text/event-stream，Connection: keep-alive。每个事件 data: {json}\n\n 的格式发出去。前端不需要单独的 SSE 解析库，原生的 EventSource 或者 fetch 配合 ReadableStream 都能消费。

为什么 chayuan-desktop 用 fetch + ReadableStream 而不是 EventSource。EventSource 不支持自定义 header，请求时不能带 Authorization 之类的字段。fetch 加 ReadableStream 可以，灵活性高。chayuan-desktop 的前端用 fetch 发请求，response.body 拿到 ReadableStream，流式读，按 SSE 格式解析。

链路第三段：前端到 React。前端 chat 模块拿到流式事件后，按事件类型分发到不同的 React state。delta 追加到当前消息的 content；reasoning_delta 追加到 reasoning 字段；tool_call_delta 更新当前 tool_call 的状态；citation_delta 追加到引用列表。React 19 的并发渲染让这些 state 更新不会卡住主线程。

React 19 的实际收益。useTransition 把 流式更新 标记为非紧急，浏览器在 idle 时间渲染，输入框响应保持流畅。useDeferredValue 让大量 state 变更被批量处理而不是逐个触发渲染。这两个特性让 chayuan-desktop 在流式输出几百行长答案时仍能保持响应。

事件去重与乱序。网络传输有时乱序到达，特别是跨多个事件类型混合的时候。前端按 sequence 字段做排序，避免渲染抖动。重复事件用本地缓存判断，丢弃。

工具调用的三层折叠展示。tool_call_delta 事件累积成完整的 tool_call 之后，前端渲染成一个折叠卡片：summary 一行（工具名 + 状态）、参数与输出（点开可见）、完整 JSON（再点开看 raw）。这种三层结构让用户既能快速浏览又能深入看细节。

reasoning 折叠。深度思考模型（比如 GPT-o1、DeepSeek R1）会有大段 reasoning 输出。reasoning_delta 累积成 reasoning 字段后，前端默认折叠，给一个 显示思考过程 按钮。这样答案看起来简洁，需要时能查思考。

错误事件处理。流式过程中如果出现错误（比如模型限速、网络中断），sidecar 推一个 error 事件。前端把当前消息标记为 中断，给一个 重试 按钮。已经流出来的部分内容仍保留，重试时基于上下文继续。

断线重连。Tauri webview 内部网络通常稳定，但偶尔（比如系统休眠唤醒）连接断掉。前端 EventSource 或 fetch 监测到 readyState 变 closed，触发重连逻辑。重连后从上次中断的地方继续不可行（HTTP 流不支持），所以重试是从头再发一次请求。

落库时机。流式过程中前端只在内存里维护，等 done 事件到了才把整段答案打包发到 sidecar 的 /api/v1/conversations/.../messages 接口落库。这种 流完落库 的方式避免在流式过程中频繁写 SQLite。如果中途意外退出，最近一次未完成的回答会丢，但之前的所有对话历史都在。

WPS AI 插件 chayuan-wps 共用同一套流式协议。加载项里的对话流式输出走的是同样的 SSE 链路，前端是 Vue 3 实现，事件分发逻辑一致。这种统一让 chayuan-desktop 加 chayuan-wps 在流式体验上完全一致。

流式响应这件事看起来普通，背后从模型厂商到 React 渲染一共五段处理。任何一段不顺都会让用户体感变差。免费开源的AI软件 想做出生产级流畅体验，每段都要打磨到位。
