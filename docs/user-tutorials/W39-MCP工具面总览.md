---
id: W39
title: MCP 工具面总览（69 工具全景与写确认纪律）
entry: —
level: P1
tags: [MCP, 工具清单, confirmed, 域聚合]
status: draft
---

## 一句话说明

本机 MCP 服务（sidecar 0.13.0）对外暴露一套文档智能体工具：目录源码 `mcp-sidecar/lib/toolCatalog.mjs` 共 **69 个工具定义**；其中 33 个细粒度旧名已并入 17 个「域工具」（一个工具名 + `action` 参数区分具体动作），外部客户端 `tools/list` 实际可见 53 个。本文是给用户和智能体看的能力地图：能干什么、哪些动作要先确认才落盘、长任务与审计怎么走。

## 适用场景

- 接好 MCP 后（[W38](./W38-外部智能体接入MCP.md)）想知道智能体「手里有哪些工具」、分别管什么；
- 担心智能体乱改文档，想了解写确认（`confirmed`）纪律；
- 排障时想看审计日志、理解报错码。

典型提问（chabot 语料视角）：

- 「MCP 都有哪些工具？能操作表格和 PPT 吗？」
- 「智能体改我的文档前会先确认吗？」
- 「文档太大读不了怎么办？」

## 前置条件

- 本机 MCP 服务已启动、WPS 加载项在线（[W37](./W37-启动本机MCP服务.md)）；客户端已接入（[W38](./W38-外部智能体接入MCP.md)）。
- 推理在外部模型：工具只负责读/定位/写/导出，翻译、校对判断、内容生成都由客户端 LLM 自己完成——服务级 instructions 已向客户端声明这一分工。

## 操作步骤（工具面全景，按域分组）

以下 53 个为客户端 `tools/list` 实见工具名（69 = 53 + 33 个已并入域工具的细粒度旧名，如 `document_add_comment`→`comment(action=add)`，旧名一个版本内别名兼容）。

**主机与健康（2）**

- `wps_status`：分层健康——sidecar / Agent（`agent.agentOnline`、各宿主 wps/et/wpp 在线情况）/ 活动文档 / 可见窗口。
- `wps_launch`：OS 冷启动 WPS 并等待加载项连上；可指定拉起文字（wps）/表格（et）/演示（wpp）宿主。

**文字文档生命周期与读写（13，`document_*`）**

- 打开/切换：`document_open`（打开本地文档为可见活动文档，默认经 OS 拉起真窗口）、`document_ensure_open`（已是活动文档则空操作）、`document_list_open`（列出已开文档）、`document_activate`（在已开文档间切换）。
- 读取：`document_meta`（名称/字数/段数/是否建议分块）、`document_list_paragraphs`（逐段列表带锚点，逐段工作流首选）、`document_chunks`（长文分块翻页，带 start/end 锚点）、`document_get_text`（全文/选区纯文本，约 8 万字符以上报 `DOCUMENT_TOO_LARGE`，需 `force:true` 或改用 chunks）、`document_locate`（定位字词/句，返回多命中锚点）。
- 写入：`document_replace`（替换锚点文本段）、`document_insert`（相对锚点/文末插入）、`document_apply_ops`（批量写回 replace/comment/comment-replace/insert-after，一次至多 200 条操作）、`document_save`（保存/另存）。三者写入类均「预览→确认」：不带 `confirmed:true` 只返回预览不落盘。

**格式与样式（5）**：`format_read`（读格式）、`format_run`（字体字色加粗等文字级格式）、`format_para`（对齐行距等段落级格式）、`format_apply_ops`（批量格式写回）、`system_fonts_list`（系统字体清单）。改措辞用 `document_*`，改样子用 `format_*`，不要混。

**域聚合工具（17，一个工具 + `action` 参数）**

| 域 | action（只读 | 需确认写） |
|---|---|
| `comment` 批注 | list | add、delete |
| `revision` 修订 | mode、list | apply（接受/拒绝） |
| `layout` 版式 | — | page（纸张页边距）、columns（分栏）、break（分隔符）、blank_page |
| `nav` 导航 | location、outline、pane_set | — |
| `toc` 目录 | — | insert、update |
| `bookmark` 书签 | list、goto | — |
| `table` 文档内表格（12 动作） | list、header_read、row_read、column_read、cell_read、export（序列化为 md/csv/json，不写文件） | insert、header_repeat、column_set_width、row_insert、column_insert、cell_merge |
| `caption` 题注 | list（图/表/式枚举，连续性由 LLM 判断） | — |
| `field` 域 | list | add（SEQ 自动编号/TOC 域） |
| `image` 图片 | list | insert、delete、export |
| `hyperlink` 超链接 | list | add、delete |
| `headerfooter` 页眉页脚 | get | set |
| `watermark` 水印 | — | set、clear |
| `style` 样式 | list；audit（stats/unused/purge_unused） | apply |
| `export` 导出 | — | file（docx/pdf，另存到指定路径） |
| `spreadsheet` 表格（ET 宿主，23 动作） | status、sheet_list、used_range、range_read、find、chart_list（6 只读） | sheet_add/rename/delete、range_write、find_replace、row/column_insert/delete、sort、autofilter、format、chart_add/chart_export、export、security_encrypt_save/decrypt_save（17 写；读写均支持工作簿打开密码加密/解密另存） |
| `presentation` 演示（WPP 宿主，23 动作） | status、slide_list、slide_read、shape_list（4 只读） | slide_add/delete/duplicate/move/layout、text_replace/text_set、textbox_add、picture_add（支持整页 cover）、table_add、notes_set（演讲备注）、format_uniform（统一字体字号）、shape_zorder、svg_add、slideshow_run（放映）、export（pdf/images）、slide_export_image、security_encrypt_save/decrypt_save（19 写） |

