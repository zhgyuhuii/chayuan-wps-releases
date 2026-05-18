# 本地 Runtime 多 Capability 扩展 (Plan 3B) 设计文档

**日期:** 2026-05-15
**作用域:** Plan 1+2 chat-only `LlamaRuntimeManager` 拓展到 embedding + rerank 多 capability,集成版装机后用户无需 pip install 也能跑本地 RAG 闭环。
**关联:** Plan 1 后端 (`f9ae8ce..a240516`, `aa3dc63`) + Plan 2 前端 (`d738df5..d1b4623`) + Plan 3A 诊断 (`d8f85a5..3a3d508`)

---

## 1. 目标

集成版桌面 .msi/.dmg/.deb 装机后,用户能:

1. 一键启动本地 chat / embedding / rerank 三个 llama-server 子进程 (各跑各的端口)
2. 自检 / 启停 / 配置 / 看状态 全套 UI 跟 chat 一致
3. RAG 链路 (chunk 后向量化 + 检索 + rerank) 跑通而无任何外部网络依赖
4. 旧的「pip install infinity_emb」路径作为兼容兜底保留,但不再是 first-class

**out of scope:**
- ASR (whisper.cpp 另一份 vendor 二进制) → Plan 3C
- image-embedding (CLIP) → Plan 3D
- 模型市场 / auto-download → 永远不做或独立 plan
- CI 自动测 → 沿用 Plan 3A,留真机

---

## 2. 关键决策(brainstorming 已确认)

| # | 决策 | 选项 |
|---|---|---|
| 2.1 | inference 引擎 | **llama.cpp 单一栈** (新 capability 复用同一份 llama-server 二进制) |
| 2.2 | capability 范围 | **embedding + rerank** 两项 |
| 2.3 | 后端架构 | **Strategy 1: Registry on top** — 保留 `LlamaRuntimeManager`,新增 `LocalRuntimeRegistry` 单例 |
| 2.4 | API shape | 向后兼容 `/runtime/llama/*` (chat) + 显式 `/runtime/llama/{capability}/*` 双轨 |
| 2.5 | 端口约定 | chat = `settings.port` (62582);embedding = base+1;rerank = base+2 |
| 2.6 | preload 默认 | chat=true (旧),embedding/rerank=false (省 RAM) |
| 2.7 | bundled 模型格式 | GGUF (跟 chat 一致),旧 HF 格式留兼容 |

---

## 3. 架构

```
┌───────────────────────────────────────────────────────────────┐
│  chayuan-server (sidecar)                                     │
│                                                                │
│  LocalRuntimeRegistry  (singleton)                            │
│  ├── chat:      LlamaRuntimeManager(capability="chat",      port_offset=0)  │
│  ├── embedding: LlamaRuntimeManager(capability="embedding", port_offset=1)  │
│  └── rerank:    LlamaRuntimeManager(capability="rerank",    port_offset=2)  │
│                                                                │
│  API:                                                          │
│    /runtime/llama/status               → chat (向后兼容)      │
│    /runtime/llama/start / stop / etc.  → chat                 │
│    /runtime/llama/{cap}/status         → 显式 capability      │
│    /runtime/llama/{cap}/start ...      → 显式启停             │
│    /runtime/llama/registry             → 三个 manager 状态汇总 │
│    /runtime/llama/config GET/POST      → 共享 settings        │
│    /runtime/llama/install-info         → vendor 路径不变      │
│    /runtime/diagnose                   → Plan 3A,不动        │
└─────────────┬─────────────────────────────────────────────────┘
              │
              │ spawns
              ▼
┌──────────────────────┬────────────────────────┬─────────────────────┐
│ llama-server.exe     │ llama-server.exe       │ llama-server.exe    │
│ --model chat.gguf    │ --embedding --model    │ --reranking --model │
│ port 62582           │ embed.gguf  port 62583 │ rerank.gguf 62584   │
└──────────────────────┴────────────────────────┴─────────────────────┘
```

