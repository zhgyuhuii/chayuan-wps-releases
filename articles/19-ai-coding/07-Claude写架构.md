# 让 Claude 写架构 retrieval/query 模块的演化

chayuan-desktop 桌面单机版 retrieval/query 模块的演化由 Claude 协助设计。这一篇讲。

## 场景

retrieval/query 是 chayuan-desktop 后端的核心模块（前面文章讲过）。从 v1.0 到 v3.0 经历多次重构。

每次重构 Claude 协助。

## v1.0 单一模块

最早。所有 RAG 逻辑在 router.py 一个文件。

```python
def search(query, kb_names):
    chunks = []
    for kb in kb_names:
        # 检索每个 KB
        chunks.extend(search_kb(kb, query))
    # 重排
    return rerank(chunks)
```

简单粗暴。能跑。

## v2.0 router 模式

随着 KB 类型多了。引入 router。

```python
def search(query, kb_refs):
    intent = router(query)
    if intent == "structured":
        return structured_query(query, kb_refs)
    elif intent == "vector":
        return vector_query(query, kb_refs)
    else:
        return document_query(query, kb_refs)
```

有改善。但 search() 函数还是大。

## v3.0 模块化重构

跟 Claude 协作重构。

Claude 建议。

```
按职责分。

refs.py: 解析 KB 引用（doc:* / src:* / office:*）
authz.py: 权限校验
router.py: 意图识别
orchestrator.py: 编排（并发 / 超时 / 错误隔离）
adapters/
  document.py
  structured.py
  vector.py
  office.py
results.py: 统一结果对象
```

每个模块单一职责。

## Claude 写的代码

Claude 帮写 orchestrator.py。

```python
class Orchestrator:
    def __init__(self, adapters, refs_resolver, authz):
        self.adapters = adapters
        self.refs_resolver = refs_resolver
        self.authz = authz
    
    async def execute(self, query, ku_ids, user):
        # 解析引用
        refs = self.refs_resolver.resolve(ku_ids)
        # 权限过滤
        accessible = [r for r in refs if self.authz.can_read(user, r)]
        # 按类型分组
        grouped = self.group_by_type(accessible)
        # 并发执行
        tasks = [
            self.adapters[g.type].search(query, g.refs)
            for g in grouped
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        # 合并
        return self.merge(results)
```

整洁清晰。

## Claude 帮维护文档

Claude 看代码生成模块的设计文档。

```markdown
# retrieval/query 模块

## 设计目标
- 路由无关（API 路由不承载业务）
- 模块化（按职责分）
- 可测试（每模块独立）
- 可扩展（加新 adapter 简单）

## 组件
[每个模块的职责说明]

## 数据流
[图]
```

完整设计文档。

## Claude 跟踪重构

每个 Claude 对话保存到 chayuan-desktop 历史。

某天工程师不记得为什么某段是这样设计。回查 Claude 对话。

```
"那次重构。Claude 建议把 authz 单独成模块的理由是..."
```

类似设计 ADR（Architecture Decision Record）。

## Claude 跟代码同步演化

代码改了。Claude 看到提交记录建议文档更新。

某些场景 Claude 主动发现设计漂移。

```
Claude: 我注意到 orchestrator.py 现在有 200 行。是否考虑拆分？
```

主动建议。

## 测试驱动重构

Claude 帮做测试驱动重构。

第一步：旧代码加测试覆盖。

第二步：在测试通过的前提下重构。

第三步：测试仍通过 → 重构成功。

Claude 跑这个流程。每一步给具体代码。

## 国产化场景

党政军开发也可用 Claude（如果允许）。或本地国产 LLM 替代。chayuan-desktop 内嵌的 Qwen-Coder 也能做类似工作。

## chayuan-server 的对应

chayuan-server 同样用 retrieval/query 模块。Claude 协作的设计成果两个项目共享。

## 总结

让 Claude 写架构 retrieval/query 模块演化是 chayuan-desktop 工程实践的具体案例。免费开源的AI软件 让 AI 协作架构 是日常。Claude 的设计建议 + 代码生成 + 文档维护 + 测试驱动重构让模块演化有依据。
