# Bundled Models 固定清单

> 由 `scripts/install-bundled-models.py` 落到 `chayuan-server/vendor/bundled_models/<cap>/<dest_subdir>/`。
> 这份是 **v0 桌面瘦身集** —— 优先 GGUF 单文件 + Q8_0 量化，目的是让 Windows installer < 4 GB 且能纯 CPU 跑通。

## 一句话总览

| capability | 模型 | 量化 | 单文件大小 | 上下文 | 参数量 |
|---|---|---|---:|---:|---:|
| chat | Qwen3-4B-Instruct-2507 | Q3_K_S GGUF | ~1.85 GB | 32 K | 4.0 B |
| embedding | gte-multilingual-base (mGTE) | Q8_0 GGUF | ~300 MB | 8192 | 304 M |
| rerank | bge-reranker-v2-m3 | Q8_0 GGUF | ~600 MB | 8192 | 568 M |
| asr | whisper.cpp tiny | f16 ggml | ~74 MB | 30 s 窗口 | 39 M |
| ocr | RapidOCR PP-OCRv4 | ONNX | ~16 MB | — | det+rec+cls 三件套 |
| image | OpenAI CLIP ViT-B/32 | fp32 | ~605 MB | 77 token / 224² | 151 M |
| **合计** | | | **~3.5 GB** | | |

---

## 1. chat — Qwen3-4B-Instruct-2507

**默认 repo：** `unsloth/Qwen3-4B-Instruct-2507-GGUF`（HF）/ `qwen/Qwen3-4B-Instruct-2507-GGUF`（ModelScope）
**文件：** `*Q3_K_S*.gguf`
**落盘：** `vendor/bundled_models/chat/Qwen3-4B-Instruct-2507-GGUF/`

| 属性 | 值 |
|---|---|
| 参数量 | 4.0 B |
| 上下文 | 32 K（基础 32K，可 YaRN 扩到 128K） |
| 量化 | Q3_K_S（4 bit 以下，体积优先） |
| 单文件大小 | ~1.85 GB |
| FP16 全量 | ~7.5 GB |
| 训练截止 | 2025 Q2 |

### 对比同类（4B 量级 chat）

| 模型 | Q3 / Q4 大小 | 中文 | 工具调用 | 备注 |
|---|---:|:---:|:---:|---|
| **Qwen3-4B-Instruct ★** | ~1.85 GB | A | A | 中文 SOTA, function-calling, 32K ctx |
| Qwen2.5-3B-Instruct | ~1.96 GB Q4 | A | B | 老一代,MS 上稳定,兜底候选 |
| Llama-3.2-3B-Instruct | ~1.9 GB Q4 | B | B | 英文强中文弱 |
| Gemma-3-4B-it | ~2.1 GB Q4 | B | C | 多模态版本另算 |
| Phi-3-mini-4k | ~2.2 GB Q4 | C | B | 4K ctx 偏短 |
| MiniCPM3-4B | ~2.3 GB Q4 | B+ | B | 32K ctx |

**选 Qwen3 的理由：** 中文办公场景 + function-calling + 32K 上下文。Q3_K_S 在 4B 模型上掉点比 7B 明显，但仍是当前 < 2 GB 单文件里中文最强的实例。

---

## 2. embedding — gte-multilingual-base (mGTE)

**默认 repo：** `gpustack/gte-multilingual-base-GGUF` → `second-state/gte-multilingual-base-GGUF` → `Alibaba-NLP/gte-multilingual-base`（safetensors fallback）
**MS：** `iic/gte-multilingual-base`
**文件：** `*Q8_0.gguf`
**落盘：** `vendor/bundled_models/embedding/gte-multilingual-base/`

| 属性 | 值 |
|---|---|
| 参数量 | 304 M |
| 上下文 | **8192**（关键指标 —— 一般 embedding 只有 512） |
| 维度 | 768 |
| 量化 | Q8_0（无损接近 FP16） |
| 单文件大小 | ~300 MB |
| FP16 safetensors | ~1.22 GB |
| 检索方式 | dense（单向量，余弦相似度） |
| 训练 | Alibaba mGTE 系列，2024 Q3 |

### 对比同类多语种 embedding

| 模型 | 参数 | Q8 大小 | ctx | 中文 | 备注 |
|---|---:|---:|---:|:---:|---|
| **gte-multilingual-base ★** | 304 M | ~300 MB | **8192** | A | mGTE，8K ctx 是亮点 |
| bge-m3 | 568 M | ~600 MB | 8192 | A | dense + sparse + colbert 三检索 |
| multilingual-e5-large | 560 M | ~580 MB | 512 | A | 经典强基线但 ctx 短 |
| multilingual-e5-base | 278 M | ~280 MB | 512 | B+ | ctx 短 |
| multilingual-e5-small | 118 M | ~120 MB | 512 | B | demo 用 |
| bge-large-zh-v1.5 | 326 M | ~340 MB | 512 | A | 中文强但仅中文 |
| bge-base-zh-v1.5 | 102 M | ~100 MB | 512 | B+ | 中文,短 ctx |

