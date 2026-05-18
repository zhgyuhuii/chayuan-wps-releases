# 本地 Runtime 诊断 (Plan 3A) 设计文档

**日期:** 2026-05-15
**作用域:** Plan 1+2 真机装机后的快速 E2E 诊断 + 用户报 bug 时贴日志的工具
**关联:** Plan 1 后端 (commits `f9ae8ce..a240516` + `aa3dc63` 清扫) + Plan 2 前端 (`d738df5..d1b4623`)

---

## 1. 目标

集成版 `chayuan-desktop` MSI 装机后:

1. 装机后双击一个脚本能立刻验证 Plan 1+2 端到端是否工作 (sidecar / vendor 二进制 / runtime / chat / 端口 / 路径权限);
2. 普通用户在「设置 → AI 平台 → 本地模型」页点一个按钮就能生成可粘贴的 markdown 诊断报告,贴到 GitHub issue / 客服群即可定位问题;
3. 单一真源 (single source of truth) — 后端跑检查,CLI + UI 都只是格式化输出。

**不包含 (留 Plan 3B+):**
- 多 runtime (embedding / rerank / ASR) 启停 — 是 Plan 3B 的事。
- CI 自动化 — 装机 + MSI 安装本身在 GitHub Actions 跑成本高,暂不做。
- 自动修复建议 — 只 *诊断*,不 *自愈*。

---

## 2. 架构

```
┌─────────────────────────────────────────────────────────────┐
│  chayuan-server                                              │
│    GET /runtime/diagnose                                     │
│      └─ runs 10 checks, returns DiagnoseReport JSON         │
│         (each check has name / ok / severity / detail)      │
└────────────────┬───────────────────┬────────────────────────┘
                 │                   │
        ┌────────▼──────┐    ┌───────▼────────┐
        │  CLI scripts  │    │ UI (React)     │
        │  (.ps1 + .sh) │    │ LocalRuntime   │
        │               │    │   Panel +      │
        │ +sidecar-down │    │  DiagnoseModal │
        │  fallbacks    │    │                │
        └───────────────┘    └────────────────┘
```

**关键设计选择:**

- 后端唯一执行检查 (单一真源,避免前后端实现 drift);
- CLI 只多一项:**sidecar 是否在跑** — 因为 sidecar 没在跑时 `/runtime/diagnose` 调不到,CLI 需 fallback;
- UI 只做格式化:生成 markdown + 复制按钮。

---

## 3. 后端 API

### 3.1 `GET /runtime/diagnose`

无 body,无 query。返回 `OkEnvelope<DiagnoseReport>`。

```typescript
interface DiagnoseReport {
  timestamp: string;          // ISO8601
  platform: 'win32' | 'darwin' | 'linux';
  python_version: string;     // 3.10.x
  chayuan_root: string;
  chayuan_server_version: string;  // from chayuan.settings.VERSION 或 git sha
  checks: DiagnoseCheck[];
  summary: { ok: number; warn: number; fail: number };
}

interface DiagnoseCheck {
  /** 稳定 id,机器可识别,例:vendor.llama-server.binary */
  name: string;
  /** 通过/失败的二值;warn 算 ok=true */
  ok: boolean;
  severity: 'ok' | 'warn' | 'fail';
  /** 给人读的一行描述 */
  detail: string;
  /** 出错时的额外结构化信息 (可选) */
  context?: Record<string, unknown>;
}
```

### 3.2 10 项检查清单

