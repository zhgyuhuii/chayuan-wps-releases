# React 19的并发渲染对察元AI意味着什么 流式UI的真实收益

chayuan-desktop 桌面单机版前端用 React 19。这个版本是 React 团队投入多年的并发渲染（Concurrent Rendering）成熟的一代。在普通 Web 应用上 React 19 的好处可能不那么直观，但对一个全程流式输出的 AI 桌面应用，并发渲染带来的体验差是实在的。这一篇讲 React 19 在 chayuan-desktop 上的具体收益。

先看 AI 桌面应用的渲染特征。一次对话流式输出可能持续几秒到几十秒，期间几百到几千个 token 增量到达。每个增量都要更新 UI：当前消息的 content 字段追加、reasoning 字段追加、引用气泡列表追加、工具调用卡片状态变化。如果每个增量都触发一次完整的 React render，主线程会被 update flood 堵死，输入框点击都会卡。

React 18 之前的处理方式。开发者要手动节流（throttle）或防抖（debounce），把多次 setState 合并成一次。这种手动优化容易出错，节流间隔难调，全栈频繁 setState 还是会有抖动。

React 18 引入的并发渲染。setState 默认变成 异步批量。短时间内多次 setState 会被自动合并到一次 render。useTransition 和 useDeferredValue 让开发者能显式声明 哪些更新不紧急，让浏览器在 idle 时间渲染。

React 19 的进一步打磨。useTransition 的细节更稳，useOptimistic 让乐观更新更直接，自动批量的边界更清晰。chayuan-desktop 用的是这一代的 API。

具体的 chayuan-desktop 用法。流式接收 token 时，每个 delta 事件触发 setMessages 更新当前消息的 content。React 19 自动批量这些更新，按浏览器 idle 时间渲染，不会每个 token 都触发一次完整 render。结果是即使一秒钟来 100 个 token，UI 仍然流畅，输入框响应正常。

useTransition 的应用场景。引用气泡的渲染相对慢（每个气泡组件含 metadata 解析、原文 chunk lookup、UI 布局）。chayuan-desktop 把引用气泡的 setState 包在 startTransition 里，标记为非紧急更新。结果是流式 token 的渲染（紧急）不会被引用气泡的渲染阻塞。

useDeferredValue 的应用场景。对话历史列表显示当前对话的所有消息，包括正在流式接收的最后一条。这个列表在长对话里渲染量大。chayuan-desktop 用 useDeferredValue 让历史列表的更新延后，让流式接收的最新消息优先渲染。

React 19 的 Server Components 不在桌面端使用。Server Components 是为 Next.js 之类的服务端框架设计的。chayuan-desktop 是纯客户端 React，没用这个特性。但 React 19 的其他改进（自动批量、useTransition、useOptimistic）都用了。

不用并发渲染会怎样。早期某个版本的 chayuan-desktop 用的是 React 17，流式输出长答案时输入框卡顿明显，用户在键盘按一下到屏幕显示有几百毫秒延迟。升级到 React 18 之后立刻好转，再到 React 19 的体感更稳。

React 19 的成本。一是依赖升级。React 19 跟某些第三方库有兼容性差异，chayuan-desktop 升级时跑了一遍依赖兼容性检查。二是开发心智。useTransition、useDeferredValue 这些 API 用错地方反而会让体验变差，需要团队理解清楚什么是 紧急 什么是 非紧急。

为什么不选 Vue 3。Vue 3 也是优秀的前端框架，chayuan-wps WPS AI 插件 用的就是 Vue 3。chayuan-desktop 选 React 19 的考虑是 团队经验偏 React、并发渲染对流式 UI 的优化更成熟、生态库（Tanstack Query、Zustand、Radix UI）更适合复杂应用。这不是说 Vue 不行，是基于团队和场景的具体决定。

为什么不选 Svelte。Svelte 编译时优化激进，最终包体积小。chayuan-desktop 考虑过 Svelte 但放弃了，原因是 Svelte 在大型应用上的复杂状态管理还不够成熟，且生态不如 React 厚。

React 19 加 Tauri 2 的组合。Tauri 主进程对 webview 的事件分发性能挺好，React 19 的并发渲染在 webview 里跑跟在浏览器里跑表现一致。这两个技术栈搭配起来对 流式 UI 这件事支持很到位。

WPS AI 插件 chayuan-wps 用 Vue 3，加载项里同样有流式输出。Vue 3 的响应式系统在流式更新场景下表现也不错，跟 React 19 是不同实现思路但同样能解决问题。两个产品的前端选型不一致是历史原因，但都把流式 UI 这件事处理好了。

React 19 在 chayuan-desktop 上的真实收益总结：流式 UI 不卡、长对话不卡、多 Tab 并行不卡。这些 不卡 加起来就是 免费开源的AI软件 用着舒服的基础。