**校对（3，`proofread_*`）**：`proofread_run`（跑错别字/语法校对，`dryRun` 默认 true 只返回问题清单；`dryRun:false` 且未确认会被拒）、`proofread_apply_comments`（把问题清单写成 WPS 批注，需 `confirmed:true`）、`proofread_job_poll`（轮询异步校对任务进度）。

**脱密（4，`declassify_*`）**：`declassify_status`（是否处于脱密态）、`declassify_preview`（按关键词构建遮蔽预览，不写盘）、`declassify_apply`（应用脱密，`confirmed`+`password`+`keywords` 必填，工具描述明令 Never invent a password）、`declassify_restore`（凭密码复原）。注意：这组工具**仅限本机可信通道**（带 `X-Chayuan-Token`）调用，外部 MCP 客户端直调会被拒绝——脱密走 WPS 内「文档脱密/脱密复原」（[W21](./W21-文档脱密.md)/[W22](./W22-脱密复原.md)）。

**知识库与助手（4）**：`kb_retrieve`（检索知识库片段供 LLM 对照推理，只检索不写文档）；`assistants_list_domains` / `assistants_search` / `assistants_get`（检索并导出察元领域助手——数千个助手不注册成工具，按需检索导出提示词）。

**生图与素材（2）**：`image_search`（网络搜图存本地返回路径）、`generate_image`（按已配置生图模型生成，PPT 宿主自动按页面比例 16:9）。

**模板与文件（2）**：`template_generate`（按模板 pptx/docx/xlsx + 参考素材后台生成整套新文档并自动打开，自带占位残留/溢出/字体一致性等多轮核对）；`file_parse`（把本地文件/面板附件解析为大模型可读文本，1-8 个路径，支持 docx/xlsx/pptx/pdf/eml/zip 等，token 预算与分块翻页）。

**内部（1）**：`chat_turn`（助手面板内部用它发起对话回合，非给外部 LLM 用）。

**写确认纪律（`confirmed` 协议字段）**

- 所有落盘写动作：不带 `confirmed:true` 时要么返回 `preview:true` 预览（replace/insert/apply_ops），要么直接报 `CONFIRMATION_REQUIRED`（加批注、校对写回、脱密等硬确认项）。
- WPS 加载项内部链路另有一层保险：面板侧对察元写工具**无条件注入** `confirmed:true` 且先剥除模型入参里的 confirmed（单一来源纪律），保证内部对话链路的确认由面板统一把控；外部 MCP 客户端则由调用方（智能体按用户指令）显式传 `confirmed`。
- 每次确认写都会记入审计日志。

**辅助发现：Resources 与 Prompts**

- Resources：`chayuan://wps/health`（分层健康）、`chayuan://guide/user-intents`（用户意图→工具编排剧本）、`chayuan://guide/tool-routing`（层路由：改字 vs 改样子 vs 批注/修订 vs 版式）、`chayuan://assistants/manifest`、`chayuan://assistants/domain/{domain}`、`chayuan://assistants/{id}`。
- Prompts：`para_translate_insert_after`（逐段翻译插段后）、`open_local_document`（打开本地文档）。

**长任务桥与代理**

- `/agent/register·poll·result`（加 `/agent/heartbeat`、`/agent/status`）是 WPS 加载项专属长轮询通道，全部要求 `X-Chayuan-Token`；外部客户端的工具调用由 sidecar 经此桥投递给 WPS 执行。
- `/upstream/*` 是给面板内多 MCP 客户端用的 HTTP 代理，仅放行 allowlist 内的 URL（allowlist 写入需 token），规避 WebView CORS。

**审计与描述规范**

- `audit.jsonl`（dataDir 下）记录每次确认写、任务派发/结果/超时，兼作运行日志；排障时与 WPS 侧日志相互印证。
- 每条工具描述按 WHAT/WHEN/NOT/HOW/EXAMPLE 五段编写（让模型自己会选工具），并附 annotations 提示：`readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`。