---

## 4. 后端实现

### 4.1 `LlamaRuntimeManager` 扩展

新增 / 修改 (signatures):

```python
class LlamaRuntimeManager:
    def __init__(
        self,
        *,
        chayuan_root: Path,
        capability: Literal["chat", "embedding", "rerank"] = "chat",  # NEW
        port_offset: int = 0,                                          # NEW
    ) -> None:
        ...
        self.capability = capability
        self.port_offset = port_offset
        self.status_path = chayuan_root / "runtime.json"  # 不变,共享
```

- `find_llama_server_exe()` — 不变 (vendor 路径无 capability 差异)
- `_allocate_port(preferred)` — 不变 (preferred 由调用方计算:`settings.port + port_offset`)
- `start()` — 内部用 `_resolve_args_for(capability)` 取代当前 `_resolve_chat_args()`
- `_persist_status()` — 改写 runtime.json 时按 capability key:`{"chat": {...}, "embedding": {...}, "rerank": {...}}`,merge 已有内容不覆盖其它 capability
- `stop()` / `restart()` — 不变,只动当前 capability 的子进程

### 4.2 新增 capability-specific arg resolver

`local_runtime.py` 加 3 个函数,替换现有 `_resolve_chat_args`:

```python
def _resolve_args_for(
    capability: str,
    *,
    n_ctx: Optional[int] = None,
) -> tuple[Resolution, Optional[str]]:
    """根据 capability 派发到对应的 resolve_*_args。"""
    if capability == "chat":
        return _resolve_chat_args(n_ctx=n_ctx)
    if capability == "embedding":
        return _resolve_embedding_args()
    if capability == "rerank":
        return _resolve_rerank_args()
    raise ValueError(f"Unknown capability: {capability}")


def _resolve_chat_args(*, n_ctx=None) -> tuple[Resolution, Optional[str]]:
    """同 Plan 1,不动语义。"""
    ...


def _resolve_embedding_args() -> tuple[Resolution, Optional[str]]:
    """Embedding capability:
    - process_args.resolve_llamacpp_args 已有的 capability default 'embedding'
    - args 加 `--embedding --pooling cls`
    """
    ...


def _resolve_rerank_args() -> tuple[Resolution, Optional[str]]:
    """Rerank capability:
    - process_args 的 capability default 'rerank'
    - args 加 `--reranking`
    """
    ...
```

`process_args.resolve_llamacpp_args` 当前只解 chat (line 182 hard-coded `"chat"`)。Plan 3B 需要把 capability 参数化:

```python
def resolve_llamacpp_args(
    *,
    capability: Literal["chat", "embedding", "rerank"] = "chat",  # NEW
    n_ctx: int = 4096,
    ...
) -> Resolution:
```

实现细节:per-capability local_index 查询 (`local_cap` mapping: chat→chat, embedding→text-embedding, rerank→rerank,跟 process_args 现有约定一致)。

### 4.3 `LocalRuntimeRegistry` 单例

新文件 `chayuan/server/model_registry/local_runtime_registry.py`:

```python
"""3 个 LlamaRuntimeManager 实例的协调器。"""

class LocalRuntimeRegistry:
    CAPABILITIES = ("chat", "embedding", "rerank")

    def __init__(self, *, chayuan_root: Path) -> None:
        self._managers: dict[str, LlamaRuntimeManager] = {
            cap: LlamaRuntimeManager(
                chayuan_root=chayuan_root,
                capability=cap,
                port_offset=i,
            )
            for i, cap in enumerate(self.CAPABILITIES)
        }

    def get(self, capability: str) -> LlamaRuntimeManager:
        if capability not in self._managers:
            raise ValueError(f"unknown capability: {capability}")
        return self._managers[capability]

    def all_statuses(self) -> dict[str, RuntimeStatus]:
        return {cap: m.status for cap, m in self._managers.items()}

    async def stop_all(self) -> None:
        for m in self._managers.values():
            await m.stop()


_registry_singleton: Optional[LocalRuntimeRegistry] = None


def get_registry() -> LocalRuntimeRegistry:
    """单例 accessor;首次调用时按 settings.CHAYUAN_ROOT 构造。"""
    global _registry_singleton
    if _registry_singleton is None:
        from chayuan import settings as cy_settings
        _registry_singleton = LocalRuntimeRegistry(chayuan_root=Path(cy_settings.CHAYUAN_ROOT))
    return _registry_singleton
```

