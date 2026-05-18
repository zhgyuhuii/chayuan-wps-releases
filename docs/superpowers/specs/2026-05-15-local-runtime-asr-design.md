# 本地 Runtime ASR (Plan 3C) — 设计文档

> 上承 Plan 1 (chat sidecar) + Plan 2 (前端整合) + Plan 3A (诊断) + Plan 3B (多 capability:chat/embedding/rerank)。
> Plan 3C 加第四 capability `asr`,引擎从 llama.cpp 换 whisper.cpp,引入 `engine` 参数泛化 Runtime Manager。

**作者:** zhgyuhui  
**日期:** 2026-05-15  
**状态:** 待 user 审阅 → writing-plans

---

## 1. 背景

Chayuan 桌面侧目前 ASR 走 `chayuan-server/.../modality/audio.py`,使用 Python 包 `faster-whisper` / `openai-whisper` in-process。痛点:

- Python deps 体积大(faster-whisper ~150 MB),Windows PyInstaller 打包慢。
- Cold start 时首次调 ASR 加载模型 5-10s,用户体验差。
- 首启 chayuan-server sidecar 时不 preload(避免启动期变慢),首次音频转写仍要等模型加载。
- 跟 Plan 3B 的 chat/embedding/rerank 不同架构(Plan 3B 用 vendor binary spawn-as-subprocess,audio.py 直接 in-process),技术栈分裂。

Plan 3C 目标:把 ASR 也搬上 Plan 3B 的 sidecar 架构,vendor `whisper-server` 二进制,统一进 `LocalRuntimeRegistry`,UI 自动多一张 capability card。

## 2. 范围 (in / out)

**In scope (本 plan):**

- `LlamaRuntimeManager` 重命名为 `SidecarRuntimeManager`,加 `engine: 'llama' | 'whisper'` 参数。`LlamaRuntimeManager` 保留作 thin alias(默认 `engine='llama'`),Plan 3B 42 个引用零改动。
- `process_args.py` 加 `resolve_whisper_args(*, capability='asr')`,返回 whisper-server 启动 args。
- `LocalRuntimeRegistry.CAPABILITIES` 从 3 项扩到 4 项,加 `asr`(`engine='whisper'`, `port_offset=3`, 默认端口 62585)。
- `vendor/services/whisper-server/` 新目录,装跨平台 whisper-server 二进制。新建 `scripts/install-whisper-server.{ps1,sh}` 跟 Plan 1 同一套路抓 ggerganov/whisper.cpp release。
- `audio.py` `AudioPipeline.transcribe()` 改成"sidecar 首选 + Python fallback":先调 `127.0.0.1:62585/inference`,失败 fallback 现有 `faster-whisper` / `openai-whisper` / OpenAI API。
- API 路径保留 `/runtime/llama/{cap}/*`,仅在 `_VALID_CAPABILITIES` 加 `'asr'`(向后兼容 Plan 3B WPS / desktop 调用)。
- `LocalRuntimeSettings` 加 2 字段:`preload_asr: bool = False`、`default_asr_model: str = ""`,yaml round-trip 兼容旧版本。
- `diagnose` check 从 12 项扩到 13 项,加 `runtime.llama.asr.status`(复用 Plan 3B 的 `check_runtime_llama_status_for(capability)`)。
- 前端:`LocalRuntimePanel` 自动渲染第 4 张 card(`['chat', 'embedding', 'rerank', 'asr']`);`LocalRuntimeCapabilityCard` 加 label 映射 `asr: '语音识别'`;`CapabilityCenter` 的 asr tab 加「启动本地 runtime」按钮(同 text-embedding / rerank tab 套路)。
- 后端单测:`test_process_args_capability` +2、`test_local_runtime` +4、`test_local_runtime_registry` +1、`test_runtime_routes_llama_multi_cap` +2、`test_diagnose_checks` +1。新建 `test_audio_pipeline.py` ~4 case。
- runbook `docs/RUNBOOK-local-runtime-diagnose.md` 加 ASR 排错条目 + 模型大小 / 端口表更新。

**Out of scope(留给后续):**

