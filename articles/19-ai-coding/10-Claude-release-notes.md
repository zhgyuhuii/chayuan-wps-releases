# 让 Claude 做 release notes 与 CHANGELOG

chayuan-desktop 桌面单机版的 release notes 和 CHANGELOG 由 Claude 协助。这一篇讲。

## 内容来源

Claude 看。

Git log 自上次 release。

PR 描述。

issue 关联。

代码改动 diff。

综合生成。

## 输出格式

```markdown
## v3.1.0 (2026-05-10)

### 新功能
- WPS 加载项支持 ku_ids 合同 (#142)
- 国产视觉模型 Qwen2.5-VL-72B 接入 (#155)
- 长视频处理（抽帧 + ASR + 入库）(#160)

### 修复
- sidecar 偶尔启动失败 (#142)
- 中文路径在某些场景下错误 (#150)

### 变更
- 默认嵌入模型升级到 bge-m3-onnx-q8

### 性能
- 检索延迟 -30%

### 安全
- 修复 CVE-2026-XXXX
```

## 用户视角的描述

Claude 把开发者的术语转用户语言。

技术：refactor RefsResolver to support generic ku_id parsing。

用户：知识库选择更灵活，支持更多类型的引用。

## 突出 breaking change

Claude 标 breaking。

```
### Breaking
- API /api/v1/kb/search 已弃用，请改用 /api/v1/kb-query/search
- 旧 kb_names 字段在 v3.2 移除

迁移指南：[link]
```

让用户警觉。

## Migration guide

Claude 写迁移指南帮老用户升级。

```markdown
# 升级到 v3.0

## 检查清单
- [ ] 备份数据
- [ ] 更新 API 调用从 kb_names 到 ku_ids
- [ ] 重新检查权限配置
- [ ] 升级
```

## 多版本累积

某些用户跳过几个版本升级。

```
您当前 v2.5 → 升级到 v3.1
中间版本变更：
  v2.6: ...
  v2.7: ...
  ...
  v3.0: 主要重构
  v3.1: ...
合并展示。
```

## CI 集成

CI 跑发布流程。

提取 git log。

调用 Claude API 生成 release notes。

提交到 GitHub release。

自动化。

## 国产化场景

党政军部署 release notes 中文为主。Claude 用中文生成。

## chayuan-server 的对应

chayuan-server 的 release notes 同样工作流。两项目共享。

## 总结

Claude 写 release notes 让 chayuan-desktop 的发布流程自动化。免费开源的AI软件 让 用户友好的版本说明 是 commit 后的自然产出。Claude 的多视角 + 突出关键 + 迁移指南让 release notes 信息丰富。
