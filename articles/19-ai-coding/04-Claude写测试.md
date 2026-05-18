# 让Claude写测试 Pydantic schema的合同覆盖

chayuan-desktop 桌面单机版的合同测试是 Claude 协作写的高效场景。这一篇讲。

合同测试的目标。锁定 API schema 不被无意改动。每个核心 schema 写一组测试。

具体例子：SearchRequest schema。

```
class SearchRequest(BaseModel):
    query: str
    ku_ids: list[str]
    top_k: int = 10
    filters: dict[str, Any] = Field(default_factory=dict)
```

合同测试要覆盖。

测试一：典型合法输入能 validate。

测试二：query 必填。空字符串拒绝。

测试三：ku_ids 格式。每条必须 doc:*/src:*/office:* 格式。

测试四：ku_ids 空数组拒绝（至少要查一个）。

测试五：top_k 默认 10。

测试六：top_k 上限。比如不能超 100。

测试七：filters 默认空字典。

测试八：序列化反序列化稳定（JSON round-trip）。

让 Claude 写。开发者给 Claude schema 文件路径，说 给这个 schema 写完整合同测试。Claude 一两分钟生成。

Claude 输出。

```python
def test_search_request_typical():
    req = SearchRequest(
        query="压力测试",
        ku_ids=["doc:技术规范"],
        top_k=10
    )
    assert req.query == "压力测试"
    assert req.ku_ids == ["doc:技术规范"]
    assert req.top_k == 10

def test_search_request_query_required():
    with pytest.raises(ValidationError):
        SearchRequest(ku_ids=["doc:test"])

def test_search_request_ku_ids_format():
    with pytest.raises(ValidationError):
        SearchRequest(query="x", ku_ids=["invalid:format"])

# 更多测试...
```

人工 review。读一遍是不是覆盖完整。Claude 偶尔漏边界情况，开发者补上。

合同覆盖度。chayuan-desktop 用 pytest-cov 跟踪 schema 文件覆盖率。要求 95%+ 覆盖。Claude 写的测试基本能达到。

跨 schema 一致性。chayuan-desktop 里有几十个 schema。让 Claude 统一风格。每个 schema 都有同样结构的测试。这种 一致性 让维护轻松。

测试运行。pytest 自动跑所有合同测试。CI 必跑。一次 PR 跑全量测试约 1-2 分钟。

新增字段时。chayuan-desktop 的 schema 演化遵循 加新字段保持向后兼容 原则。新字段的合同测试 Claude 同步加。

破坏性变更的测试。如果某次 PR 真要删字段（破坏性），Claude 帮检查所有引用并写迁移指南。

WPS AI 插件 chayuan-wps 共用 schema 跟测试。chayuan-wps 跑同一份合同测试。

让 Claude 写测试是 chayuan-desktop 工程效率的代表场景。免费开源的AI软件 用 AI 帮写测试不是 偷懒，是 把人从重复工作里解放出来 写更有价值的代码。chayuan-desktop 的合同测试覆盖率高就是这种协作的回报。
