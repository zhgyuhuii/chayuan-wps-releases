# 测试框架pytest的合同测试在kb-query模块的实践

chayuan-desktop 桌面单机版的后端 chayuan-server 用 pytest 做测试。其中 kb-query 模块的合同测试是工程上比较有意思的一块。这一篇讲讲 chayuan-desktop 的测试组织和合同测试的具体做法。

pytest 选型不需要解释。Python 生态测试框架的事实标准。chayuan-desktop 用 pytest + pytest-asyncio + pytest-httpx 三件套。

测试组织。chayuan-server/tests 目录下分 unit_tests、integration_tests、e2e_tests 三层。unit 测试单个模块的纯逻辑，integration 测试跨模块协作，e2e 走完整 HTTP 调用。

合同测试是什么。chayuan-desktop 的合同测试主要在 unit_tests/test_kb_query_schemas.py 和 unit_tests/test_kb_query_service.py 这两类文件里。它们的目标是 锁定 API schema 和 service 行为不被无意改动。

为什么要合同测试。chayuan-desktop 的 kb-query 模块对外暴露 /api/v1/kb-query/search 接口，前端、chayuan-wps WPS AI 插件、可能的第三方都依赖这个接口的稳定。任何破坏性变更（删字段、改字段类型、改默认值）都会让客户端坏掉。合同测试在 PR 阶段就把这种变更挡住。

具体怎么写。test_kb_query_schemas.py 里给每个核心 schema 写测试：构造合法的输入能正常 validate、构造非法的输入会抛对应错误、字段默认值正确、序列化结果稳定。test_kb_query_service.py 里给每个 service 函数写测试：典型输入产生预期输出、错误输入产生预期错误、边界条件处理正确。

测试数据 fixture。chayuan-desktop 用 pytest fixture 准备测试数据：sample_doc_kb、sample_struct_kb、sample_office_kb。每个测试函数按需 inject。这种共享 fixture 让测试代码简洁，不需要每次重复构造数据。

mock 与 stub。kb-query service 内部调 retrieval、authz、router。测试时用 unittest.mock 给这些依赖打桩，让单元测试聚焦 service 本身的逻辑。某些测试用 真实的内嵌 sqlite-vec，验证集成边界。

合同测试的边界。合同测试不验证业务正确性（比如 KB 检索是否真的命中相关 chunk），只验证接口稳定。业务正确性走 e2e 测试。

ku_id 的合同测试。test_kb_query_schemas.py 里专门有几条测试 ku_id 解析：合法的 doc:* / src:* / office: 格式都能 parse、非法格式返回明确错误、空字符串、null 值各自的处理。这些测试一旦坏了说明合同变了，需要明确通知前端。

权限的合同测试。authz 模块的测试覆盖：单机模式下任何请求都通过、多用户模式下校验 user-kb 关联、应用模式下校验 app-kb 关联、游客模式下校验 anonymous-kb 关联。每种模式有专门 fixture。

router 的合同测试。router 模块的测试覆盖：常见问题类型的意图识别、聚合问题不退化为文档检索、结构化问题命中 SQL 路径。比如 有几个用户 这种问题必须命中 structured_aggregate 加 COUNT 的判定。这条测试是 CLAUDE.md 里明确要求的。

回归测试。每次 PR 跑全量 pytest，CI 的 e2e_junit.xml 文件记录所有测试结果。测试失败 PR 不合并。这个 hard gate 让破坏性变更进不了主分支。

性能测试。pytest-benchmark 用来测某些性能敏感函数（嵌入计算、向量召回、SQL AST 校验）的延迟基准。性能下降明显的 PR 会被发现。

跨平台测试。GitHub Actions 在 Windows、macOS、Linux 三个平台上跑同一份测试集。某些平台特定的 bug（比如 Windows 路径处理、macOS sqlite-vec 加载）能在这阶段被抓住。

国产化支持下的测试。chayuan-desktop 在内部 CI 上加跑麒麟 UOS、loongarch64 平台的测试。这些平台不在公开 GitHub Actions 上，但有自家的 runner。

WPS AI 插件 chayuan-wps 的测试用 Vitest（Vue 3 友好），跟 chayuan-desktop 的 pytest 是不同工具。但两边都对 packages/api 共享代码做合同测试，确保前后端 API 同步。

合同测试是 chayuan-desktop 工程稳定的一道防线。免费开源的AI软件 维护版本兼容这件事，靠的是这种自动化的硬性约束，而不是开发者自觉。
