# 本地 LLM Runtime 集成 设计文档

日期:2026-05-15
状态:design draft,等用户 review
关联:用户需求"打开桌面 → 自动起本地模型 → 设置页配置 → 自动选默认"

---

## 1. 背景与现状

### 1.1 用户需求 (来自 2026-05-15 对话)

1. **模型装到哪不透明**:集成版 .msi 装好后,用户不知道模型在文件系统的实际位置
2. **桌面应用启动后应该自动拉起本地模型 runtime**:打开 App 不需要用户额外操作就能开始聊天
3. **系统设置页面新增"模型启动地址和端口"**:供 chayuan 自身调用,也供别的应用 (LM Studio / 自家 SDK / OpenAI 兼容 client) 调用
4. **自动检测 + 自动配置默认模型**:启动期发现已就绪,默认模型选择按 capability (聊天 / 文本嵌入 / 图像嵌入 / 重排) 分组,组里展开具体本地模型;聊天选模型下拉里加"本地模型"分组

### 1.2 现状对照 (探查于 2026-05-15)

| 需求拼图 | 现状 | 缺口 |
|---|---|---|
| 模型落盘路径 | `<CHAYUAN_ROOT>/models/bundled/<cap>/<repo>/...` (`install_job` + `bundled_seed` 写;`local_index.scan_once()` 扫) | UI 不透出 |
| 本地 LLM runtime 进程 | **完全无**。`chayuan-server` 没集成 llama-cpp-python;`chayuan-runtime` 只是 adapter 翻译 model_id → CLI args;`chayuan-supervisor` 能 spawn 但需 `chayuan service start <name>` 手动触发;`vendor/services/` 空 | **整个 runtime 拉起链路缺失** |
| 默认模型按 capability 推荐 | `promote_defaults_from_local()` 已就绪,写 `model_settings.yaml` 的 `DEFAULT_<CAP>_MODEL`;`install_job` 完成 + `first_launch` hook 触发 | 没问题,可复用 |
| 设置页"默认模型"分组 | `SettingsAsPage.tsx` 已有 4 capability 分组 (chat / embedding / image / rerank),已用 `<optgroup label="本地模型">` 区分 | 没问题,顺手把状态指示灯 + 路径透出补一下 |
| ComposerModelPill 分组 | 只按 platform_name 分,**没有"本地模型"显式分组** | 加一个 |
| 设置页"本地模型服务" section | **完全不存在** | 整个 section 都要新加 |
| OpenAI-compat 对外 endpoint | **完全无** | 通过 llama-server 自带 endpoint 直暴 |

### 1.3 brainstorming 阶段已敲定的决策

1. **runtime 形态** = Vendor `llama-server.exe` (CPU only build) 进集成版 .msi (~25-30 MB 额外)
2. **runtime 覆盖** = 仅 chat (其它 capability 继续 in-process)
3. **对外暴露** = llama-server 自己监听独立端口 (默认 62582),自带 `/v1/chat/completions` OpenAI 兼容;设置页配 host:port + 仅本机/局域网开关 + 可选 API Key
4. **启动时机** = 设置里"启动时预热"开关,**默认开**;关掉退到 lazy start
5. **管理层** = Python (chayuan-server) 管 llama-server 生命周期;Tauri 不直接管 llama-server,只管 sidecar

---

## 2. 目标与非目标

### 2.1 目标 (in scope)

- 集成版 .msi 装机即用:首次打开 5-30s 内本地 chat 模型可用 (含预热)
- 设置页有专门的"本地模型服务" section:状态指示灯、endpoint URL、host:port 字段、外网开关、预热开关、可选 API Key
- ComposerModelPill chat 模型下拉里加显式"本地模型"分组
- 设置页"默认模型"section 加状态指示 + 实际模型路径透出
- 外部应用 (任何支持 OpenAI 兼容 API 的 client) 可以接 `http://127.0.0.1:62582/v1` 跟 chayuan 共用同一份本地 runtime

### 2.2 非目标 (out of scope,后续迭代)

