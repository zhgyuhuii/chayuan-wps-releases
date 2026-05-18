# 多模态 UX 升级 — OCR 通道 / 实时 ASR / AI 笔记 / 知识中心外层入口

**Status**: Draft (2026-05-16)
**Scope**: 跨 chayuan-server + chayuan-client 的端到端功能增强
**Driver**: 用户需求 0-5 项 — 文件解析 OCR(已有)、对话图片自动 OCR、上传附件 OCR 现状盘点、实时语音输入、AI 笔记富文本编辑器、首页 / 知识中心外层入口

---

## 1. 背景与现状盘点

### 已有的(必须复用,不重造)

- **文档解析 OCR**(需求 #0):`RapidOCRPDFLoader / RapidOCRDocLoader / RapidOCRPPTLoader / RapidOCRLoader` 已在 KB upload 路径稳定使用(`chayuan-server/.../file_rag/document_loaders/`)。PDF 嵌入图按阈值 OCR,DOCX 内嵌图同。**本 spec 不动**。
- **临时附件解析**:`upload_temp_docs` → `KnowledgeFile.file2text()` 复用同一套 RapidOCR loader,所以**对话上传 PDF/DOCX 时图像 OCR 已经自动生效**。
- **RapidOCR sidecar**:`modality/rapidocr_server.py` 暴露 `POST /v1/ocr`,端口由 `SidecarRuntimeManager.get_runtime("ocr").info.port` 解析。`image_source/ocr_client.py:run_ocr()` 已封装好。
- **ASR 后端**:`modality/audio.py:AudioPipeline.transcribe()` 完整 fallback 链(whisper-server → faster-whisper → openai-whisper → OpenAI API)。
- **ChatComposer**:`features/composer/ChatComposer.tsx` 已有麦克风按钮 UI(`onMicrophone` prop 占位)+ 图片上传按钮;6 处 caller (Conversation/KbBoard/VectorKb/StructuredKb/Skill/KbDetailComposer)。
- **KbDropZone**:`features/kb/upload/KbDropZone.tsx` + `useKbUpload` hook 已封装好上传 + 进度。
- **doc KB 接口**:`/knowledge_base/upload_docs` 是 markdown / md 文本入库的现成路径。
- **CreateKbDialog**:`features/kb/create/CreateKbDialog.tsx` 已有"新建知识库"流程,可作为外层上传选择目标库的复用基础。

### 缺口

- **图片直接上传到对话**:`.png/.jpg/.webp` 走对话 attachment 时,既不走 OCR 也没明确 vision 路径。
- **HTTP OCR / Transcribe 端点**:`modality/audio.py` 只是 Python 类,没有暴露 FastAPI 路由;`rapidocr_server.py` 是 sidecar(随机端口),前端不能直接打通,需要 chayuan-server 主进程包一层。
- **前端录音**:`onMicrophone` 是 `() => void`,没有 MediaRecorder / 分片上传 / partial transcript UI。
- **富文本编辑器**:0,Tiptap 等依赖未装。
- **AI 笔记 feature**:0,无路由、无组件、无 API 客户端。
- **首页 AI 笔记入口 + 知识中心外层上传**:0。

## 2. 设计决策(已用户确认)

| 决策点 | 选择 |
|---|---|
| 富文本编辑器 | **Tiptap**(`@tiptap/react` + `@tiptap/starter-kit`) |
| AI 笔记存储 | **用户选择任意 doc KB**(保存时弹窗选/新建) |
| 实时 ASR 模式 | **分片轮询**(MediaRecorder 4-5s 切片 → POST `/modality/transcribe` → 拼接) |
| 对话图片附件 | **双轨**:OCR 文本拼进 prompt + 原图走 vision |
| 首页 AI 笔记入口 | **第 5 张产品卡** 与现有 4 张并列 |
| 知识中心外层上传 | **弹窗"选已有 KB 或新建"** |

## 3. 模块化架构

```text
┌──────────────────────────────────────────────────────────────────┐
│ Chayuan Server (FastAPI :62581)                                  │
│                                                                  │
│ NEW  api_server/modality_routes.py                               │
│      ├─ POST /modality/ocr            (image bytes → text)       │
│      └─ POST /modality/transcribe     (audio bytes → text)       │
│      两个路由都是薄包装,复用现有 ocr_client + audio.AudioPipeline │
│                                                                  │
│ 复用 image_source/ocr_client.py:run_ocr(image_bytes, port=...)   │
│ 复用 modality/audio.py:AudioPipeline.transcribe(audio, ...)      │
│ 复用 model_registry/local_runtime.SidecarRuntimeManager           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Chayuan Client                                                   │
│                                                                  │
│ NEW  packages/api/src/modality.ts                                │
│      modality.ocr(blob)           → {text, lang, confidence}     │
│      modality.transcribe(blob)    → {text, language}             │
│                                                                  │
│ NEW  packages/app/src/features/composer/useImageOcrAttachment.ts │
│      上传图片 → modality.ocr → 状态 chip + 文本附件 + 原图保留    │
│                                                                  │
│ NEW  packages/app/src/features/composer/useMicRecorder.ts        │
│      MediaRecorder + 4-5s slicing + modality.transcribe          │
│      + onPartial(text) callback for incremental UI updates       │
│                                                                  │
│ MOD  packages/app/src/features/composer/ChatComposer.tsx         │
│      onMicrophone 接 useMicRecorder; 图片按钮接 useImageOcrAtt   │
│      新增 attachments[] state + chip 渲染区                       │
│                                                                  │
│ NEW  packages/app/src/features/notes/  (整个新 feature 目录)     │
│      NoteEditor.tsx        — Tiptap 富文本主体                    │
│      NoteEditorPage.tsx    — /notes/new 全屏页                    │
│      SaveNoteDialog.tsx    — 弹窗选目标 KB(doc 类型)            │
│      useNoteDraft.ts       — localStorage 草稿持久化              │
│      saveNoteToKB.ts       — Tiptap JSON → markdown → kb-upload  │
│                                                                  │
│ NEW  packages/api/src/notes.ts                                   │
│      notes.list / notes.save (→ 包装 knowledgeBase.upload)       │
│                                                                  │
│ MOD  packages/app/src/features/home/HomePage.tsx                 │
│      4 张卡变 5 张,新增 "AI 笔记" 卡 → /notes/new                │
│                                                                  │
│ MOD  packages/app/src/features/kb/KbBoard.tsx                    │
│      顶部新增 3 按钮:"+ 新建笔记" "+ 上传文件" "+ 上传图像"     │
│      复用 SaveNoteDialog 选目标 KB 的 dialog                      │
└──────────────────────────────────────────────────────────────────┘
```

## 4. 各模块设计

### 4.1 M0 — 通用 `/modality/ocr` 和 `/modality/transcribe` 端点

```python
# chayuan-server/.../api_server/modality_routes.py (NEW)
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from chayuan.server.auth.deps import require_auth_enabled
from chayuan.server.image_source.ocr_client import run_ocr, resolve_port

modality_router = APIRouter(prefix="/modality", tags=["Modality"])

@modality_router.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...), user=Depends(require_auth_enabled())):
    data = await file.read()
    port = resolve_port()
    if not port:
        raise HTTPException(503, "OCR sidecar not ready")
    result = await run_ocr(data, port=port)
    if result.error:
        raise HTTPException(502, result.error)
    return {"code": 0, "data": {
        "text": result.text, "lang": result.lang,
        "confidence": result.confidence, "box_count": result.box_count,
        "elapsed_ms": result.elapsed_ms,
    }}

@modality_router.post("/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    language: str = Form(""),
    user=Depends(require_auth_enabled()),
):
    data = await file.read()
    from chayuan.server.modality.audio import AudioPipeline
    pipe = AudioPipeline()
    text = pipe.transcribe(io.BytesIO(data), language=language or None)
    return {"code": 0, "data": {"text": text, "language": language or "auto"}}
```

注册到 `api_server/main.py` 现有 router include 处。

并发约束:复用 `image_source/pipeline._OCR_SEMAPHORE`(Semaphore 2)避免同时多个 OCR 把 CPU 打满;ASR 也加 `_ASR_SEMAPHORE = asyncio.Semaphore(2)`。

### 4.2 M1 — 对话图片附件双轨

```text
用户点 ChatComposer 图片按钮
   ↓ FileList
useImageOcrAttachment(files)
   ├─ 对每张 image (mime starts with image/) 立即:
   │    1. 计算 hash → attachmentId
   │    2. 插入 attachments state: { id, file, state: "ocr", preview: objectURL }
   │    3. 异步调 modality.ocr(file) →
   │         成功 → state: "ready", ocrText
   │         失败 → state: "failed", error
   │  非 image 文件直接放进 attachments state="ready",不 OCR
   ↓
渲染 chip 列(就在 textarea 上方):
   [图 a.png 识别中…] [图 b.jpg ✓ 识别到 87 字 ▽] [doc.pdf ✓]
   ↓ 用户按 send
组装 send payload:
   - prompt = textareaText + "\n\n--- 附件文字识别 ---\n" + ocrTexts.join("\n\n")
   - vision images = [a.png base64, b.jpg base64]  (后端透传给多模态 LLM)
   - 非 image 附件走老 attachment 路(已通过 RAG)
```

**关键**:OCR 是 **opportunistic enhancement**,不阻塞发送。用户可以在 OCR 中状态点 send,文字会以 "处理中..." 占位发出。但默认实现是等 OCR 完成或失败再让 send 可点。

UI:状态 chip 的 3 个状态分别用 spinner / ✓+字数 / ⚠+error。

### 4.3 M2 — 实时语音输入

```text
ChatComposer 麦克风按钮:
   onMouseDown → useMicRecorder.start()
   onMouseUp / 再次点击 → useMicRecorder.stop()

useMicRecorder hook 内部:
   1. navigator.mediaDevices.getUserMedia({audio: true})
   2. new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
   3. ondataavailable 每 4000ms 触发(timeslice=4000)
        → 每个 chunk POST /modality/transcribe 异步并行
        → onPartial(chunkText) 回调
   4. onstop 拼接所有 chunkText → onFinal(fullText)
   
ChatComposer 集成:
   recording=true 时 textarea placeholder = "🎤 录音中... [N s]" + 进度条
   每次 onPartial 触发把 chunkText 追加到 textarea(光标位置插入)
   onFinal 时停止录音 UI 红点
   错误(getUserMedia 拒绝 / 网络) → toast 提示
```

**音质要求**:opus/webm 已经是浏览器标准,whisper-server / faster-whisper 都接受。如果某个 chunk 是纯静音 → backend transcribe 返回空字符串 → 前端跳过。

**取消**:录音中切窗 / unmount → AbortController 取消 in-flight transcribe + MediaRecorder.stop()。

### 4.4 M3 — Tiptap 富文本笔记编辑器

```text
features/notes/
   NoteEditor.tsx           主组件
   NoteEditorPage.tsx       页面包装 (路由 /notes/new 或 /notes/:id)
   useNoteDraft.ts          localStorage 草稿(防止崩溃丢稿)
   SaveNoteDialog.tsx       保存弹窗选 doc KB
   saveNoteToKB.ts          Tiptap doc JSON → markdown → POST upload_docs
   index.ts                 export
```

**NoteEditor 结构**:
```tsx
<div className="flex h-full flex-col">
  <header>
    <input value={title} ... />  {/* 默认 "AI 笔记 2026-05-16 14:32" */}
    <Button onClick={onMicrophone}><Mic /></Button>  {/* 复用 useMicRecorder */}
    <Button onClick={openSaveDialog}>保存</Button>
  </header>
  <Toolbar editor={editor} />  {/* B I U H1 H2 列表 图片 链接 引用 */}
  <EditorContent editor={editor} className="flex-1 overflow-auto px-8 py-6" />
</div>
```

**Tiptap 配置**:
```ts
const editor = useEditor({
  extensions: [
    StarterKit,                     // 段落/B/I/U/H1-3/列表/引用/代码块
    Image.configure({ inline: false }),
    Link.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: '开始写笔记…(可用 Ctrl+B/I/U;或点麦克风录音)' }),
  ],
  content: draft?.content ?? '',
  onUpdate({ editor }) {
    saveDraft({ title, content: editor.getJSON() });
  },
});
```

**ASR 集成**:`useMicRecorder` 的 `onPartial` 回调 → `editor.chain().focus().insertContent(text + ' ').run()`。在当前光标位置插入,不破坏已有内容。

**草稿**:`useNoteDraft` 用 localStorage key `chayuan:note-draft:<noteId-or-new>`,debounce 500ms 写入;首次打开恢复。

### 4.5 M4 — 笔记保存 + HomePage 入口 + KB 外层上传

**saveNoteToKB(noteData, targetKbName)**:
1. Tiptap JSON → markdown(用 `prosemirror-markdown` 或 Tiptap 内置 `editor.storage.markdown` 如果有;否则简单遍历 JSON 节点拼)
2. 构造 Blob: `new Blob([markdown], { type: 'text/markdown' })` 文件名 `{title}.md`
3. POST `/knowledge_base/upload_docs` (kb_name=targetKbName, files=[blob])
4. 成功 → clear localStorage 草稿,toast,跳转到 KB detail

**SaveNoteDialog**:
- 列出当前用户所有 `kind=document` KB
- 顶部按钮"+ 新建文档库"(复用 `CreateKbDialog`)
- 选完点确认 → saveNoteToKB

**HomePage 第 5 张卡**:
- icon: `Pen` (lucide)
- title: "AI 笔记"
- description: "随手记录,自动入库可检索"
- onClick: `navigate('/notes/new')`

**KbBoard 外层快捷按钮**:
顶部新增 3 个 button:
- `[+ 新建笔记]` → /notes/new
- `[+ 上传文件]` → 弹 `<UploadTargetDialog kind="document">` 选/新建 doc KB → 进 KbDropZone 模式
- `[+ 上传图像]` → 弹 `<UploadTargetDialog kind="image">` 选/新建 image KB → 进 image upload

`UploadTargetDialog` 是 `SaveNoteDialog` 的泛化,kind 参数控制只列 doc 或 image KB。

## 5. 复用矩阵

| 复用对象 | 复用于 |
|---|---|
| `image_source/ocr_client.run_ocr` | M0 OCR 端点 + M1 对话图片附件 |
| `modality/audio.AudioPipeline.transcribe` | M0 transcribe 端点 |
| `image_source/pipeline._OCR_SEMAPHORE` | M0 OCR 并发限流 |
| `image_source/ocr_client.resolve_port` | M0 |
| `ChatComposer` (现有) | M1 + M2 + M3(NoteEditor 内部) |
| `KbDropZone` + `useKbUpload` | M4 外层上传 |
| `CreateKbDialog` | M4 SaveNoteDialog / UploadTargetDialog 复用其 KB 创建 |
| `knowledgeBase` API client | M4 saveNoteToKB |
| `imageSource` API client(Task 6 改的) | M4 image 外层上传 |

## 6. 性能 / 并发 / 错误处理

- **OCR**:`_OCR_SEMAPHORE(2)`(已存在);每张图独立 task,失败不阻其它图。
- **ASR**:每个 chunk 独立 POST,服务端 `_ASR_SEMAPHORE(2)`。前端用顺序号 `chunkIndex` 保证 onPartial 按顺序拼接,如果 chunk 1 比 chunk 0 先回来则 buffer chunk 1,等 chunk 0 再 flush。
- **录音 stop 时未上传完的 chunk**:等所有 in-flight 完成再调 `onFinal`,带超时 fallback。
- **草稿**:localStorage,500ms debounce;切换 note 时切 key。
- **OCR 失败**:chip 显示 ⚠ + error,允许用户直接 send(不带 OCR 文字)+ 仍带 vision 原图。
- **录音权限拒绝**:toast "请在浏览器/系统设置允许麦克风"。
- **网络断开**:transcribe 失败 → 把对应 chunk 标 "[转录失败]" 占位,用户可以保留或删除。

## 7. UE / 设计师视角

- **图片附件 chip**(M1):圆角 / 半透明背景 / icon spinner / 字数 badge / hover 显示完整 OCR 预览(最多 200 字)+ 移除按钮。
- **录音 UI**(M2):麦克风按钮变红呼吸动画,旁边小计时器 `0:08`,textarea 上方贴一条 "🎤 正在听..." 横条,partial transcript 在那条横条上以淡入动画显示后再 commit 进 textarea。
- **NoteEditor**(M3):全屏沉浸(不在 dialog),编辑区最大 800px 居中(类似 Notion);Toolbar 是 sticky top;Ctrl+S 保存;ESC 提示是否丢草稿。
- **HomePage 第 5 张卡**(M4):跟现有 4 张 visual identity 一致,但 icon 用更暖色(amber)突出 "Compose" 性质。
- **KbBoard 顶部按钮**(M4):跟现有 "新建知识库" 按钮同行,左侧 3 个快捷按钮 group `[+笔记] [+文件] [+图像]`,主操作 `新建知识库` 仍在右侧。

## 8. 非目标

- 笔记的版本历史 / 协同编辑(YAGNI)。
- 笔记内嵌图片的服务端图床(MVP 先 base64 嵌入 markdown;后续可加 `file_storage.NOTE_ASSETS` namespace)。
- ASR 真流式 WebSocket(用户已选分片轮询)。
- 对话图片附件的 client-side EXIF / 自动缩放(直接传原图)。
- OCR 端点的 PDF/audio 多格式自动识别(只接 image)。
- 文档解析 OCR 的进一步增强(现状已稳定运行)。