`local_runtime.get_manager()` (Plan 1 单例) 改成 `get_registry().get("chat")`,backward compat 100%。

### 4.4 settings yaml 扩展

`LocalRuntimeSettings` dataclass 加 4 个字段:

```python
@dataclasses.dataclass
class LocalRuntimeSettings:
    # 旧字段 (不动语义)
    preload_on_startup: bool = True       # = preload_chat (向后兼容)
    host: str = "127.0.0.1"
    port: int = 62582                     # = chat base port
    api_key: str = ""
    expose_lan: bool = False
    default_chat_model: str = ""

    # NEW
    preload_embedding: bool = False
    preload_rerank: bool = False
    default_embedding_model: str = ""
    default_rerank_model: str = ""
```

`load(path)` 已有的 "过滤未知字段" 逻辑保证旧 yaml 仍能读 (commit `c0aef89` 的实现):新字段缺失 = 默认值。

### 4.5 API 路由

`runtime_routes.py` 加新组 (放在现有 `/runtime/llama/*` 之后,Plan 3A 的 `/runtime/diagnose` 之前):

```python
# ─────── /runtime/llama/{capability}/* ───────
# capability ∈ {chat, embedding, rerank}

@runtime_router.get("/llama/registry")
def llama_registry_status() -> Dict[str, Any]:
    """一次拿三个 capability 状态。"""
    reg = get_registry()
    return _ok({
        cap: m.status.to_dict() for cap, m in reg._managers.items()  # type: ignore[attr-defined]
    })


@runtime_router.get("/llama/{capability}/status")
def llama_capability_status(capability: str) -> Dict[str, Any]:
    _validate_capability(capability)
    return _ok(get_registry().get(capability).status.to_dict())


@runtime_router.post("/llama/{capability}/start")
async def llama_capability_start(capability: str, body: Dict[str, Any] = Body(default={})) -> Dict[str, Any]:
    _validate_capability(capability)
    model_id = body.get("model_id") if isinstance(body, dict) else None
    status = await get_registry().get(capability).start(model_id=model_id)
    return _ok(status.to_dict())


@runtime_router.post("/llama/{capability}/stop")
async def llama_capability_stop(capability: str) -> Dict[str, Any]:
    _validate_capability(capability)
    mgr = get_registry().get(capability)
    await mgr.stop()
    return _ok(mgr.status.to_dict())


@runtime_router.post("/llama/{capability}/restart")
async def llama_capability_restart(capability: str, body: Dict[str, Any] = Body(default={})) -> Dict[str, Any]:
    _validate_capability(capability)
    model_id = body.get("model_id") if isinstance(body, dict) else None
    status = await get_registry().get(capability).restart(model_id=model_id)
    return _ok(status.to_dict())


def _validate_capability(c: str) -> None:
    if c not in ("chat", "embedding", "rerank"):
        raise HTTPException(status_code=400, detail=f"unknown capability: {c}")
```

**关键:** 现有 `/runtime/llama/status` / `start` / `stop` / `restart` 都保留不动,语义 = chat 等价于 `/runtime/llama/chat/*`。

### 4.6 first_launch hook + lifespan shutdown

`first_launch.py` 现有的 chat preload 逻辑保留。再加 embedding / rerank 的 preload (按 settings.preload_embedding / preload_rerank 各自决定):

