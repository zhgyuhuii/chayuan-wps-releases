# 察元 AI · 察元智库 — 硬件最低配置要求

> 桌面版分两档发布:**轻量版（Lite）** 和 **全量版（Full）**。两者前端、UI、知识库、文档审核等业务能力完全一致;差异仅在「随包内置的本地推理模型」和「本机离线推理覆盖范围」。

适用版本:v3.x  (生成日期 2026-05-16)

---

## 一句话总览

| 版本 | 安装包 | 磁盘占用 | 内存(空闲) | 推荐内存 | 离线能力 |
|---|---:|---:|---:|---:|---|
| **轻量版** | ~ 0.9 GB | ~ 1.5 GB | ≥ 4 GB | 8 GB | 文本嵌入 / 重排 / OCR / ASR;**不含**离线对话和图像嵌入 |
| **全量版** | ~ 3.7 GB | ~ 5 GB | ≥ 8 GB | 16 GB | 5 类本地能力(对话 / 嵌入 / 重排 / ASR / 图像嵌入)+ OCR 全部离线 |

> 轻量版需要联网调用云端对话模型(DeepSeek / 智谱 / OpenAI / 通义 等可配置);全量版在没有任何外网的环境下也能完成「文档问答 / 字词审核 / 语音转写 / 图文检索」。

---

## 共用最低配置(两版都满足)

### CPU

| 架构 | 最低 | 推荐 | 备注 |
|---|---|---|---|
| x86_64 | Intel/AMD 4 核、支持 AVX2 (2013 年 Haswell 之后) | 6 核 12 线程以上(Ryzen 5 5600 / i5-12400 等) | AVX2 是 llama.cpp / whisper.cpp 推理的硬性要求,2011 之前的老 Xeon 走 `vendor/services/<engine>-server/win-x64-noavx/` fallback,但实测 < 1 token/s,不建议 |
| ARM64 | Apple M1 / 树莓派 5 8GB / 飞腾 D2000 等 | Apple M2 Pro / 鲲鹏 920 8 核 | 国产化场景已验证麒麟 V10 SP3 ARM64 + 飞腾 D2000 |

### 操作系统

| 平台 | 最低 | 推荐 | 备注 |
|---|---|---|---|
| Windows | Windows 10 21H2 (64-bit) | Windows 11 23H2 | 需 WebView2 Runtime(系统自带 / 也会随安装包补装) |
| macOS | 11 Big Sur | 14 Sonoma / Apple Silicon | Apple Silicon 用 Metal 加速 llama.cpp,纯 CPU 也能跑 |
| Linux | Ubuntu 22.04 / 麒麟 V10 SP3 / UOS V20 1060 / openKylin 2.0 | Ubuntu 24.04 LTS | glibc ≥ 2.31;ARM64 与 x86_64 均验证 |

### 网络

| 用途 | 必需 |
|---|---|
| 首次安装后联网激活 | ✗(完全离线可用) |
| 模型/语料增量更新 | 可选(在线模型广场) |
| 云端模型对接(DeepSeek/OpenAI/Qwen Plus 等) | 仅轻量版的对话能力必需 |

### 磁盘

| 项目 | 轻量版 | 全量版 |
|---|---:|---:|
| 应用本体(Tauri 壳 + Python 解释器 + 前端) | ~ 600 MB | ~ 600 MB |
| 内置模型(bundled_models/) | ~ 0.9 GB | ~ 3.7 GB |
| 数据目录(CHAYUAN_ROOT,知识库+索引+对话历史) | ≥ 500 MB | ≥ 1 GB |
| **下限合计** | **~ 2 GB** | **~ 5 GB** |
| **建议预留** | 10 GB | 30 GB |

> 数据目录可通过「设置 → 数据目录」搬到任意盘符;模型权重单独管理,可随时增删。

---

## 轻量版(Lite) — 详细配置

**定位:** 业务前台、办公笔记本、移动场景、低端机型、纯文本知识库场景。不在本机跑大模型对话,把对话推理外包给云端 API。

### 硬件要求

| 项目 | 最低 | 推荐 |
|---|---|---|
| CPU | 2.0 GHz / 4 核(支持 AVX2) | 2.6 GHz / 6 核 |
| 内存 | 4 GB | 8 GB |
| 磁盘可用 | 2 GB | 10 GB |
| GPU | 无需 | 无需 |
| 显存 | 0 | 0 |

### 随包内置的本地推理能力

