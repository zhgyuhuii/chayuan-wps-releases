# 多模态 UX 升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 给对话框加图片自动 OCR + 实时语音输入,新建 AI 笔记富文本编辑器(Tiptap)并接入 ASR,首页加 AI 笔记入口,知识中心加外层"上传文件 / 上传图像"快捷按钮。

**Architecture:** 后端薄包一层 `/modality/ocr` 和 `/modality/transcribe`,复用现成 `ocr_client.run_ocr` + `audio.AudioPipeline.transcribe`。前端新增 `useImageOcrAttachment` 与 `useMicRecorder` 两个 hook 给 ChatComposer 用;独立 `features/notes/` feature 目录,Tiptap 编辑器 + 草稿 + 保存到用户选的 doc KB;HomePage 加第 5 张卡,KbBoard 顶部加 3 个快捷按钮 + 通用 UploadTargetDialog。

**Tech Stack:** Python 3 / FastAPI / Tiptap(`@tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-image @tiptap/extension-link`) / MediaRecorder Web API / React Query

**Spec:** `docs/superpowers/specs/2026-05-16-multimodal-ux-design.md`

---

## File Structure

### Backend (新增 1 个路由文件)

| 文件 | 责任 | 性质 |
|---|---|---|
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/modality_routes.py` | `POST /modality/ocr` + `POST /modality/transcribe` 两个端点;复用 `ocr_client.run_ocr` + `audio.AudioPipeline.transcribe`;Semaphore 限流 | 新增 |
| `chayuan-server/libs/chayuan-server/chayuan/server/api_server/main.py` | 注册 modality_router | 改(只加一行 include) |

### Frontend

| 文件 | 责任 | 性质 |
|---|---|---|
| `chayuan-client/packages/api/src/modality.ts` | `modality.ocr(blob)` / `modality.transcribe(blob, lang?)` 客户端 | 新增 |
| `chayuan-client/packages/api/src/notes.ts` | `notes.save(title, markdown, kbName)` 包装 knowledgeBase.upload | 新增 |
| `chayuan-client/packages/app/src/features/composer/useImageOcrAttachment.ts` | 上传图片 → OCR → attachments state hook | 新增 |
| `chayuan-client/packages/app/src/features/composer/useMicRecorder.ts` | MediaRecorder + 4s 切片 + 串行 transcribe + onPartial hook | 新增 |
| `chayuan-client/packages/app/src/features/composer/ChatComposer.tsx` | 集成两个 hook;attachments chip 渲染区;mic 按钮状态 | 改 |
| `chayuan-client/packages/app/src/features/chat/ConversationView.tsx` | 把 attachments OCR 文本拼进 prompt;原图走 vision 路径 | 改 |
| `chayuan-client/packages/app/src/features/notes/NoteEditor.tsx` | Tiptap 富文本主组件 | 新增 |
| `chayuan-client/packages/app/src/features/notes/NoteEditorPage.tsx` | 路由 `/notes/new` 全屏页 | 新增 |
| `chayuan-client/packages/app/src/features/notes/SaveNoteDialog.tsx` | 弹窗选 doc KB 或新建 | 新增 |
| `chayuan-client/packages/app/src/features/notes/UploadTargetDialog.tsx` | 上传文件/图像目标库选择(泛化的 SaveNoteDialog) | 新增 |
| `chayuan-client/packages/app/src/features/notes/useNoteDraft.ts` | localStorage 草稿持久化 | 新增 |
| `chayuan-client/packages/app/src/features/notes/saveNoteToKB.ts` | Tiptap JSON → markdown → upload_docs | 新增 |
| `chayuan-client/packages/app/src/features/notes/index.ts` | re-export | 新增 |
| `chayuan-client/packages/app/src/features/home/HomePage.tsx` | 加第 5 张 "AI 笔记" 卡 | 改 |
| `chayuan-client/packages/app/src/features/kb/KbBoard.tsx` | 顶部加 3 个快捷按钮 | 改 |
| `chayuan-client/packages/app/src/routes.tsx` (或等价路由配置) | 注册 /notes/new 路由 | 改 |
| `chayuan-client/packages/app/package.json` | 加 Tiptap 依赖 | 改 |

---

## M0 — `/modality/ocr` + `/modality/transcribe` 通用端点

### Task M0.1: 后端 modality_routes.py

**Files:**
- Create: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/modality_routes.py`
- Modify: `chayuan-server/libs/chayuan-server/chayuan/server/api_server/main.py`(注册 router)
- Test: `chayuan-server/libs/chayuan-server/tests/unit_tests/test_modality_routes.py`