### 验证

1. 用 MCP Inspector（`npx @modelcontextprotocol/inspector`，Streamable HTTP 连 `http://127.0.0.1:62588/mcp`）点 Connect → 列出全部工具，数一数与本文 53 个口径一致，工具描述含 WHAT/WHEN 等五段与 annotations。
2. 让智能体调 `wps_status`：返回 `agent.agentOnline:true` 且 `document.*` 是你当前文档。
3. 无确认写试探：让它「把某词替换为某词」但不许带确认——应看到返回预览（`preview:true`）而文档未变；说「确认执行」后才落盘，且 `audit.jsonl` 出现一条 `"confirmed": true` 记录。

## 常见问题

**Q1：文档很长，一读就报 `DOCUMENT_TOO_LARGE`？**
约 8 万字符以上禁止默认拉全文（防撑爆上下文）。正确姿势：`document_meta` 看建议 → `document_chunks`（`cursor`/`limit`）逐块处理 → 汇总带锚点的操作 → `document_apply_ops` 一次写回。解析**非当前打开**的文件用 `file_parse`。

**Q2：智能体说「工具不存在」或用了奇怪的工具名？**
让它改用域工具 + action（如 `comment(action=add)` 而不是 `document_add_comment`——后者是旧名，仅一个版本内兼容）。服务级 instructions 与 `chayuan://guide/tool-routing` 都会引导模型正确选型；也可把 `chayuan://guide/user-intents` 喂给它。

**Q3：怎么让校对「只挑问题、我确认后再写批注」？**
直接说：「先 `proofread_run` dryRun 汇总问题，不要改正文；我确认后再写成批注。」dryRun 默认只出问题清单；写批注必须 `confirmed:true`，钉在具体文字上（含表格内）。

**Q4：表格和演示操作没反应？**
`spreadsheet.*` 需要 WPS **表格**（et）宿主在线、`presentation.*` 需 **演示**（wpp）宿主在线——`wps_status` 的 `agent.hosts` 能看各宿主是否在线；可用 `wps_launch` 指定宿主拉起。文档内表格（文字端）则用 `table` 域，两者不要混。

**Q5：出错码怎么看？**
常见：`WPS_AGENT_OFFLINE`（WPS/加载项未连 sidecar）、`DOCUMENT_TOO_LARGE`（改用 chunks）、`LOCATE_MISMATCH/LOCATE_NOT_FOUND`（锚点失效，重新 locate）、`CONFIRMATION_REQUIRED`（写操作没传 confirmed）、`LICENSE_REQUIRED`（免费额度用尽或需授权，不弹购买窗）、`MODEL_NOT_CONFIGURED`（校对模型未配置）。

## 事实来源

- `mcp-sidecar/lib/toolCatalog.mjs`（`SERVER_INFO = { name: 'chayuan-wps-mcp', version: '0.13.0' }`；工具定义 69 个——CORE 65 + IMAGE 2 + TEMPLATE 1 + FILE 1；`SERVER_INSTRUCTIONS` 全文；document_*/format_*/proofread_*/declassify_*/kb_retrieve/assistants_*/chat_turn/image_search/generate_image/template_generate/file_parse 描述与 schema 原文；实测 `import` 后 `TOOLS.length === 53`）
- `mcp-sidecar/lib/aggregateTools.mjs`（17 个域聚合工具与 `LEGACY_TOOL_ALIASES` 33 个旧名；`spreadsheet` 23 动作=6 只读+17 需确认、`presentation` 23 动作=4 只读+19 需确认、`table` 12 动作；`resolveAggregateCall` 的 requireConfirmed 标注）
- `mcp-sidecar/lib/mcpHandler.mjs`（Resources 六项与 Prompts 两项、`CONFIRMATION_REQUIRED` 出口、`proofread_run` dryRun 默认、declassify 非可信通道拒绝、审计打点）
- `mcp-sidecar/server.mjs`（`/agent/*` token 门禁、`/upstream/*` allowlist、audit 兼运行日志、启动鉴权说明）
- `src/services/mcpBridge/agentCoreSkill.js`（「confirmed 只能由客户端注入」单一来源：模型入参 confirmed 一律剥除，本层对写工具无条件注入）
- `docs/mcp-tool-descriptions.md`（描述结构 WHAT/WHEN/NOT/HOW/EXAMPLE + annotations；Resource `chayuan://guide/user-intents` 与两个 Prompt）
- `docs/mcp-connection.md`（confirmed 策略表、长文剧本、错误码表、不把数千助手注册成工具的口径）
- 互链：`docs/user-tutorials/W21-文档脱密.md`、`W22-脱密复原.md`、`W37`、`W38`