- GPU 加速 (CUDA / Vulkan / Metal):MVP 只做 CPU 版 llama-server;GPU 版作为另一个 build flavor 后续做
- 多 chat runtime 并发 (同时跑多个 GGUF):一次只跑一个,切换 default model 时 hot-restart
- embedding / rerank 用 GGUF 量化版跑 llama-server `--embeddings` 模式:这些维持 in-process sentence-transformers
- vision LLM / image generation 的 runtime:这些 capability 走外部 supervisor 或后续单独迭代
- OpenAI proxy 在 chayuan-server 上挂 `/v1/*`:直暴 llama-server 端口,不做中间代理 (无审计 / 限流;后续真有需要再加 proxy)
- 鉴权 / 多租户:llama-server 自带 `--api-key`,设置页透出这个字段,不另做账号系统
- 跨平台:本设计只针对 Windows 集成版;Mac / Linux 集成版后续迭代

### 2.3 显式风险

- llama-server.exe Windows CPU AVX2 build 在老 CPU (无 AVX2) 上无法启动,失败要清晰透出
- 4B Q4 chat 模型加载 ~1.7-2 GB RAM,8 GB RAM 机器开启"预热"会占近一半物理内存,需要在"预热"开关旁说明
- llama-server 进程独立于 sidecar:sidecar 异常退出时 llama-server 必须级联关闭,否则留尸占端口

---

## 3. 架构

```
┌────────────────────────────────────────────────────────────────────┐
│  Tauri  (Rust)                                                     │
│   - WebView (前端)                                                 │
│   - shell-execute capa 只放 chayuan-server-*.exe                  │
│   - 不直接 spawn llama-server                                      │
└─────────┬──────────────────────────────────────────────────────────┘
          │ 127.0.0.1:62581 (sidecar API)
┌─────────▼──────────────────────────────────────────────────────────┐
│  chayuan-server (Python, PyInstaller frozen)                       │
│   ├─ FastAPI (62581)                                               │
│   ├─ model_registry/                                               │
│   │   ├─ install_job  (在线下载,已就绪)                            │
│   │   ├─ bundled_seed (vendor → CHAYUAN_ROOT,已就绪)              │
│   │   ├─ local_index   (扫描,已就绪)                              │
│   │   ├─ auto_assign.promote_defaults_from_local (已就绪)         │
│   │   └─ local_runtime.LlamaRuntimeManager  ← **NEW**             │
│   │       • spawn vendor/services/llama-server/llama-server.exe   │
│   │       • args = process_args.resolve_llamacpp_args(model_id)   │
│   │       • 端口:从 settings 读 (默认 62582),冲突自动 bump        │
│   │       • 健康检查:/health 轮询                                  │
│   │       • 关停:sidecar shutdown hook 级联 SIGTERM                │
│   │       • 状态写入 runtime.json (前端读)                         │
│   └─ api_server/runtime_routes.py                                  │
│       ├─ GET  /runtime/llama/status        ← NEW                  │
│       ├─ POST /runtime/llama/restart       ← NEW                  │
│       ├─ POST /runtime/llama/config        ← NEW (host/port/key)  │
│       └─ GET  /runtime/llama/install-info  ← NEW (透出落盘路径)    │
└─────────┬──────────────────────────────────────────────────────────┘
          │ 127.0.0.1:62582 (默认;可配)
┌─────────▼──────────────────────────────────────────────────────────┐
│  llama-server.exe  (CPU only, vendor 进集成版 .msi)               │
│   GET  /health                                                     │
│   POST /v1/chat/completions     (streaming + non-streaming)        │
│   POST /v1/embeddings           (如果 --embeddings,MVP 不开)      │
│   GET  /v1/models                                                  │
└────────────────────────────────────────────────────────────────────┘
                    ▲
                    │ 外部 app (LM Studio / 自家 SDK / Cline / 任何
                    │ OpenAI client) 接这个 endpoint;默认 127.0.0.1,
                    │ 设置里勾"允许局域网"后绑 0.0.0.0
```

### 3.1 端口分配

- sidecar API:62581 (写死,与现状一致)
- llama-server:62582 (默认;`local_runtime.LlamaRuntimeManager` 启动时先 try-bind,冲突就在 62583-62600 区间找空闲;最终端口写 `runtime.json`)
- 用户在设置页可改 llama-server 端口;改后 `POST /runtime/llama/config`,后端持久化到 `model_settings.yaml`,下次 restart 生效;立即生效需点"重启 runtime"

### 3.2 状态机

