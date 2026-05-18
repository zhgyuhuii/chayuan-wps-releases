# 国产化支持下文件解析为什么放Python而不是Rust

chayuan-desktop 桌面单机版的文档解析（PDF、Word、Excel、PPT、HTML、Markdown）放在 Python sidecar 里，没有移到 Rust 主进程。这一篇讲为什么这么放，以及国产文档兼容这件事的现实考量。

先看 Python 在文件解析上的生态。PyMuPDF 处理 PDF，python-docx 处理 Word，openpyxl 处理 Excel，python-pptx 处理 PPT，markdown 处理 MD，beautifulsoup 处理 HTML。这些库都是 Python 生态里成熟的方案，覆盖了所有 chayuan-desktop 支持的文件格式。

Rust 的文件解析生态。pdf-rs（PDF）、docx-rs（Word）、calamine（Excel）等。这些库相对新，覆盖度不如 Python，对中文文档的兼容性差。chayuan-desktop 早期评估时跑过 calamine 在中文 Excel 上的测试，发现某些 cell 格式（合并单元格、特殊样式）解析不准。

国产文档兼容的现实。国内办公场景大量使用 WPS Office 生成的 .docx、.xlsx，这些文件跟 Microsoft Office 的格式偶尔有微妙差异，特别是字体引用、批注格式、表格属性。Python 的 python-docx 和 openpyxl 在处理 WPS 文件上有更好的兼容历史，社区贡献多。

PDF 的特别复杂性。PDF 是个 形态多样 的格式：有些是 真 PDF 有可读文本层，有些是 扫描 PDF 只有图像。chayuan-desktop 用 PyMuPDF 检测文本层，文本层缺失或不完整的走 OCR 兜底（RapidOCR）。这种 双轨 解析在 Python 上写起来直接。

OCR 与 Python 的协作。RapidOCR 是 Python 库，跟 PyMuPDF 配合直接。把 PDF 页渲染成图，调 RapidOCR 识别文字，再回填到 chunk。这个流程如果在 Rust 上要走 FFI 调外部进程，复杂度高。

中文分词。chayuan-desktop 的文档解析在某些场景需要分词（比如 BM25 检索辅助），用 jieba 这种中文分词库。jieba 在 Python 生态成熟，Rust 上没有同等成熟的库。

国产格式扩展。WPS 的 .et（电子表格）、.dps（演示文稿）、.wps（文字）这些专有格式 chayuan-desktop 当前不直接解析（用户可以另存为标准格式）。但如果未来要加这些格式的解析，Python 生态的兼容工具更可能先有。

性能不是瓶颈。文件解析的瓶颈在 IO（磁盘读取）和算力密集步骤（OCR）。Python 解释器开销在这种场景下不显著。chayuan-desktop 解析一份 100 页 PDF（含 OCR）耗时几十秒，Python 跟 Rust 差异微乎其微。

解析失败的诊断。Python 的 traceback 信息丰富，调试解析失败的文件方便。chayuan-desktop 把每次解析失败的诊断（文件名、错误类型、stack trace）写到日志，用户能看到哪份文档没解析成功。

解析线程化。Python 的 GIL 在 CPU 密集场景下限制并发，但文件解析大量是 IO 等待和 C 扩展（PyMuPDF 内部是 C++）。这两类操作 GIL 都会释放。chayuan-desktop 用 asyncio 加 thread pool 跑解析，并发吞吐量足够。

跟 sidecar 内部其他模块的协作。文件解析放 Python sidecar 里，跟 RAG 入库、嵌入计算、metadata 写入是同进程。中间数据传递不需要跨进程序列化，效率高。

Tauri 主进程在文件处理里的角色。Tauri 主进程负责文件选择对话框、把用户选中的文件路径发给 sidecar。sidecar 接到路径自己读文件解析。Tauri 不参与解析逻辑。

国产化支持下 PDF 的几个细节。中文公文常见的 双 PDF 结构（一层是文本一层是签名扫描）需要特殊处理，PyMuPDF 能识别。盖章扫描的 PDF 走 OCR 兜底。中英文混合段落的切分需要专门 chunk 策略。这些都在 Python 端实现。

未来如果要 Rust 化。某些极致性能要求的场景（比如批量解析数千份文件）可能值得部分 Rust 实现。但要等 Rust 文件解析生态成熟，且要保证国产文档兼容性。这件事不在路线图近期。

WPS AI 插件 chayuan-wps 不直接解析文件，所有解析通过 sidecar 完成。加载项把文件上传给 sidecar，sidecar 解析后返回结果。两边职责清晰。

文件解析放 Python 这件事在 chayuan-desktop 的工程决策里非常自然。免费开源的AI软件 选语言时不能只看 性能更快 这一维度，生态、兼容性、维护成本同等重要。