- [ ] **Step 1: 写失败测试**

```python
# chayuan-server/libs/chayuan-server/tests/unit_tests/test_modality_routes.py
"""POST /modality/ocr 和 /modality/transcribe 通用端点。"""
from __future__ import annotations

import io
import pytest


@pytest.mark.asyncio
async def test_ocr_endpoint_happy(monkeypatch):
    from chayuan.server.api_server import modality_routes as mr
    from chayuan.server.image_source.ocr_client import OCRResult

    async def _fake_run_ocr(data, *, port, timeout=30.0):
        assert data == b"\x89PNG..."
        return OCRResult(text="hello", lang="en", confidence=0.95,
                         box_count=1, elapsed_ms=10)
    monkeypatch.setattr(mr, "run_ocr", _fake_run_ocr)
    monkeypatch.setattr(mr, "resolve_ocr_port", lambda: 18380)

    class _UF:
        async def read(self): return b"\x89PNG..."
    resp = await mr.ocr_endpoint(file=_UF(), user={"id": 1, "role": "admin"})
    assert resp["code"] == 0
    assert resp["data"]["text"] == "hello"
    assert resp["data"]["lang"] == "en"


@pytest.mark.asyncio
async def test_ocr_endpoint_sidecar_unavail(monkeypatch):
    from chayuan.server.api_server import modality_routes as mr
    from fastapi import HTTPException
    monkeypatch.setattr(mr, "resolve_ocr_port", lambda: None)

    class _UF:
        async def read(self): return b"x"
    with pytest.raises(HTTPException) as exc:
        await mr.ocr_endpoint(file=_UF(), user={"id": 1, "role": "admin"})
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_transcribe_endpoint_happy(monkeypatch):
    from chayuan.server.api_server import modality_routes as mr

    captured = {}
    class _FakePipe:
        def transcribe(self, audio, *, language=None, **kw):
            captured["audio_size"] = len(audio.read())
            captured["language"] = language
            return "你好世界"
    monkeypatch.setattr(mr, "_get_audio_pipeline", lambda: _FakePipe())

    class _UF:
        async def read(self): return b"webm-bytes"
    resp = await mr.transcribe_endpoint(
        file=_UF(), language="zh", user={"id": 1, "role": "admin"},
    )
    assert resp["code"] == 0
    assert resp["data"]["text"] == "你好世界"
    assert resp["data"]["language"] == "zh"


@pytest.mark.asyncio
async def test_transcribe_endpoint_empty_returns_empty_text(monkeypatch):
    from chayuan.server.api_server import modality_routes as mr
    class _FakePipe:
        def transcribe(self, audio, *, language=None, **kw): return ""
    monkeypatch.setattr(mr, "_get_audio_pipeline", lambda: _FakePipe())

    class _UF:
        async def read(self): return b""
    resp = await mr.transcribe_endpoint(
        file=_UF(), language="", user={"id": 1, "role": "admin"},
    )
    assert resp["code"] == 0
    assert resp["data"]["text"] == ""
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /work/chayuan-desktop && PYTHONPATH=chayuan-server/libs/chayuan-server pytest -q chayuan-server/libs/chayuan-server/tests/unit_tests/test_modality_routes.py -v`
Expected: FAIL — `modality_routes` module 不存在

- [ ] **Step 3: 实现 modality_routes.py**

Create `/work/chayuan-desktop/chayuan-server/libs/chayuan-server/chayuan/server/api_server/modality_routes.py`:

```python
"""通用多模态 HTTP 端点 — OCR / ASR。

设计:
    本路由是薄包装 — 复用 image_source.ocr_client.run_ocr 与
    modality.audio.AudioPipeline。前端可通过它直接调 OCR / ASR,
    无需先去查 SidecarRuntimeManager 端口。

并发限制:
    - OCR:复用 image_source.pipeline._OCR_SEMAPHORE(Semaphore 2)
    - ASR:本模块独立 _ASR_SEMAPHORE(Semaphore 2)— 4-5s 一片 + 多并发上传时防止 CPU 打满
"""
from __future__ import annotations

import asyncio
import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from chayuan.server.auth.deps import require_auth_enabled
from chayuan.server.image_source.ocr_client import resolve_port as resolve_ocr_port
from chayuan.server.image_source.ocr_client import run_ocr
from chayuan.server.image_source.pipeline import _OCR_SEMAPHORE

logger = logging.getLogger("chayuan.api.modality")

modality_router = APIRouter(prefix="/modality", tags=["Modality"])

_ASR_SEMAPHORE = asyncio.Semaphore(2)


def _get_audio_pipeline():
    """单例 AudioPipeline;monkeypatch seam。"""
    global _AUDIO_PIPE
    if _AUDIO_PIPE is None:
        from chayuan.server.modality.audio import AudioPipeline
        _AUDIO_PIPE = AudioPipeline()
    return _AUDIO_PIPE


_AUDIO_PIPE = None


@modality_router.post("/ocr", summary="对一张图做 OCR 并返回文字")
async def ocr_endpoint(
    file: UploadFile = File(...),
    user=Depends(require_auth_enabled()),
):
    """POST multipart 'file' (image)。

    Body: {file: image bytes}
    Resp: {code: 0, data: {text, lang, confidence, box_count, elapsed_ms}}

    503 if OCR sidecar 未就绪;502 if 转写异常。
    """
    data = await file.read()
    if not data:
        raise HTTPException(400, "empty file")
    port = resolve_ocr_port()
    if not port:
        raise HTTPException(503, "OCR sidecar not ready")
    async with _OCR_SEMAPHORE:
        result = await run_ocr(data, port=port)
    if result.error:
        raise HTTPException(502, f"OCR failed: {result.error}")
    return {
        "code": 0,
        "data": {
            "text": result.text,
            "lang": result.lang,
            "confidence": result.confidence,
            "box_count": result.box_count,
            "elapsed_ms": result.elapsed_ms,
        },
    }


@modality_router.post("/transcribe", summary="对一段音频做 ASR 转写")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    language: str = Form(""),
    user=Depends(require_auth_enabled()),
):
    """POST multipart 'file' (audio:webm/opus/wav/mp3/ogg)。

    Form fields:
        - file: audio 字节
        - language: 语言提示("zh"/"en"/""为自动)

    Resp: {code: 0, data: {text, language}}
    永不抛 ASR exception;失败时 text 为 "" + 顶层 code 仍 0,前端按空处理。
    """
    data = await file.read()
    if not data:
        return {"code": 0, "data": {"text": "", "language": language or "auto"}}
    pipe = _get_audio_pipeline()
    async with _ASR_SEMAPHORE:
        try:
            text = await asyncio.to_thread(
                pipe.transcribe, io.BytesIO(data),
                language=(language or None),
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("transcribe failed: %r", e)
            text = ""
    return {"code": 0, "data": {"text": text or "", "language": language or "auto"}}
```

- [ ] **Step 4: 在 main.py 注册 router**

打开 `chayuan-server/libs/chayuan-server/chayuan/server/api_server/main.py`,找到已有 `app.include_router(...)` 块,在它附近(image_router 注册之后是好位置)加:

```python
from chayuan.server.api_server.modality_routes import modality_router
app.include_router(modality_router)
```

如果不知道具体应该插哪一行,先 grep `include_router\|image_router`:
```bash
grep -n "include_router\|image_router\|image_routes" /work/chayuan-desktop/chayuan-server/libs/chayuan-server/chayuan/server/api_server/main.py | head -10
```
找到 image_router 那行,在下面加 modality_router 即可。

- [ ] **Step 5: 跑测试 + 回归 image-kb 全套**

