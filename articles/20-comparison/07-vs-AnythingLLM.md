# 察元 AI vs AnythingLLM 文档 RAG 的差异

chayuan-desktop 跟 AnythingLLM 在文档 RAG 上的差异。这一篇讲。

## AnythingLLM 是什么

Mintplex Labs 开源的 RAG 应用。

文档上传 → 嵌入 → 检索。

接多模型（OpenAI、Anthropic、Ollama 等）。

桌面 + Web 双形态。

文档 RAG 强。

## chayuan-desktop 的对应

文档 RAG 也强。但不只这个。

5 类知识源（doc:* 是其中一类）。

WPS 集成。

国产化。

模型对抗。

更广。

## 文档 RAG 细节对比

文档类型支持。

| 类型 | AnythingLLM | chayuan-desktop |
|---|---|---|
| PDF | ✓ | ✓ |
| docx | ✓ | ✓ |
| md | ✓ | ✓ |
| html | ✓ | ✓ |
| pptx | ✓ | ✓ |
| xlsx | 弱 | ✓ + 结构化模式 |
| 扫描件 OCR | ✓ | ✓ + RapidOCR |
| 中文古籍 | 一般 | ✓ + 路线图 |
| 公文（红头文件） | 不专门 | ✓ + 印章识别 |

chayuan-desktop 在中文文档支持更深。

## 嵌入模型

AnythingLLM：默认 OpenAI text-embedding。能切换。

chayuan-desktop：默认 bge-m3-onnx（本地，国产开源）。

完全离线 chayuan-desktop 优势。

## 重排

AnythingLLM：基础或无。

chayuan-desktop：bce-reranker（国产开源）默认开。

精度提升明显。

## 引用回链

AnythingLLM：chunk 显示 + 文档跳转。

chayuan-desktop：完整引用气泡（颜色编码 + 页码 + bbox + 跳转 WPS 段落）。

更精细。

## chunk 切分策略

AnythingLLM：固定 size + overlap。

chayuan-desktop：固定 size + overlap + 章节感知 + 表格感知 + 公式感知。

更聪明。

## 多 KB 管理

AnythingLLM：workspace 概念（多 workspace 各自 KB）。

chayuan-desktop：5 类 KB + ku_ids 抽象 + 跨类型混合检索。

更灵活。

## 私库

AnythingLLM：workspace 隔离（基础）。

chayuan-desktop：office:* 命名空间 + RBAC + 颜色编码 + 隐私警示。

完整。

## 多模态

AnythingLLM：基础视觉。

chayuan-desktop：视觉 / 语音 / 图像生成 / 视频处理完整。

## 国产化

AnythingLLM：国际项目。国产化适配少。

chayuan-desktop：国产化核心。

## WPS 集成

AnythingLLM：无。

chayuan-desktop：chayuan-wps 深度集成。

## 适合的用户

AnythingLLM 适合。

简单文档 RAG。

国际开发者。

不需要 WPS / 国产化。

工具能力一般。

chayuan-desktop 适合。

中国用户。

办公场景（WPS）。

复杂多源 KB。

党政军合规。

## 共存

某些用户两个都用。

AnythingLLM 处理某些专门场景。

chayuan-desktop 主用。

不冲突。

## 总结

察元 AI vs AnythingLLM 在文档 RAG 重叠但范围不同。免费开源的AI软件 各有侧重。chayuan-desktop 的多 KB + 国产化 + WPS + 完整多模态让它适合更广办公场景。AnythingLLM 在简单文档 RAG 上专注。
