# 自定义HTTP工具 用OpenAPI Swagger一键导入

chayuan-desktop 桌面单机版支持从 OpenAPI（Swagger）规范一键导入第三方 HTTP API 作为工具。这一篇讲。

应用场景。公司内部系统大多有 OpenAPI 文档。Swagger UI 暴露的 /api-docs 或者 /openapi.json。chayuan-desktop 的导入工具能解析这种文档，把每个 API endpoint 变成一个 LLM 可调用工具。

导入步骤。

第一步。chayuan-desktop 设置 - 工具 - 新建 - OpenAPI 导入。

第二步。填 OpenAPI URL（http://internal-api/openapi.json）或者上传 JSON 文件。

第三步。chayuan-desktop 解析。提取所有 endpoint 跟参数定义。

第四步。预览。每个 endpoint 显示成可勾选的工具。用户选要导入哪些。

第五步。确认。chayuan-desktop 把选中的 endpoint 注册成 BaseTool 实例。

第六步。LLM 在对话中能调用。

工具元数据自动生成。

name。从 endpoint operationId 取。

description。从 endpoint summary 和 description 拼。

inputSchema。从 endpoint requestBody 和 parameters 转。

outputSchema。从 endpoint responses 转。

OAuth2 / API key 鉴权。chayuan-desktop 支持配置 OAuth2 token 或 API key 头。每次调用自动加上。

参数转换。OpenAPI 的 query / path / body 参数 chayuan-desktop 在调用时按规范放对位置。

调用示例。导入 公司销售 CRM API（含 createOrder、queryCustomer、updateProduct 等）。LLM 在对话中。

用户：帮我查一下张三客户的最近订单。

LLM：调用工具 queryCustomer 查 张三 拿到 customer_id。再调 listOrders 查这个 customer_id 的订单。

返回结构化结果给用户。

权限控制。chayuan-desktop 支持给某些工具加 require_confirmation 标记。比如 createOrder 这种写操作，调用前要用户确认。

工具的更新。OpenAPI 规范变化时，chayuan-desktop 提供 重新导入 选项，更新工具元数据。已删除的 endpoint 工具自动失效。

WPS AI 插件 chayuan-wps 共用导入的 HTTP 工具。

OpenAPI 自动导入是 chayuan-desktop 工具扩展的最简方式。免费开源的AI软件 想让企业内部系统能被 LLM 用，OpenAPI 导入是最低成本路径。chayuan-desktop 在这一面让 LLM 用上现有 API 不需要写代码。
