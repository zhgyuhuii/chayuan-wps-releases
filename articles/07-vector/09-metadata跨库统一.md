# metadata payload的字段约定 跨库的统一字段

chayuan-desktop 桌面单机版接多种向量库时面对一个挑战：每家库的 metadata payload 字段命名不一致。如果不统一，前端展示和检索过滤都要按每个库写不同代码。这一篇讲 chayuan-desktop 的 metadata 统一策略。

先看不同库的字段约定差异。

Milvus 用户传什么字段就什么字段。没强制约定。

Chroma 推荐用 metadata 字典存键值，没强制 schema。

Qdrant 的 payload 是 JSON，灵活。

Elasticsearch 跟 _source 字段，schema 由 mapping 定义。

PG pgvector 直接用 SQL 表的列。

不统一的后果。chayuan-desktop 接 Milvus 时知道字段叫 source_file，接 Qdrant 时叫 doc_path，接 ES 时叫 file_url。前端展示要写多个 if 分支按库类型取字段。

chayuan-desktop 的统一字段约定。建议用户在外部库建 collection 时遵循一份共通约定。

约定一：source 字段。表示原始来源标识。可以是文件路径、URL、数据库主键。命名 source 或 source_path。

约定二：title 字段。chunk 的标题或主题。命名 title。

约定三：content 字段。chunk 的实际文本内容。命名 content 或 text。

约定四：created_at 字段。chunk 创建时间。

约定五：modified_at 字段。最后修改时间。

约定六：page 字段（如有）。原文档页码。

约定七：section 字段（如有）。章节或段落标识。

约定八：tags 字段（如有）。标签列表。

约定九：confidentiality 字段（如有）。密级。

约定十：custom_meta 字段。其他业务字段，作为 dict。

如果用户没遵循。chayuan-desktop 提供 字段映射 配置。在创建外部源时让用户填映射规则：source → source_file、content → chunk_text 等。chayuan-desktop 内部按映射访问字段。这种 显式映射 让现有数据不需要改字段名也能接入。

具体配置示例。Milvus collection 字段：fid（主键）、ft（文本内容）、fp（路径）、emb（embedding）。chayuan-desktop 配置：

  source 字段：fp。
  content 字段：ft。
  embedding 字段：emb。
  custom_meta 字段：所有其他字段。

chayuan-desktop 内部把 fp 当 source，ft 当 content。前端按统一字段渲染。

引用展示的统一。基于统一字段约定，chayuan-desktop 的引用气泡按 source 显示来源、按 content 显示预览、按 created_at 显示时间。这种统一让用户体验一致。

filter 表达式的统一。chayuan-desktop 的查询 API 接受统一 filter 字段（content_contains、source_starts_with、created_at_gte 等）。每个外部 adapter 内部翻译成对应库的查询语言。用户写 filter 表达式不用懂每家库的语法。

统一字段的局限。某些库的特殊字段（Milvus 的 partition_key、Qdrant 的 group_id）chayuan-desktop 不抽象。用户需要这些特性时直接配置原始字段。

实战建议。给团队建外部向量库时定一份字段命名规范，遵循 chayuan-desktop 的约定。这样后续接入和团队协作成本低。

国产化支持下的字段约定。国产向量库（RT、Relyt）字段命名跟 Milvus 类似，没有特殊约束。chayuan-desktop 的统一字段约定通用。

实际测试效果。chayuan-desktop 团队用一份共通的字段约定接 6 种不同向量库（Milvus、Qdrant、Chroma、ES、pgvector、sqlite-vec）。前端展示完全一致，filter 表达式跨库通用。这种统一让 KB 切换 几乎零成本。

WPS AI 插件 chayuan-wps 不感知 metadata 字段差异。在 WPS 里看到的引用气泡按统一字段展示。

metadata 跨库统一字段是 chayuan-desktop 多源抽象的细节工作。免费开源的AI软件 给用户的不只是 接得上 而是 接得顺。chayuan-desktop 在字段约定上的设计让多源 RAG 真正可用。
