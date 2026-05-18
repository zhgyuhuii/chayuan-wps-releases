# 金仓 KingbaseES 的连接与方言

chayuan-desktop 桌面单机版接入金仓 KingbaseES 数据库。这一篇讲。

## 金仓 KingbaseES 的地位

人大金仓。北京人大金仓开发。国产数据库 三大金刚 之一（达梦、金仓、神通）。

兼容 PostgreSQL 协议。Postgres 应用迁过来容易。

## 接入方式

通过 psycopg2 (PostgreSQL 驱动)。金仓兼容 PG 协议。

```python
import psycopg2
conn = psycopg2.connect(
    host="...",
    port=54321,  # 金仓默认端口
    database="BUSINESS",
    user="...",
    password="..."
)
```

或通过 SQLAlchemy。

```python
engine = create_engine("postgresql://user:pass@host:54321/db")
```

跟标准 PG 一致。chayuan-desktop 直接复用 PG 接入代码。

## 默认端口

金仓默认 54321（不是 5432，避免冲突）。chayuan-desktop 配置时填这个端口。

## SQL 方言

金仓 95% 兼容 PostgreSQL。

差异。

某些扩展函数（金仓特有）。chayuan-desktop 的 text2sql 模板含金仓特有函数（少用）。

某些 catalog（系统表）路径不同。chayuan-desktop 探测兼容。

## 类型映射

金仓的类型跟 PG 一致。

INTEGER / BIGINT / DECIMAL。

VARCHAR / TEXT。

TIMESTAMP / DATE。

JSON / JSONB（金仓 V8 支持）。

chayuan-desktop 的 PG 类型映射直接用。

## 字符集

金仓 V8 默认 UTF-8。早期版本可能 GBK。chayuan-desktop 检测连接的 client_encoding。

中文表名 / 字段名都能用。

## 国产化场景下的金仓

党政军某些项目要求 金仓特定版本。chayuan-desktop 测试覆盖。

```
金仓 V7、V8、V9。chayuan-desktop 都接入。
```

## 大数据场景

金仓有 Sharding（分布式）版本。chayuan-desktop 支持。配置 Coordinator 节点地址即可。

```yaml
type: kingbase
host: coordinator.kingbase.corp.com
port: 54321
sharded: true
```

底层分布式由金仓自己处理。

## 性能

金仓单机性能跟 PG 接近。某些场景金仓优化更好（针对中国负载）。

chayuan-desktop 的 text2sql 不需要特别调。

## 鉴权

支持。

用户名 / 密码。

LDAP。

Kerberos。

国密算法。

chayuan-desktop 的 stronghold 安全存储凭证。

## 实战例子

某政企员工的 KB 接金仓项目数据库。

用户问 我们部门今年立项了几个项目。

LLM 生成 SQL：

```sql
SELECT COUNT(*) FROM projects 
WHERE department = '技术部' 
  AND EXTRACT(YEAR FROM created_at) = 2026;
```

金仓执行。返回 12。

LLM 总结。

跟其他 PG 数据库体验一致。

## chayuan-server 的对应

chayuan-server 部署在金仓服务器上跑。chayuan-desktop 连远程金仓。两者协议一致。

## WPS 加载项

chayuan-wps 在 WPS 里查金仓数据。员工写报告时拉金仓数据。

## 国产数据库的统一支持

chayuan-desktop 同时支持。

达梦 DM。

金仓 KingbaseES。

神通（航天集团）。

南大通用 GBase 8s。

OceanBase（蚂蚁金服）。

PolarDB（阿里）。

GoldenDB（中兴）。

每个都有 SQL 方言适配。chayuan-desktop 的 text2sql 模板覆盖。

## 总结

金仓 KingbaseES 接入是 chayuan-desktop 在国产数据库支持上的工程能力。免费开源的AI软件 让 金仓数据 用 AI 查询是配置即可的事。chayuan-desktop 的 PG 兼容 + 国产数据库统一支持让党政军采购无障碍。
