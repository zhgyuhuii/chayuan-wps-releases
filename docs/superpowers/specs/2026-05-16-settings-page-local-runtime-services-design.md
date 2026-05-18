# 设置页「本地模型服务」分组 — 设计文档

> 把 `LocalRuntimePanel` 的核心能力（5 个 capability 启停 + 状态可视化 + 诊断）下沉到桌面 `/settings` 主路径页面，让用户不必绕道弹窗式 `SettingsDialog → AI 平台 → 本地模型` 三级菜单。

**作者：** zhgyuhui
**日期：** 2026-05-16
**状态：** 待 user 审阅 → writing-plans

---

## 1. 背景

桌面单机版进入设置的主路径是 `头像下拉 → 设置`，路由到 `/settings` 渲染 `SettingsAsPage`。SettingsAsPage 有 6 个分组：基础 / 默认模型 / 知识中心 / 快捷工具 / 高级 / 关于。其中「高级」分组只放了 3 个 boolean 占位开关，没有真正的本地 runtime 管理。

`LocalRuntimePanel`（完整版，含配置表单、装机路径、诊断）仅挂在弹窗式 `SettingsDialog → AI 平台 → 本地模型` 三级菜单下。用户反馈：

- 桌面主设置页里看不到「本地模型服务」入口
- 找不到地方启动 / 停止 chat / embedding / rerank / asr / image-embedding 这五种本地能力

同时设置页的「基础」分组里有两行业务上已过时的内容：

- **后端服务**：单机版后端 baseURL 由 Tauri sidecar 注入到 `apiBaseOverride`，改了会断开
- **上传遥测**：当前桌面单机版未启用 telemetry pipeline，开关只是本地偏好持久化

## 2. 范围 (in / out)

**In scope：**

- 在 `SettingsAsPage` 中新增独立分组「本地模型服务」，放在 `<DefaultModelsSection />` 之前
- 新组件 `LocalRuntimeServicesSection`，展示 5 个 capability（chat/embedding/rerank/asr/image-embedding）的状态卡片，提供启动 / 停止 / 重启 / 模型切换 / 诊断
- 复用现有 store `useLocalRuntimeStore`（5 秒轮询）、组件 `LocalRuntimeStatusBadge` / `DiagnoseModal`、API client `localRuntime`
- 删除 `SettingsAsPage` 的「后端服务」Row 和「上传遥测」Row，连带清理仅服务这两行的局部 state 与 handler
- 新增 API 调用 `runtimeModels.list()`（如果不存在）拉 `/runtime/models`，按 capability 分组喂下拉
- 翻译文案：复用现有 i18n key，未覆盖的（capability 中文名）就近 inline

**Out of scope：**

- `LocalRuntimePanel`（含配置表单 / 装机路径 / 自检 hint）保持原样不动，仍挂在 `SettingsDialog → AI 平台 → 本地模型`，作为「高级版」入口
- `SettingsDialog` 完全不改
- 不新增独立路由 / 不动 Sidebar / 不动 UserMenuPopover
- 删除的 store 字段（`apiBaseOverride / telemetry`）保留，仅删 UI 行
- 不动 store `localRuntime`，复用现有 actions
- 不引入新依赖
- 不写 e2e 自动化（按照仓库现行做法，桌面 UX 改动靠真机手测）

## 3. 架构

### 3.1 文件改动

| 文件 | 操作 | 备注 |
|---|---|---|
| `packages/app/src/features/aiPlatform/LocalRuntimeServicesSection.tsx` | 新增 | 主组件 |
| `packages/app/src/features/aiPlatform/index.ts` | 改 | 导出新组件 |
| `packages/app/src/features/placeholders/SettingsAsPage.tsx` | 改 | 插入新 section + 删两行 |
| `packages/api/src/localRuntime.ts` | 改 | 若 `runtimeModels.list()` 不存在则补；已存在则无改动 |
| 单测 | 新增 | `LocalRuntimeServicesSection.test.tsx` 覆盖关键交互 |

### 3.2 组件树