| 能力 | 引擎 | 模型 | 体积 | 离线? |
|---|---|---|---:|:---:|
| 文本嵌入 | llama-server | gte-multilingual-base Q8 (mGTE) | 300 MB | ✅ |
| 重排 | llama-server | bge-reranker-v2-m3 Q8 | 600 MB | ✅ |
| 语音识别 | whisper.cpp | whisper-tiny f16 | 74 MB | ✅ |
| OCR(图像识字) | onnxruntime | RapidOCR PP-OCRv4 (det+rec+cls) | 16 MB | ✅ |
| **对话** | **云端 API** | **由用户自配 DeepSeek/智谱/OpenAI/Qwen Plus 等** | **0** | **❌ 需联网** |

### 适合场景

- 个人办公笔记本(MacBook Air M1 / ThinkPad X1 8 代以下)
- 公司发的"上网本"配置(i5-1135G7 / 8GB / 256GB)
- WPS 加载项 + 桌面端配套使用,核心需求是文档 RAG / 字词审核 / OCR / 录音转写,大模型对话愿意付云端费用
- 内网严格但允许向特定 API 网关出站的部门(如银行办公网调内部 LLM 中台)

### 不适合场景

- 完全内网(政府秘密室、监所、保密外协)→ 改用全量版
- 重度长对话用户(50 万 token+/月)→ 云端 token 费用 > 全量版自托管

---

## 全量版(Full) — 详细配置

**定位:** 涉密办公、私有云、央国企内网、麒麟/UOS/openKylin 国产化,要求 100% 离线 + 100% 数据不出网。所有 6 类能力本地跑通。

### 硬件要求

| 项目 | 最低(只跑 CPU,Q3_K_S) | 推荐(舒适体验) | 旗舰(GPU 加速) |
|---|---|---|---|
| CPU | 3.0 GHz / 6 核 (支持 AVX2) | Ryzen 5 7600X / i5-13500 / M2 Pro | i7-14700K / Ryzen 9 7900X / M3 Max |
| 内存 | 8 GB | 16 GB | 32 GB+ |
| 磁盘可用(SSD 强烈推荐) | 5 GB | 30 GB | 50 GB |
| GPU(可选) | 无 | NVIDIA RTX 3060 4GB | RTX 4070 8GB+ / Apple M3 Max |
| 显存 | 0(全 CPU 推理) | ≥ 4 GB(chat 全卸载到 GPU) | ≥ 8 GB |

### 性能基线(实测,Qwen3-4B Q3_K_S 对话)

| 硬件 | 输出速率 | 首 token 延迟 | 同时能跑的 capability |
|---|---:|---:|---|
| ThinkPad T14 / i7-1260P / 16GB(纯 CPU) | ~ 6 tok/s | ~ 1.5 s | chat + embedding + rerank(asr/image-embed 按需) |
| Mac mini M2 / 16GB(Metal 加速) | ~ 22 tok/s | ~ 0.4 s | 全 6 类同时 |
| 桌面 PC / Ryzen 5800X + RTX 3060 / 32GB | ~ 35 tok/s | ~ 0.2 s | 全 6 类 + 文档 batch 索引并行 |
| 服务器 / Xeon 8358 + 64GB(纯 CPU) | ~ 9 tok/s | ~ 1.0 s | 全 6 类 + 多用户并发 |

> 对话速率 ≥ 5 tok/s 时人类阅读体感"等不到"。低于该值时建议:换 Q4 量化(更小但推理略快) / 升级 GPU / 改用轻量版调云端。

### 全部 6 类本地推理能力

| 能力 | 引擎 | 模型 | 体积 | 端口 |
|---|---|---|---:|---:|
| 对话(chat) | llama-server | Qwen3-4B-Instruct-2507 Q3_K_S | 1.85 GB | 62582 |
| 文本嵌入(embedding) | llama-server | mGTE Q8 (Alibaba gte-multilingual-base) | 300 MB | 62583 |
| 重排(rerank) | llama-server | bge-reranker-v2-m3 Q8 (BAAI) | 600 MB | 62584 |
| 语音识别(asr) | whisper.cpp | whisper-tiny(可换 base / small / medium) | 74 MB+ | 62585 |
| 图像嵌入(image-embedding) | infinity sidecar (Python) | OpenAI CLIP ViT-B/32 | 605 MB | 62586 |
| OCR | onnxruntime(同进程) | RapidOCR PP-OCRv4 | 16 MB | (内嵌) |

> 模型可后续单独升级:跑 `scripts/install-bundled-models.ps1 -Only chat -CleanCap` 替换为 Qwen3-7B / Qwen2.5-14B 等;只要硬件吃得下都行。

### 适合场景

- 党政机关、军工、医疗、金融保密办公(数据出网即违规)
- 央企/国企国产化替代(麒麟 / UOS / openKylin + 飞腾 / 鲲鹏)
- 私有云一键打包整本部署(把整个 bundled_models 同包随发)
- 高频长对话(开发者写代码助手、客服、内容创作)节省云端 token 成本

