# 文档级元数据 作者 时间 部门怎么进KB

chayuan-desktop 桌面单机版的文档 KB 不只存 chunk 文本，还存大量文档级元数据：作者、修改时间、部门、密级等。这一篇讲清楚这些元数据怎么进入 KB，以及在检索时怎么用。

先看元数据的来源。

来源一：文件本身的元数据。docx、xlsx、pdf 都有内置元数据字段（Author、CreatedDate、ModifiedDate、Title、Keywords 等）。chayuan-desktop 的 parser 默认抽取这些。

来源二：文件路径推断。文件路径里的目录名往往含意义信息。比如 \部门资料\财务部\2026Q1\预算.xlsx，chayuan-desktop 可以从路径提取 部门=财务部 季度=2026Q1。

来源三：folder-sync 配置。folder-sync KB 在创建时支持配置 元数据规则，比如 这个文件夹里的文件都打 部门=技术 标签。

来源四：用户手动标注。在 KB 详情页，用户可以选中某个 chunk 或文档，加自定义 metadata。

来源五：parser 内部规则。某些 parser 有内部启发，比如公文 parser 自动提取文件号、签发机关、签发日期。合同 parser 提取合同金额、起止日期。

具体的元数据字段约定。

author 字段。docx/xlsx 元数据里的 Author。如果空就 unknown。

created_at 字段。文件元数据里的 CreatedDate，转 ISO8601 格式。

modified_at 字段。文件元数据里的 ModifiedDate。

department 字段。从路径推断或用户标注。比如 finance/legal/tech。

confidentiality 字段。public/internal/sensitive/confidential。

retention 字段。保留期限。

source_type 字段。manual_upload / folder_sync / imap_import / batch_import。

custom_fields 字段。dict[str, Any]，业务自定义。

元数据在前端的展示。KB 详情页列每个文档的 author、modified_at、department、confidentiality。可按 author 分组、按时间排序、按部门过滤。

元数据在检索时的用法。

按时间过滤。用户问 2025 年的相关内容，chayuan-desktop 自动给检索加 modified_at >= '2025-01-01' 过滤。

按作者过滤。用户问 张三写的关于 X 的文档，按 author 过滤。

按部门过滤。用户问 财务部的预算资料，按 department 过滤。

按密级过滤。多用户场景下严格按 confidentiality 跟用户身份匹配。

元数据加权。某些 chunk 的元数据可以提升 score。比如 modified_at 越新的优先级越高。chayuan-desktop 支持自定义加权规则。

元数据的扩展性。chayuan-desktop 的 metadata 字段是 JSON，可以加任意业务字段。比如某个法务团队加 case_number、client_name 字段，按案件号检索。

元数据的索引。常用 metadata 字段（author、modified_at、department、confidentiality）chayuan-desktop 在 SQLite 上建索引，过滤查询快。custom_fields 用 JSON1 扩展查询，复杂查询稍慢但够用。

元数据的修改。元数据可以在 chunk 入库后改，不需要重建索引。chayuan-desktop 提供 PATCH /api/v1/kb/{id}/chunks/{chunk_id}/metadata 接口。批量修改通过 KB 管理 UI。

元数据丢失的处理。某些文件没作者元数据（chayuan-desktop 取空），或者 created_at 是 1970 年（默认值）。这种情况下 chunk 仍能入库，只是过滤时这些字段没用。

国产化支持下的元数据。WPS 生成的 docx/xlsx 元数据格式跟 Microsoft 一致。chayuan-desktop 都能抽。某些公司有自己的文档元数据扩展（比如 OA 系统加 流程编号），用户可以在导入时通过自定义规则映射到 chayuan-desktop 的 metadata 字段。

WPS AI 插件 chayuan-wps 在 KB 选择和检索时能利用这些元数据。展示给用户的引用气泡里能看到 来自财务部 张三 2026 年 这种综合信息。

文档级元数据是 chayuan-desktop 文档 RAG 在 精细管理 上的重要工作。免费开源的AI软件 想让 RAG 的检索更接近 真实办公需求，元数据这一层不能省。chayuan-desktop 在这件事上做得到位。