- Plan 3D (image-embedding):CLIP / Tauri webview 集成,另起 plan。
- Streaming ASR (WebSocket):whisper-server 0.x release 支持 streaming 但本 plan 只走 one-shot multipart;后续如需 streaming UX 另起 plan。
- 删 Python `faster-whisper` deps:用户选了 sidecar+Python fallback 路径,本 plan 不瘦 installer。
- whisper.cpp 模型多档量化下载:本 plan 只复用 install-bundled-models 已拉的 `ggml-tiny.bin`(74 MB)。后续如需 base / small / medium 另起 plan。
- ASR 多语言模型选择 UI:CapabilityCenter asr tab 沿用 Plan 3B 已有的「已安装 / 推荐 / 自定义」3 栏,不另加 UI。
- E2E 自动化测试:沿用 Plan 3A 真机装机手测哲学。

## 3. 架构

### 3.1 顶层结构

```
┌──────────────────────────────────────────────────────────────┐
│  LocalRuntimeRegistry (singleton)                            │
│    CAPABILITIES = ('chat', 'embedding', 'rerank', 'asr')    │
│                                                              │
│    chat       → SidecarRuntimeManager(engine='llama',  off=0)│
│    embedding  → SidecarRuntimeManager(engine='llama',  off=1)│
│    rerank     → SidecarRuntimeManager(engine='llama',  off=2)│
│    asr        → SidecarRuntimeManager(engine='whisper', off=3)│
└──────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
    spawn llama-server.exe          spawn whisper-server.exe
       (port 62582+offset)            (port 62585)
```

### 3.2 SidecarRuntimeManager 类(Plan 3B `LlamaRuntimeManager` 改名 + engine 参数)

```python
class SidecarRuntimeManager:
    """通用 sidecar (llama / whisper) 生命周期管理。"""

    def __init__(
        self,
        *,
        chayuan_root: Path,
        engine: Literal['llama', 'whisper'] = 'llama',
        capability: str = 'chat',
        port_offset: int = 0,
    ) -> None:
        ...

    def _find_server_exe(self) -> Path:
        """按 engine 找 vendor binary。"""
        if self.engine == 'llama':
            return _find_in_install_dirs('llama-server')
        if self.engine == 'whisper':
            return _find_in_install_dirs('whisper-server')

    def _resolve_args_for(self, capability) -> tuple[Resolution, Optional[str]]:
        if self.engine == 'llama':
            return _resolve_args_llamacpp(capability)
        if self.engine == 'whisper':
            return _resolve_args_whispercpp(capability)


# Plan 1+2+3B back-compat alias
class LlamaRuntimeManager(SidecarRuntimeManager):
    def __init__(self, **kw):
        kw.setdefault('engine', 'llama')
        super().__init__(**kw)
```

启停 / 健康检查 / port allocation / status persist 等通用逻辑保留 Plan 3B 实现不动。

### 3.3 process_args.resolve_whisper_args

```python
_WHISPER_CAPABILITIES = ('asr',)
_WHISPER_LOCAL_CAP_MAP = {'asr': 'asr'}


def resolve_whisper_args(
    *,
    capability: str = 'asr',
    n_threads: Optional[int] = None,
) -> Resolution:
    """whisper-server 启动 args。

    capability:
      * 'asr' → asr default + ggml-bin + --model <path>
    """
    if capability not in _WHISPER_CAPABILITIES:
        raise ValueError(f"Unknown capability for whisper: {capability!r}")

    r = Resolution(process='whispercpp')
    entry, reason = _resolve(capability, prefer_format='ggml', local_cap='asr')
    if entry is None or entry.format != 'ggml':
        r.missing.append(capability)
        r.reason = reason
        return r

    r.args.extend(['--model', entry.path])
    if n_threads is not None:
        r.args.extend(['--threads', str(int(n_threads))])
    r.resolved_models[capability] = entry.model_id
    r.reason = reason
    return r
```

### 3.4 audio.py 改造

```python
def transcribe(self, audio, *, language=None, model=None) -> str:
    # 1) Plan 3C 新增:本地 sidecar 走 whisper-server
    try:
        return self._transcribe_via_sidecar(audio, language=language)
    except (SidecarUnavailable, requests.HTTPError, asyncio.TimeoutError):
        logger.info("[asr] sidecar 不可用,fallback Python")
    # 2) 旧:faster-whisper
    # 3) 旧:openai-whisper
    # 4) 旧:OpenAI API
```

