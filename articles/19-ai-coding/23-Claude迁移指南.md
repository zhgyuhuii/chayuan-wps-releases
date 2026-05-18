# 让 Claude 写迁移指南 老用户的升级路径

chayuan-desktop 桌面单机版的版本迁移指南由 Claude 协助。这一篇讲。

## 迁移指南的需求

某些版本升级有 breaking change。

```
v2.5 → v3.0：API 字段从 kb_names 改为 ku_ids
v3.5 → v4.0：嵌入模型默认从 bge-m3-v1 升级到 v2
```

老用户怎么升级。

需要明确指南。

## Claude 的输入

Claude 看。

CHANGELOG。

代码 diff（v2.5 vs v3.0 关键文件）。

issue 里用户问的迁移问题。

输出迁移指南。

## 输出的结构

```markdown
# 从 v2.5 升级到 v3.0 指南

## 概述
v3.0 引入 ku_ids 合同。kb_names 仍兼容但建议迁移。

## 检查清单
- [ ] 备份数据
- [ ] 查看您的 KB 列表（有几个 doc:* / src:* / office:*）
- [ ] 查看您的应用集成（自家代码调 chayuan-desktop API）
- [ ] 升级 chayuan-desktop
- [ ] 验证

## 详细步骤
### 步骤 1：备份
[具体命令]

### 步骤 2：升级
[安装 v3.0]

### 步骤 3：验证
[测试 KB 检索]

### 步骤 4：迁移代码（如有自家集成）

旧代码：
```python
chayuan.search(query="...", kb_names=["my_kb"])
```

新代码（推荐）：
```python
chayuan.search(query="...", ku_ids=["doc:my_kb"])
```

旧代码仍可用（兼容期 6 个月）但收 deprecation 警告。

## 常见问题

Q: 我的 KB 数据会丢吗？
A: 不会。升级只影响主程序。数据在 ~/.chayuan/。

Q: 旧版本的 backup 在新版能恢复吗？
A: 能。chayuan-desktop 的 backup 格式向后兼容。
```

详尽。

## 指南的多版本累积

某用户跳几个版本升级。

v2.5 → v3.5（直接）。

需要看从 v2.5 到 v3.5 的所有 breaking change。

Claude 整合。

```markdown
# 从 v2.5 升级到 v3.5

## 涉及版本
v2.6: ...
v2.7: ...
...
v3.5: ...

## 检查清单（合并所有 breaking）
- ku_ids 迁移（v3.0）
- 嵌入模型升级（v3.2）
- 工具权限默认收紧（v3.4）
...

## 步骤
[详细]
```

## 自动化辅助

某些迁移能自动化。

Claude 写迁移工具。

```bash
chayuan-desktop migrate --from v2.5 --to v3.5
```

工具自动。

把旧 kb_names 映射到 ku_ids。

升级嵌入模型重建索引。

更新设置文件格式。

减少人工。

## 风险评估

迁移指南含风险。

```
风险：
- 重建索引耗时（10 万 chunk 约 1 小时）。
- 嵌入模型升级影响检索精度（重建索引后恢复）。
- 某些自定义工具配置可能不兼容。

缓解：
- 在低峰期重建索引。
- 重建前备份。
- 自定义工具升级前测试。
```

## 回滚指南

如果升级失败如何回滚。

```
回滚到 v2.5:
1. chayuan-desktop --uninstall
2. 安装 v2.5
3. 从备份恢复数据

数据兼容：是。v2.5 能读 v3.0 之前的数据。
```

## 国产化场景

党政军升级谨慎。指南详尽 + 测试期长。chayuan-desktop 的迁移指南满足。

某些场景升级走变更管理流程。指南作为变更评审材料。

## chayuan-server 的对应

chayuan-server 的迁移指南更复杂（多用户）。chayuan-desktop 的经验复用。两项目协调升级。

## 总结

让 Claude 写迁移指南是 chayuan-desktop 在长期演进上的协作。免费开源的AI软件 让 升级 不让老用户掉队。Claude 的多版本整合 + 检查清单 + 自动化工具 + 风险评估让迁移指南清晰可操作。
