# 向量库容量与索引重建 自建Milvus的运维清单

如果用户给 chayuan-desktop 桌面单机版接的是自建 Milvus 集群，需要懂一些 Milvus 运维。这一篇给一份运维清单。

先看 Milvus 的运维维度。

维度一：容量管理。collection 数据量、磁盘占用、内存占用。

维度二：性能监控。查询延迟、QPS、错误率。

维度三：索引管理。索引类型、参数、重建。

维度四：备份恢复。数据备份、恢复演练。

维度五：升级。Milvus 版本升级、参数迁移。

容量管理。

Milvus 的存储分两部分。Object Storage（MinIO/S3）存原始数据。Etcd 存元数据。监控这两个组件的磁盘使用。

每个 collection 的容量。Milvus 提供 stats API 看 collection 的 entity 数（chunk 数）、segment 数、磁盘大小。chayuan-desktop 在 KB 详情页能拉这些信息展示给用户。

容量规划。一份 100 万 chunk 1024 维向量大约 4GB。加上 segment 元数据和索引，实际存储 6-10GB。给 collection 预留 20% 余量。

性能监控。

监控 Milvus 的 Prometheus metrics（Milvus 默认暴露 9091 端口）。关键指标。

milvus_proxy_search_latency。查询延迟分布。p50、p99。

milvus_proxy_req_count。请求数。

milvus_querynode_search_count。查询节点的负载。

milvus_indexnode_index_task_count。索引节点的任务。

chayuan-desktop 不接管 Milvus 监控，建议用户自家集成 Grafana 看 dashboard。

索引管理。

Milvus 的索引类型选择。

HNSW：精度高，内存占用高。适合中小规模。

IVF_FLAT：训练快，无压缩。适合简单场景。

IVF_PQ：压缩存储。适合大规模。

DISKANN：硬盘索引。适合超大规模。

每个 collection 在创建时定一种索引类型。chayuan-desktop 不推荐特定类型，由用户根据数据规模和性能要求决定。

索引参数。HNSW 的 M 和 efConstruction 影响构建时间和精度。chayuan-desktop 不参与参数调优，按 collection 默认。

索引重建场景。索引参数调整、Milvus 版本升级、数据大量更新。重建需要 Milvus 端操作（DROP INDEX → CREATE INDEX）。chayuan-desktop 不替你做这件事。

索引重建期间的可用性。Milvus 索引重建期间查询可能用旧索引或者退化，chayuan-desktop 这边的检索可能短暂变慢。建议在低峰时段做。

备份恢复。

Milvus 提供 backup 工具（基于快照）。备份 collection 数据 + 元数据到外部存储。chayuan-desktop 不替你做备份，建议用户每周一次。

恢复需要重启 Milvus 集群，把备份还原。这是 Milvus 端运维操作。chayuan-desktop 这边只需要重连一次连接。

升级。

Milvus 版本升级有大版本和小版本。小版本兼容性好。大版本（比如 2.0 → 2.4）可能需要数据迁移。chayuan-desktop 跟着 pymilvus 客户端版本升级即可，但 Milvus 服务端的升级由用户自家做。

实战经验。

经验一：collection 拆分。一个 Milvus 集群里建一个超大 collection（亿级以上）不如拆成几个中等 collection（千万级）。chayuan-desktop 通过 src:* KB 灵活映射多个 collection。

经验二：partition 用法。某些 metadata 维度（比如时间、部门）适合做 partition 分区。Milvus 的 partition 让按维度过滤更高效。

经验三：副本配置。Milvus 集群可以配 replicas 数，提升查询吞吐。chayuan-desktop 不参与配置。

经验四：内存预算。HNSW 索引在内存里，节点内存要够。一个 100 万 chunk 1024 维 HNSW 索引大约 1GB 内存。

国产化支持下的 Milvus 替代。RT、Relyt 等国产向量库的运维细节跟 Milvus 不同。chayuan-desktop 不替你做这些库的运维，按各家文档操作。

WPS AI 插件 chayuan-wps 不感知 Milvus 运维状态。Milvus 失败时加载项的检索失败提示给用户。

Milvus 自建运维不在 chayuan-desktop 能力范围内。免费开源的AI软件 给你接入工具，运维由用户的 DBA 和 ops 团队负责。chayuan-desktop 提供 KB 健康监控（连接是否通、检索是否成功）但不接管底层运维。