`_transcribe_via_sidecar(audio, language)`:

1. 取 `registry.get('asr')` 当前 status。若 `state != 'ready'`,触发 `await manager.start()`(等 health up 到 30s)。
2. POST `http://127.0.0.1:62585/inference` (multipart/form-data,字段 `file` 是 audio bytes,可选 `language` 字段)。
3. 收 JSON `{"text": "..."}`,返回 text。
4. HTTP non-2xx 或 timeout 抛 `SidecarUnavailable`,触发上层 fallback。

### 3.5 API 路由(零新增)

Plan 3B `/runtime/llama/{cap}/{status,start,stop,restart}` 已经是 capability-scoped。Plan 3C 只在路由文件的 `_VALID_CAPABILITIES` 集合加 `'asr'`,其余代码无改动。

也就是说 `curl POST /runtime/llama/asr/start` 自动 work,前端 `localRuntime.startFor('asr')` 自动 work。

### 3.6 vendor 二进制布局

```
vendor/services/
├── llama-server/
│   ├── llama-server.exe          (Win)
│   ├── llama-server              (Mac/Linux)
│   └── README.md
└── whisper-server/               ← 本 plan 新加
    ├── whisper-server.exe
    ├── whisper-server
    └── README.md
```

`scripts/install-whisper-server.{ps1,sh}` 跟 Plan 1 install-llama-server 同套路:

- 抓 https://github.com/ggerganov/whisper.cpp/releases/tag/v1.7.x 对应平台的 zip / tar
- 解压 whisper-server[.exe] 到 vendor/services/whisper-server/
- 验证 binary 可执行(`--help` 返 exit 0)
- 失败 fallback 列多个 release tag 优先级

### 3.7 端口约定

| Capability | Engine | Port |
|---|---|---|
| chat | llama | settings.port (62582) |
| embedding | llama | settings.port + 1 (62583) |
| rerank | llama | settings.port + 2 (62584) |
| asr | whisper | settings.port + 3 (62585) |

Port 占用时 `_allocate_port` 自动 bump(Plan 1 行为)。

## 4. 数据流(典型一次 ASR 调用)

```
chat-composer / WPS 录音上传
    │
    ▼
modality_routes.py:21  POST /modality/asr (multipart, audio=...)
    │
    ▼
modality/service.py:96  ModalityService.transcribe(audio_bytes, language)
    │
    ▼
modality/audio.py  AudioPipeline.transcribe(audio_bytes, language=zh)
    │
    ├── 1) registry.get('asr').status
    │      state == 'ready':
    │        POST http://127.0.0.1:62585/inference
    │          multipart: file=<bytes>, language=zh
    │        ← 200 {"text": "今天天气真好"}
    │        返回 "今天天气真好"
    │
    │      state == 'stopped':
    │        await registry.get('asr').start()  (~3-5s)
    │        (start 成功 → 跳到上面 POST)
    │        (start 失败 → 抛 SidecarUnavailable,fallback)
    │
    │      state == 'failed':
    │        抛 SidecarUnavailable,fallback Python
    │
    ├── 2) faster-whisper(若 sidecar fallback)
    ├── 3) openai-whisper
    └── 4) OpenAI API
```

## 5. 错误处理

| 失败场景 | 表现 | 处理 |
|---|---|---|
| `whisper-server.exe` 缺失 | start() 抛 `RuntimeUnavailable` | diagnose 报 `vendor.whisper-server.binary fail` |
| `ggml-tiny.bin` 缺失 | `resolve_whisper_args` 进 missing,start() 拒绝起 | diagnose 报 `vendor.bundled_models.asr fail` |
| 模型不是 ggml 格式 | 同上 | 同上 |
| Port 62585 占用 | `_allocate_port` 自动 bump 到 62586+ | 透明 |
| Health 超时 | `start()` 30s 内 health 不 up,state→failed,last_error 写超时 | audio.py fallback Python |
| 音频 multipart > 4 MB | whisper-server 返 413 | audio.py fallback Python |
| AVX2 缺失 | whisper-server 启动崩,Popen 立即退出 | diagnose 报 `runtime.llama.asr.status fail` |
| 语种不支持 | whisper-tiny 是多语种,基本都识(可能输出乱码) | 不处理,信任 whisper.cpp |

