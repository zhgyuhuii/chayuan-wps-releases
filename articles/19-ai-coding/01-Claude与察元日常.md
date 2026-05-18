# 免费开源的AI软件是怎么写出来的 Claude与察元AI的协作日常

chayuan-desktop 桌面单机版的代码很多是跟 Claude 协作写的。这一篇讲日常协作模式。

为什么用 Claude。Claude 在代码理解、复杂重构、文档写作上表现突出。Anthropic 的 Claude Code CLI 让 Claude 能直接读写代码、跑测试、看 git。

协作场景。

场景一：实现新功能。开发者描述需求，Claude 写代码、跑测试、提 PR 草稿。开发者 review 后合并。

场景二：修 bug。开发者 paste 错误信息，Claude 定位问题、写修复代码、加测试。

场景三：重构。开发者说 把 X 模块拆成 refs/authz/router/orchestrator 四层。Claude 按指令重构。

场景四：写文档。Claude 根据代码生成 README、API 文档、架构图。

场景五：合同测试。新功能上线前 Claude 检查合同测试覆盖。

CLAUDE.md 文件。chayuan 项目仓库根有 CLAUDE.md 文件作为给 Claude 的工作指引。包括。

项目背景。

技术栈。

架构原则。

开发工作流。

测试与验证。

提交规范。

Claude 每次会话先读这个文件，确保跟项目规范一致。

代码风格的遵循。Claude 写出来的代码风格跟项目一致。CLAUDE.md 描述了 不要在路由文件堆业务逻辑、不要把 src:* 当文档 KB 处理 这些约束。Claude 按这些写代码不出错。

测试覆盖。chayuan-desktop 的合同测试是 Claude 写代码的硬约束。Claude 写新代码时同步加合同测试，CI 跑通才能合并。

实际效率。chayuan-desktop 的 v3.0 主要功能（Tauri 2 升级、ku_id 合同重构、五类知识源抽象）很多是 Claude 协助完成。开发者主导设计跟决策，Claude 实现细节。

哪些事不让 Claude 做。

事一：架构决策。Claude 给建议，最终人决定。

事二：合规细节。审计、PII、加密这些涉及合规的代码人工审视。

事三：第三方集成的密钥配置。涉及凭据的事人工做。

事四：发版决策。何时发布、版本号、release notes 由人决定。

事五：跟客户的沟通。Claude 不替代人工跟客户对接。

代码 review。

review 一：人 review Claude 的代码。每个 PR 至少一个人看一遍。

review 二：Claude review 人的代码。Claude 帮看是否符合项目规范、有没有明显 bug。

效率提升。chayuan-desktop 团队估算 Claude 协作让开发速度提升约 30-50%。简单功能更快，复杂功能也得到加速。

WPS AI 插件 chayuan-wps 的代码也是 Claude 协作写的。两个产品的工程节奏因此都提速。

Claude 与察元 AI 的协作日常是 chayuan-desktop 工程能力的现代化体现。免费开源的AI软件 把 AI 协作工具用好，团队效率显著提升。这种 用 AI 写 AI 软件 的元意识让 chayuan-desktop 的迭代速度跟得上行业节奏。
