# 本地离线知识库的内嵌向量库 sqlite-vec的来历与边界

chayuan-desktop 桌面单机版的默认向量库是 sqlite-vec。这是个相对新的项目，但在嵌入式向量库领域里位置特殊。这一篇讲它的来历和能力边界。

先看 sqlite-vec 是什么。它是 SQLite 的一个扩展，给 SQLite 加上向量字段和 ANN 查询能力。作者 Alex Garcia 维护。基于 BSD/MIT 协议开源。可以编译成 .so（Linux/macOS）或 .dll（Windows），动态加载到 SQLite 进程。

sqlite-vec 的优势。

优势一：嵌入式。跟 SQLite 同进程，没独立服务。chayuan-desktop sidecar 加载 sqlite-vec 之后就有了向量查询能力，不用起额外服务。

优势二：跨平台。预编译的二进制覆盖所有主流平台。chayuan-desktop 的 PyInstaller 打包带上对应平台的二进制。

优势三：性能良好。在百万级向量规模下查询毫秒到几十毫秒。比 FAISS 这种纯库慢一点，但比起步要起独立服务的 Milvus 方便。

优势四：跟 SQL 一体。向量查询语法是 SQL 的扩展（vec_distance 函数），跟普通 SQL 查询无缝结合。WHERE 条件 + 向量距离一起跑。

sqlite-vec 的能力边界。

边界一：算法主要是 IVF。当前不支持 HNSW（在路线图但还没实现）。HNSW 在大规模数据上性能更好，sqlite-vec 当前在百万到千万规模下足够。

边界二：单文件限制。sqlite-vec 的索引在 SQLite 文件里。文件大小理论 281TB，实际超过几十 G 后维护慢。chayuan-desktop 用 一个 KB 一个文件 策略，单 KB 不会膨胀到这种规模。

边界三：并发。SQLite 多读单写。同一时刻多个读没问题，但只能一个写。chayuan-desktop sidecar 单进程，不存在跨进程写冲突。

边界四：算法配置。IVF 的 nlist nprobe 参数 sqlite-vec 暴露但默认值合理。某些极端场景调参才有意义。

边界五：维度。sqlite-vec 支持任意维度（理论上 32 位浮点数组）。chayuan-desktop 默认 1024 维（bge-m3）。维度太大（4096+）存储和计算成本高。

为什么不选 FAISS。FAISS 是 Facebook 开源的向量库，性能强大。但 FAISS 是 Python 库不是 SQL 扩展，用法跟 SQL 数据库脱节。chayuan-desktop 的 sqlite-vec 选择是 跟现有 SQLite 体系融合 优于 性能极致。

为什么不选 Chroma 嵌入式。Chroma 也支持嵌入式，但启动时需要起一个独立 server 进程（即使是嵌入式形态）。架构上跟 sqlite-vec 不同，集成度低。chayuan-desktop 选 sqlite-vec 是 完全同进程 优于 嵌入式 server。

实际跑的样子。chayuan-desktop sidecar 启动时一行 conn.load_extension('vec0') 加载 sqlite-vec。然后用 SQL 创建虚拟表 CREATE VIRTUAL TABLE chunks USING vec0(embedding float[1024])。插入数据 INSERT INTO chunks VALUES (?, ?)。查询 SELECT id, content FROM chunks WHERE embedding MATCH ? AND k = 10 ORDER BY distance。这种 SQL 化 让向量查询跟普通查询体验一致。

跟 metadata 过滤的协作。sqlite-vec 的查询可以加 WHERE 条件按 metadata 过滤。比如 WHERE department='finance' AND embedding MATCH ?。这种 filter+ANN 一体在某些场景下比 Milvus 用起来还方便。

社区和维护。sqlite-vec 当前主要由 Alex Garcia 维护。版本节奏不算快但稳定。chayuan-desktop 锁定具体版本，跟随上游升级。

未来 sqlite-vec 的方向。HNSW 索引、量化压缩、增量索引这些都在路线图。chayuan-desktop 跟着升级即可，业务代码不需要动。

国产化支持下的 sqlite-vec。loongarch64 平台需要从源码构建，chayuan-desktop 的龙芯发行包带预编译版。其他主流架构都直接用上游二进制。

WPS AI 插件 chayuan-wps 不直接接触 sqlite-vec，所有向量查询通过 sidecar。这种间接让 sqlite-vec 升级对加载项透明。

sqlite-vec 在 chayuan-desktop 的位置是 单机优先的默认选择。免费开源的AI软件 想做到 装到电脑里就能用，向量库不能依赖外部服务。sqlite-vec 是当前最契合这个定位的工具。