## 6. 测试

详见上文 brainstorm 第 3 段。要点:

- 后端单测 +10 case(分散在 5 个测试文件)+ 新建 `test_audio_pipeline.py` 4 case
- 前端单测 0 新增(automatic via cap loop)
- 集成验证:真机装 .msi → smoke test ASR(沿 Plan 3A 哲学)

## 7. 配置 / 持久化

```yaml
# local_runtime.yaml (Plan 3B + 3C)
preload_on_startup: true       # chat
host: 127.0.0.1
port: 62582
api_key: ""
expose_lan: false
default_chat_model: ""
preload_embedding: false
preload_rerank: false
default_embedding_model: ""
default_rerank_model: ""
preload_asr: false             # Plan 3C 新增
default_asr_model: ""          # Plan 3C 新增
```

```json
// runtime.json (Plan 3B + 3C)
{
  "llama": {
    "chat":      { "state": "ready", "endpoint": "...", "pid": 1, ... },
    "embedding": { "state": "stopped" },
    "rerank":    { "state": "stopped" },
    "asr":       { "state": "ready", "endpoint": "http://127.0.0.1:62585", "pid": 2, ... }
  }
}
```

(注:JSON key 仍叫 "llama" 是 Plan 3B back-compat,实际语义是"local sidecar runtime"。)

## 8. 前端 UI

### 8.1 LocalRuntimePanel(设置 → AI 平台 → 本地模型)

```
┌─────────────────────────────────────────────────────────────┐
│ ▶ 聊天          [Ready] http://127.0.0.1:62582 pid 1234     │
│   model: Qwen3-4B                                           │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 文本嵌入       [Stopped]                                   │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 重排           [Failed] no model                           │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ ▶ 语音识别        [Stopped]                ← Plan 3C 新增   │
│   [启动] [停止] [重启]                                       │
├─────────────────────────────────────────────────────────────┤
│ [生成诊断报告]                                                │
├─────────────────────────────────────────────────────────────┤
│ 配置 (host / port / API key / preload 开关)                  │
├─────────────────────────────────────────────────────────────┤
│ 装机路径                                                      │
└─────────────────────────────────────────────────────────────┘
```

`LocalRuntimeCapabilityCard` 本身 cap-agnostic,只需:
1. `LocalRuntimeCapability` type 加 `'asr'`(在 `@chayuan/api`)
2. `CAPABILITY_LABEL` map 加 `asr: '语音识别'`
3. `LocalRuntimePanel` 的 `['chat','embedding','rerank']` 数组改 `['chat','embedding','rerank','asr']`

### 8.2 CapabilityCenter(设置 → AI 平台 → 能力中心)的 asr tab

跟 Plan 3B text-embedding / rerank tab 同样的 inline 状态条 + 启动按钮:

```
asr tab content:
┌─────────────────────────────────────────────────────────────┐
│ 🖥 本地 runtime: 未运行                  [启动本地 runtime]  │
├─────────────────────────────────────────────────────────────┤
│ 已安装 · 语音识别                                             │
│   - whisper.cpp ggml-tiny  [默认]                            │
│ 推荐 / 自定义安装(沿用现有 UI)                              │
└─────────────────────────────────────────────────────────────┘
```

`CapabilityCenter` 现有的 `localCap` 派生加一条 mapping:
```typescript
const localCap = activeCap === 'asr' ? 'asr' : ...;
```

## 9. 跨平台兼容矩阵

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| whisper-server 二进制源 | ggerganov/whisper.cpp release w64-mingw or msys2 | release pre-built or Homebrew brew install | release tarball or source build |
| 安装脚本 | `scripts/install-whisper-server.ps1` (UTF-8 BOM) | `scripts/install-whisper-server.sh` | 同 sh |
| 模型 `ggml-tiny.bin` | install-bundled-models manifest 已存(74 MB) | 同 | 同 |
| 端口 (62585) | psutil 跨平台 | 同 | 同 |
| audio 临时文件路径 | `%TEMP%/chayuan_asr_*/input.audio` | `/tmp/chayuan_asr_*/...` | 同 |
| 防火墙 / AV | Defender 可能拦 whisper-server.exe spawn | n/a (Mac sandbox) | n/a |

