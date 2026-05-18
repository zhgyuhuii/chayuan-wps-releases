# MCP 工具的输入校验 schema 校验放在哪一层

chayuan-desktop 桌面单机版的 MCP 工具输入校验有多层。这一篇讲哪一层做什么。

## 校验的目的

LLM 生成的工具调用参数可能不合法。

参数缺失。required 字段没给。

类型错。string 字段给了 number。

值非法。enum 字段给了不在列表里的值。

格式错。日期字段给了 "tomorrow" 而不是 "2026-05-11"。

每种都需要在调用前发现。

## 校验的层次

层一：LLM 自己。LLM 看到工具的 schema 描述，应该按 schema 生成。这是第一道防线。但不可靠（LLM 偶尔出错）。

层二：chayuan-desktop 网关层。收到 LLM 的 tool_calls 后用 JSON Schema 校验参数。失败则要求 LLM 重试或返回错误。

层三：MCP 工具自己。工具收到调用后再校验一次。冗余但安全。

## chayuan-desktop 的网关校验

工具描述含 inputSchema（JSON Schema 标准）。

```json
{
  "name": "list_todos",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "string",
        "enum": ["pending", "done", "all"]
      }
    },
    "required": []
  }
}
```

LLM 调用时给 {"status": "pending"} 通过。

LLM 给 {"status": "未完成"} 不在 enum 里，校验失败。

## 校验失败的处理

策略一：返回错误给 LLM 让它重试。

```
{"error": "validation_failed", "details": "status must be one of pending/done/all"}
```

LLM 看到错误信息，下一轮调整。

策略二：尝试自动修复。简单类型转换（string "1" → int 1）。

策略三：直接放弃，告诉用户。

chayuan-desktop 默认策略一。给 LLM 自己纠错的机会。

## 重试次数限制

避免 LLM 无限纠错。最多重试 3 次。仍失败放弃。

## 复杂 schema

某些工具的输入是嵌套对象、数组等复杂结构。

```json
{
  "filters": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "field": {"type": "string"},
        "value": {"type": ["string", "number"]}
      }
    }
  }
}
```

chayuan-desktop 用 jsonschema 库（Python）校验所有层级。

## schema 的来源

MCP 工具自己提供。chayuan-desktop 启动子进程后调 list_tools，工具返回每个工具的 schema。

chayuan-desktop 缓存这些 schema 用于校验。

## schema 的版本

工具升级 schema 可能变。chayuan-desktop 启动时重新拉 schema。如果 schema 变化提示用户。

## 工具自己的校验

校验不应只在 chayuan-desktop。MCP 工具也要校验（防止绕过 chayuan-desktop 的恶意调用）。

工具 SDK（Python mcp 库）默认会做基本校验。开发者自己加业务逻辑校验。

## 出错给用户的提示

校验失败 chayuan-desktop UI 显示。

```
工具调用失败：
  工具: list_todos
  错误: status 必须是 pending、done 或 all 之一
  LLM 重试中... (1/3)
```

让用户看到完整流程。

## 国产化场景

党政军场景对工具调用的安全性要求高。chayuan-desktop 的多层校验避免 LLM 误操作或恶意 prompt 触发非法调用。

## chayuan-server 的对应

chayuan-server 多用户场景下校验更严格（管理员能配置工具的允许参数范围）。chayuan-desktop 单机简化。

## WPS 加载项

chayuan-wps 在 WPS 里调用工具走 chayuan-desktop。校验对 WPS 透明。

## 总结

MCP 工具输入校验是 chayuan-desktop 在工具调用安全性上的工程基础。免费开源的AI软件 让 LLM 调用工具 不会因为参数错乱出问题。chayuan-desktop 的网关校验 + 工具自校验 + LLM 自纠让校验工作多层冗余。