| # | name | 含义 | severity 规则 |
|---|---|---|---|
| 1 | `sidecar.healthz` | `GET /healthz` 自检 (基本上一定 ok,因为路由已经在跑;失败说明 healthz 路由本身坏了) | ok / fail |
| 2 | `vendor.llama-server.binary` | `find_llama_server_exe()` 返回非 None;读到 VERSION 文件 | ok=找到 / warn=没找到但开发模式 / fail=集成版应有却没有 |
| 3 | `vendor.bundled_models.chat` | `bundled_models/` 至少一个 `.gguf` (用 `local_index.by_capability('chat')`) | ok=≥1 / fail=0 |
| 4 | `chayuan_root.writable` | 尝试在 `chayuan_root/.diagnose-test` 写 + 删 | ok / fail |
| 5 | `runtime_json.writable` | `runtime.json` 父目录可写 | ok / fail |
| 6 | `local_runtime_yaml.readable` | `local_runtime.yaml` 存在则解析成功 (不存在不算 fail) | ok / warn |
| 7 | `port.62582` | 用 `psutil.net_connections()` 查 62582 owner;不存在 = ok | ok=空闲或被 chayuan-server 占 / warn=被其它进程占 |
| 8 | `chayuan_server.process` | 当前进程 pid / start time / RSS (基本上一定 ok,因为我们就在这进程里跑) | ok |
| 9 | `runtime.llama.status` | `LlamaRuntimeManager.status` 当前值;state=ready 给 ok,failed 给 fail,其它给 warn | ok / warn / fail |
| 10 | `disk.chayuan_root.free_gb` | `shutil.disk_usage(chayuan_root).free`,< 2 GB 算 warn,< 500 MB 算 fail | ok / warn / fail |

**实现位置:**

- 新文件 `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/checks.py` — 每个 check 一个函数 `def check_<name>() -> DiagnoseCheck:` ,纯函数,易单测;
- 新文件 `chayuan-server/libs/chayuan-server/chayuan/server/diagnose/__init__.py` — 聚合,导出 `run_all_checks() -> DiagnoseReport`;
- 新路由放到 `chayuan-server/libs/chayuan-server/chayuan/server/api_server/runtime_routes.py` 现有文件末尾 (`/runtime/diagnose` 跟 `/runtime/llama/*` 同一个 router)。

---

## 4. CLI 脚本

### 4.1 跨平台分发

| OS | 文件 | 形式 |
|---|---|---|
| Windows | `scripts/diagnose.ps1` (UTF-8 BOM) | 用户右键「使用 PowerShell 运行」/ 终端直接跑 |
| macOS / Linux | `scripts/diagnose.sh` | `chmod +x` 后 `./scripts/diagnose.sh` |

两个脚本逻辑等价,只差 OS-specific 调用 (Get-Process / pgrep, Invoke-RestMethod / curl, netstat -ano / lsof)。

### 4.2 流程

```
1. 探 sidecar 是否在跑:
   - Win: Get-Process chayuan-server -ErrorAction SilentlyContinue
   - Unix: pgrep -f chayuan-server
   - 找不到:输出「sidecar 没在跑,请先启动 Chayuan 桌面应用,或检查
              install 日志:%LOCALAPPDATA%\chayuan\logs\sidecar.log」
              并打印 vendor 二进制 + 装机目录的 fallback 检查后退出。

2. sidecar 在跑:
   - curl http://127.0.0.1:62581/runtime/diagnose
   - 解析 JSON
   - 按 summary 渲染 markdown 头:[v sidecar 跑通] [✓ 8 通过 ⚠ 1 警告 ✗ 0 失败]
   - 每个 check 一行:[ok/warn/fail 图标] name — detail
   - 末尾留 `chayuan-server 版本 / 时间 / 平台`

3. 输出:
   - stdout
   - 同时写 %TEMP%\chayuan-diagnose-<timestamp>.md (Win) 或 /tmp/chayuan-diagnose-<timestamp>.md (Unix)
   - 最后一行打印「日志已写到:<完整路径>」,方便用户上传
```

### 4.3 退出码

- 0 = 全部 ok
- 1 = 至少一个 fail
- 2 = sidecar 不可达 (调不到 /runtime/diagnose)

便于 CI / scripted 使用(虽然 Plan 3A scope 不含 CI)。

---

## 5. UI 按钮

### 5.1 位置 + 触发

`LocalRuntimePanel`(commit `b259c30`)状态区底部,跟「启动 / 停止 / 重启」按钮平行加第 4 个按钮:**「生成诊断报告」**。