```bash
cd /work/chayuan-desktop && PYTHONPATH=chayuan-server/libs/chayuan-server pytest -q \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_modality_routes.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_store_schema.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_pipeline.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_fusion.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py
```
Expected: 4 + 34 = 38 passed

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-server/libs/chayuan-server/chayuan/server/api_server/modality_routes.py \
        chayuan-server/libs/chayuan-server/chayuan/server/api_server/main.py \
        chayuan-server/libs/chayuan-server/tests/unit_tests/test_modality_routes.py
git commit -m "feat(modality): add /modality/ocr and /modality/transcribe HTTP endpoints"
```

### Task M0.2: 前端 modality API 客户端

**Files:**
- Create: `chayuan-client/packages/api/src/modality.ts`
- Modify: `chayuan-client/packages/api/src/index.ts`(re-export)

- [ ] **Step 1: 写 modality.ts**

Create `/work/chayuan-desktop/chayuan-client/packages/api/src/modality.ts`:

```ts
/**
 * 通用多模态 HTTP 客户端 — OCR / ASR。
 * 后端端点:POST /modality/ocr / /modality/transcribe(modality_routes.py)。
 */
import { request } from './request';

export interface OcrResult {
  text: string;
  lang: string;
  confidence: number;
  box_count: number;
  elapsed_ms: number;
}

export interface TranscribeResult {
  text: string;
  language: string;
}

export const modality = {
  /**
   * 对一张图做 OCR。
   * blob 应该是 image/* (jpeg/png/webp 等浏览器原生支持的格式)。
   * 失败时 throws (server returns 502/503)。
   */
  async ocr(file: Blob, opts: { signal?: AbortSignal } = {}): Promise<OcrResult> {
    const form = new FormData();
    form.append('file', file, (file as File).name || 'image.bin');
    const r = await request<{ data: OcrResult }>(`/modality/ocr`, {
      method: 'POST',
      body: form,
      signal: opts.signal,
      raw: true,
    });
    return r.data?.data as OcrResult;
  },

  /**
   * 对一段音频做 ASR 转写。
   * blob:audio/webm 或 audio/wav 等。失败永远返回 text=""(不 throw)。
   */
  async transcribe(
    blob: Blob,
    opts: { language?: string; signal?: AbortSignal } = {},
  ): Promise<TranscribeResult> {
    const form = new FormData();
    form.append('file', blob, (blob as File).name || 'audio.webm');
    if (opts.language) form.append('language', opts.language);
    const r = await request<{ data: TranscribeResult }>(`/modality/transcribe`, {
      method: 'POST',
      body: form,
      signal: opts.signal,
      raw: true,
    });
    return r.data?.data ?? { text: '', language: opts.language ?? 'auto' };
  },
};
```

- [ ] **Step 2: 在 packages/api/src/index.ts 加 export**

打开 `chayuan-client/packages/api/src/index.ts`,在已有 export 列表末尾追加:
```ts
export { modality, type OcrResult, type TranscribeResult } from './modality';
```

- [ ] **Step 3: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client && npm run typecheck
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/api/src/modality.ts \
        chayuan-client/packages/api/src/index.ts
git commit -m "feat(api): add modality client (ocr + transcribe)"
```

---

## M1 — 对话图片附件双轨

### Task M1: ChatComposer 集成 useImageOcrAttachment

**Files:**
- Create: `chayuan-client/packages/app/src/features/composer/useImageOcrAttachment.ts`
- Modify: `chayuan-client/packages/app/src/features/composer/ChatComposer.tsx`(加 attachments chip 区 + 接 hook)

详细 step:**实施时由 subagent 读现状定**(ChatComposer 现有 attachments 处理可能已经存在;实施 subagent 先 grep 现状,如果已有简单 attachments array,扩展加 `ocrText/ocrState`,如果没有就引入。)

核心实现:

```ts
// useImageOcrAttachment.ts
export interface ImageAttachment {
  id: string;
  file: File;
  previewUrl: string;
  ocrState: 'pending' | 'ok' | 'failed';
  ocrText?: string;
  ocrError?: string;
}

export function useImageOcrAttachment() {
  const [items, setItems] = React.useState<ImageAttachment[]>([]);
  const addFiles = React.useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    const newAtts: ImageAttachment[] = images.map((f) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      ocrState: 'pending',
    }));
    setItems((prev) => [...prev, ...newAtts]);
    // 并行调 OCR
    await Promise.all(newAtts.map(async (att) => {
      try {
        const r = await modality.ocr(att.file);
        setItems((prev) => prev.map((x) => x.id === att.id
          ? { ...x, ocrState: 'ok', ocrText: r.text }
          : x));
      } catch (e: any) {
        setItems((prev) => prev.map((x) => x.id === att.id
          ? { ...x, ocrState: 'failed', ocrError: String(e?.message ?? e) }
          : x));
      }
    }));
  }, []);
  const remove = (id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };
  const clear = () => {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
  };
  return { items, addFiles, remove, clear };
}
```

ChatComposer 改造:
- 加 chip 渲染区(在 textarea 上方)
- 图片按钮 onClick 触发 `addFiles`(从 file picker 拿 File[])
- 改 prop: 新增 `onSendAttachments?: (atts: ImageAttachment[], textareaValue: string) => void`,由调用方 (ConversationView 等) 决定怎么把 OCR 文本和原图发出去
- 不动现有 send 流程

测试 / 验证:typecheck;手动 dev:打开对话页 → 上传图片 → chip 显示识别进行中 → 完成显示字数 → 点 send,在 ConversationView 控制台/网络请求里能看到 OCR 文字已拼进 prompt。

**Commit message**: `feat(composer): image attachment auto-OCR (dual-track: ocr text + vision)`

---

## M2 — 实时语音输入

### Task M2: useMicRecorder + ChatComposer 接通

**Files:**
- Create: `chayuan-client/packages/app/src/features/composer/useMicRecorder.ts`
- Modify: `chayuan-client/packages/app/src/features/composer/ChatComposer.tsx`(`onMicrophone` 接 hook)
- Modify: `chayuan-client/packages/app/src/features/chat/ConversationView.tsx`(给 ChatComposer 传 onMicrophone)

核心实现:

```ts
// useMicRecorder.ts
export interface UseMicRecorderOptions {
  sliceMs?: number;       // 默认 4000
  language?: string;      // 默认 ""
  onPartial?: (text: string, chunkIndex: number) => void;
  onError?: (err: Error) => void;
}

export function useMicRecorder(opts: UseMicRecorderOptions = {}) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunkIdxRef = React.useRef(0);
  const abortersRef = React.useRef<AbortController[]>([]);
  const startTsRef = React.useRef(0);
  const tickerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const start = React.useCallback(async () => {
    if (recording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    chunkIdxRef.current = 0;
    mr.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      const idx = chunkIdxRef.current++;
      const ac = new AbortController();
      abortersRef.current.push(ac);
      modality.transcribe(e.data, { language: opts.language, signal: ac.signal })
        .then((r) => {
          if (r.text) opts.onPartial?.(r.text, idx);
        })
        .catch(() => {/* 静默 */});
    };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (tickerRef.current) clearInterval(tickerRef.current);
      setElapsed(0);
      setRecording(false);
    };
    mr.start(opts.sliceMs ?? 4000);
    recorderRef.current = mr;
    startTsRef.current = Date.now();
    setRecording(true);
    tickerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000));
    }, 500);
  }, [recording, opts]);

  const stop = React.useCallback(() => {
    if (!recording) return;
    recorderRef.current?.stop();
  }, [recording]);

  const cancel = React.useCallback(() => {
    abortersRef.current.forEach((ac) => ac.abort());
    abortersRef.current = [];
    recorderRef.current?.stop();
  }, []);

  React.useEffect(() => () => cancel(), [cancel]);

  return { recording, elapsed, start, stop, cancel };
}
```

ChatComposer 改造:
- `onMicrophone` 默认行为:第一次点击 → `start()`,再点 → `stop()`
- recording 时按钮变红 + 旁边显示 `🎤 0:08`
- `onPartial(text)` → setTextareaValue((prev) => prev + (prev ? ' ' : '') + text)