```
                         ┌──────────────────┐
                         │   stopped        │
                         └────────┬─────────┘
        spawn (设置预热=on,启动期) │
                                  ▼
                         ┌──────────────────┐
            spawn fail   │   starting        │  /health 200
                ┌────────┤   (loading model) │────────┐
                │        └────────┬─────────┘        │
                │                  │ 30s timeout      │
                ▼                  ▼                  ▼
        ┌──────────────┐  ┌──────────────────┐  ┌────────────┐
        │   failed     │  │   ready          │  │   ready    │
        │  (透出错误)  │  │  (UI 亮绿灯)     │  └─────┬──────┘
        └──────┬───────┘  └────────┬─────────┘        │
               │                    │ restart cmd      │
               │ user 点重试        │                  │
               │                    ▼                  │
               │           ┌──────────────────┐        │
               └──────────►│   restarting     │◄───────┘
                           └──────────────────┘
                            (sidecar shutdown → SIGTERM llama-server → 终态)
```

### 3.3 数据流(典型聊天请求)

```
1. 用户在 Composer 点 chat 模型下拉 → 看到"本地模型"分组里 default chat
2. 输入消息,发请求
3. chayuan-client → chayuan-server (62581) 的 chat completion API
4. chayuan-server 路由发现 chat 走本地 runtime → 转发到 llama-server (62582)
5. llama-server stream 返回 SSE → chayuan-server → chayuan-client → UI 渲染
```

### 3.4 启动期顺序 (集成版桌面)

```
T+0   Tauri 启动 → spawn chayuan-server.exe
T+1   chayuan-server FastAPI 起 (62581 listen)
T+2   first_launch hook:
         a. seed_bundled_models (vendor → CHAYUAN_ROOT)
         b. local_index.scan_once
         c. promote_defaults_from_local (写 model_settings.yaml)
T+3   /healthz 200 → Tauri 通知 WebView "sidecar ready"
T+4   if settings.PRELOAD_LOCAL_RUNTIME == True (默认):
         LlamaRuntimeManager.start_async() (不阻塞)
         前端 WebView 已经在加载 UI
T+5   llama-server.exe spawn,model loading
T+30  llama-server /health 200 → runtime.json.llama_status = "ready"
         前端轮询拿到状态,Composer 模型下拉里"本地模型"组亮绿
```

如果 `PRELOAD_LOCAL_RUNTIME == False`,T+4 跳过;首次用户发聊天时才 lazy spawn (UX 加 spinner)。

---

## 4. 组件设计 (按 MVP 拆 5 个模块)

### 4.1 Module 1:Vendor llama-server.exe + 同步进集成版

**目标**:把 `llama-server.exe` 作为外部资源带进集成版 .msi,装机后跟着主 .exe 一起部署。

**变更**:

- 新目录 `chayuan-server/vendor/services/llama-server/` 放:
  - `llama-server.exe` (从 llama.cpp 官方 release `llama-bin-win-cpu-x64.zip` 解压挑出)
  - `ggml-cpu.dll` + 其它依赖 dll
  - `VERSION` 文件记 llama.cpp commit hash
  - `README.md` 说明来源 + 升级流程
- `chayuan-server/packaging/pyinstaller/build.py` 的 `sync_bundled_models()` 增加 `vendor/services/` → `src-tauri/services/` 复制 (跟 `bundled_models/` 同机制)
- `chayuan-client/apps/desktop/src-tauri/tauri.conf.json` 的 `bundle.resources` 加 `"services/**/*"`
- `chayuan-server/packaging/pyinstaller/build.py` 加 size-guard:`vendor/services/` 单文件也走 2 GB 检查 (llama-server.exe 通常 < 50 MB,不会撞,但 dll 也得扫)

**装机后路径** (Windows 集成版):
```
C:\Program Files\Chayuan\
├── chayuan-desktop.exe                  ← Tauri 主进程
├── binaries\
│   └── chayuan-server-x86_64-pc-windows-msvc.exe ← sidecar
└── services\
    └── llama-server\
        ├── llama-server.exe
        ├── ggml-cpu.dll
        └── ...
```

**注意**:这套二进制不入 git。`vendor/services/llama-server/.gitkeep` + `.gitignore` 列 `vendor/services/llama-server/*.exe` `*.dll`。下载脚本 `scripts/install-llama-server.{ps1,sh}` 帮开发机 / CI 拉取。

### 4.2 Module 2:LlamaRuntimeManager (Python)

**目标**:chayuan-server 内部一个单例,管 llama-server 生命周期 (spawn / 健康检查 / 重启 / 关停 / 状态)。

**文件**:`chayuan-server/libs/chayuan-server/chayuan/server/model_registry/local_runtime.py` (NEW)

**接口**:

```python
class LlamaRuntimeManager:
    def __init__(self, *, root: Path, settings: LocalRuntimeSettings) -> None: ...

    async def start(self, model_id: str | None = None) -> RuntimeStatus:
        """spawn llama-server.exe;model_id 不传则用 model_settings.yaml.DEFAULT_CHAT_MODEL"""

    async def stop(self, *, timeout: float = 10.0) -> None:
        """SIGTERM, then SIGKILL if not exited within timeout"""

    async def restart(self, *, model_id: str | None = None) -> RuntimeStatus: ...

    async def status(self) -> RuntimeStatus:
        """读 runtime.json + 实时 /health 探测"""

    async def health_loop(self) -> None:
        """后台 task,2s 一次 /health 探测,失败 3 次连续后标记 unhealthy 触发重启"""
```

**配置存储** (`<CHAYUAN_ROOT>/model_registry/local_runtime.yaml`):

```yaml
preload_on_startup: true     # "启动时预热"开关,默认 true
host: 127.0.0.1              # llama-server 监听 host,默认 127.0.0.1
port: 62582                  # 默认 62582,冲突时自动 bump
api_key: ""                  # 可选 API key,空 = 不要求
expose_lan: false            # true 时 host 强制改 0.0.0.0
default_chat_model: ""       # 空 = 从 model_settings.yaml.DEFAULT_CHAT_MODEL 读
```

**spawn 参数** (调 `process_args.resolve_llamacpp_args`):

```python
args = [
    str(llama_server_exe),
    "--model", str(gguf_path),
    "--host", host,
    "--port", str(port),
    "--ctx-size", "8192",       # 默认 8K context;后续可配
    "--threads", str(min(8, os.cpu_count() or 4)),
    "--log-disable",            # 减少 stdout 输出,日志走另一份
]
if api_key:
    args += ["--api-key", api_key]
```

**RuntimeStatus dataclass**:

```python
@dataclass
class RuntimeStatus:
    state: Literal["stopped", "starting", "ready", "failed", "restarting"]
    endpoint: str | None                # http://host:port
    pid: int | None
    model_id: str | None
    model_path: str | None
    started_at: datetime | None
    last_health_at: datetime | None
    last_error: str | None              # 启动失败时填,UI 显示
```

**关停级联**:chayuan-server 的 `lifespan` shutdown hook 调 `manager.stop()`;Tauri 退出时 kill sidecar,sidecar shutdown 会触发这个。

### 4.3 Module 3:API 路由 (FastAPI)

**文件**:`chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` (EXISTING,加路由)

新增端点:

```
GET  /runtime/llama/status         → RuntimeStatus JSON
POST /runtime/llama/start          → start();body {model_id?}
POST /runtime/llama/stop
POST /runtime/llama/restart        → restart();body {model_id?}
GET  /runtime/llama/config         → 当前配置 (含字段语义)
POST /runtime/llama/config         → 改配置 (host/port/api_key/expose_lan/preload_on_startup)
                                     不立即重启,要求前端追一个 /restart
GET  /runtime/llama/install-info   → {bundled_root, models_root, services_root,
                                       llama_server_exe, build_version}
                                     给设置页透出"模型装到哪 / runtime 二进制在哪"
```

### 4.4 Module 4:设置页"本地模型服务" Section (前端)

**文件**:`chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx`

新加一个 `LocalRuntimeSection`,放在"默认模型"section 上方 (因为它是"默认模型"的前提)。

布局:

```
┌─ 本地模型服务 ────────────────────────────────────────┐
│  状态:● 就绪 (Qwen2.5-3B-Instruct-Q4_K_M)            │
│  Endpoint:http://127.0.0.1:62582  [📋 复制]          │
│                                                       │
│  [启动] [停止] [重启]                                  │
│                                                       │
│  ── 配置 ──                                            │
│  监听地址:[127.0.0.1] (☐ 允许局域网访问)              │
│  端口:    [62582]                                     │
│  API Key: [_________________ (可选,留空=不鉴权)]      │
│  ☑ 启动桌面时自动预热本地模型 (默认开,8GB 内存机谨慎) │
│  [保存配置] (改完点保存 → 提示是否立即重启)            │
│                                                       │
│  ── 模型存放路径 ──                                    │
│  模型库根:C:\Users\hp\.chayuan\models\bundled\        │
│  llama-server: C:\Program Files\Chayuan\services\... │
│  本次 chat 模型:.../chat/Qwen2.5-3B-Instruct-GGUF/   │
│                                                       │
│  ── 外部应用接入 ──                                    │
│  把这个 base URL 填到外部 OpenAI 兼容 client:         │
│    Base URL:http://127.0.0.1:62582/v1                │
│    API Key:(留空 / 跟上面一致)                        │
│    Model 名: <来自 /v1/models 列表>                   │
│  [显示示例:LM Studio / Cline / cURL]                  │
└───────────────────────────────────────────────────────┘
```

