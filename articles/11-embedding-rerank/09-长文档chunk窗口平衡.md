# 长文档嵌入 chunk 与窗口的平衡

chayuan-desktop 桌面单机版处理长文档时 chunk 大小和重叠窗口的平衡是工程关键。这一篇讲。

## chunk 大小的影响

chunk 太小（如 64 token）。每个 chunk 信息量少。检索能命中关键词但缺上下文。LLM 看到孤立片段难回答。

chunk 太大（如 2000 token）。包含太多无关内容。嵌入向量被稀释。命中精度降。

中等（256-512 token）。平衡。chayuan-desktop 默认 256 token。

## 重叠窗口的作用

相邻 chunk 之间留重叠（默认 64 token）。

```
chunk 1: token 1-256
chunk 2: token 193-448  # 重叠 64
chunk 3: token 385-640
```

理由。重要信息可能跨 chunk 边界。重叠保证关键句不被切断。

## 重叠的代价

重叠越多。chunk 数量越多。索引变大。检索可能多次返回相似 chunk。

chayuan-desktop 默认重叠 64 token（25%）。够多保留连续性又不过度膨胀。

## 长文档的特殊处理

100 页 PDF 切成 chunk。

按 256 token 切。约 1000 chunk。索引几十 MB。

bge-m3 嵌入 1000 chunk。CPU 约 2-3 分钟。GPU 约 30 秒。

可接受。

某些极长文档（万页报告）chunk 上万。chayuan-desktop 提示 文档过长，建议分批入库。

## 章节感知

长文档通常有章节结构（Word 标题、PDF 书签）。chayuan-desktop 优先按章节切。每个章节作为 chunk 集合。

```
第 1 章 → chunks 1-50
第 2 章 → chunks 51-120
```

检索时章节信息保留。引用气泡显示 来自第 3 章 5.2 节。

## chunk 元数据

每个 chunk 含。

text。chunk 文本。

embedding。1024 维向量。

source。文档名。

page。所在页码（PDF）。

section。章节路径。

position。在文档里的相对位置。

prev_chunk_id / next_chunk_id。前后 chunk 链接（便于扩展上下文）。

## 上下文扩展

LLM 答题时如果命中某 chunk，chayuan-desktop 自动取前后各 1 个 chunk 一起给 LLM。让 LLM 看到更完整上下文。

```
hit chunk: 第 5 段
context window: 第 4-6 段
```

避免 LLM 因为切片切断 而答不上。

## 不同文档类型的策略

合同。按条款切（每条款一 chunk）。

会议纪要。按议题切。

学术论文。按章节切。

代码文档。按函数切。

新闻文章。按段落切。

chayuan-desktop 内置这些识别规则。用户能自定义。

## chunk 长度的实测

不同 chunk 长度的检索精度对比（同一查询集 100 题）。

```
chunk 长度  命中率  精度
64 token    72%     65%
128 token   85%     78%
256 token   91%     85%
512 token   88%     82%
1024 token  79%     75%
```

256 token 最佳。chayuan-desktop 默认值就是这个。

## 用户自定义

chayuan-desktop 设置 - 知识库 - 切分策略。

```yaml
default:
  chunk_size: 256
  chunk_overlap: 64
  split_by: "section"  # section / paragraph / sentence / fixed
```

用户能调。某些场景（代码文档）用 split_by=function 更合适。

## 重新切分

切分策略变了。需要重建 chunk + embedding。chayuan-desktop 设置里有 重切分 按钮。

代价。1 万 chunk 重切 + 重嵌入 CPU 约 30 分钟。GPU 几分钟。

## 国产化场景

党政军长文档（政策文件、报告）多。chayuan-desktop 的章节感知切分让 政策文件第三章第二节 这种引用粒度自然。

## chayuan-server 的对应

chayuan-server 模式下切分在服务器跑。chayuan-desktop 单机版相同算法。一致性保证。

## WPS 加载项

chayuan-wps 在 WPS 里看到的引用气泡含 chunk 元数据（章节、页码）。WPS 用户能直接定位。

## 总结

长文档嵌入的 chunk 与窗口平衡是 chayuan-desktop 在 RAG 精度上的工程基础。免费开源的AI软件 默认值合理 + 用户能调让 长文档 RAG 在工程上稳。
