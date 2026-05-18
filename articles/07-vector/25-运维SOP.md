# 一份给运维的向量库选型与运维 SOP

这一篇是 chayuan-desktop 桌面单机版向量库篇章的总结，给负责 chayuan-desktop 部署的运维一份 SOP。

第一步：评估数据规模。

100 万 chunk 以下：sqlite-vec 内嵌（默认）。

100 万-1000 万 chunk：sqlite-vec 仍可，或者 Chroma standalone。

1000 万-亿级 chunk：Qdrant 或 Milvus standalone。

亿级以上：Milvus 集群。

第二步：评估部署形态。

完全本地：sqlite-vec（嵌入）或 Chroma 嵌入式。

公司内网集中：Milvus / Qdrant / ES 集群。

云端托管：Zilliz Cloud / Tencent VectorDB（合规允许情况下）。

第三步：评估合规要求。

数据严格不出域：本地 sqlite-vec 或内网自建。

国产化要求：RT / Relyt / 自建 Milvus + 国产 OS + 国产数据库。

等保 2.0：自建 + 审计 + 备份。

第四步：评估性能要求。

毫秒级延迟：Qdrant > Milvus > sqlite-vec。

中等延迟（100ms 内）：四家都行。

不敏感：sqlite-vec 最简。

第五步：评估运维能力。

零运维：sqlite-vec。

中等运维：Chroma server / Qdrant standalone。

强运维：Milvus 集群。

向量库选型决策表。

| 数据规模 | 部署形态 | 合规 | 推荐 |
|---|---|---|---|
| 100 万以下 | 本地 | 普通 | sqlite-vec |
| 100 万 - 1000 万 | 本地 | 严格 | sqlite-vec |
| 100 万 - 1000 万 | 内网 | 普通 | Chroma standalone / Qdrant |
| 1000 万 - 亿级 | 内网 | 严格 | Qdrant / Milvus |
| 亿级以上 | 内网 | 严格 | Milvus 集群 |
| 任意 | 云端 | 普通 | Zilliz Cloud |

部署 SOP。

第一步。确认 chayuan-desktop 安装包就绪。员工电脑装 chayuan-desktop。

第二步。FirstRunSetup 选 CHAYUAN_ROOT 在独立分区。

第三步。配模型供应商（云端或本地推理）。

第四步。建第一个 KB（doc:* 文档库），用 sqlite-vec。测试基本流程。

第五步。如需要外部向量库，按选型部署 Milvus/Qdrant 等。

第六步。在 chayuan-desktop 配 src:* 外部源，连到外部库。

第七步。建立测试集，跑 eval 评估检索精度。

第八步。设置备份策略（CHAYUAN_ROOT 整体备份 + 外部库各自备份）。

第九步。设置监控（chayuan-desktop sidecar 状态 + 外部库 metrics）。

第十步。培训用户。

运维 SOP。

日常巡检。

每天看 sidecar 日志有无错误。

每周看 KB 健康状态。

每月跑一次 eval 看精度。

每季度做一次恢复演练。

故障响应。

sidecar 不能起：看日志、检查端口、检查 CHAYUAN_ROOT 权限。

外部源不可达：检查网络、检查认证、ping 测试。

检索精度异常：跑 eval 定位、检查 embedding 模型一致性。

升级流程。

确认版本说明（breaking changes）。

备份 CHAYUAN_ROOT。

下载新版本安装包。

关闭 chayuan-desktop。

安装新版本。

启动验证。

如果失败，回滚到老版本 + 恢复备份。

合规审计准备。

audit_log 导出（每月或每季度）。

KB 元数据导出。

PII 脱敏配置确认。

用户访问统计。

性能调优。

慢查询：看 sidecar 日志中的延迟分布，定位慢的 KB 或慢的 SQL。

内存占用：监控 sidecar 内存，必要时增加内存或调小 cache。

磁盘空间：监控 CHAYUAN_ROOT 大小，定期 VACUUM SQLite。

国产化支持下的 SOP。整套 SOP 在国产 OS（麒麟 UOS）和国产 CPU（飞腾、鲲鹏、龙芯）上一致。差异只在 OS 命令（apt 还是 dnf）和某些底层包路径。

跨产品协同。WPS AI 插件 chayuan-wps 的运维跟 chayuan-desktop 一起。装 WPS 加载项、配 服务器地址、测试基本调用。chayuan-desktop 升级时确认加载项兼容性。

这份 SOP 是给 chayuan-desktop 运维同事的导航。免费开源的AI软件 想真正落地企业级使用，运维流程的清晰度决定能不能稳定运行。chayuan-desktop 在 SOP 这一面的工作让 部署到稳态运行 这条路径有迹可循。
