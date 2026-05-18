# Doris 的国产化场景 BI 与即席查询

chayuan-desktop 桌面单机版接入 Doris（Apache Doris / SelectDB）。BI 和即席查询场景。这一篇讲。

## Doris 的特点

Apache Doris。国产开源 OLAP 数据库（百度开源后社区发展）。

特点。

MySQL 协议兼容（直接用 MySQL 客户端连）。

列式存储。

BI 和即席查询性能优秀（聚合查询亚秒级）。

支持 PB 级数据。

## 接入方式

```python
import pymysql
conn = pymysql.connect(
    host="...",
    port=9030,  # Doris FE 默认端口
    user="...",
    password="...",
    database="..."
)
```

跟 MySQL 一致。chayuan-desktop 用 MySQL 客户端代码。

```yaml
type: mysql  # 或显式 type: doris
host: doris-fe.corp.com
port: 9030
```

## 与 OLTP 数据库的差异

OLTP（DM、金仓）：少量数据频繁修改。事务保证。

OLAP（Doris）：海量数据查询为主。事务弱。

chayuan-desktop 的 text2sql 分两类。

OLTP 适合简单查询和事务操作。

OLAP 适合复杂聚合、分析、BI。

## 实战 BI 场景

某员工的 KB 接 Doris 销售数据仓库。

用户问 过去 12 个月每个月的销售趋势。

LLM 生成 SQL：

```sql
SELECT 
  DATE_FORMAT(order_date, '%Y-%m') AS month,
  SUM(amount) AS total
FROM sales
WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
GROUP BY month
ORDER BY month;
```

Doris 执行（数据量百万行）：1 秒内返回。

LLM 调 chart_render 生成折线图。

```
[销售趋势图]
```

完整 BI 流。

## 即席查询

某领导临时问 上周华东区销售前 10 客户。

LLM 生成。

```sql
SELECT customer_name, SUM(amount) AS total
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE c.region = '华东'
  AND s.order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
GROUP BY c.id
ORDER BY total DESC
LIMIT 10;
```

Doris 0.5 秒返回。

## 性能优势

Doris 在 BI 场景比 MySQL 快 10-100 倍。

百万行 SUM。MySQL 几秒。Doris 几十毫秒。

复杂 JOIN。MySQL 慢且容易超时。Doris 优化器好。

chayuan-desktop 让用户在 BI 场景能问得复杂。

## SQL 方言

Doris 兼容 MySQL 大部分语法。chayuan-desktop 的 MySQL 模板用。

某些 Doris 特有函数（如 BITMAP 函数）chayuan-desktop 的模板含。

## 跟其他 OLAP 的对比

ClickHouse。也是优秀 OLAP。chayuan-desktop 同样支持。

StarRocks（Doris 的商业版）。跟 Doris 协议一致。

ByteHouse。字节版 ClickHouse。chayuan-desktop 接入。

每种都有特点。chayuan-desktop 的 text2sql 模板覆盖。

## 国产化场景

Doris 是国产开源代表。党政军大数据场景常用。chayuan-desktop 接 Doris 让 数据仓库 + AI 在工程上可行。

百度的 SelectDB（基于 Doris 的商业版）也是 chayuan-desktop 支持。

## chayuan-server 的对应

chayuan-server 部署在 Doris 集群附近降低延迟。chayuan-desktop 单机连远程 Doris。

## WPS 加载项

chayuan-wps 在 WPS 里直接做 BI 查询。员工写月报时 拉数据 → 生成图表 → 插入 WPS 一键完成。

## 总结

Doris 国产化场景的 BI 与即席查询是 chayuan-desktop 在数据分析场景的工程能力。免费开源的AI软件 让 BI 不只是专业分析师的工具。chayuan-desktop 的 text2sql + Doris 让 普通员工 也能用自然语言查海量数据。