### 5.2 行为

```
点击 → 调 GET /runtime/diagnose
     ↓
拿到 DiagnoseReport
     ↓
打开 Dialog:
  Title: "诊断报告"
  Body:  <pre>markdown 渲染</pre>  (相同 markdown 格式,跟 CLI 一致)
  Footer: [复制全部] [关闭]
     ↓
点「复制全部」→ navigator.clipboard.writeText(markdown) + toast「已复制,可贴到 GitHub issue」
```

### 5.3 失败处理

- 请求超时 (10s) / 网络错误 → Dialog 仍打开,Body 显示「无法连接 sidecar,
  请先尝试重启桌面应用;如果仍不行,在装机目录跑 `diagnose.{ps1,sh}` 留存日志后上报。」

### 5.4 新增前端文件

| 文件 | 责任 |
|---|---|
| `chayuan-client/packages/api/src/diagnose.ts` | 新建。`diagnose.run(): Promise<DiagnoseReport>` 客户端 + 类型 |
| `chayuan-client/packages/app/src/features/aiPlatform/DiagnoseModal.tsx` | 新建。Dialog 渲染 + 复制按钮 |

**修改:**
| 文件 | 改什么 |
|---|---|
| `chayuan-client/packages/api/src/index.ts` | export 新模块 |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx` | 加「生成诊断报告」按钮 + 挂 DiagnoseModal |

---

## 6. Markdown 报告格式

为了 CLI 和 UI 输出 100% 一致,后端额外提供一个格式化函数。但 UI 是 React,CLI 是 shell — 直接共享 Python 渲染函数不优雅。

**决定:** 后端 `/runtime/diagnose` 只返 JSON;markdown 渲染由 CLI 和 UI **各自**实现 (~20 行模板代码,drift 风险低)。如果格式后来要统一,加一个 `?format=md` query 让后端可选返 markdown 字符串。

样例 markdown:

```markdown
# Chayuan 本地 Runtime 诊断报告

- 时间: 2026-05-15 14:32:10
- 平台: win32
- Python: 3.11.5
- chayuan-server: v3.0.1
- chayuan_root: C:\Users\Alice\AppData\Roaming\chayuan

## 结果: 8 ✓ / 1 ⚠ / 0 ✗