**API 客户端补**:`packages/api/src/modelPlatform.ts` 加 `serverLocalRuntime.{status, start, stop, restart, getConfig, setConfig, installInfo}`。

**状态刷新**:5 秒一次轮询 `/runtime/llama/status`;启动 / 重启时 SSE 或短轮询 1s 一次。

### 4.5 Module 5:ComposerModelPill 加"本地模型"分组

**文件**:`chayuan-client/packages/app/src/features/composer/ModelMenuList.tsx`

现在按 `platform_name` 分组。新增逻辑:**优先把 `source === "local_index"` 的模型聚到一个特殊分组**,标题 `🖥 本地模型`,展开在所有 platform 分组的最上面。

伪代码:

```typescript
const localModels = models.filter(m => m.source === 'local_index')
const platformGroups = groupBy(
  models.filter(m => m.source !== 'local_index'),
  m => m.platform_name
)

render:
  <Group title="🖥 本地模型" status={localRuntimeStatus}>
    {localModels.map(m => <ModelItem ... />)}
  </Group>
  {Object.entries(platformGroups).map(([plat, ms]) => (
    <Group title={plat}>{ms.map(...)}</Group>
  ))}
```

**状态联动**:本地模型分组标题旁边带状态指示灯 (绿/橙/红),对应 `localRuntimeStatus.state`。runtime stopped 时本地模型组里所有 item disabled,点击弹"先到设置启动本地模型服务"。

---

## 5. 错误处理

### 5.1 llama-server.exe 启动失败

可能原因:
- 端口被占 → `LlamaRuntimeManager` 自动 bump 到下个空闲端口,记日志
- 老 CPU 无 AVX2 → llama-server.exe `_exit_` 非 0,stderr "AVX2 not supported"。`status.state = failed`,`last_error` 填这条;设置页显示 + 链接到 FAQ
- GGUF 文件损坏 → 同上,`last_error` 含 "model load failed"
- 路径含中文 / 空格 → 已用 `Path` 处理转义,正常应该没问题;真撞要日志 capture

### 5.2 健康检查失败 (运行期 crash)

- 后台 `health_loop` 连续 3 次 /health 超时 → 标记 unhealthy
- 自动重启 1 次;再失败 → `state = failed`,UI 提示"本地模型服务挂了,点重启"
- 不死循环重启 (避免烧 CPU)

### 5.3 chayuan-server crash 时

- llama-server 是子进程,Python 异常时 `lifespan` shutdown hook 可能跑不到
- 用 `psutil` 在启动 llama-server 时记 pid 到 `runtime.json`;下次 chayuan-server 启动时如果 pid 还活着,先 kill 再起新的

### 5.4 配置错误透出

- 前端配 host=0.0.0.0 + 无 api_key → 保存时弹警告"对外暴露但无 API key 不安全,确认 / 取消"
- 端口设置成 < 1024 → 后端 422,UI 提示"端口需 1024-65535"

---

## 6. 测试

### 6.1 单元测试 (chayuan-server)

- `tests/unit_tests/test_local_runtime.py` (NEW):
  - mock `subprocess.Popen`,测 `LlamaRuntimeManager.start/stop/restart` 状态转换
  - mock `httpx.get('/health')` 测 health_loop
  - 测端口冲突 bump 逻辑

- `tests/unit_tests/test_runtime_routes_llama.py` (NEW):
  - mock LlamaRuntimeManager,测 `/runtime/llama/*` 路由路径 + body 合同

### 6.2 集成测试 (开发机,要 llama-server.exe 实际存在)

- `tests/integration_tests/test_local_runtime_e2e.py` (NEW,@pytest.mark.requires_llama):
  - 真起一个 llama-server 子进程 (用一个超小的 TinyLlama Q4 ~ 600 MB 测试模型,不嵌 vendor)
  - 走 `/runtime/llama/start` → 等 `state=ready` → POST `/v1/chat/completions` 直接打 llama-server → 验证 stream 返回
  - 收尾 `/runtime/llama/stop` 确认进程退干净 (psutil 查)