```python
# Plan 1 已有
if manager.settings.preload_on_startup:
    loop.create_task(manager.start())

# Plan 3B 新增
reg = get_registry()
if reg.get("chat").settings.preload_embedding:
    loop.create_task(reg.get("embedding").start())
if reg.get("chat").settings.preload_rerank:
    loop.create_task(reg.get("rerank").start())
```

`startup.py` lifespan shutdown 改成 `get_registry().stop_all()`:

```python
async def lifespan(app):
    ...
    yield
    try:
        await get_registry().stop_all()
    except Exception as e:
        logger.warning(...)
```

### 4.7 诊断 (Plan 3A 联动)

`runtime.llama.status` check 当前只看 chat。改成读 `get_registry().all_statuses()`,3 个 capability 各报一条 check:

```python
# Plan 3A check 数:10 → 12 (chat / embedding / rerank 三条 runtime.llama.<cap>.status)
```

(注:这是 Plan 3A 测试断言要更新的地方;Plan 3A 已经 ship 的 10 个 check 会临时变 12 个。会更新对应单测和 spec。)

### 4.8 install-bundled-models.py 扩展

manifest 加 GGUF embedding/rerank candidates:

```python
"embedding": {
    "hf_candidates": ["CompendiumLabs/bge-small-en-v1.5-gguf"],
    "ms_candidates": [],   # 国内镜像 fallback
    "url_fallbacks": ["..."],
    "size_estimate_mb": 60,
},
"rerank": {
    "hf_candidates": ["gpustack/bge-reranker-v2-m3-GGUF"],
    "ms_candidates": [],
    "size_estimate_mb": 200,
},
```

具体模型 ID 留 install 脚本侧决定,本 plan 只约定:bundled 模型必须是 GGUF 格式,文件名含 capability 关键字 (e.g., `bge-small-en-v1.5.Q4_K_M.gguf` 可被 local_index 识别为 `embedding`)。

---

## 5. 前端实现

### 5.1 API client

`packages/api/src/localRuntime.ts` 扩展:

```typescript
export type LocalRuntimeCapability = 'chat' | 'embedding' | 'rerank';

// 旧 API 不动(向后兼容,内部映射到 chat):
async function getStatus(): Promise<LocalRuntimeStatus> { ... }
async function start(): Promise<LocalRuntimeStatus> { ... }
// ...

// 新:capability-scoped
async function getStatusFor(cap: LocalRuntimeCapability): Promise<LocalRuntimeStatus> { ... }
async function startFor(cap: LocalRuntimeCapability, opts?): Promise<LocalRuntimeStatus> { ... }
// ...
async function getRegistry(): Promise<Record<LocalRuntimeCapability, LocalRuntimeStatus>> { ... }

export const localRuntime = {
  // 旧 (chat 别名)
  getStatus, start, stop, restart, getConfig, setConfig, getInstallInfo,
  // 新
  getStatusFor, startFor, stopFor, restartFor, getRegistry,
};
```

### 5.2 zustand store 扩展

```typescript
interface LocalRuntimeStoreState {
  // 旧字段 (chat)
  status: LocalRuntimeStatus | null;
  config: LocalRuntimeSettings | null;
  installInfo: ...;
  pending: ...;
  // ...

  // NEW: 三个 capability 的 status 字典
  statuses: Record<LocalRuntimeCapability, LocalRuntimeStatus | null>;
  pendingFor: Record<LocalRuntimeCapability, PendingState | null>;

  // 新 actions
  refreshRegistry(): Promise<void>;
  startCapability(cap: LocalRuntimeCapability): Promise<void>;
  stopCapability(cap: LocalRuntimeCapability): Promise<void>;
  restartCapability(cap: LocalRuntimeCapability): Promise<void>;
}
```

`status` (chat) 仍保留,作为 `statuses.chat` 的别名;Composer 等只关心 chat 的旧消费方不动。

### 5.3 LocalRuntimePanel 拓展