**选 mGTE base 的理由：**
- **8192 ctx** 直接吃整段 chunk，不用切碎；同价位 e5-large 只有 512
- 体积只有 bge-m3 一半，但 dense 质量在中文 MMTEB 上接近
- 不需要 bge-m3 的 sparse/colbert 复杂度（chayuan-server 检索栈现在只用 dense）

**什么时候该换 bge-m3：** 你需要 hybrid (dense+sparse) 检索 或 长 query reranker-like 多向量打分。

---

## 3. rerank — bge-reranker-v2-m3

**默认 repo：** `gpustack/bge-reranker-v2-m3-GGUF`（HF / MS 都有 mirror）
**文件：** `*Q8_0.gguf`
**落盘：** `vendor/bundled_models/rerank/gte-multilingual-reranker-base/`

| 属性 | 值 |
|---|---|
| 参数量 | 568 M |
| 上下文 | 8192（query + doc 共享） |
| 输入 | [query, doc] pair，输出相关性 logit |
| 量化 | Q8_0 |
| 单文件大小 | ~600 MB |
| FP16 | ~1.14 GB |
| 训练 | BAAI 2024 Q1 |

### 对比同类 reranker

| 模型 | 参数 | Q8 大小 | ctx | 多语种 | 备注 |
|---|---:|---:|---:|:---:|---|
| **bge-reranker-v2-m3 ★** | 568 M | ~600 MB | 8192 | A | 多语种 reranker SOTA 之一 |
| bge-reranker-large | 560 M | ~580 MB | 512 | B | 仅中英 |
| bge-reranker-base | 278 M | ~280 MB | 512 | B | 短 ctx |
| gte-multilingual-reranker-base | 304 M | ~300 MB | 8192 | A | 比 bge-rerank-v2-m3 小一半，质量接近 |
| jina-reranker-v2-base-multilingual | 278 M | ~280 MB | 1024 | A | 中文偏弱 |
| Cohere rerank-multilingual-v3 | API only | — | 4096 | A | 商用 API |

**选 bge-reranker-v2-m3 的理由：** 现在的事实标准；llama-server 加 `--reranking` 直接吃 GGUF。

**潜在切换：** 后续想再瘦身 300 MB，可换 `gte-multilingual-reranker-base`（Alibaba 自家的同代 reranker，体积一半，质量接近）。

---

## 4. asr — whisper.cpp tiny

**默认 repo：** `ggerganov/whisper.cpp`
**文件：** `ggml-tiny.bin`
**落盘：** `vendor/bundled_models/asr/whisper.cpp/`
**Runtime：** `whisper-server.exe`（`scripts/install-whisper-server.ps1`）

| 属性 | 值 |
|---|---|
| 参数量 | 39 M |
| 上下文 | 30 秒音频窗口 / 224 token 文本 |
| 采样率 | 16 kHz mono |
| 单文件大小 | ~74 MB |
| 中文 WER | ~30%（tiny），~15%（base），~7%（large-v3） |

### 对比同系列

| 规格 | 文件 | 大小 | 中文 WER | 速度（CPU） |
|---|---|---:|---:|---:|
| **tiny ★** | `ggml-tiny.bin` | 74 MB | ~30% | 实时 ~30x |
| base | `ggml-base.bin` | 142 MB | ~15% | 实时 ~16x |
| small | `ggml-small.bin` | 466 MB | ~10% | 实时 ~6x |
| medium | `ggml-medium.bin` | 1.5 GB | ~7% | 实时 ~2x |
| large-v3 | `ggml-large-v3.bin` | 3 GB | ~5% | 实时 ~1x |
| FunASR Paraformer-zh | — | 800 MB | ~5%（中文 SOTA） | 实时 ~3x |

**选 tiny 的理由：** 桌面 v0 默认要保 < 100 MB，演示+短指令场景够用。**生产建议升 base** 或换 FunASR Paraformer-zh。

---

## 5. ocr — RapidOCR PP-OCRv4

**默认 repo：** `SWHL/RapidOCR`
**文件：** `PP-OCRv4/ch_PP-OCRv4_det_infer.onnx` + `PP-OCRv4/ch_PP-OCRv4_rec_infer.onnx` + `PP-OCRv3/ch_ppocr_mobile_v2.0_cls_train.onnx`
**落盘：** `vendor/bundled_models/ocr/RapidOCR/`
**Runtime：** ONNXRuntime（chayuan-server 进程内）

| 属性 | 值 |
|---|---|
| 三件套合计 | ~16 MB |
| det 模型 | 文字检测，PP-OCRv4 中文 |
| rec 模型 | 文字识别，PP-OCRv4 中文 |
| cls 模型 | 方向分类，PP-OCRv3 mobile |
| 中文文档准确率 | ~95% |