## 10. 已知风险 + 兜底

1. **whisper-server release 不稳定** — ggerganov/whisper.cpp Win pre-built 偶尔缺。`install-whisper-server.ps1` 列 3+ release tag 优先级 fallback。
2. **AVX2 缺失** — 复用 Plan 3A diagnose,`runtime.llama.asr.status fail` + last_error 报错。
3. **首次调慢** — preload_asr 默认 False,首次 `transcribe()` await start 30s。文档明示。
4. **Python deps 没瘦** — installer 体积不变,后续如要瘦 (~150 MB) 另起 plan。
5. **音频 > 4 MB 413** — whisper-server multipart 默认上限。本 plan 不调,runbook 加排错。

## 11. 验收

实施完后,用户能做:

1. ✅ 设置 → AI 平台 → 本地模型 显示 4 张 capability card,asr 卡可独立启停
2. ✅ `curl http://127.0.0.1:62581/runtime/llama/asr/start` POST 拉起 whisper-server
3. ✅ `curl http://127.0.0.1:62585/inference -F file=@hello.wav` 直接打通(whisper-server 原生 API)
4. ✅ `curl http://127.0.0.1:62581/modality/asr -F audio=@hello.wav` 优先走 sidecar(若 sidecar 不可用 fallback Python)
5. ✅ `curl http://127.0.0.1:62581/runtime/llama/registry` 一次返 4 个 capability 状态
6. ✅ Plan 3A 诊断报告显示 13 项 check,含 `runtime.llama.asr.status`
7. ✅ 退桌面 sidecar 时 lifespan shutdown 4 个子进程都 kill(`registry.stop_all`)
8. ✅ CapabilityCenter 「语音识别」tab 有「启动本地 runtime」按钮
9. ✅ 后端单测 +10 全过,新建 audio_pipeline 测试 4 case 全过;前端 typecheck 0 error
10. ✅ Plan 3B 已有的 76 backend tests + 20 frontend tests 不破

---

## 附录 A:与 Plan 3B 的差异速查

| 维度 | Plan 3B | Plan 3C(新增 / 改) |
|---|---|---|
| 类名 | LlamaRuntimeManager | SidecarRuntimeManager(LlamaRuntimeManager 作 alias) |
| Registry capabilities | 3 (chat/embedding/rerank) | 4 (+ asr) |
| Engine 参数 | 无 | engine='llama' / 'whisper' |
| Vendor binary | 1 (llama-server) | 2 (+ whisper-server) |
| Install script | install-llama-server.{ps1,sh} | + install-whisper-server.{ps1,sh} |
| API 路径 | /runtime/llama/{cap}/* | 同 (只加 asr 到白名单) |
| LocalRuntimeSettings 字段数 | 10 | 12 (+ preload_asr / default_asr_model) |
| Diagnose check 数 | 12 | 13 (+ runtime.llama.asr.status) |
| Frontend UI cards | 3 | 4 (自动) |
| audio.py 改造 | 不动 | sidecar 首选 fallback Python |

## 附录 B:实施顺序提示(供 writing-plans skill 参考)

建议 task 切分(15-18 task 估):

**Sprint 5C-1 后端(~8 task):**
1. `resolve_whisper_args` + 测试
2. `SidecarRuntimeManager` 改名 + engine 参数 + LlamaRuntimeManager alias
3. `_find_server_exe` 按 engine 找 binary
4. `_resolve_args_for` 按 engine 派发
5. `LocalRuntimeRegistry` 加 asr 项
6. `_VALID_CAPABILITIES` + 路由测试加 asr
7. `LocalRuntimeSettings` 加 2 字段
8. `first_launch` + `diagnose` 接 asr

**Sprint 5C-2 vendor + audio.py(~4 task):**
9. `install-whisper-server.ps1` (Win)
10. `install-whisper-server.sh` (Mac/Linux)
11. `audio.py` sidecar 路径 + fallback 顺序
12. 新建 `test_audio_pipeline.py`

**Sprint 5C-3 前端 + 收尾(~3-4 task):**
13. `@chayuan/api` LocalRuntimeCapability 加 asr type
14. `LocalRuntimePanel` 数组加 asr + Card label
15. `CapabilityCenter` asr tab localCap mapping
16. RUNBOOK + 真机 smoke
