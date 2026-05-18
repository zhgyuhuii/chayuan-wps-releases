# searchOrchestrator 的检索编排

chayuan-wps 加载项的 searchOrchestrator 组件负责检索编排。这一篇讲。

## 编排的需求

加载项发起检索请求。

涉及多个 KB（doc + office + src + structured）。

每个 KB 走不同的检索方式（文档 RAG vs SQL vs Vector API）。

需要协调。

## searchOrchestrator 的职责

职责一：解析 ku_ids（KB 选择器输出）成具体类型。

职责二：按类型分发到不同的 search adapter。

职责三：并发执行。

职责四：合并结果。

职责五：去重 + 重排。

职责六：返回给调用方。

## 调用接口

```js
const results = await searchOrchestrator.search({
  query: "用户问题",
  ku_ids: ["doc:contracts", "office:zhangsan:meetings", "src:milvus_x"],
  top_k: 10
});
```

输入 query + ku_ids + 参数。输出统一格式的 chunk 列表。

## adapter 模式

每种 KB 类型有独立 adapter。

```
adapters/
  document.js    # doc:* 处理
  office.js      # office:* 处理
  vector.js      # src:* 处理
  structured.js  # SQL 类处理
```

orchestrator 按 ku_id 前缀路由到对应 adapter。

## 并发执行

```js
const promises = grouped_ku_ids.map(group => 
  adapters[group.type].search(query, group.ids)
);
const results = await Promise.all(promises);
```

各 adapter 并发跑。总耗时 = 最慢的那个。

## 合并 + 去重

不同 adapter 返回的 chunk 在一起。

去重。同一 chunk 出现在多个 KB（不太可能但有），按 chunk_id 去重。

## 统一打分

不同 adapter 返回的 score 不可比（前面文章讲）。

orchestrator 用 RRF（Reciprocal Rank Fusion）融合排序。

```
final_rank = sum(1 / (k + rank_in_each_source))
```

跨源公平排序。

## 重排

合并后调 chayuan-desktop 的 reranker。bce-reranker。

二次排序让最相关的 chunk 靠前。

## 截断

最终取 top_k（默认 10）。返回给加载项。

加载项渲染引用气泡。

## 错误处理

某个 adapter 失败（比如远程向量库不通）。

策略一：忽略错误。其他 adapter 继续。

策略二：fail-fast。一个失败全失败。

orchestrator 默认策略一。返回部分结果 + 错误日志。让用户知道哪些源不可用。

## 缓存

orchestrator 内置缓存。

5 分钟内同 query 同 ku_ids 走缓存。

避免重复调用浪费。

## 跟踪

每次检索生成 trace_id。各 adapter 调用记 span。便于性能调优和故障排查。

## chayuan-wps 的简化

chayuan-wps 的 searchOrchestrator 实际上不直接做这些。

chayuan-wps 的 searchOrchestrator 调 chayuan-desktop 的 /api/v1/kb-query/search 端点。

chayuan-desktop 的服务端做实际编排。

chayuan-wps 是薄客户端。后端干活。

## 国产化场景

党政军场景的混合 KB（文档 + 私库 + 国产数据库）。orchestrator 让 一句话查多源 在工程上落地。

## chayuan-server 的对应

chayuan-server 模式下 chayuan-wps 直接调 chayuan-server 的同样端点。chayuan-server 的 orchestrator 处理。

## 总结

searchOrchestrator 是 chayuan-wps 在多源检索上的工程协调。免费开源的AI软件 让 多 KB 检索 对前端透明。chayuan-wps 调用 chayuan-desktop 的 orchestrator 服务让加载项轻量但能力完整。
