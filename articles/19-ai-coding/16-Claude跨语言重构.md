# 让 Claude 跨语言重构 TypeScript 与 Python 同步演化

chayuan-desktop 跨 TypeScript（前端）和 Python（后端）。Claude 协助跨语言重构。这一篇讲。

## 跨语言一致性的挑战

API 协议在两边都定义。

TypeScript 用 zod / tsoa / openapi-typescript。

Python 用 Pydantic。

两边手动同步容易漏。

## chayuan-desktop 的协作

类型定义集中。

Pydantic schema 是真源。

OpenAPI 自动从 Pydantic 生成。

TypeScript 类型从 OpenAPI 生成。

```
Python BaseModel → openapi.yaml → TS types.ts
```

修改 Python。CI 自动生成 OpenAPI + TS。

## Claude 的协作

某场景修改 KB schema。Claude。

第一。改 Python schema。

第二。跑 OpenAPI 生成。

第三。生成 TS types。

第四。更新 TS 调用方。

第五。跑测试两端。

第六。提交一个 PR 含两边改动。

工程师只需改 Python。其他自动化。

## 跨语言 bug 修复

某 bug。前端某字段没显示。

Claude 跟踪。

```
症状：UI 字段空白。
后端：sidecar 的 GET /kb/list 返回字段 'kb_id'。
前端：UI 期望字段 'id'。

不一致。
```

找出根因。决定改哪边。

```
建议：后端改字段为 'id'（OpenAPI 标准）。
TS 类型重新生成。
前端无需改（如果用 type）。
```

修复一致。

## 性能优化跨语言

某场景前端慢。Claude 帮看。

```
前端瀑布：
- /api/kb/list 1 秒
- /api/kb/{id}/chunks 2 秒
- /api/chat 5 秒

后端：每个端点跑得慢吗？
```

跟后端日志对比。

```
后端：
- /api/kb/list 100ms
- /api/kb/{id}/chunks 200ms
- /api/chat 4500ms

前端串行调用浪费时间。
```

建议。

```
前端：并行调用前两个。
后端：chat 接口缓存 KB 信息。

总延迟降到 5 秒（chat 仍是大头但不可避免）。
```

跨语言 profile。

## 测试同步

后端测试用 pytest。前端测试用 Vitest。Claude 同时维护。

某 schema 改了。

后端测试更新（Python）。

前端测试更新（TS）。

E2E 测试更新（Playwright）。

Claude 跨语言协调。

## 文档同步

API 文档是真源。前端 / 后端文档跟它一致。

Claude 检测不一致。

```
README.md 描述 ku_ids 字段。
API.md 还在描述 kb_names。

不一致。建议同步。
```

## 国产化场景

党政军开发同样跨语言项目。Claude 协作适用。本地国产 LLM 也行。

## chayuan-server 的对应

chayuan-server 同样 Python + TS。chayuan-desktop 的跨语言协作经验完全复用。

## 总结

让 Claude 跨语言重构是 chayuan-desktop 在工程一致性上的协作。免费开源的AI软件 让 跨 TS / Python 同步 不靠人工。Claude 的真源 + 自动化生成 + 跨端测试 + 文档同步让跨语言重构高效。