| 检查项 | 状态 | 说明 |
|---|---|---|
| sidecar.healthz | ✓ | 200 OK |
| vendor.llama-server.binary | ✓ | C:\...\llama-server.exe (b4404, 18.5 MB) |
| vendor.bundled_models.chat | ✓ | 1 个 .gguf 模型 |
| chayuan_root.writable | ✓ | 可写 |
| runtime_json.writable | ✓ | 可写 |
| local_runtime_yaml.readable | ✓ | 解析成功 |
| port.62582 | ⚠ | 被 PID 1234 (chrome.exe) 占用 |
| chayuan_server.process | ✓ | PID 5678, RSS 234.5 MB, started 2026-05-15 14:00 |
| runtime.llama.status | ✓ | state=ready, endpoint=http://127.0.0.1:62583, model=qwen3-4b |
| disk.chayuan_root.free_gb | ✓ | 86.4 GB 可用 |
```

---

## 7. 错误处理

| 场景 | 行为 |
|---|---|
| sidecar 未跑 (CLI) | 退出码 2,提示用户检查桌面 app |
| sidecar 未跑 (UI) | UI 用户本身就在 app 内,几乎不可能;但接口超时 → Dialog 显友好错误 |
| 某个 check 抛异常 | 不阻塞其它 check;该项 severity=fail,detail 写「检查抛异常: <异常类型>」 |
| `/runtime/diagnose` 整个 endpoint 抛异常 | FastAPI 自然返 500;CLI / UI 各自渲染「检查接口异常」 |
| chayuan_root 不存在 | check 4/5 自然 fail,不阻塞 |
| psutil 调用失败 (权限不足) | check 7/8/9 fail,detail 写「psutil 调用失败」 |

---

## 8. 测试

### 8.1 后端单测

`tests/unit_tests/test_diagnose.py`:
- 每个 check 函数单独可调,mock 文件系统 / psutil / port 占用三类外部依赖
- `run_all_checks()` 聚合:验证 summary 计数正确 / 一个 check 抛异常不影响其它 check
- 路由层测试 (TestClient):验证 `/runtime/diagnose` 返回正确 envelope + 包含 10 项 check

预期单测数:**~12-15 个 case**,跟 Plan 1 后端测试在同一文件夹下。

### 8.2 前端单测

`packages/api/src/__tests__/diagnose.test.ts`:
- `diagnose.run()` 命中 GET / 解包 envelope (跟 localRuntime 测试同模板)
- 2-3 case 足够

UI 端 DiagnoseModal 没 RTL,只过 typecheck。

### 8.3 手测 (不在本 Plan)

CLI 脚本 / UI 按钮的真实行为需要在 Windows / Mac 装机后跑,本 Plan 不强制覆盖。Plan 完成后留个手测 checklist 让用户在装机时验证。

---

## 9. 跨平台落地

| 维度 | Win | Mac | Linux |
|---|---|---|---|
| `vendor.llama-server.binary` check | 找 `llama-server.exe` | 找 `llama-server` (Contents/Resources/ 路径) | 找 `llama-server` (resources/ 小写) |
| `port.62582` check | `psutil.net_connections()` (跨平台,Win 需 admin 才能看其它进程名 — 退化为「被占,owner 未知」) | psutil 直接读 lsof | psutil 直接读 /proc |
| `chayuan_server.process` 进程信息 | `psutil.Process()` 跨平台 | 同 | 同 |
| `disk.free_gb` check | `shutil.disk_usage` 跨平台 | 同 | 同 |
| CLI 编码 | UTF-8 BOM | UTF-8 无 BOM | UTF-8 无 BOM |

---

## 10. 任务拆分粒度 (供 Plan 3A 实施 plan 参考)

预估 8-10 个 task:

1. 新建 `chayuan-server/.../diagnose/checks.py`,先写 1 个 check (sidecar.healthz) + 单测
2. 加其它 9 个 check (1 task 拆 3-4 个 check)
3. `run_all_checks()` 聚合 + 单测
4. 加 `GET /runtime/diagnose` 路由 + 路由测试
5. 客户端 `packages/api/src/diagnose.ts` + 契约单测
6. UI: DiagnoseModal 组件 + 接 LocalRuntimePanel 按钮
7. CLI: `scripts/diagnose.ps1` (Win,UTF-8 BOM)
8. CLI: `scripts/diagnose.sh` (Mac/Linux)
9. 跨平台 sanity + 手测 checklist runbook

---

## 11. 不在本 Plan 的事

- **CI 自动跑** — 装机 + 跑 E2E 在 GitHub Actions 上重得不实际,留 Plan 3D 或永不做。
- **自动修复** — 比如「端口被占」是否自动 bump,「磁盘不足」是否清理 — 都不在 Plan 3A,这是 *诊断* 不是 *自愈*。
- **多 runtime 检查** — embedding / rerank / ASR 是 Plan 3B 范畴。
- **遥测上报** — 自动把 diagnose 报告发回服务器,这关系到隐私,需要单独决策,不做。

---

## 12. 验收标准

跑通后用户能做:

1. ✅ 装机后在终端 `.\scripts\diagnose.ps1` (Win) / `./scripts/diagnose.sh` (Mac/Linux) 拿到 ✓✓✗ 报告
2. ✅ 报告文件落到 `%TEMP%` / `/tmp`,路径打印在末尾
3. ✅ 桌面 app 打开「设置 → AI 平台 → 本地模型」点「生成诊断报告」弹 Dialog
4. ✅ 「复制全部」一键复制 markdown
5. ✅ 后端 12+ 个单测全过 (10 个 check + 路由 + 聚合容错)
6. ✅ 前端 typecheck 全过 + 3 个 API 契约测试过
