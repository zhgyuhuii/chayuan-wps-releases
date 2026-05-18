# OCR 解析后的嵌入策略 表格图像怎么处理

chayuan-desktop 桌面单机版的 OCR 解析后内容嵌入有特殊策略。这一篇讲。

## OCR 内容的特点

OCR 出的文本不像原生 docx。

特点一：可能识别错误。某些字识别成形似字（"市" 识别成 "巿"）。

特点二：版式信息丢失。粗体、斜体、缩进丢了。

特点三：表格结构破坏。表格被识别成行连续的字串。

特点四：阅读顺序可能错乱。多列布局识别成单列。

每个特点都影响嵌入质量。

## 嵌入前的清洗

清洗一：错别字纠正。chayuan-desktop 调本地 LLM（Qwen-1.8B）做轻量纠错。基于上下文修明显错别字。

清洗二：合并断行。OCR 经常把连续句子断行。chayuan-desktop 用启发式合并。如果上一行没标点结尾，跟下一行合并。

清洗三：去除噪音字符。OCR 有时识别出乱码。chayuan-desktop 检测连续 3 个不可解释字符就过滤。

## chunk 切分

OCR 文本切 chunk 跟 docx 略不同。

docx 按段落切。OCR 没有清晰段落。chayuan-desktop 按 token 数 + 句子边界切。每 chunk 约 256 token。

切分时如果发现某 chunk 是 表格行 形式（多列对齐），单独处理。

## 表格的处理

OCR 出的表格被识别成行。chayuan-desktop 用 PaddleOCR 的表格结构识别（pp-structure）。

第一步。检测图像中是否有表格（CV 模型）。

第二步。识别表格结构（行列）。

第三步。按结构提取每个单元格内容。

第四步。重建表格的 markdown 形式。

```
| 姓名 | 部门 | 入职日期 |
|---|---|---|
| 张三 | 财务 | 2020-01-15 |
```

第五步。每行作为一个 chunk 嵌入（保留 markdown 表格上下文）。

LLM 答题时能引用某行 = 表格的某条记录。

## 图像中的图表

OCR 识别图表（柱状图、折线图）麻烦。chayuan-desktop 当前的策略。

策略一：调多模态模型（Qwen-VL、GPT-4V）让模型描述图表。生成自然语言描述。

```
图表描述：2024 年 Q1-Q4 销售额分别为 100 万、120 万、150 万、180 万。整体上升趋势。
```

策略二：把图表描述作为 chunk 嵌入。

策略三：保留原图作为引用。如果用户点击想看原图，跳到 PDF 该页。

代价。多模态模型贵。chayuan-desktop 默认只对用户标记 重要 的扫描件调多模态。

## 公式的处理

数学公式 OCR 出来一团乱码。chayuan-desktop 集成 LaTeX-OCR 模型（路线图）。

识别后转 LaTeX。$\sum_{i=1}^{n} x_i$。

嵌入 LaTeX 字符串。LLM 能基于 LaTeX 回答公式相关问题。

## 嵌入质量的对比

| 内容来源 | 嵌入质量（相对） |
|---|---|
| docx 原生文本 | 100% |
| PDF 文字层 | 95% |
| OCR 文字（清洗后） | 85% |
| OCR 文字（未清洗） | 70% |
| 图表描述（Qwen-VL） | 75% |

OCR 内容嵌入质量比原生略低。能用但不如原生。

## 检索时的提示

OCR 来源的 chunk 在引用气泡上标 [OCR] 标识。LLM 在回答里如果引用 OCR chunk，提示 "（OCR 内容可能有误差）"。

让用户知情。

## 重排的影响

OCR chunk 在重排时可能因为有错别字略低于原生 chunk。不公平。

chayuan-desktop 的策略。同 query 同信息，OCR chunk 给一个小幅 boost（比如 +5% 分数）。补偿因为 OCR 错误带来的损失。

## 国产化场景

党政军大量纸质档案需要 OCR 入库。chayuan-desktop 的 OCR 嵌入策略覆盖这种场景。等保数字化转型项目常见。

## chayuan-server 的对应

chayuan-server 模式下 OCR 处理在服务器端，多用户共享。chayuan-desktop 单机各自跑。

## WPS 加载项

chayuan-wps 在 WPS 里如果用户拖入扫描件，chayuan-desktop 跑 OCR + 嵌入完整流程。WPS 用户感知就是 拖入扫描件就能问问题。

## 总结

OCR 后嵌入策略是 chayuan-desktop 在多源数据处理上的工程细节。免费开源的AI软件 不只处理结构化文档，也覆盖扫描件、表格、图表。chayuan-desktop 的清洗 + 表格结构识别 + 图表多模态 + 标注让 OCR 内容在 RAG 里能用。
