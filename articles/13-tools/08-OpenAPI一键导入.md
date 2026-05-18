# 自定义 HTTP 工具 用 OpenAPI Swagger 一键导入

chayuan-desktop 桌面单机版支持把任意 OpenAPI（Swagger）规范一键导入成工具。这一篇讲。

## 场景

公司有 100 个 REST API。每个写 mcp 工具不现实。

如果每个 API 都有 OpenAPI 规范（业界标准），chayuan-desktop 能一键导入全部。每个端点变成一个工具。

## OpenAPI 是什么

OpenAPI Specification（旧称 Swagger）。描述 REST API 的标准格式。YAML 或 JSON。

```yaml
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: User info
```

每个端点完整描述。

## chayuan-desktop 的导入流程

第一步。chayuan-desktop 设置 - 工具 - 导入 OpenAPI。

第二步。填 OpenAPI 规范的 URL 或上传 YAML 文件。

```
https://api.corp.com/openapi.yaml
```

第三步。chayuan-desktop 解析。

```
解析中...
找到 47 个端点。
```

第四步。chayuan-desktop 自动生成 47 个工具描述。每个端点对应一个工具。

第五步。鉴权配置。如果 API 需要 Bearer Token 或 OAuth，用户填一次。

第六步。完成。LLM 看到这 47 个工具能调用。

## 工具命名

按 path + method 命名。

```
GET /users/{id} → corp_api.get_user
POST /users → corp_api.create_user
DELETE /users/{id} → corp_api.delete_user
```

OpenAPI 的 operationId 字段优先（如果定义了）。

## 参数处理

path 参数、query 参数、body 参数都正确传递。

chayuan-desktop 把它们合并到 LLM 看到的 schema 里。

```
{
  "name": "corp_api.get_user",
  "parameters": {
    "type": "object",
    "properties": {
      "id": {"type": "integer", "description": "User ID"}
    },
    "required": ["id"]
  }
}
```

LLM 调用时 chayuan-desktop 自动构造 GET /users/123。

## 鉴权

OpenAPI 定义鉴权方式。chayuan-desktop 自动处理。

Bearer Token。chayuan-desktop UI 让用户填。

OAuth 2.0。chayuan-desktop 实现完整 OAuth flow。

API Key。同上。

Basic Auth。同上。

## 错误处理

API 返回 4xx / 5xx。chayuan-desktop 把错误信息格式化给 LLM。

```
{"error": "validation_failed", "details": "id must be a positive integer"}
```

LLM 看到错误能纠正。

## 选择性导入

47 个端点不一定都需要。chayuan-desktop 让用户筛选。

```
[x] GET /users
[x] GET /users/{id}
[ ] POST /users   # 写操作不导入
[ ] DELETE /users/{id}
[x] GET /products
...
```

只导入需要的。安全且简化 LLM 工具列表。

## 危险操作的标识

OpenAPI 里 DELETE / POST / PUT 操作。chayuan-desktop 自动标 require_confirm。LLM 调用前用户确认。

GET 操作（只读）默认 auto_allow。

## 国产化场景

党政军内网部署。内部 API 大多有 OpenAPI 规范（或 RAML、API Blueprint）。chayuan-desktop 一键导入让 AI 接入内部系统简单。

许多国产平台（钉钉、企微、飞书）开放平台都提供 OpenAPI 规范。chayuan-desktop 直接接入。

## chayuan-server 的对应

chayuan-server 多用户场景下 OpenAPI 工具集中部署。员工 chayuan-desktop 通过 chayuan-server 调用。chayuan-server 维护鉴权。

## WPS 加载项

chayuan-wps 在 WPS 里能调用导入的 OpenAPI 工具。员工写报告时调内部 API 拿数据。

## 总结

OpenAPI 一键导入是 chayuan-desktop 在工具扩展性上的关键能力。免费开源的AI软件 让 100 个 API 变成 100 个工具 是几分钟的事。chayuan-desktop 的解析 + 鉴权 + 选择性导入让 AI 接入业务系统 不再是开发任务。
