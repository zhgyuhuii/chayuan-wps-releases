# CLAUDE.md在察元仓库里到底写了什么

chayuan 项目仓库的 CLAUDE.md 是给 Claude（或类似 AI 编程助手）的工作指引。这一篇讲它的内容结构。

CLAUDE.md 的位置。chayuan 项目（含 chayuan、chayuan-server、chayuan-client 三个子仓库）的工作目录根有 CLAUDE.md。Claude 进入仓库时第一份读它。

文件结构。

第一章：项目背景。

察元 AI 是什么、目标客户、技术定位。

三个子项目（chayuan WPS 加载项、chayuan-server、chayuan-client）各自的角色。

第二章：技术栈速览。

每个子项目的语言、框架、关键目录。

让 Claude 快速定位代码。

第三章：架构原则。

第一节：统一知识查询路径。所有新功能用 ku_ids / KnowledgeRef 作为真源。

第二节：Query Engine 分层。refs/authz/router/orchestrator/adapters/results。

第三节：结构化数据不是文档 RAG。聚合问题走 SQL。

第四节：API 路由文件只做协议适配。

第四章：开发工作流。

开始任务前的 checklist。

修改代码时的原则。

完成任务后的收尾（测试、git status、按需 commit）。

第五章：测试与验证。

每个子项目的常用测试命令。

什么时候必须加测试。

第六章：Git 与多仓库注意事项。

每个子项目的固定目标分支（chayuan-server / chayuan-client / chayuan WPS 都是 main）。

不要新建临时分支。

不要 force push。

第七章：常见任务处理策略。

统一查询路径相关任务。

WPS 加载项相关。

服务端结构化查询相关。

客户端合同相关。

第八章：回答用户时的风格。

用中文。

先给结论。

如果有测试未跑，明确说明。

第九章：质量红线。

避免的反模式。

为什么这文件重要。

理由一：AI 助手没有项目背景知识。CLAUDE.md 把所有约束讲清楚。

理由二：人新员工也用得上。这份文档相当于工程文化文档。

理由三：版本演化。CLAUDE.md 跟代码同步演化，反映当前最佳实践。

跟 README 的区别。README 给人看，描述产品。CLAUDE.md 给 AI 看，描述工程。两者侧重不同。

写 CLAUDE.md 的诀窍。

诀窍一：明确具体。不要 写好代码，要 路由文件不超过 50 行。

诀窍二：举例。每条规则配一个反例。

诀窍三：理由。每条规则解释 为什么。AI 理解后会推广到边界场景。

诀窍四：可机读。结构清晰，markdown 格式。

诀窍五：及时更新。每次架构调整后改 CLAUDE.md。

国产化支持下的 CLAUDE.md。中文写作。AI 助手能理解中文规则。

WPS AI 插件 chayuan-wps 仓库也有自己的 CLAUDE.md。两边规则一致但侧重不同（chayuan-wps 更多 Vue 3 + WPS API 的细节）。

CLAUDE.md 的内容是 chayuan 项目工程文化的明文化。免费开源的AI软件 想跟 AI 助手高效协作，这种文档是基础设施。chayuan-desktop 通过 CLAUDE.md 让 AI 协作 能稳定输出符合项目要求的代码。