```
SettingsAsPage
├─ Section (基础)
│   ├─ Row(主题)
│   ├─ Row(字号)
│   ├─ Row(语言)
│   └─ Row(名称)          ← 保留
│                          ← 删除: Row(后端服务)
│                          ← 删除: Row(上传遥测)
├─ LocalRuntimeServicesSection   ← 新增
│   ├─ 标题 + [刷新][诊断]
│   └─ CapabilityRow × 5
│       ├─ 状态徽标 (LocalRuntimeStatusBadge)
│       ├─ capability 中文名
│       ├─ 模型下拉 <select>
│       ├─ 操作按钮 [启动]/[停止]/[重启]/[重试]
│       └─ 详情行: endpoint · pid (或错误信息)
├─ DefaultModelsSection (含「模型库不完整」banner)
├─ Section (知识中心)
├─ Section (快捷工具)
├─ Section (高级 — 3 个占位开关)
└─ Section (关于)
```

### 3.3 数据流

```
mount
 ├─ useLocalRuntimeStore  → 已有 5s 轮询 statuses / config / installInfo
 ├─ useEffect: runtimeModels.list()  → models by capability
 └─ DiagnoseModal closed

interactions
 ├─ onChoose(cap, modelId)      → setChosen
 ├─ onStart(cap)                → startCapability(cap, { model_id: chosen[cap] })
 ├─ onStop(cap)                 → stopCapability(cap)
 ├─ onRestart(cap)              → restartCapability(cap, { model_id: chosen[cap] })
 ├─ onRefresh                   → store.refreshStatus() + refresh models
 └─ onOpenDiagnose              → setDiagnoseOpen(true)

errors
 ├─ start/stop/restart 失败     → store.lastError + toast
 │                                 卡片下方红字常驻 + [查看诊断] 链接
 ├─ runtimeModels 加载失败       → 下拉 placeholder "加载失败,点击重试"
 └─ reachable=false              → 整 section 替换为"本地 runtime 不可用"提示
                                   (沿用 LocalRuntimePanel 现有文案)
```

### 3.4 状态机映射

| `state` | 状态灯 | 操作按钮 | 详情行 |
|---|---|---|---|
| `stopped` | ⚫ 灰 | `[启动]` | "未启动" |
| `starting` | 🟡 黄 (spinner) | disabled + spinner | "启动中…" |
| `ready` | 🟢 绿 | `[重启] [停止]` | `:62582 · pid 1234` |
| `stopping` | 🟡 黄 (spinner) | disabled + spinner | "停止中…" |
| `error` | 🔴 红 | `[重试]` | `lastError` 文字 + `[查看诊断]` |

`pendingFor[cap] !== null` 时所有按钮 disabled，状态灯叠 spinner。

### 3.5 capability 中文名映射

inline 一个常量，不进 i18n（5 项硬编码，未来添加新 capability 时一起更新）：

```ts
const CAP_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '对话',
  embedding: '文本嵌入',
  rerank: '重排',
  asr: '语音识别',
  'image-embedding': '图像嵌入',
};
```

## 4. 接口

### 4.1 现有可复用

- `useLocalRuntimeStore` 的 `statuses / pendingFor / reachable / lastError / startCapability / stopCapability / restartCapability / refreshStatus / refreshRegistry`
- `LocalRuntimeStatusBadge`：根据 `state` 渲染状态色块
- `DiagnoseModal`：开/关由本组件管理
- `localRuntime.getStatus / getRegistry`：store 内部已用

### 4.2 新增 / 补齐

`runtimeModels.list()` —— 拉 `/runtime/models`，返回按 capability 索引的本地模型列表。若 `packages/api/src/localRuntime.ts` 已有则复用；没有就补：

```ts
export interface LocalRuntimeModelEntry {
  id: string;                              // model_id
  capability: LocalRuntimeCapability;
  size_bytes?: number;
  format?: string;                         // gguf / safetensors / onnx
  path?: string;
}

export const runtimeModels = {
  list(): Promise<LocalRuntimeModelEntry[]>;
};
```

后端 endpoint 已有：`GET /runtime/models`（runtime_routes.py:133）。

### 4.3 SettingsAsPage 删除的内容

- 第 234-265 行：`<Row title={t('settings.backend')}>` 整段
- 第 266-295 行：`<Row title="上传遥测">` 整段
- 关联 state：`apiInput / setApiInput`, `apiTesting / setApiTesting`, `apiTestResult / setApiTestResult`, `uploadTesting / setUploadTesting`, `uploadTestResult / setUploadTestResult`
- 关联 handler：`onApplyApi`, `onTestApi`, `onTestUpload`
- 关联 import：检查 `Loader2 / configureClient` 是否还有其它用法；只用于这两行则一并清掉

