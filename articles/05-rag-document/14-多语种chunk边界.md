# 多语种文档的chunk边界 中英日并存的处理

chayuan-desktop 桌面单机版的文档 RAG 支持多语种。但是中英文混合甚至中英日韩混合的文档怎么切 chunk 是个细节问题。这一篇讲多语种文档的处理。

先看为什么中英文 chunk 不同。中文按字符切（每个汉字一个 token），英文按 word 切（一个 word 一个 token）。同样 512 token 的 chunk size，中文大约 1000 字符，英文大约 2500 字符。如果直接按 token 数切，中英文混合段落的物理长度差异大。

chayuan-desktop 的处理。用嵌入模型的 tokenizer 实际计算 token 数，自适应中英文。bge-m3 是多语种 tokenizer，中英文都能正确处理。chunk_size 512 token 在中文段落和英文段落上各自合理。

句子边界识别。中英文的句子结束符不同。中文用 。！？，英文用 . ! ?。chayuan-desktop 的 chunker 同时识别这两类，按句子边界切，避免半截句子。

段落边界识别。中英文都用换行符分段，处理一致。

日韩文档。chayuan-desktop 用的 tokenizer 支持日韩。日文有 。。！等多种结束符，韩文有 . 加空格。chunker 都覆盖。

混合段落。一段话里中英文混合（比如技术文档常见）。chayuan-desktop 不区分内部语言，按整段处理。tokenizer 计算 token 数时自动按语言切分。

跨语种引用。某些文档中文章节之后跟英文翻译，或者反之。chayuan-desktop 把中英文章节当作不同 chunk（不强制合并），让检索能精准命中所需语种的内容。

embedding 模型的多语言能力。bge-m3 在多语言基准上表现很好，能跨语种检索。比如用中文 query 召回英文 chunk（语义相同的话）。这种 跨语种检索 让用户不用纠结 资料是什么语言写的。

实测对比。chayuan-desktop 在自家中英混合 KB 上跑过测试：中文 query 召回中文 chunk 的 recall@5 是 0.91，召回英文 chunk 是 0.78（因为 query 和 chunk 跨语种）。英文 query 类似。这种 跨语种召回 比想象中可用。

非主流语种。chayuan-desktop 的默认 bge-m3 支持 100+ 种语言。但小语种（藏文、维吾尔文、蒙文等）的精度可能下降。如果你主要处理小语种文档，建议换专门的小语种嵌入模型。

OCR 多语种。RapidOCR 默认支持中英双语。日文需要单独的日文 OCR 模型，韩文同理。chayuan-desktop 当前不内置日韩 OCR，国际场景需要用户自己接入。

语种检测。chayuan-desktop 在文档解析后用语种检测库（langdetect 或 fasttext）识别每个 chunk 的主要语种。识别结果写到 metadata，方便检索时按语种过滤。

繁体中文。chayuan-desktop 的处理跟简体中文一致（不区分简繁）。bge-m3 能跨简繁体召回（语义相同的话）。如果用户场景纯繁体，建议用简繁转换工具统一到一种风格再入库，或者就让多版本共存。

中英混合 chunk 的检索效果。chayuan-desktop 实测在产品手册（中英技术术语混合）上检索精度跟纯中文文档接近。原因是 bge-m3 的训练涵盖了大量混合语言数据。

国产化支持下的多语种。中国办公文档以中文为主，但偶尔涉及英文（厂商名、技术术语、缩写）。chayuan-desktop 的处理跟普通中文文档一致，无需特殊配置。日韩文档在涉外业务中常见，chayuan-desktop 的多语种支持让这些场景一并覆盖。

提示工程层面。chayuan-desktop 的 prompt 模板默认是中文。如果用户问英文 query，模型也用英文回答（按 query 语言走）。引用气泡的展示语言跟答案一致。

WPS AI 插件 chayuan-wps 在 WPS 文字里支持多语种文档。加载项里中英文混合段落跟桌面客户端一致处理。

多语种 chunk 边界处理是 chayuan-desktop 国际化的基础。免费开源的AI软件 想覆盖国际办公场景，多语种是必经一关。chayuan-desktop 的现有处理在主流语种上够用，小语种可以扩展。