ConversationView 改造:
- 给 ChatComposer 传 `onMicrophone`(目前没传,或传了空 — 改成真实接 useMicRecorder)
- 因为 useMicRecorder 需要 textarea 引用来 insert text,把 hook 提到 ChatComposer 内部反而更简单(ChatComposer 自己持有 textarea state),所以 onMicrophone 干脆放进 ChatComposer 内部实现,prop 变成可选 override。

**Commit**: `feat(composer): real-time mic recording with 4s chunked ASR`

---

## M3 — Tiptap 富文本笔记编辑器

### Task M3.1: 加 Tiptap 依赖

**Files:**
- Modify: `chayuan-client/packages/app/package.json`

- [ ] Run:
```bash
cd /work/chayuan-desktop/chayuan-client/packages/app
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-image @tiptap/extension-link
```
然后 `cd ../.. && pnpm install` 同步 lockfile。

- [ ] Commit:
```bash
git add packages/app/package.json ../../pnpm-lock.yaml
# 注意 pnpm-lock.yaml 在 chayuan-client 根
cd /work/chayuan-desktop
git add chayuan-client/packages/app/package.json chayuan-client/pnpm-lock.yaml
git commit -m "feat(notes): add tiptap dependencies"
```

### Task M3.2: NoteEditor 组件 + 草稿 + ASR

**Files:**
- Create: `chayuan-client/packages/app/src/features/notes/NoteEditor.tsx`
- Create: `chayuan-client/packages/app/src/features/notes/useNoteDraft.ts`
- Create: `chayuan-client/packages/app/src/features/notes/index.ts`

NoteEditor 结构(见 spec 4.4)实现要点:
- `useEditor` 用 StarterKit + Image + Link + Placeholder
- 顶部:标题 input(默认 `AI 笔记 YYYY-MM-DD HH:mm`) + 工具栏(B/I/U/H1/H2/列表/链接/图片/分割线) + 麦克风按钮(集成 useMicRecorder) + 保存按钮(open SaveNoteDialog)
- 麦克风 onPartial(text) → `editor?.chain().focus().insertContent(text + ' ').run()`
- 草稿:useNoteDraft 用 debounce 500ms 写 localStorage,key `chayuan:note-draft:new`(MVP 只支持 new note,不做 noteId)
- 卸载时 revoke 编辑器实例

useNoteDraft:
```ts
export function useNoteDraft(key = 'chayuan:note-draft:new') {
  const get = () => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  };
  const set = (data: { title: string; content: any }) => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  };
  const clear = () => { try { localStorage.removeItem(key); } catch {} };
  return { get, set, clear };
}
```

**Commit**: `feat(notes): Tiptap editor with ASR + draft persistence`

---

## M4 — 笔记保存 + HomePage 入口 + KB 外层上传

### Task M4.1: SaveNoteDialog + saveNoteToKB

**Files:**
- Create: `chayuan-client/packages/app/src/features/notes/SaveNoteDialog.tsx`
- Create: `chayuan-client/packages/app/src/features/notes/saveNoteToKB.ts`
- Create: `chayuan-client/packages/api/src/notes.ts`

saveNoteToKB:
- 拿 editor.getJSON() → 转 markdown(简单遍历,paragraphs/headings/lists/code/blockquote/image/link)
- 构造 File: `new File([markdown], filename, { type: 'text/markdown' })`,filename = `${title.replace(/[/\\?%*:|"<>]/g, '-')}.md`
- POST `/knowledge_base/upload_docs` 用现有 `knowledgeBase.upload` API client(或等价)
- 成功后 useNoteDraft.clear()

SaveNoteDialog:
- 用 useQuery 拉 doc KB 列表(`knowledge_universe.list({ kind: 'document' })` 或现有列表 API)
- 列表展示 + 选中 KB → 调 saveNoteToKB
- 顶部 "+ 新建知识库" 按钮 → 复用 CreateKbDialog,创建完返回新 KB 选中