保留：`settings.apiBaseOverride / settings.telemetry / settings.setTelemetry` 等 store 字段。仅删 UI。

## 5. 视觉规范

沿用 SettingsAsPage 的现有视觉：

- 容器：`<Section>` 卡片（圆角 `var(--cy-radius-md)` + `var(--cy-border-default)`）
- 标题：小字段标题 `text-sm font-medium`，右侧 inline `[刷新][诊断]` 用 `<Button size="sm" variant="outline">`
- CapabilityRow：高度约 64px，分三段（左：状态灯+名称，中：模型下拉+endpoint，右：操作按钮）
- 状态色：复用 `LocalRuntimeStatusBadge` 的色板
- 模型下拉：`<select className="...">` 走 SettingsAsPage 已有的 select 样式
- 错误条：`bg-rose-50 / dark:bg-rose-950/30` + `text-rose-800 / dark:text-rose-200`，inline 一行

## 6. 错误处理

| 场景 | UX |
|---|---|
| 启动失败 | toast 一次性 + 卡片下方红字常驻 + `[查看诊断]` 链接 |
| 拉 `/runtime/models` 失败 | 下拉 placeholder "加载失败,点击重试"，点击触发再拉一次 |
| capability 没有可选模型 | 下拉 disabled + placeholder "未安装,前往模型广场下载" + 链接跳 `/marketplace` |
| `reachable=false` | 整 section 替换为「无法连接 sidecar」提示（沿用 LocalRuntimePanel 现有文案与样式） |
| `pendingFor[cap]` 未释放 | 按钮 disabled + spinner，超时 30s 自动 clearError |

## 7. 测试

新增 `packages/app/src/features/aiPlatform/__tests__/LocalRuntimeServicesSection.test.tsx`，覆盖：

1. mount 时调 store `refreshStatus` + `refreshRegistry`，调 `runtimeModels.list()` 一次
2. `state=stopped` 时显示 `[启动]`，点击调 `startCapability(cap, { model_id: chosen })`
3. `state=ready` 时显示 `[重启] [停止]`，点击 stop 调 `stopCapability(cap)`
4. `state=error` 时显示 `[重试]` + 错误条 + `[查看诊断]` 链接，点击诊断打开 `DiagnoseModal`
5. 模型下拉切换后再点 `[重启]`，`restartCapability` 收到新 `model_id`
6. `reachable=false` 时整 section 替换为「不可用」提示

不动现有测试。`LocalRuntimePanel` 旧测试保持通过。

## 8. 验收

- 桌面进 `/settings`，「模型库不完整」banner 上方出现「本地模型服务」分组，5 张 capability 行
- 启动 / 停止 / 重启操作按钮按状态正确切换，5 秒轮询自动刷新状态灯
- 切换模型下拉后启动，sidecar 启动时带新 `model_id`
- 启动失败有红字 + 查看诊断
- 「基础」分组里没有「后端服务」「上传遥测」两行
- `SettingsDialog → AI 平台 → 本地模型` 完整版仍可用（旧入口保留）
- `pnpm typecheck` 通过
- 新增的单测全部 PASS，原有测试不退化

## 9. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 删后端服务 Row 后多场景部署（非单机）无地方改 API base | 当前桌面默认单机版用 sidecar 注入；非单机部署仍可通过 `SettingsDialog` 走多 tab，且未来若要恢复可在「高级」section 补回 |
| `runtimeModels.list()` 拉到的 capability 跟 store `statuses` 索引不一致 | 用 capability 5 项硬白名单 `chat/embedding/rerank/asr/image-embedding` 兜底；模型列表按这 5 个 key 分组 |
| 5 秒轮询过快导致桌面端 CPU 占用 | 沿用 `LocalRuntimePanel` 已有节奏，不变化；如需调整另起 plan |
| 模型下拉切换后用户期望立即生效 | 切换 ≠ 自动重启，需用户主动点 `[重启]`；UI 用 hint `"切换后点重启生效"` 标注 |

## 10. 不做什么 (YAGNI)

- 不做 sidecar 自动启动（启动权交给用户主动点）
- 不做模型下载进度条（下载在「模型库不完整」banner 那行已经覆盖）
- 不做日志面板 / 实时输出（DiagnoseModal 已经能给关键诊断）
- 不做拖拽排序、批量启停、健康监控仪表盘（YAGNI；后续需要时另起 plan）
