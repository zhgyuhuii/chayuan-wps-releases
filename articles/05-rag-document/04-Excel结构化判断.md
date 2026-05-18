# 本地离线知识库的Excel处理 当结构化还是文档的判断

Excel 文件 (.xlsx) 是办公里仅次于 PDF 和 Word 的格式，但用 chayuan-desktop 桌面单机版处理 Excel 时有一个判断：把它当结构化数据还是当文档。这一篇讲清楚怎么判断。

先看两种处理方式的差别。

当结构化数据。chayuan-desktop 把 Excel 转成本地 SQLite 表，建立 src:* 类型的 KB（结构化）。问问题走 text2sql。回答能聚合（总和、平均、计数）、能过滤（按地区、按时间）、能排序（前 10、最后 5）。

当文档。chayuan-desktop 用 openpyxl 抽出 Excel 的所有 cell 文字，按行作为 Document 喂给 chunker，建 doc:* 类型的 KB。问问题走向量召回。回答能找到 包含某个词的行，但不能聚合或精确过滤。

判断依据：数据形态。

如果 Excel 是 标准表格 形态——第一行是表头（字段名），后面每行是一条记录，所有字段类型一致——这是 数据型 Excel，应该当结构化数据处理。比如 销售台账、客户清单、订单记录、财务流水。

如果 Excel 是 报告型 形态——多个表格混在一起、有标题段、有合并单元格做装饰、有图表、不像数据库表——这是 文档型 Excel，应该当文档处理。比如 月度报告、汇总分析、提案文档。

如果 Excel 是 混合 形态——某些 sheet 是数据某些 sheet 是报告——分别处理。把数据 sheet 单独导出建结构化 KB，把报告 sheet 当文档。

判断依据：用户期望的问答方式。

如果你期望问 这份资料里关于压力测试的内容是什么 这种 找出包含关键词的内容 问题，文档处理合适。

如果你期望问 上个月华南地区销售额是多少、按客户排序前 10 名 这种 聚合或精确查询 问题，结构化处理合适。

判断依据：数据量。

小数据（几十到几百行）。两种都行，结构化更精确，文档更灵活。

中数据（几百到几千行）。结构化优势明显。文档处理时每行一个 chunk，量太大检索精度下降。

大数据（几千到几万行）。必须结构化。文档处理在这个量级下不可用，每次问答检索几万 chunk 慢且不准。

chayuan-desktop 的 Excel 默认行为。当用户在 KB 创建对话框选择 Excel 文件时，chayuan-desktop 提供两种选项让用户选：作为表格（结构化）或 作为文档。如果 Excel 标准表格特征明显（第一行是表头、字段类型一致），默认选择 作为表格。

转换流程。结构化路径下，chayuan-desktop 用 pandas 读 Excel，把每个 sheet 转成 SQLite 表，表名按 sheet 名取，字段名按第一行表头。文档路径下，每行作为一个 Document 入库，metadata 包含 sheet 名 + 行号。

Excel 特殊处理。

合并单元格。结构化场景合并单元格让 SQL 解析复杂，chayuan-desktop 把合并 cell 在 SQL 表里展开成对应行（值复制到合并的所有行）。

公式。Excel 公式（=SUM(A1:A10)）chayuan-desktop 取计算结果而不是公式本身。如果 Excel 文件没保存计算结果（不常见），chayuan-desktop 跳过该 cell。

样式与图表。颜色、字体、单元格背景这些样式 chayuan-desktop 不保留。图表（chart）当前不做 OCR，跳过。

多 sheet。一份 Excel 可能多个 sheet。chayuan-desktop 默认每个 sheet 转一个 SQL 表，但用户可以在导入时选择只导某些 sheet。

性能。十万行的 Excel 转 SQLite 大概 10-30 秒（取决于列数和数据复杂度）。这个速度让 中等数据量 入库流畅。

国产化支持下的 Excel。WPS 生成的 .et 文件 chayuan-desktop 当前不直接支持，需要先转 .xlsx。WPS 的 .xlsx 跟 Microsoft 的 .xlsx 兼容性良好，chayuan-desktop 都能解析。

WPS AI 插件 chayuan-wps 在 WPS 表格里可以直接调起 chayuan-desktop 处理当前表格。加载项把表格内容（CSV 形式）发给 sidecar，sidecar 按结构化路径处理。这种 即时分析 是 chayuan-desktop 加 chayuan-wps 在数据场景下的特色。

Excel 当结构化还是文档这个判断是 chayuan-desktop 用户的 KB 选型核心问题之一。免费开源的AI软件 想让 数据问答 跟 文档问答 都做得好，这一步判断必须明确。chayuan-desktop 的双路径设计给用户选择空间，但默认的智能判定能覆盖大多数情况。
