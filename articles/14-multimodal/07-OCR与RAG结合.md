# OCR 不只是工具 与 RAG 的天然结合

chayuan-desktop 桌面单机版的 OCR 跟 RAG 天然结合。这一篇讲。

## OCR 不只是工具

OCR 单独看是 把图变文字 的工具。但跟 RAG 结合后是 让扫描件能被 AI 检索 的入口。

## 入库链路

完整链路。

第一步：上传扫描件 PDF 或图片。

第二步：chayuan-desktop 调 RapidOCR 提取文字。

第三步：清洗 + chunk 切分（前面文章讲）。

第四步：bge-m3 嵌入。

第五步：sqlite-vec 存索引。

第六步：检索时 chunk 跟原图保留对应关系。

## 引用回原图

用户问问题命中 OCR chunk。引用气泡含。

OCR 后的文字（chunk 内容）。

原图的页码 + bbox（在原图中的位置）。

点引用气泡跳转。

```
点击 → 打开原 PDF 第 5 页 → 高亮 bbox 区域
```

让用户验证 OCR 是否准。

## 区分 OCR 和原生

chunk 元数据含 source 字段。

```
"source": "ocr"
"source": "native"  # 原生文字层
```

UI 区分展示。OCR chunk 引用气泡多个 [OCR] 标识。

## OCR 误差的标识

OCR 有置信度（0-1）。chunk 元数据存。

低置信度 chunk（< 0.7）UI 标 OCR 质量不确定。

LLM 答题时如果只命中低置信度 chunk，回答里加 "（OCR 内容可能有误差）" 提示。

## 修正后的二次入库

用户在 KB 详情页编辑某 chunk（修正 OCR 错字）。chayuan-desktop。

更新 chunk 文本。

重新嵌入。

更新索引。

旧引用记录保留（指向修正前内容），新引用用修正后。

## 表格的特殊 RAG

OCR 出的表格按行 chunk 化。每行 chunk 嵌入时拼上表头作为上下文（前面文章讲）。

LLM 答题能精确引用表格的某行。

```
回答：根据 [chunk_xxx]，张三财务部 2020-01-15 入职。
点击 chunk_xxx → 跳转到原扫描件，高亮该行。
```

## 公式的 RAG

LaTeX-OCR 出的公式作为 LaTeX 字符串入库。

LLM 答题时引用公式。回答里能渲染 LaTeX（chayuan-desktop UI 用 KaTeX）。

```
质能方程是：
$$ E = mc^2 $$
来源：[chunk_yyy] - 物理学第 3 章
```

## 多语种 OCR

某些扫描件英文中文混合。chayuan-desktop 的 OCR 都识别。

bge-m3 多语种嵌入。中文 query 能命中英文 OCR chunk（跨语种）。

## 国产化场景

党政军纸质档案数字化场景。chayuan-desktop 的 OCR + RAG 是核心能力。员工扫描档案后 AI 能查。

某些场景档案敏感不能上云。chayuan-desktop 全本地（OCR + 嵌入 + 推理）符合。

## chayuan-server 的对应

chayuan-server 部署在服务器跑 OCR + 嵌入。chayuan-desktop 单机本地。两者协议一致。

## WPS 加载项

chayuan-wps 在 WPS 里能直接拖入扫描件 PDF。chayuan-desktop 跑 OCR + RAG 入库。WPS 用户感知就是 拖入扫描件就能问问题。

## 总结

OCR 与 RAG 的天然结合是 chayuan-desktop 在数据完整覆盖上的工程能力。免费开源的AI软件 不只处理原生文档，扫描件、纸质档案都能用。chayuan-desktop 的 OCR + 切分 + 嵌入 + 引用回原图链路完整。
