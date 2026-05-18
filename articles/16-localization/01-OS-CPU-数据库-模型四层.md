# 国产化支持是个综合命题 OS CPU 数据库 模型四层

chayuan-desktop 桌面单机版的 国产化支持 是一个综合工程。涉及操作系统、CPU 架构、数据库、模型多层。这一篇做总览。

第一层：操作系统。

麒麟桌面 V10。

统信 UOS 1060。

openKylin。

deepin。

中标麒麟、银河麒麟服务器版。

chayuan-desktop 对这些 OS 都有专门发行包。deb 格式为主，rpm 视情况。

第二层：CPU 架构。

x86_64。Intel/AMD 通用平台。

aarch64。飞腾 D2000、鲲鹏 920。

loongarch64。龙芯 3A5000、3A6000。

mips64。早期国产 CPU（少见）。

chayuan-desktop 在 x86_64 跟 aarch64 上覆盖完整。loongarch64 通过专门构建链支持。mips64 不主流，按需。

第三层：数据库。

达梦 DM。商用国产代表。

金仓 KingbaseES。基于 PG 国产化版本。

人大金仓另一些版本。

GaussDB（华为）。

OceanBase（蚂蚁）。

TiDB（PingCAP）。

Doris（百度开源）。

StarRocks。

chayuan-desktop 通过 src:* 外部源接入。SQLAlchemy dialect 处理方言差异。

第四层：模型。

国产 LLM。文心、通义、智谱、豆包、DeepSeek、Moonshot、Yi、商汤、讯飞、Minimax。

国产嵌入。bge 系列（智源）、bce（网易）、GTE（阿里）。

国产重排。bce-reranker（网易）。

国产 OCR。RapidOCR（基于 PaddleOCR）。

国产 ASR。FunASR（达摩院）、paraformer。

国产 TTS。cosyvoice（阿里）、PaddleTTS。

国产视觉。通义 VL、文心 Vision、智谱 GLM-4V。

四层都有国产选择。

整体国产化部署。

OS：麒麟 UOS。

CPU：飞腾 D2000 / 鲲鹏 920。

数据库：达梦 DM。

向量库：自建 Milvus 或 RT。

LLM：本地 Ollama 跑 DeepSeek 7B。

嵌入：bge-m3-onnx。

重排：bce-reranker。

OCR：RapidOCR。

办公：WPS Office Linux 版 + chayuan-wps 加载项。

整套配下来 100% 国产化清单覆盖。

合规价值。

等保 2.0。chayuan-desktop 的审计、PII 脱敏、加密存储满足等保要求。

信创清单。chayuan-desktop AGPL 开源 + 国产组件。覆盖信创主流要求。

党政机关采购。chayuan-desktop 在国产化基础上具备党政机关采购的潜在资格（具体看招标）。

技术挑战。

挑战一：发行版差异。每个国产 OS 细节不同，chayuan-desktop 发行包按 OS 适配。

挑战二：CPU 架构差异。loongarch64 编译链特殊，需要专门 CI。

挑战三：模型适配。国产模型每家协议略有差异，adapter 适配。

挑战四：测试覆盖。国产平台测试机器少，覆盖度比 x86 慢。

WPS AI 插件 chayuan-wps 在国产化场景里跟 chayuan-desktop 一起部署，覆盖 WPS Office Linux 版。

国产化支持的四层综合是 chayuan-desktop 长期投入的方向。免费开源的AI软件 想真正服务中国政企客户，国产化不能只是 部分支持，要全栈覆盖。chayuan-desktop 在这一面的工程深度让 完全国产化 这件事真可达。
