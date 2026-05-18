# 让 Claude 写故障 Runbook

chayuan-desktop 桌面单机版的故障 Runbook 由 Claude 协助。这一篇讲。

## Runbook 是什么

故障应对手册。

某种故障发生时按 Runbook 一步步处理。

让运维 / 用户不慌。能快速恢复。

## 需要 Runbook 的故障

故障一：sidecar 崩溃。

故障二：模型加载失败。

故障三：sqlite-vec 索引损坏。

故障四：网络断开。

故障五：磁盘满。

故障六：升级失败。

故障七：API Key 失效。

故障八：被刷算力（异常账单）。

每种都需要 Runbook。

## Claude 写 Runbook

提示。

```
为 chayuan-desktop 的 sqlite-vec 索引损坏故障写 Runbook。
```

Claude 输出。

```markdown
# Runbook：sqlite-vec 索引损坏

## 症状
- chayuan-desktop 启动报错 "database is locked" 或 "database disk image is malformed"
- KB 检索返回空或错误

## 紧急止损（5 分钟内）

第一步：保留现场。
```bash
mv ~/.chayuan/data/chunks.db ~/.chayuan/data/chunks.db.backup
```

第二步：停止 chayuan-desktop（避免进一步写入）。

## 诊断（10 分钟）

第三步：尝试用 sqlite3 修复。
```bash
sqlite3 ~/.chayuan/data/chunks.db.backup "PRAGMA integrity_check;"
```

如果返回 ok：数据库还行。

如果返回 errors：损坏。

第四步：尝试 dump 数据。
```bash
sqlite3 ~/.chayuan/data/chunks.db.backup ".dump" > dump.sql
```

成功能恢复部分数据。

## 恢复（30 分钟）

方案一：从 chayuan-desktop 备份恢复。
```
chayuan-desktop 设置 - 备份 - 恢复
[选择最近 backup]
[恢复]
```

方案二：从 dump.sql 恢复。
```bash
rm ~/.chayuan/data/chunks.db
sqlite3 ~/.chayuan/data/chunks.db < dump.sql
```

方案三：完全重建（最差情况）。
```
重新建 KB 把所有原始文档重新入库。
```

## 验证
- chayuan-desktop 启动成功。
- KB 检索返回结果。
- 跑 chayuan-desktop doctor 全 ✓。

## 预防
- 启用每天自动备份。
- 定期跑 chayuan-desktop doctor。
- 不强制断电关 chayuan-desktop。
```

完整 Runbook。

## Runbook 的更新

某新故障类型出现。Claude 帮加 Runbook。

某些故障修复后 Claude 更新现有 Runbook。

```
sqlite-vec 升级到 1.0 解决了某些损坏问题。
更新 Runbook 提及。
```

## CI 集成

CI 跑 chaos test 模拟故障。

按 Runbook 自动恢复。

验证 Runbook 步骤可行。

避免 Runbook 过时。

## 用户视角

某些 Runbook 用户能自己跑。

某些（深度修复）需要找 chayuan support。

Runbook 区分。

```
[用户能做的]
- 备份恢复
- 重启服务

[需要支持]
- sqlite 深度修复
- 数据恢复（无备份场景）
```

## 国产化场景

党政军场景的运维有 Runbook 文化。chayuan-desktop 的 Runbook 满足运维需要。

某些场景需要中英双语 Runbook。Claude 帮翻译。

## chayuan-server 的对应

chayuan-server 多用户场景下 Runbook 更复杂（影响多人）。chayuan-desktop 的 Runbook 经验复用。

## Runbook 的价值

新员工 / 新用户碰故障时按 Runbook 处理。不慌。

缩短 MTTR（平均修复时间）。

减少对资深员工的依赖。

## 总结

让 Claude 写故障 Runbook 是 chayuan-desktop 在运营成熟度上的工程实践。免费开源的AI软件 让 故障应对 标准化。Claude 的全面覆盖 + 步骤清晰 + 持续更新让 Runbook 是真用得上的工具。
