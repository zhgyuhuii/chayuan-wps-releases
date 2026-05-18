# API路由文件为什么不放业务逻辑 路由无关分层的好处

chayuan-desktop 桌面单机版的代码组织有一条架构红线：API 路由文件只做协议适配、参数校验和身份注入，不放任何业务逻辑。这条规矩在 CLAUDE.md 里反复强调过。这一篇讲清楚为什么要这么做，以及实际工程上的好处。

先看 路由文件 是什么。chayuan-server 后端用 FastAPI，每个 HTTP 接口对应一个 endpoint 函数，写在 api_server 目录下。一个典型的路由函数长这样：用 @router.post 装饰器声明 URL 和方法，函数签名声明请求参数和返回类型，函数体调用 service 层做实际工作。

错误的写法是什么样。早期某些项目里路由函数里塞满了业务逻辑：参数解析 + KB 查找 + 权限校验 + 检索逻辑 + LLM 调用 + 结果格式化全都堆一起。一个路由函数 200 多行，跨几个外部依赖。这种写法在前期看着方便，每加一个接口直接写完一锤子买卖。但到了维护期就是灾难。

灾难表现在几件事上。第一，测试难。一个 200 行的路由函数想写单元测试要 mock 半天。第二，复用难。同样的业务逻辑在 HTTP 接口和 WebSocket 接口都要用，但代码在路由函数里没法被另一个路由复用。第三，重构难。想把检索逻辑改一改要在所有相关路由里找改一遍。第四，权限漏洞。某个路由函数忘了写权限校验就直接放出去了，每个路由都是潜在的安全漏洞。

正确的分层是什么样。chayuan-desktop 把代码分三层。最外层是 API 路由层（api_server 目录），只做协议适配。中间是 Service 层（service 模块），承载业务流程编排。最内层是 Domain 层（kb_query、retrieval、knowledge_source 等模块），承载具体业务逻辑。

API 路由层做的具体事情。第一，URL 路由声明。第二，请求参数 schema 验证（Pydantic v2 自动做）。第三，从 header 或 cookie 抽取身份信息（单机版下是空的）。第四，调 service 层函数。第五，把 service 返回值序列化。第六，处理 service 抛出的业务异常映射成 HTTP 状态码。完了。

Service 层做的具体事情。第一，参数从 schema 转成 domain 实体。第二，调用 domain 层的具体函数（refs、authz、router、orchestrator 等）。第三，把 domain 层返回的结果聚合包装成 service 层数据结构。第四，处理跨 domain 的协调（比如同一请求需要 KB 查询加 LLM 调用加日志记录）。

Domain 层做的具体事情。具体业务规则、算法、数据访问。每个 domain 模块对外暴露纯函数接口，内部维护自己的状态和不变量。

这种分层的好处。一是 路由薄。每个路由函数 20-30 行就够，可读性高，新人接手快。二是 业务可复用。Service 层函数被 HTTP 路由调用，也被 WebSocket 路由调用，也被命令行工具调用，也被测试调用。三是 测试容易。Service 层用 pytest 直接跑就能覆盖业务逻辑，不需要起 HTTP server。四是 演进友好。换 HTTP 框架（比如从 FastAPI 换 Starlette）只动路由层，业务不动。

实际例子。/api/v1/kb-query/search 路由函数大概 25 行：解析请求体到 SearchRequest schema、注入身份（单机版直接给 None）、调 kb_query.service.search(req)、把返回值序列化成 SearchResponse。一行业务都不写。

权限校验为什么也放 service 而不是路由。早期项目里习惯在路由层做权限校验，结果每个路由都要写一遍权限代码，一不小心漏写就是漏洞。chayuan-desktop 的做法是 路由只注入身份信息，service 层调 authz 模块统一做权限校验。这样所有的权限点都集中在 authz 模块，审计起来一目了然。

请求验证为什么放路由层。Pydantic v2 自动验证请求体的 schema 完整性，这件事 FastAPI 已经做得很好。路由层把验证后的 dataclass 直接传给 service 层。Service 层不需要再校验一遍 schema，但需要做业务级的校验（比如 KB 是否存在、当前用户是否有权限），这些跟 schema 校验是不同层面的事。

WPS AI 插件 chayuan-wps 跟桌面客户端共用同一份后端路由。两个客户端发起的请求经过同样的路由函数、调用同样的 service 层、走同样的 domain 模块。这种统一是分层架构的副产品：客户端只是调用方，业务逻辑跟客户端无关。

这条架构红线坚持下来的回报，在每次新功能开发和 bug 修复时都体现得很直接。代码定位快、修改影响范围清晰、测试容易写。免费开源的AI软件 想长期维护，这种内部约束比前端炫酷的 UI 更重要。
