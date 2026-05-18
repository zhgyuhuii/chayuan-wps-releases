# 把WPS表格当结构化私库 跨产品的检索

chayuan-desktop 桌面单机版可以把 WPS 表格（xlsx 或 et 转 xlsx）作为 office:* 命名空间下的结构化私库。这一篇讲。

## 场景

员工的工作笔记里有大量 WPS 表格：客户跟进表、项目进度表、个人 OKR 表。这些数据本质是结构化的，但是 私有 不该让别人看。

## 双重定位

xlsx 文件既能当文档库（doc:* 走文档 RAG）也能当结构化库（office:zhangsan:trackers 走 text2sql）。哪种合适看用法。

数据问答场景。问 我跟进的客户里逾期的有几个、本月 OKR 完成度多少。这种聚合走结构化。

文档检索场景。问 关于客户 X 的所有跟进记录。这种走文档 RAG 也行。

## 结构化路径的实操

第一步：把 WPS 表格另存为 xlsx 标准格式。

第二步：chayuan-desktop 设置 - 知识库 - 新建 - 类型 结构化数据 - 数据源 上传 xlsx - 命名空间 office:zhangsan:trackers。

第三步：chayuan-desktop 用 openpyxl 读 xlsx，转成本地 SQLite 表。每个 sheet 一个表。第一行作表头。

第四步：自动识别字段类型。日期列识别为 date。数字列识别为 numeric。文本列识别为 string。

第五步：建库完成。LLM 走 text2sql。

## 实际查询

用户问 我跟进的客户里这个月还没回访的有几个。

chayuan-desktop 走 router 识别意图：structured_aggregate。

LLM 生成 SQL：SELECT COUNT(*) FROM trackers WHERE 上次回访日期 < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)。

AST 校验通过，执行，返回数字。

LLM 总结：你跟进的客户里有 5 个最近一个月没回访。

## 跟纯 doc:* 的差别

doc:* 把每行作为 chunk 入库。问 哪些客户逾期，能命中包含 逾期 字样的行，但不会聚合数。

结构化能聚合、过滤、排序。

## 增量更新

WPS 表格如果频繁更新（每天加新行），folder-sync 监听文件变化，重新入库。不过 SQL 表的增量更新比文档库复杂（要 truncate 重灌或者 diff 增量），chayuan-desktop 当前是 truncate 重灌。

## 跨产品的检索

某些场景。员工的客户跟进表在 WPS 表格，但销售台账在 ERP 系统。chayuan-desktop 同时接两边。问 我跟进的客户里有 ERP 显示已下单的有几个，跨 KB 联合查询。

跨 KB 的 SQL 涉及不同数据库，需要应用层 JOIN。chayuan-desktop 的 router 识别这种跨源后让 LLM 分两次查询，合并结果。

## 私库的特别保护

office:zhangsan:trackers 默认只对 zhangsan 可见。其他用户即使知道这个 KB 名也访问不到。

跨电脑同步。如果员工有两台电脑，trackers 数据要 export/import 同步，或者 WPS 表格本身放云盘 + folder-sync。

## 国产化场景

WPS 表格在政企办公里大量使用。chayuan-desktop 把 WPS 表格当结构化 KB 让 自己的工作数据 能用 AI 自助查询，比交给 IT 写 SQL 高效。

## WPS 加载项的协同

chayuan-wps 在 WPS 表格里直接调起察元 AI（如果加载项支持表格）。问表格相关问题，加载项调 sidecar 跑结构化查询。

## 总结

WPS 表格当结构化私库是 chayuan-desktop 在 个人数据自助查询 的实际落地。免费开源的AI软件 让员工自己电脑上的工作数据能用 AI 查，而不是只能问 IT。chayuan-desktop 在这一面的支持让生产力提升明显。
