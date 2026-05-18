# 让 Claude 做合规审视 数据流可视化

chayuan-desktop 桌面单机版的合规审视由 Claude 协助。数据流可视化。这一篇讲。

## 合规审视的目的

代码改动可能违反隐私 / 合规规则。

数据出域。

未脱敏 PII。

未审计的操作。

明确权限旁路。

每次 PR Claude 审视。

## Claude 的审视方法

Claude 看 PR 的代码改动。

识别。

新增的网络请求。

新增的文件操作。

新增的数据库查询。

新增的日志。

跟合规规则对照。

## 数据流追踪

某 PR 加了一段。

```python
def handle_chat(query, user):
    # 调云 LLM
    response = openai_client.chat(messages=[{"role": "user", "content": query}])
    return response
```

Claude 审视。

```
警告：query 直接发给 OpenAI。
如果 query 含 office:* 私库内容，违反隐私规则（前面文章讲）。
建议：
1. 检查 query 是否含私库引用。
2. 如果是，弹用户确认或强制本地模型。

修改建议：
[代码]
```

## 数据流图

Claude 帮生成 chayuan-desktop 的数据流图。

```
用户输入 → chayuan-desktop UI → 主进程 → sidecar
       → 检索 KB → 引用 chunk
       → LLM 调用（本地或云）
       → 返回回答 → UI 显示
```

每一步标 是否数据出端。

```
KB 检索：本地 ✓
LLM 调用（云）：数据出端 ⚠
LLM 调用（本地）：本地 ✓
```

让审视者一目了然。

## 审视的规则

chayuan-desktop 维护合规规则。

```yaml
rules:
  - id: no_pii_to_cloud
    description: 含 PII 的内容不能发云模型
    pattern: openai_client.chat
    require_check: pii_redacted
  - id: audit_required
    description: 关键操作必须审计
    pattern: kb.delete | kb.export
    require_call: audit_log.write
  - id: privacy_check_before_cloud
    description: office:* 私库 chunk 不能进入 cloud LLM prompt
    ...
```

Claude 看代码 + 规则做匹配。

## 自动化集成

CI 跑 Claude 审视。某 PR 违反规则。

CI 标 not allowed。要求人工 review。

Claude 在 PR 评论里指出违规点 + 建议修改。

像 lint。

## 跟 CLAUDE.md 协同

chayuan-desktop 的 CLAUDE.md（前面文章讲）含合规规则。Claude 自动读取并应用。

某些场景规则更新（如新法规）。CLAUDE.md 同步更新。

## 误报的处理

Claude 偶尔误报。

工程师在 PR 评论。

```
@claude-bot 这不是私库数据，是公开模板，可以上云。
```

Claude 标记规则例外或更新规则。

## 国产化场景

党政军合规规则严。chayuan-desktop 的规则配置严。Claude 审视严。

某些场景规则定制（如本单位特殊要求）。CLAUDE.md 配置。

## chayuan-server 的对应

chayuan-server 多用户场景下合规审视更复杂。chayuan-desktop 的规则经验复用。

## 总结

让 Claude 做合规审视是 chayuan-desktop 在工程合规上的协作。免费开源的AI软件 让 合规检查 不只在测评时做。chayuan-desktop 的规则配置 + Claude 审视 + 数据流图让合规审视 持续在工程流中。
