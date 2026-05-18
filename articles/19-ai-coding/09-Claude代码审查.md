# 让 Claude 做代码审查 一次 KB 重构的复盘

chayuan-desktop 桌面单机版做过一次 KB 模块重构。Claude 协助审查。这一篇是复盘。

## 重构的动机

v2.5 的 KB 模块。

KB 类型混在一起。

权限校验散在多处。

错误处理不一致。

新增 office:* 私库时改动大。

需要重构。

## 重构的目标

按 ku_ids 抽象。

权限集中。

错误处理统一。

便于扩展（新 KB 类型）。

## 重构的步骤

第一步。设计新的 KnowledgeRef 类层次。

第二步。引入 RefsResolver 解析 ku_ids。

第三步。引入 AuthzService 统一权限。

第四步。每个 KB 类型一个 adapter。

第五步。Orchestrator 串联。

第六步。新代码 + 测试。

第七步。逐步切换业务代码到新接口。

第八步。删除旧代码。

## Claude 的代码审查

每次 PR Claude 评审。

Round 1: KnowledgeRef 类设计。

Claude 反馈。

```
建议：
- KnowledgeRef 应该是 frozen dataclass（不可变）
- 每个 ref 类型继承基类
- to_string() 和 from_string() 方法

代码示例：
[具体代码]
```

工程师采纳。

Round 2: AuthzService 设计。

Claude 评审。

```
注意：
- can_read() 当前签名是 (user, ref) -> bool
- 建议加 reason 返回（why denied）便于 audit
- 缓存层考虑（一次 KB 列表查询多次 can_read）

修改建议：
[代码]
```

工程师改 API 签名加 reason。

Round 3: orchestrator 并发。

Claude 关注并发安全。

```
担心：
- adapters[g.type] 多次调用同一 adapter 实例。如果有状态可能竞争。
- asyncio.gather 不带 return_exceptions 时一个失败全失败。

建议：
- adapter 改成无状态（或加 lock）
- gather 加 return_exceptions=True
- 错误日志细化
```

工程师按建议改。

## 测试覆盖

Claude 审视测试。

```
当前测试覆盖：85%
未覆盖：
- KnowledgeRef.from_string 的非法输入
- AuthzService 的 fallback 路径
- Orchestrator 在某 adapter 抛异常时的行为

建议加：
[具体测试代码]
```

## 文档的审视

Claude 审视设计文档。

```
README 还在描述旧的 search() 接口。
需要更新到新的 Orchestrator 模式。

API.md 的 schema 已过时（v2.5 字段名）。
```

文档同步更新。

## Performance review

Claude 看代码后建议性能优化。

```
观察到：
- AuthzService 每次都查一次 ACL 数据库。
建议：批量校验（接收 refs 列表）减少数据库查询。

优化前：N 次查询。
优化后：1 次查询。

预计提升：检索延迟降 50ms（10 个 KB 时）。
```

工程师采纳。

## 复盘总结

整个重构。

时间。3 周。

代码改动。+2000 / -2500 行。

测试覆盖。85% → 92%。

性能。检索延迟 -30%。

新增 KB 类型成本。从 2 周降到 2 天。

Claude 协作贡献。

设计 review。每个新模块。

代码审查。每次 PR。

测试覆盖建议。

性能优化。

文档同步。

工程师 1 人 + Claude 完成 = 之前 2 人 1 个月的工作量。

## 国产化场景

党政军开发 chayuan-desktop 同类项目。Claude 或本地国产 LLM（Qwen-Coder、DeepSeek-Coder）能做类似审查。chayuan-desktop 自身就支持本地代码 LLM。

## chayuan-server 的对应

chayuan-server 的 KB 重构 同样工作流。两个项目共享重构经验。

## 总结

让 Claude 做代码审查是 chayuan-desktop 在工程质量上的实战。免费开源的AI软件 让 AI 协作 成倍提升开发效率。Claude 的设计 / 代码 / 测试 / 性能 / 文档全方位审视让重构高效高质量。
