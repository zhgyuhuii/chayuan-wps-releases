# 让 Claude 处理 issue 一个 bug 从复现到修

chayuan-desktop 桌面单机版的 GitHub issue 由 Claude 协助处理。这一篇是一次 bug 修复实战。

## issue 描述

用户提交 issue。

```
标题：检索某中文 KB 时偶尔返回空结果。

描述：
- chayuan-desktop v3.0.5
- KB: doc:reports（含中文文档）
- 复现：90% 概率某些 query 命中。10% 命中 0 个 chunk。
- 不一致。
```

## Claude 协助复现

Claude 看 issue 后建议。

```
这是间歇性问题。可能：
1. 嵌入模型不稳定？(同 query 同 chunk 应该结果一致)
2. 检索阈值动态变化？
3. 多线程竞争？
4. 缓存问题？

建议：让用户提供。
- 具体 query 例子（成功 vs 失败）
- chayuan-desktop 的日志（chayuan-desktop --debug-tool 启用）
- 复现频率
```

## 用户补充

用户跑 chayuan-desktop --debug-tool 给出日志。

Claude 看日志。

```
日志显示：
2026-05-10 10:00:00 [ok] 查询 "客户案例" 命中 5 chunk
2026-05-10 10:00:30 [empty] 查询 "客户案例" 命中 0 chunk
2026-05-10 10:00:35 [ok] 查询 "客户案例" 命中 5 chunk

奇怪。同样 query 不同结果。
```

## Claude 深入分析

```
查看代码发现：
detection_threshold 用了 random()！

```python
threshold = 0.5 + random.random() * 0.2  # 漂移阈值
```

某次 random 高（接近 0.7）时所有 chunk 不达阈值，返回空。

bug 找到了。
```

## 修复

Claude 提建议。

```
threshold 不应该 random。建议：
- 固定 0.5（保守）
- 或基于 query 长度动态（短 query 0.6，长 query 0.4）

固定方案简单。Claude 写 PR：

```python
threshold = 0.5  # 固定阈值
```

加测试：
- 同 query 多次跑结果一致
- 阈值边界测试
```

修复 PR 提交。

## CI 跑测试

CI 跑通。

合并到 main。

## release

下个版本（v3.0.6）含修复。

```
## v3.0.6 changelog
### Fixed
- 中文 KB 偶发空结果（#issue-xxx）
```

通知用户升级。

## 用户反馈

用户升级后回复 issue。

```
升级到 v3.0.6 后跑了 50 次。每次都命中 5 chunk。
问题已解决。感谢！
```

issue 关闭。

## 整个过程

时间。

issue 接收：1 天。

Claude 帮复现 + 诊断：30 分钟。

Claude 写 fix：30 分钟。

CI + review：1 天。

发版：3 天。

总共 1 周。

工程师 1 人 + Claude。

## 流程的工程化

chayuan-desktop 的 issue handling SOP。

第一。Claude 自动看新 issue，给优先级建议。

第二。重要 issue Claude 做初步分析。

第三。工程师介入 case-by-case。

第四。Claude 帮写 fix + 测试。

第五。CI 跑通。

第六。release。

某些场景小 bug Claude 完全自动处理。工程师只 review。

## 国产化场景

党政军开发同样可用 Claude（如允许）或本地 LLM 处理 issue。流程一致。

## chayuan-server 的对应

chayuan-server 的 issue 处理同样工作流。两项目共享 SOP。

## 总结

让 Claude 处理 issue 是 chayuan-desktop 在开源运营上的工程效率。免费开源的AI软件 让 issue 不积压。Claude 的复现协助 + 诊断 + 修复 + 测试让 bug 从接收到修复时间显著缩短。
