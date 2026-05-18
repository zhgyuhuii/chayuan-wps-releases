# 让 Claude 写测试 Pydantic schema 的合同覆盖

chayuan-desktop 桌面单机版的 Pydantic schema 合同测试由 Claude 协助编写。这一篇讲。

## 场景

chayuan-desktop 后端用 Pydantic 定义 API 合同。schema 变更可能破坏 API 兼容。

需要测试覆盖 schema 的合同。

## Pydantic schema 例子

```python
from pydantic import BaseModel
from typing import List, Optional

class KBSearchRequest(BaseModel):
    query: str
    ku_ids: List[str]
    top_k: int = 10
    filters: Optional[dict] = None
```

API 接口受这个 schema 约束。

## Claude 写的测试

提示 Claude。

```
为这个 KBSearchRequest 写完整测试覆盖。包括：
- 必填字段缺失
- 类型错误
- 边界值（top_k=0, top_k=100）
- 默认值
- 序列化反序列化
```

Claude 输出。

```python
import pytest
from pydantic import ValidationError

def test_required_query():
    with pytest.raises(ValidationError):
        KBSearchRequest(ku_ids=["doc:test"])

def test_query_must_be_string():
    with pytest.raises(ValidationError):
        KBSearchRequest(query=123, ku_ids=["doc:test"])

def test_default_top_k():
    req = KBSearchRequest(query="hi", ku_ids=["doc:test"])
    assert req.top_k == 10

def test_top_k_zero():
    req = KBSearchRequest(query="hi", ku_ids=[], top_k=0)
    assert req.top_k == 0  # 边界

def test_top_k_negative():
    # 当前 schema 没限制负数，测试反映行为
    req = KBSearchRequest(query="hi", ku_ids=[], top_k=-1)
    assert req.top_k == -1

def test_serialize_roundtrip():
    req = KBSearchRequest(query="hi", ku_ids=["doc:test"], top_k=5)
    json_str = req.model_dump_json()
    req2 = KBSearchRequest.model_validate_json(json_str)
    assert req == req2
```

完整覆盖。

## Claude 发现的问题

Claude 写测试时可能发现 schema 设计问题。

```
注意：当前 schema 允许 top_k=-1 通过。这可能不是预期。
建议：top_k: int = Field(default=10, ge=1, le=100)
```

让我加上约束。

```python
class KBSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    ku_ids: List[str] = Field(..., min_items=1)
    top_k: int = Field(default=10, ge=1, le=100)
```

约束加上后 Claude 更新测试。

## 跨版本兼容测试

API schema 升级。Claude 帮写跨版本测试。

```python
def test_backward_compat_v1_request():
    """v1 请求字段仍能被 v2 schema 接受。"""
    v1_data = {"query": "test", "kb_names": ["doc:test"]}  # 旧字段
    # v2 schema 应该兼容
    req = KBSearchRequest.model_validate(v1_data)
    assert req.ku_ids == ["doc:test"]  # 旧字段 kb_names 映射到 ku_ids
```

兼容性保证。

## Claude 跟测试框架

chayuan-desktop 用 pytest。Claude 熟悉 pytest 风格。

某些场景用 hypothesis（property-based testing）。Claude 也能写。

```python
from hypothesis import given, strategies as st

@given(
    query=st.text(min_size=1),
    ku_ids=st.lists(st.text(), min_size=1)
)
def test_valid_input_always_passes(query, ku_ids):
    req = KBSearchRequest(query=query, ku_ids=ku_ids)
    assert req.query == query
```

随机生成输入测 schema。

## CI 集成

Claude 写好测试后。CI 跑。

```bash
PYTHONPATH=... pytest tests/unit_tests/test_kb_query_schemas.py -v
```

每次 PR 跑测试。schema 改动有 CI 守。

## chayuan-desktop 的协作体验

Claude 帮写测试不只是写。

发现边界。

发现 schema 设计问题。

提供 hypothesis property-based 思路。

写跨版本兼容测试。

省工程师精力。

## 国产化场景

党政军开发同样可用 Claude（如果有访问）。或用本地国产 LLM（chayuan-desktop 本身用 Qwen-Coder 等）。

## chayuan-server 的对应

chayuan-server 的 Pydantic schema 测试同样靠 Claude / Qwen-Coder 协作。chayuan-desktop 共享方法论。

## 总结

让 Claude 写 Pydantic schema 测试是 chayuan-desktop 工程实践的具体例子。免费开源的AI软件 让 AI 协助开发是日常。Claude 的合同覆盖 + 边界发现 + property-based + 跨版本测试让 schema 测试既全又深。