### 不适合场景

- 4GB 内存的旧机器(连 Q3_K_S 都跑不动)→ 用轻量版
- 完全无业务必要本地推理(只是想看看)→ 用轻量版

---

## GPU 加速详细矩阵

| GPU | chat 卸载 | embedding | rerank | image-embed | 备注 |
|---|---|---|---|---|---|
| **无 / iGPU**(Intel HD / Vega) | 纯 CPU | 纯 CPU | 纯 CPU | 纯 CPU | 全 CPU 推理 fallback,Q3_K_S 还能用 |
| **Apple M1/M2/M3** | Metal 全卸载 | Metal | Metal | CPU | macOS 全自动,无需任何配置 |
| **NVIDIA RTX 30/40 系**(4GB+) | CUDA 全卸载 | CUDA | CUDA | CUDA | Windows/Linux,需装 CUDA 12 runtime |
| **NVIDIA T4 / A10G / A100**(数据中心卡) | CUDA 全卸载 + 大上下文 | 同左 | 同左 | 同左 | 服务器部署,可起更大模型 |
| **AMD ROCm**(7900 XTX / W7900) | 实验性 | 实验性 | 实验性 | CPU | 仅 Linux,部分发行版需手动 patch |
| **Intel Arc A380/A770** | 实验性(IPEX-LLM) | 实验性 | 实验性 | CPU | 暂未官方支持,等待 SYCL 后端成熟 |

> 启动 GPU 加速无需手动配置:`vendor/services/llama-server/` 下放对应平台的 cuBLAS / Metal / ROCm 构建,运行时自动探测。

---

## 国产化适配(麒麟 / UOS / openKylin)

| 发行版 | 架构 | 状态 | 备注 |
|---|---|:---:|---|
| 麒麟 V10 SP3 桌面 | x86_64 | ✅ 已验证 | Tauri WebView 用 wkwebview 后端 |
| 麒麟 V10 SP3 桌面 | ARM64(飞腾 D2000/D3000) | ✅ 已验证 | bundled llama-server linux-arm64 |
| UOS V20 1060 | x86_64 | ✅ 已验证 | 商业版 Pro,部分内核模块需手动 modprobe |
| openKylin 2.0 | x86_64 / ARM64 | ✅ 已验证 | 开源社区版 |
| 中科方德 / 红旗 / 起点 | x86_64 | 兼容 | 未做 CI,但 glibc ≥ 2.31 应该可用 |

国产 CPU(鲲鹏 920 / 飞腾 D2000 / 兆芯 KX-6000)均在 ARM64 / x86_64 标准指令集范围内,无需额外适配。

---

## 升级路径

| 想做什么 | 怎么办 |
|---|---|
| 装更大对话模型(Qwen3-7B / Qwen2.5-14B) | 全量版 → 设置 → 本地模型服务 → chat 模型下拉 → 选;首次会从镜像源下,需联网 |
| 把语音识别升到中文 SOTA | asr 模型换 FunASR Paraformer-zh(800 MB,中文 WER ~5%) |
| 接入企业大模型 / 数据集 | 至臻版(商业授权,服务化部署,详见官网) |
| 接 GPU 显卡加速 | 装好显卡驱动 + CUDA 12 / ROCm 5.7,启动 chat 自动检测,无需改设置 |

---

## 故障排查速查

| 现象 | 可能原因 | 解决 |
|---|---|---|
| 启动后状态徽标全灰 | 5s 轮询还没启动 | 等 5 秒 / 按"刷新"按钮 |
| 启动 chat 报 "AVX2 not available" | CPU 老于 2013 年 | 改用轻量版(无本地对话);或装 noavx fallback binary |
| 启动 chat 内存爆炸 | 模型 + 上下文超过物理内存 | 换 Q3_K_S → Q2_K(质量略降)/ 升级到 16GB 内存 |
| ASR 转写速度 < 1×(比实时还慢) | tiny 在低端 CPU 上慢 | 装更小的 base/tiny.en;或开 GPU |
| 知识库索引慢 / 文档导入超时 | embedding 跑 CPU + 大文档 | 上 GPU;或夜间批跑 |

详细日志在 `<CHAYUAN_ROOT>/logs/` 下;诊断报告:**设置 → 本地模型服务 → 诊断** 一键拿。

---

## 版本下载

- 轻量版下载: <https://aidooo.com/download/lite>
- 全量版下载: <https://aidooo.com/download/full>
- 商业咨询(至臻版): cmdbird@163.com

不确定选哪个?**先装轻量版**;不够用再换全量版,数据目录可直接继承,知识库无需重建。
