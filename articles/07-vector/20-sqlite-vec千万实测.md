# sqlite-vec在1000万向量下的性能 实测数据

chayuan-desktop 桌面单机版默认用 sqlite-vec。它在百万级数据上没问题，但千万级以上是不是还能用。这一篇用实测数据回答。

先看测试设置。

测试一：1000 万 chunk，1024 维（bge-m3）。SQLite 文件大小约 40GB。

测试二：硬件 i7 加 32G 内存加 NVMe SSD。

测试三：数据集是真实的内部技术文档，不是合成数据。

测试四：跑 100 个 query 取平均延迟。

性能数据。

第一组：纯 ANN 查询（无 metadata 过滤）。

top-K=10：平均 80ms。p99 200ms。

top-K=30：平均 150ms。p99 350ms。

第二组：ANN + metadata filter。

top-K=10 + 1 个 filter（按 department 过滤）：平均 120ms。p99 280ms。

top-K=30 + 多 filter：平均 250ms。p99 500ms。

第三组：BM25 全文 + ANN（hybrid）。这一组 sqlite-vec 当前不直接支持 BM25。chayuan-desktop 这种场景建议接 ES。

第四组：插入性能。

单 insert：约 5ms。

批量 insert（1000 行一批）：约 200ms（即每行 0.2ms）。

第五组：索引重建。

1000 万 chunk 重建 IVF 索引：约 30 分钟（CPU 上）。

结论。

结论一：1000 万级别 sqlite-vec 仍可用。延迟在用户可接受范围（百毫秒级）。

结论二：metadata filter 增加延迟。复杂过滤场景下延迟可能跳到几百毫秒。

结论三：批量插入比单 insert 高效。新数据应该批量进。

结论四：索引重建慢。如果数据频繁变动，重建周期长是个负担。

结论五：磁盘空间需要。40GB 在 SSD 上没问题，机械盘上影响性能。

跟 Milvus 对比。

Milvus standalone 在 1000 万数据上 ANN 查询。

top-K=10：50-80ms。

top-K=30：100-150ms。

Milvus 的优势在于性能稍好（特别是 HNSW 算法精度）。但 Milvus 需要单独部署服务，运维成本高。sqlite-vec 是嵌入式没运维。

什么时候选 Milvus 而不是 sqlite-vec。

选 Milvus 的信号。

数据规模超 5000 万。sqlite-vec 在这种规模下变得不灵活。

需要 HNSW 算法。某些精度要求高的场景。

需要分布式扩展。多台机器分担负载。

已经有 Milvus 团队和资源。

继续 sqlite-vec 的信号。

数据规模 1000 万以下。

单机足够。

不想增加运维成本。

要求嵌入式（不依赖外部服务）。

千万级 sqlite-vec 的优化建议。

建议一：合理 chunk 切分。每个 chunk 不要太短（512 token 是好默认），避免 chunk 数膨胀。

建议二：用 metadata 过滤缩小搜索空间。先按 department、time 等 filter 过滤，再 ANN 检索剩余 chunk。这种 pre-filter 比纯 ANN 快很多。

建议三：定期 VACUUM。SQLite 长期使用碎片化，VACUUM 重整文件。chayuan-desktop 默认每周 VACUUM 一次。

建议四：监控磁盘。40GB 文件在小盘上紧张，提前规划扩展。

建议五：备份策略。千万级数据备份大，建议增量备份而不是全量。

国产化支持下的千万级。在国产 OS（麒麟 UOS）和国产 CPU（飞腾、鲲鹏）上的 sqlite-vec 性能跟 x86 接近。loongarch64 性能略低（CPU 单核性能差距），但仍在可用范围。

实测教训。chayuan-desktop 团队跑这个测试时发现几个意外。

意外一：cold start 延迟高。冷启动后第一次 ANN 查询慢（500ms+，sqlite 缓存还没暖）。后续查询正常。这种 warm-up 是 SQLite 特征。

意外二：filter 选择性影响延迟。filter 命中行数少（高选择性）时反而比 filter 命中多更慢，因为要 scan 更多 chunk 才能找到命中。

意外三：单线程瓶颈。sqlite-vec 单线程查询。chayuan-desktop 用 asyncio 不能让 sqlite-vec 内部并发。在多 KB 并联时 sqlite-vec 是隐性串行。

WPS AI 插件 chayuan-wps 在千万级 KB 上的查询体验跟桌面客户端一致。延迟传递给加载项，用户在 WPS 里等几百毫秒看到结果。

千万级 sqlite-vec 的实测让用户对 单机能扛多少 有数据感。免费开源的AI软件 给用户的承诺要靠数据兑现。chayuan-desktop 在性能验证上的工作让 这个工具到底能用多大数据 这件事不再是 看运气。