### 6.3 手测脚本

- `scripts/test-local-runtime.ps1` (NEW):双击跑,装好桌面后用,顺序 health-check → ping llama-server → 一句话聊天测试,落日志可粘贴

### 6.4 装机验收 (人工)

- Windows 11 干净机装集成版 .msi:
  - 打开桌面 60s 内本地模型组绿灯
  - 设置页能看到 endpoint + 模型路径 + 改 host:port 重启生效
  - 外部 cURL 打 `http://127.0.0.1:62582/v1/chat/completions` 拿到回复
  - 设置勾"允许局域网" + 设 API key → 局域网另一台机能接

---

## 7. 实施顺序与里程碑

按依赖顺序:

| Sprint | 模块 | 输出 | 验证 |
|---|---|---|---|
| **S1** | Module 1 vendor | `vendor/services/llama-server/` + 装包流水线带它 + size-guard | 装机后 `C:\Program Files\Chayuan\services\llama-server\llama-server.exe` 存在 |
| **S2** | Module 2 manager + Module 3 路由 | `local_runtime.py` + `/runtime/llama/*` 接口 + 单元测试 | curl 启停 llama-server 状态 OK |
| **S3** | Module 4 设置页 section | UI section + API 接通 + 状态刷新 | 设置页能改 host:port,改完重启,装机后默认预热可见绿灯 |
| **S4** | Module 5 ComposerModelPill 分组 | "本地模型"分组渲染 | chat 选模型时本地模型独立组,runtime 未就绪时 disabled |
| **S5** | 测试 + 收尾 | 集成测试 + 装机验收 + 文档更新 | 装机黑盒走通 |

每个 Sprint 独立可 review。S1-S3 后桌面集成版能跑本地聊天 (即使 UI 不完美);S4-S5 是 UX 打磨。

---

## 8. 关联文件清单 (实现时编辑)

```
chayuan-server/
  libs/chayuan-server/chayuan/server/
    model_registry/local_runtime.py            ← NEW,Module 2
    model_registry/local_runtime.yaml          ← NEW(运行时生成,template 见 spec §4.2)
    api_server/runtime_routes.py               ← EDIT,Module 3 加路由
  vendor/services/llama-server/                ← NEW dir,Module 1
    .gitkeep
    README.md
  packaging/pyinstaller/build.py               ← EDIT,sync_bundled_models 加 services
  tests/unit_tests/
    test_local_runtime.py                      ← NEW
    test_runtime_routes_llama.py               ← NEW
  tests/integration_tests/
    test_local_runtime_e2e.py                  ← NEW

chayuan-client/
  apps/desktop/src-tauri/
    tauri.conf.json                            ← EDIT,bundle.resources 加 services/**
  packages/api/src/modelPlatform.ts            ← EDIT,Module 4 加 serverLocalRuntime
  packages/app/src/features/placeholders/
    SettingsAsPage.tsx                         ← EDIT,Module 4 LocalRuntimeSection
  packages/app/src/features/composer/
    ModelMenuList.tsx                          ← EDIT,Module 5 加本地模型分组
    ComposerModelPill.tsx                      ← 可能受影响

scripts/
  install-llama-server.ps1                     ← NEW,开发机拉 llama-server binary
  install-llama-server.sh                      ← NEW,Mac/Linux dev 同上
  test-local-runtime.ps1                       ← NEW,装机后手测
```

---

## 9. 后续迭代规划 (非本次 spec)

按重要性排:

1. **GPU build flavor**:用 `llama.cpp` CUDA / Vulkan build 做单独的 .msi,装机包翻 5-10 倍但 4B Q4 推理速度 5x
2. **多 chat runtime 并发**:设置页可同时跑多个模型,前端选择切换不重启
3. **OpenAI proxy 在 chayuan-server 上挂 `/v1/*`**:支持鉴权 / 限流 / 审计 / 多 runtime 路由
4. **embedding/rerank 走 llama-server `--embeddings`**:统一架构,但要把 vendor/bundled_models 换 GGUF 量化版本
5. **vision LLM (Qwen2-VL) 走 llama-server**:扩到 image 分类的本地 runtime
6. **Mac / Linux 集成版本地 runtime**:vendor 对应平台 `llama-server` + 改 Tauri capability

---

## 10. 未决问题 (等用户 review 阶段拍板)

无 — brainstorming 阶段所有关键分叉都已决策,实现细节可在 plan / implementation 阶段补。
