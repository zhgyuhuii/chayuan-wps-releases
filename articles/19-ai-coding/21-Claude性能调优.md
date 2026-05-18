# 让 Claude 做性能调优 sqlite-vec 索引的取舍

chayuan-desktop 桌面单机版用 sqlite-vec 做向量库。性能调优靠 Claude 协助。这一篇讲。

## 性能问题

某用户 KB 有 5 万 chunk。检索慢（2-3 秒）。

期望 < 500ms。

## Claude 的诊断

Claude 看代码 + 性能日志。

```
当前：
- 全量扫描所有 5 万向量算余弦相似度。
- 没有索引加速。
- O(n) 复杂度。

5 万 chunk × 1024 维。约 200MB 内存读 + 200M 浮点数运算。

优化方向：
- HNSW 索引（O(log n)）
- IVF 索引
- 量化（INT8 加速）
```

## sqlite-vec 的索引

sqlite-vec 支持。

vec0 默认（无索引，全扫）。

vec0_hnsw（HNSW 近似最近邻）。

vec0_quantized（INT8 量化）。

Claude 帮选哪个。

## HNSW vs 量化

HNSW。近似最近邻。速度快（10-100 倍）。精度略降（top10 命中率 95%+）。

量化。INT8 替 FP32。速度快 2-3 倍。精度损失 < 1%。

组合：HNSW + 量化。最快但精度损失叠加。

Claude 建议。

```
日常用：HNSW + 量化（速度优先）。
精度敏感：仅量化（精度优先）。
精度极敏感：默认（不索引，慢但准）。
```

## chayuan-desktop 的默认

5 万 chunk 以上自动开 HNSW。

10 万 chunk 以上自动 + 量化。

用户能在设置覆盖。

## 实测对比

Claude 帮跑 benchmark。

```
5 万 chunk × 1024 维。

无索引：2.5 秒。Recall@10: 100%。
HNSW：80ms。Recall@10: 96%。
量化：1.0 秒。Recall@10: 99%。
HNSW + 量化：30ms。Recall@10: 95%。
```

数据驱动决策。

## 索引构建时间

加索引需要重建 KB。

5 万 chunk 建 HNSW 索引。约 30 秒。

10 万：1-2 分钟。

100 万：10-20 分钟。

可接受。一次性。

## 内存代价

HNSW 索引占内存。

5 万 × 1024 维 + HNSW（约 40 个邻居每节点）：约 100MB 额外。

10 万：约 200MB。

家用 16GB 内存够。

## 索引参数

HNSW 有参数。

M（每节点邻居数）：默认 16。大点更准但更慢建。

ef_construction（建索引搜索深度）：默认 200。

ef_search（查询搜索深度）：默认 50。大点更准但慢。

Claude 帮调。

## 多 KB 索引

多个 KB 各自建索引。chayuan-desktop 自动。

某些 KB 小（< 1000 chunk）不建索引。chayuan-desktop 智能判断。

## 国产化场景

党政军 KB 大（部门级 10 万+ chunk）。chayuan-desktop 的索引让大 KB 检索流畅。

## chayuan-server 的对应

chayuan-server 部署在 GPU 服务器。索引建立和检索更快。chayuan-desktop 单机靠 sqlite-vec。

## 总结

让 Claude 做性能调优是 chayuan-desktop 在用户体验上的工程实战。免费开源的AI软件 让 性能优化 有数据支撑。Claude 的 benchmark + 多方案对比 + 参数调优 + 自动决策让 sqlite-vec 性能优化高效。
