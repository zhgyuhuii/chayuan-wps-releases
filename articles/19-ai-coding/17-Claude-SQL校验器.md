# 让 Claude 写 SQL 校验器 AST 走查的实战

chayuan-desktop 桌面单机版的 SQL 校验器（防止 LLM 生成危险 SQL）由 Claude 协助。这一篇讲。

## 校验器的需求

LLM 生成 SQL。可能。

DROP TABLE。

DELETE FROM。

UPDATE 大量行。

跨表敏感操作。

每种都是危险。chayuan-desktop 校验后才执行。

## 实现方案

方案一：白名单。只允许 SELECT 类。

方案二：AST 解析。把 SQL parse 成抽象语法树。检查节点类型。

chayuan-desktop 用方案二。更精细。

## Claude 写 AST walker

提示 Claude。

```
用 sqlglot 解析 SQL。检查：
- 必须是 SELECT 或 WITH ... SELECT。
- 不能含 INSERT/UPDATE/DELETE/DROP/TRUNCATE/ALTER/CREATE。
- 不能含子查询里的写操作。
- 不能含 SET 命令。
帮我写一个 validator。
```

Claude 输出。

```python
import sqlglot
from sqlglot import exp

def validate_readonly_sql(sql: str) -> tuple[bool, str | None]:
    """校验 SQL 只读。返回 (是否通过, 错误原因)"""
    try:
        parsed = sqlglot.parse_one(sql)
    except Exception as e:
        return False, f"SQL 解析失败：{e}"
    
    # 顶层必须是 SELECT 或 With
    if not isinstance(parsed, (exp.Select, exp.With)):
        return False, f"顶层语句必须是 SELECT，当前：{type(parsed).__name__}"
    
    # 遍历所有节点检查
    for node in parsed.walk():
        if isinstance(node, (exp.Insert, exp.Update, exp.Delete, exp.Drop, ...)):
            return False, f"含禁止操作：{type(node).__name__}"
    
    return True, None
```

清晰严谨。

## 测试覆盖

Claude 帮写测试。

```python
def test_select_passes():
    ok, _ = validate_readonly_sql("SELECT * FROM users")
    assert ok

def test_insert_blocked():
    ok, reason = validate_readonly_sql("INSERT INTO users VALUES (...)")
    assert not ok
    assert "Insert" in reason

def test_subquery_with_delete_blocked():
    sql = "SELECT * FROM (DELETE FROM users RETURNING *)"
    ok, _ = validate_readonly_sql(sql)
    assert not ok

# 覆盖各种边界
```

## SQL 注入的防护

LLM 生成 SQL 时如果用户输入直接拼接可能注入。

```
LLM 生成：SELECT * FROM users WHERE name = '<user_input>'
用户输入：x'; DROP TABLE users; --
最终 SQL: SELECT * FROM users WHERE name = 'x'; DROP TABLE users; --'
```

chayuan-desktop 的校验器接到后发现 DROP 拒绝。

但更好的防护：参数化查询。

Claude 建议。

```
不要把 user input 拼到 SQL。
用参数化：
  SELECT * FROM users WHERE name = ?
  params: [user_input]

参数永远不会被解释为 SQL。

LLM 应该生成参数化 SQL，而不是直接 SQL。
```

更安全。

## SQL shape 校验

某些场景要求 SQL 必须是聚合（如 question 是 几个）。

```python
def is_aggregate(parsed):
    has_count = any(isinstance(n, exp.Count) for n in parsed.walk())
    has_sum = any(isinstance(n, exp.Sum) for n in parsed.walk())
    return has_count or has_sum or ...
```

Claude 帮写各种 shape 校验。

## 表 / 列白名单

只允许查特定表。

```python
ALLOWED_TABLES = {'users', 'orders', 'products'}

def validate_tables(parsed):
    tables = [t.name for t in parsed.find_all(exp.Table)]
    for t in tables:
        if t not in ALLOWED_TABLES:
            return False, f"不允许查表 {t}"
    return True, None
```

防止 LLM 不小心查到敏感表（如 audit_log）。

## 跨方言

chayuan-desktop 支持 17 种 SQL 方言。

sqlglot 支持各方言解析。Claude 帮处理方言差异。

```python
parsed = sqlglot.parse_one(sql, dialect='dm')  # 达梦
```

## 国产化场景

党政军场景 SQL 校验严格。chayuan-desktop 的校验器 + 白名单 + 参数化查询满足合规。

## chayuan-server 的对应

chayuan-server 用同样 SQL 校验器。chayuan-desktop 单机经验复用。

## 总结

让 Claude 写 SQL 校验器是 chayuan-desktop 在数据安全上的工程实战。免费开源的AI软件 让 SQL 安全 不靠运气。Claude 的 AST 解析 + 测试覆盖 + 注入防护 + 跨方言让 SQL 校验器严谨可信。