### 对比同类

| 方案 | 大小 | 中文 | 部署 |
|---|---:|:---:|---|
| **RapidOCR PP-OCRv4 ★** | ~16 MB | A | ONNX，纯 CPU 0 依赖 |
| PaddleOCR 原版 | 200 MB+ | A | 要 PaddlePaddle 运行时 |
| Tesseract 5 | ~100 MB | B+ | 老牌但中文偏弱 |
| EasyOCR | 700 MB | B | PyTorch 依赖 |
| TrOCR (HF) | 1.4 GB | C | 偏英文,推理慢 |

**选 RapidOCR 的理由：** 三件套 16 MB 是同类最小，ONNX 没 PaddlePaddle 依赖，中文文档准确率跟 PaddleOCR 原版一致（同模型）。

---

## 6. image — OpenAI CLIP ViT-B/32

**默认 repo：** `openai/clip-vit-base-patch32`
**文件：** `pytorch_model.bin` + 配套 json/txt
**落盘：** `vendor/bundled_models/image/clip-vit-base-patch32/`
**Runtime：** infinity_emb Python sidecar（image-embedding 能力，端口 62586）

| 属性 | 值 |
|---|---|
| 参数量 | 151 M |
| 文本编码器 | 77 token 输入 |
| 图像编码器 | 224×224 输入，patch=32 |
| embedding 维度 | 512 |
| 单文件大小 | ~605 MB |
| 训练 | OpenAI 2021，400 M 图文对 |

### 对比同类图文 embedding

| 模型 | 参数 | 大小 | 中文 | 备注 |
|---|---:|---:|:---:|---|
| **CLIP ViT-B/32 ★** | 151 M | ~605 MB | C | OpenAI 原版，事实标准 |
| CLIP ViT-B/16 | 151 M | ~605 MB | C | 更细 patch，精度略高，速度略慢 |
| CLIP ViT-L/14 | 428 M | ~1.7 GB | C | OpenAI L 规格 |
| Chinese-CLIP ViT-B/16 | 188 M | ~750 MB | A | Alibaba 中文 CLIP |
| SigLIP base patch16 | 203 M | ~800 MB | B | Google 2023，多语种更好 |
| jina-clip-v2 | 865 M | ~3.5 GB | A | 长文本 + 多语种 |

**选 CLIP B/32 的理由：** infinity_emb / sentence-transformers 默认就吃这个仓库；体积最小、生态最稳。

**中文场景建议升级：** Chinese-CLIP 或 jina-clip-v2，但体积会翻倍。

---

## 落盘目录结构

```
chayuan-server/vendor/bundled_models/
├── chat/
│   └── Qwen3-4B-Instruct-2507-GGUF/
│       └── Qwen3-4B-Instruct-2507-Q3_K_S.gguf
├── embedding/
│   └── gte-multilingual-base/
│       └── gte-multilingual-base-Q8_0.gguf      (或 safetensors fallback)
├── rerank/
│   └── gte-multilingual-reranker-base/
│       └── bge-reranker-v2-m3-Q8_0.gguf
├── asr/
│   └── whisper.cpp/
│       └── ggml-tiny.bin
├── ocr/
│   └── RapidOCR/
│       ├── PP-OCRv4/
│       │   ├── ch_PP-OCRv4_det_infer.onnx
│       │   └── ch_PP-OCRv4_rec_infer.onnx
│       └── PP-OCRv3/
│           └── ch_ppocr_mobile_v2.0_cls_train.onnx
└── image/
    └── clip-vit-base-patch32/
        ├── pytorch_model.bin
        ├── config.json
        ├── preprocessor_config.json
        ├── tokenizer.json
        ├── tokenizer_config.json
        ├── vocab.json
        ├── merges.txt
        └── special_tokens_map.json
```

## 安装

```powershell
# 一次全下,~3.5 GB,auto fallback HF→MS
.\scripts\install-bundled-models.ps1

# 切换 manifest 后清掉旧文件再装(推荐 v0 → v1 升级时用):
.\scripts\install-bundled-models.ps1 -CleanCap

# 只重装某个能力:
.\scripts\install-bundled-models.ps1 -Only embedding -CleanCap

# 国内 HF 不通,走 ModelScope:
.\scripts\install-bundled-models.ps1 -Source modelscope
```

`-CleanCap` vs `-Clean`：

- `-Clean` 只删 `<cap>/<dest_subdir>/`（同名同路径的旧版本）
- `-CleanCap` 删整个 `<cap>/`，包括之前误下的 `bge-small-en-v1.5-gguf/`、`gte-multilingual-reranker-base-old/` 这种**其他子目录**

切换模型 manifest 后用 `-CleanCap` 保持目录干净。

## 版本

- 文档生成：2026-05-16
- manifest 来源：`scripts/install-bundled-models.py` MANIFEST 常量
- 评级（A/B/C）来源：MMTEB / CMTEB / 内部 chayuan 检索评测