packages/api/src/notes.ts:
```ts
export const notes = {
  async save(title: string, content: any /* Tiptap JSON */, kbName: string): Promise<void> {
    const markdown = tiptapJsonToMarkdown(content);
    const filename = `${title.replace(/[/\\?%*:|"<>]/g, '-') || 'note'}.md`;
    const file = new File([markdown], filename, { type: 'text/markdown' });
    await knowledgeBase.uploadDocs(kbName, [file]);
  },
};
```

(若 `knowledgeBase.uploadDocs` 不是现有名,实施时改成 file_chat or kb_doc_api 现有调用,subagent 自己 grep)

### Task M4.2: NoteEditorPage + 路由

**Files:**
- Create: `chayuan-client/packages/app/src/features/notes/NoteEditorPage.tsx`
- Modify: 路由配置(grep `routes.tsx` 或 `App.tsx` 找现有路由注册位置)

NoteEditorPage 简单包装 NoteEditor 在全屏 layout 里。路由:`/notes/new` → NoteEditorPage。

### Task M4.3: HomePage 加第 5 张卡

**Files:**
- Modify: `chayuan-client/packages/app/src/features/home/HomePage.tsx`

现有 4 张卡(知识库/模型广场/MCP/工具),加第 5 张:
- icon: `<Pen />` (lucide-react)
- title: "AI 笔记"
- subtitle: "随手记录,自动入库可检索"
- onClick: `navigate('/notes/new')`

### Task M4.4: UploadTargetDialog + KbBoard 外层快捷按钮

**Files:**
- Create: `chayuan-client/packages/app/src/features/notes/UploadTargetDialog.tsx`(泛化 SaveNoteDialog)
- Modify: `chayuan-client/packages/app/src/features/kb/KbBoard.tsx`(顶部加 3 按钮)

UploadTargetDialog props: `{ kind: 'document' | 'image', onPick: (kbName: string) => void, onClose: () => void }`
- 列出该 kind 的 KB,顶部 "+ 新建 X 库" 按钮
- 选完 onPick(kbName)

KbBoard 顶部新增 toolbar:
```tsx
<div className="flex gap-2 p-3">
  <Button onClick={() => navigate('/notes/new')}><Pen /> 新建笔记</Button>
  <Button onClick={() => setUploadDocOpen(true)}><FileUp /> 上传文件</Button>
  <Button onClick={() => setUploadImgOpen(true)}><ImagePlus /> 上传图像</Button>
  <div className="flex-1" />
  {/* 原"新建知识库"按钮保留 */}
</div>
```

**Commit M4 整体**: `feat(notes,kb): note save dialog + homepage entry + kb-board quick uploads`

---

## 收尾

- [ ] 全后端测试套(image-kb 30 + modality 4 = 38):
```bash
cd /work/chayuan-desktop && PYTHONPATH=chayuan-server/libs/chayuan-server pytest -q \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_modality_routes.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_store_schema.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_routes_source_name.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_ocr_client.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_text_embed_client.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_pipeline.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_routes_upload.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_fusion.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_image_routes_search_text.py \
  chayuan-server/libs/chayuan-server/tests/unit_tests/test_universe_image_detail.py
```
Expected: 38 passed

- [ ] 前端 typecheck:
```bash
cd /work/chayuan-desktop/chayuan-client && npm run typecheck
```
Expected: 0 errors

- [ ] `git status -sb` 干净

- [ ] 等用户授权 push

## 风险与缓解

- **Tiptap 包体积 + lockfile 变化**:加依赖会改 pnpm-lock.yaml,务必一起 commit。`@tiptap/*` 组合 ~150KB gzip,可接受。
- **MediaRecorder 浏览器兼容**:Tauri Webview2 / Chrome 95+ 都支持 audio/webm;Safari 老版本可能要 audio/mp4 fallback。MVP 不处理,Safari 用户暂时降级"录完再转"。实施时检测 `MediaRecorder.isTypeSupported`,不支持时降级。
- **markdown 转换不完整**:Tiptap JSON → markdown 自己写转换是简化版,复杂嵌套(如表格)可能丢格式。MVP 用 StarterKit 不包表格,可控。
- **AudioPipeline 同步阻塞**:`pipe.transcribe` 是同步函数,放进 `asyncio.to_thread` 解决。
- **测试环境 jsdom 无 MediaRecorder**:useMicRecorder 不写单元测试(集成测试需手动),只在浏览器手动验证。