布局从「1 个 status section + config + install-info」改成「3 个 capability card + 共享 config form + install-info」:

```
┌─────────────────────────────────────────────────────────────┐
│ [chat ✓] http://127.0.0.1:62582  pid 1234  Qwen3-4B         │
│   [启动] [停止] [重启] [☐ 启动时预热]                       │
├─────────────────────────────────────────────────────────────┤
│ [embedding ✗] 已停止                                         │
│   [启动] [停止] [重启] [☐ 启动时预热]                       │
├─────────────────────────────────────────────────────────────┤
│ [rerank ⚠] 失败:模型未找到                                  │
│   [启动] [停止] [重启] [☐ 启动时预热]                       │
├─────────────────────────────────────────────────────────────┤
│ 共享配置                                                     │
│   Host  / Port (chat base) / API Key / LAN 开关             │
│   [保存]                                                     │
├─────────────────────────────────────────────────────────────┤
│ 装机路径 + [生成诊断报告]                                    │
└─────────────────────────────────────────────────────────────┘
```

抽出新组件 `LocalRuntimeCapabilityCard.tsx` 复用 3 次,内部用 `useLocalRuntimeStore` + `cap` prop 取自己那份状态。

### 5.4 Composer / CapabilityCenter 集成

- **Composer** (Plan 2 ModelMenuList) — 不动。Composer 是 chat 选择器,embedding/rerank 不出现在那里。
- **CapabilityCenter「文本嵌入」/「重排」tab** — 加「启动本地 runtime」按钮:点后调 `useLocalRuntimeStore().startCapability("embedding")`。runtime ready 后,本地模型出现在「我的模型」分组 (跟 chat 同机制)。

---

## 6. 跨平台

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| vendor 二进制 | Plan 1 已带 `llama-server.exe`,Plan 3B 不动 | 同 | 同 |
| Popen 参数 (per cap) | chat: `--ctx-size 8192`<br/>embedding: `--embedding --pooling cls`<br/>rerank: `--reranking` | 同 | 同 |
| 端口约定 | chat base+0/+1/+2 | 同 | 同 |
| RAM 占用 (默认配置) | chat preload ~3 GB,embed/rerank lazy (按需) | 同 | 同 |
| 关停信号 | terminate→5s wait→kill | 同 | 同 |
| 测试 | 后端单测 + 前端 typecheck;真机 Win MSI 手测 | runbook 留兜底 | 同 |

---

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| 一个 capability 的模型缺失 | 该 manager.start() → state=failed, 其它 capability 不受影响 |
| 端口冲突 (allocate 失败) | 同 Plan 1 (raise RuntimeError → state=failed) |
| llama-server 启动崩 (AVX2 缺失等) | 该 capability state=failed,stderr 写到 last_error;其它 capability 独立运行 |
| `/runtime/llama/{cap}/start` capability 非法 | 400 unknown capability |
| stop_all 中某个 stop 抛异常 | logger.warning 不阻塞其它 |
| settings.yaml 旧版无新字段 | 默认值 (preload_embed/rerank=False, default_*_model=""),不抛 |

---

## 8. 测试

### 8.1 后端

新增 / 修改测试 (大致):

- `test_local_runtime.py` 现有 16 个测试需要部分改动:
  - `LlamaRuntimeManager` 构造器加 `capability` 参数,现有 chat 默认值保证测试无回归
  - `get_manager()` 返 `get_registry().get("chat")` 后,`test_get_manager_singleton` 测试需要小调整
- 新增 `test_local_runtime_registry.py` (~5 case):registry 构造 / `get(cap)` / 端口偏移 / `all_statuses` / `stop_all` 容错
- 新增 `test_runtime_routes_llama_multi_cap.py` (~6 case):3 个 capability × {status, start, stop, restart} 路由 + `/registry` 聚合 + 非法 capability 400
- `test_diagnose_checks.py` 的 `test_check_runtime_llama_status_*` 改成 per-cap 三条

