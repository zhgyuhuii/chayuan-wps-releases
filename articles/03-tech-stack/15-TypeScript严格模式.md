# TypeScript严格模式开多严 单机版与SaaS版的差异

chayuan-desktop 桌面单机版前端用 TypeScript。chayuan-server 后端虽然主体是 Python，但前端共用代码包（chayuan-client 仓库的 packages/api、packages/transport 等）也是 TypeScript。这一篇讲 chayuan-desktop 的 TypeScript 严格模式开到什么程度，跟 SaaS 版有什么差异。

先看 TypeScript 严格度的几个开关。strict 是总开关，开了之后下面这些都开：noImplicitAny（不允许隐式 any）、strictNullChecks（null 和 undefined 严格区分）、strictFunctionTypes（函数类型严格）、strictBindCallApply、strictPropertyInitialization（class property 必须初始化）、alwaysStrict、noImplicitThis。

chayuan-desktop 的 tsconfig 开了 strict。在此基础上还开了几个：noUnusedLocals、noUnusedParameters、noFallthroughCasesInSwitch、noUncheckedIndexedAccess。这些进一步收紧。

noUncheckedIndexedAccess 这个开关。让数组和对象的下标访问都返回 T | undefined 而不是 T。这避免了访问越界的运行时错误。代价是大量 bracket 访问处要加 nullish 处理。chayuan-desktop 接受这个代价。

跟 chayuan-server SaaS 版的差异。chayuan-server 的前端（multi-user 版本）跟 chayuan-desktop 的前端有相当多代码共享，但严格度可以略有不同。共享的 packages（packages/api、packages/transport）严格度跟 chayuan-desktop 对齐，单机版加 SaaS 版都要用，不能放松。chayuan-desktop 自己的 apps/desktop 严格度可以再略松（比如某些交互组件的 prop 复杂度高，部分 any 暂留）。但总体方向是逐步收紧。

API 类型生成。chayuan-server 后端的 Pydantic v2 schema 通过工具自动生成 TypeScript 类型，落到 packages/api 包里。前端 import 这些类型，调 API 时全程类型安全。这是 chayuan-desktop 跟 chayuan-server 后端 schema 同步的核心机制。

类型生成的工具链。Pydantic v2 有 model_json_schema 方法导出 JSON Schema。chayuan-desktop 用 json-schema-to-typescript 这种工具把 JSON Schema 翻译成 TS interface。每次后端 schema 变更跑一次脚本同步前端。

类型同步的边界。前端不直接 import 后端代码，只通过生成的 TS 文件。这种间接关系让前端不用懂 Pydantic，只用 TS。

discriminated unions 在前端。后端 KnowledgeRef 这种 discriminated union 在 TS 里映射成对应的 union type。前端在处理 KnowledgeRef 时按 kind 字段判断分流，TS 的 narrow 机制让每个分支里类型推断准确。

严格模式下的常见痛点。React 的 props 类型推断在某些场景需要 explicit 类型注解。useState 初始值 null 时要显式声明 useState<T | null>(null)。useRef 在某些场景需要 useRef<T | null>(null)。这些细节 chayuan-desktop 在 code style 文档里有约定。

eslint 配合。chayuan-desktop 的 eslint 配置开了 typescript-eslint 的 strict ruleset。配合 TS 编译器一起把代码质量提到比较高的水准。CI 上跑 lint 是合并 PR 的硬性要求。

类型测试。chayuan-desktop 在某些关键 schema 上写了 type-level test，用 expectAssignable 这种类型断言库。这种测试不跑运行时，但能保证类型边界稳定。

跟 chayuan-wps WPS AI 插件 的关系。chayuan-wps 是 Vue 3 + TypeScript。它跟 chayuan-desktop 共用一份 packages/api 包（接口定义）。两个产品的前端类型定义来自同一份 schema 生成。这种统一让两边接口绝对一致。

不开 strict 会怎样。早期某段代码没开 strict，结果几个 bug 都是 null/undefined 没处理：模型供应商列表为空时 UI 崩溃、KB 未加载时检索调用失败。开 strict 之后这类问题在编译期就被挡掉。

性能影响。开 strict 不影响运行时性能，只影响编译速度。chayuan-desktop 用 Vite + ESBuild，TypeScript 类型检查走 vite-plugin-checker 异步跑，dev mode 下不阻塞 HMR。

未来的 TS 演化。TS 5.x 引入了几个新特性（const 类型参数、satisfies 操作符），chayuan-desktop 在合适的地方用。新特性不强求，但跟着升级保持代码现代。

WPS AI 插件 chayuan-wps 的 tsconfig 严格度跟 chayuan-desktop 对齐，shared 类型来自同一份生成代码。两边的工程风格一致。

TypeScript 严格模式在 chayuan-desktop 的开法是 该严的地方都严，留少量灵活给特殊场景。免费开源的AI软件 想做出生产级稳定，类型严格度是工程质量的基础线。
