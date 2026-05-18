# 嵌入模型与 OCR 的协同 图像转文本后的二次嵌入

chayuan-desktop 桌面单机版的 OCR 内容嵌入有特别的协同流程。这一篇讲。

## 协同的链路

完整链路。

第一步。用户上传扫描件 PDF 或图像。

第二步。chayuan-desktop 调 RapidOCR 提取文字。

第三步。文字清洗（错别字纠正、合并断行）。

第四步。chunk 切分。

第五步。bge-m3 嵌入每个 chunk。

第六步。存入 sqlite-vec。

第七步。用户问问题，bge-m3 嵌入查询，向量库查最近邻。

第八步。返回 chunk + 引用回原图。

## OCR 误差对嵌入的影响

OCR 误差主要是。

误识别。市 → 巿。

漏识别。某字看不清直接没识别。

多识别。同一字识别两次（图像有阴影）。

每种都让嵌入向量偏离原意。但 bge-m3 对小量误差有容忍（语义嵌入）。1-2 个错字 chunk 嵌入仍接近正确语义。

## 二次嵌入策略

某些场景需要二次嵌入。

策略一。OCR 完后第一次嵌入入库。

策略二。后续用户修正 OCR 错误（在 KB 详情页编辑 chunk）。chayuan-desktop 重新嵌入。

策略三。chayuan-desktop 在后台用本地 LLM 跑 OCR 校对（基于上下文识别错字），自动修正后重新嵌入。

第三种是 chayuan-desktop 的高级特性，路线图。

## 不同 OCR 引擎的兼容

chayuan-desktop 默认 RapidOCR。某些场景用户希望接入其他 OCR。

接入二：PaddleOCR 完整版。比 RapidOCR 准但慢。

接入三：Tesseract。多语言支持好但中文一般。

接入四：商业云 OCR（百度、阿里、腾讯）。最准但要联网。

无论用哪个 OCR 后续嵌入流程一样。chayuan-desktop 对接 OCR 引擎有插件机制。

## 嵌入 vs 原图的对应

OCR 出的 chunk 跟原图区域有对应。每个 chunk 含。

```
{
  "text": "...",
  "embedding": [...],
  "source_image": "/path/page_5.png",
  "bbox": [100, 200, 800, 400]  # 原图中的位置
}
```

用户点引用气泡能跳到原图对应位置（高亮 bbox 区域）。

## 多模态嵌入的可能

某些情况 OCR 不够好。比如图表、复杂版式。

可以直接用多模态模型（CLIP、Qwen-VL-Embed）嵌入图像本身。不走 OCR 路径。

```
image → multimodal_embed → vector
```

跟文本向量在同一空间（CLIP 训练就是文本 + 图像对齐）。检索时 query 文本嵌入也在同一空间。

chayuan-desktop 的多模态嵌入是可选模块。默认走 OCR + 文本嵌入。多模态需要更大模型（CLIP-large 约 2GB）。

## 表格的特殊处理

表格 OCR 出来后。

每行一个 chunk（前面文章讲过）。

每个 chunk 文本带上表格上下文（表头）。

例：

```
chunk 1: "员工档案表 | 张三 | 财务部 | 2020-01-15"
chunk 2: "员工档案表 | 李四 | 法务部 | 2021-03-20"
```

每个 chunk 嵌入时上下文足够丰富。

## 公式的特殊处理

公式 OCR 用 LaTeX-OCR 转 LaTeX 字符串。LaTeX 字符串嵌入。LLM 也能基于 LaTeX 回答。

```
$E = mc^2$
```

bge-m3 看到 LaTeX 跟看到自然语言"质能方程"距离远。chayuan-desktop 在 chunk 文本里既保留 LaTeX 也加自然语言描述。

```
chunk: "$E = mc^2$ - 质能方程"
```

嵌入向量包含两种表达。检索 公式 或 质能方程 都能命中。

## 国产化场景

党政军纸质档案数字化（OCR 入库）是大场景。chayuan-desktop 的 RapidOCR + bge-m3 全国产化路径。员工电脑上完整离线跑通。

## chayuan-server 的对应

chayuan-server 模式下 OCR 在服务器（多用户共享 GPU 加速）。chayuan-desktop 单机本地跑。两者协议一致。

## WPS 加载项

chayuan-wps 在 WPS 里能直接拖入扫描件 PDF。chayuan-wps 调 chayuan-desktop OCR + 嵌入入库。WPS 用户感知就是 拖入扫描件就能问问题。

## 总结

嵌入与 OCR 的协同是 chayuan-desktop 在多源数据完整支持上的工程链路。免费开源的AI软件 不只处理原生文档，也覆盖纸质扫描件。chayuan-desktop 的 OCR + 清洗 + 拼接上下文 + 二次嵌入让 扫描件 RAG 在工程上完整。