预计**后端单测累计:Plan 3A 49 + Plan 3B ~12 = ~61 个**。

### 8.2 前端

- `packages/api/src/__tests__/localRuntime.test.ts` 加 capability-scoped API case (`getStatusFor` / `startFor` / `getRegistry`),~3 新 case
- `packages/app/src/store/__tests__/localRuntime.test.ts` 加 `statuses[cap]` 缓存 / `startCapability` pending 隔离 case,~3 新 case
- LocalRuntimePanel 没 RTL,只过 typecheck (跟 Plan 2 一致)

预计**前端单测累计:Plan 3A 14 + Plan 3B ~6 = ~20 个**。

---

## 9. install-bundled-models 联动

`scripts/install-bundled-models.py` 当前 manifest 拉 HF 格式 (`iic/gte-multilingual-base`)。Plan 3B 实施时改成 GGUF candidates。manifest 内容不在本 spec 写死,留 plan 的具体任务里选(选模型不是 design 决策)。

`bundled_models/embedding/` 和 `bundled_models/rerank/` 目录已有 `.gitkeep`,落 GGUF 文件后 `local_index` 扫得到 `capability=embedding` / `rerank` (process_args.py 现有 mapping 已支持)。

---

## 10. 任务粒度预估 (供 Plan 3B 实施 plan 参考)

预估 **14-16 个 task**:

后端 (8 个):
1. `LlamaRuntimeManager.__init__` 加 `capability` + `port_offset` 参数,改 `_persist_status` per-cap key
2. `process_args.resolve_llamacpp_args` 加 capability 参数,新增 embedding/rerank 分支
3. `local_runtime.py` 新增 `_resolve_args_for(cap)` 派发 + 3 个 capability resolver
4. `LocalRuntimeRegistry` 单例 + `get_registry()` accessor + 4 个 unit test
5. `get_manager()` 改成 alias for `get_registry().get("chat")` + 现有 test 回归
6. `LocalRuntimeSettings` 加 4 个新字段 + yaml round-trip test
7. 新增 `/runtime/llama/{cap}/*` 5 个路由 + 路由集成测试
8. first_launch + lifespan shutdown 接 registry.stop_all

前端 (5 个):
9. `localRuntime.ts` 加 capability-scoped methods + 契约 test
10. zustand store 加 `statuses` / `pendingFor` / `startCapability` 等 + store test
11. `LocalRuntimeCapabilityCard.tsx` 抽组件
12. `LocalRuntimePanel.tsx` 改成 3 cards + 共享 config form
13. `CapabilityCenter` 加「启动本地 runtime」按钮 (text-embedding / rerank tab)

收尾 (2-3 个):
14. `install-bundled-models.py` manifest GGUF embedding/rerank candidates
15. Plan 3A 诊断 `runtime.llama.status` check 拆 per-cap + 测试更新
16. 总验证 (typecheck / 单测 / runbook 增加 multi-cap 场景)

---

## 11. 验收

跑通后用户能做:

1. ✅ Settings 页「本地模型」tab 显示 3 个 capability card,各自启停
2. ✅ chat 默认开机预热不变 (Plan 1+2 行为);embedding / rerank 用户手动开
3. ✅ `curl /runtime/llama/embedding/status` 拿到状态 (state=ready 时 endpoint=62583)
4. ✅ `curl http://127.0.0.1:62583/v1/embeddings -d '{"input":"hello"}'` 直接打通 OpenAI 兼容
5. ✅ rerank 类似 (port 62584,`/rerank` endpoint)
6. ✅ 退桌面 sidecar 时 lifespan shutdown 三个子进程都 kill (stop_all)
7. ✅ Plan 3A 诊断报告 check 12 个,包含 3 个 capability runtime 状态
8. ✅ 后端 ~61 单测全过 + 前端 ~20 单测全过 + 全仓 typecheck 0 error
