# 让 Claude 调 Tauri 与 React 19 的并发问题

chayuan-desktop 桌面单机版基于 Tauri + React 19。两者并发交互复杂。Claude 协助。这一篇讲。

## 并发的来源

Tauri 主进程（Rust）。

React 19 前端（JS）。

Python sidecar（独立进程）。

每个有自己的并发模型。互相通过 IPC 通信。

容易出问题。

## React 19 的新并发

React 19 的 Concurrent Mode + use() hook + Server Components。

某些异步 API 跟 Tauri 的命令调用结合时奇怪。

```jsx
function ChatComponent() {
  const data = use(fetchKB());  // 19 的 use()
  return <div>{data.kbName}</div>;
}
```

某些场景 Tauri 命令 race。Claude 帮诊断。

## 跨进程数据流

```
Tauri Rust 收到 invoke('kb_search', { query }) 调用
↓
Tauri 转发给 sidecar (HTTP 127.0.0.1:62581/api/kb/search)
↓
sidecar 处理 → 返回
↓
Tauri Rust 收到响应
↓
返回给 React 前端
```

某些环节可能 race。

```
React 同时发 5 个 invoke。
Tauri 顺序处理还是并行？
sidecar 同时处理 5 个？
```

Claude 帮设计并发策略。

## 状态同步

某些状态在 React、Rust、Python sidecar 三处都有。

```
当前选中的 KB list:
  - React state（UI 显示）
  - Rust 缓存（性能）
  - Python sidecar 持久化
```

三处不同步可能用户看到的跟实际不一致。

Claude 建议。

```
状态主权应该明确：
- 真实状态在 sidecar (持久化层)
- React 是显示层
- Rust 不持有状态，仅转发

不要在 Rust 缓存。每次需要从 sidecar 拉。
```

简化。

## React 19 的 useTransition

某些操作慢。React 19 的 useTransition 让 UI 不卡。

```jsx
const [isPending, startTransition] = useTransition();

function handleSearch() {
  startTransition(() => {
    invoke('kb_search', { query });
  });
}

return (
  <div>
    {isPending && <Spinner />}
    <Results />
  </div>
);
```

Claude 教用法。

## 取消和清理

用户切换会话或关闭 chayuan-desktop。进行中的请求需要取消。

```
React 用 AbortController。
Tauri 命令支持取消？
sidecar 的 HTTP 请求支持取消？
```

Claude 帮设计取消链路。

## 错误传播

某层出错。错误怎么传到用户。

sidecar 错 → Tauri Rust 包装 → React 展示。

Claude 帮设计错误格式。

```
{
  "code": "MODEL_OOM",
  "message": "模型加载内存不足",
  "stack": "...",
  "hint": "建议关闭其他程序或换更小模型"
}
```

每层透传。最后给用户 hint 友好提示。

## 性能调试

某操作慢。Claude 帮分析。

```
检索 1 秒。哪里慢？
- React 调用前 50ms
- Tauri Rust 转发 5ms
- sidecar 处理 800ms
- 返回链路 100ms

瓶颈在 sidecar 的检索。优化 sqlite-vec 索引。
```

跨进程性能 profile。

## chayuan-desktop 的 IPC

Tauri 的 invoke + emit。最常用。

某些场景需要 channel（双向流）。Tauri 也支持。

某些场景 sidecar 主动推。SSE 或 WebSocket。

Claude 帮选哪种 IPC。

## 国产化场景

党政军开发 chayuan-desktop 类项目。Tauri + React 跨进程并发问题相同。Claude 协作适用。

## chayuan-server 的对应

chayuan-server 是 web 应用。不涉及 Tauri 多进程。React 19 + Web 是简化场景。

## 总结

让 Claude 调 Tauri + React 19 并发问题是 chayuan-desktop 在前端架构上的工程实战。免费开源的AI软件 让 复杂跨进程并发 有 AI 协作。Claude 的状态分析 + IPC 设计 + 错误传播 + 性能 profile 让并发问题可控。
