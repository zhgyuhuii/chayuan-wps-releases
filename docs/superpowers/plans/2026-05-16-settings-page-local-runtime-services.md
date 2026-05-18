# 设置页「本地模型服务」分组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `SettingsAsPage` 中新增「本地模型服务」分组(5 个 capability 卡片 + 模型下拉 + 启动/停止/重启/诊断),同时移除原有「后端服务」「上传遥测」两行。

**Architecture:** 复用现有 `useLocalRuntimeStore`(5s 轮询) / `LocalRuntimeStatusBadge` / `DiagnoseModal` / `runtimeModels.list({ capability? })`。新增 1 个 React 组件 `LocalRuntimeServicesSection`,扩 2 个 store actions(`startCapability`/`restartCapability`)接 `model_id`。

**Tech Stack:** TypeScript / React 19 / Zustand 5 / Tailwind CSS / lucide-react / vitest(node env) / pnpm workspace。

**Spec:** `docs/superpowers/specs/2026-05-16-settings-page-local-runtime-services-design.md` (commit bc7d5e5)

**约束:**
- 桌面单机版 vitest 用 node env,无法跑 React 渲染测试。组件测试改为 typecheck + 手测验收。
- 所有 TDD 步骤仅覆盖 store(纯逻辑)。
- 工作分支 `main`(CLAUDE.md 固定分支约束)。
- 不动 `LocalRuntimePanel.tsx` / `SettingsDialog.tsx`(spec out-of-scope)。

**spec 错别字更正(实现时按现有代码为准):**
- 状态机字段值是 `failed`(不是 `error`),见 `LocalRuntimeStatusBadge.tsx`。
- capability 中文名沿用 `LocalRuntimeCapabilityCard.tsx` 现有的 `'聊天'`(不是 spec 里的"对话"),保持一处真源。
- spec 4.2 说要新增 `runtimeModels.list()`,**已废弃**:`chayuan-client/packages/api/src/runtime.ts:147` 已存在 `runtimeModels.list({ capability? })` 返回 `{ total, items: LocalModelEntry[] }`,后端响应包就是这个 schema(`runtime_routes.py:141-146` 返回 `{data: {total, items}}`)。直接复用,不要新建 API。
- spec 4.2 的 `LocalRuntimeModelEntry` 类型废弃,复用 `runtime.ts:74` 的 `LocalModelEntry`,关键字段:`model_id / capability / size_bytes / format / path`(注意是 `model_id` 不是 `id`)。

---

## 文件结构

| 文件 | 操作 | 责任 |
|---|---|---|
| `chayuan-client/packages/app/src/store/localRuntime.ts` | 改 | `startCapability/restartCapability` 接 `opts?: { model_id?: string }` |
| `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts` | 新增 | TDD store 把 `model_id` 透传给 API client |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeServicesSection.tsx` | 新增 | 主组件,复用 `@chayuan/api` 已有 `runtimeModels.list` |
| `chayuan-client/packages/app/src/features/aiPlatform/index.ts` | 改 | 导出 `LocalRuntimeServicesSection` |
| `chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx` | 改 | 插入新 section + 删两行 + 清理 state/handler |

---

## Task 1: 扩展 store `startCapability` / `restartCapability` 接 `model_id`

> 原 plan 的"Task 1: 新增 runtimeModels.list() API"已删除 —— `runtime.ts:147` 已有 `runtimeModels.list({ capability? })` 完全够用,后端响应也匹配 `{total, items: LocalModelEntry[]}`,无需重复造轮子。剩余 task 顺移成 1-4。

**Files:**
- Modify: `chayuan-client/packages/app/src/store/localRuntime.ts`
- Test: `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts` (新文件)

### Step 1.1: 写失败的 store 测试

- [ ] 创建 `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts`,内容:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// mock API 模块,捕获 startFor / restartFor 调用参数
const startFor = vi.fn();
const restartFor = vi.fn();
const stopFor = vi.fn();
const getRegistry = vi.fn();

vi.mock('@chayuan/api', () => ({
  localRuntime: {
    getStatus: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    getInstallInfo: vi.fn(),
    getStatusFor: vi.fn(),
    startFor,
    stopFor,
    restartFor,
    getRegistry,
  },
}));

const READY = {
  state: 'ready' as const,
  endpoint: 'http://127.0.0.1:62582',
  pid: 1234,
  model_id: 'qwen3-4b',
};

beforeEach(() => {
  startFor.mockReset().mockResolvedValue(READY);
  restartFor.mockReset().mockResolvedValue(READY);
  stopFor.mockReset().mockResolvedValue({ state: 'stopped' });
  getRegistry.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.resetModules();
});

describe('useLocalRuntimeStore startCapability with model_id', () => {
  it('startCapability("chat", { model_id }) 透传给 localRuntime.startFor', async () => {
    const { useLocalRuntimeStore } = await import('../localRuntime');
    await useLocalRuntimeStore.getState().startCapability('chat', { model_id: 'qwen3-4b' });
    expect(startFor).toHaveBeenCalledWith('chat', { model_id: 'qwen3-4b' });
  });

  it('startCapability 不带 opts 时 startFor 收到 undefined', async () => {
    const { useLocalRuntimeStore } = await import('../localRuntime');
    await useLocalRuntimeStore.getState().startCapability('embedding');
    expect(startFor).toHaveBeenCalledWith('embedding', undefined);
  });

  it('restartCapability("rerank", { model_id }) 透传给 localRuntime.restartFor', async () => {
    const { useLocalRuntimeStore } = await import('../localRuntime');
    await useLocalRuntimeStore
      .getState()
      .restartCapability('rerank', { model_id: 'bge-rerank-q8' });
    expect(restartFor).toHaveBeenCalledWith('rerank', { model_id: 'bge-rerank-q8' });
  });
});
```

### Step 1.2: 运行测试看失败

- [ ] Run: `pnpm test --run packages/app/src/store/__tests__/localRuntime.test.ts`

  Expected: FAIL。报错类似 `expected startFor("chat", { model_id: 'qwen3-4b' }), got startFor("chat")`,因为当前 store 调 `startFor(cap)` 没传 opts。

### Step 1.3: 改 store 接口与实现

- [ ] 修改 `chayuan-client/packages/app/src/store/localRuntime.ts`。先改 interface(约第 53-55 行):

```ts
  startCapability(cap: LocalRuntimeCapability, opts?: { model_id?: string }): Promise<void>;
  stopCapability(cap: LocalRuntimeCapability): Promise<void>;
  restartCapability(cap: LocalRuntimeCapability, opts?: { model_id?: string }): Promise<void>;
```

- [ ] 改实现 `startCapability` 函数(约第 152 行),把 `cap` 后加上 `opts`,并把 `opts` 透传给 `startFor`:

```ts
  async startCapability(cap, opts) {
    if (get().pendingFor[cap]) return;
    set((s) => ({
      pendingFor: { ...s.pendingFor, [cap]: 'start' },
      lastError: null,
    }));
    try {
      const status = await localRuntime.startFor(cap, opts);
      set((s) => ({
        statuses: { ...s.statuses, [cap]: status },
        pendingFor: { ...s.pendingFor, [cap]: null },
      }));
    } catch (e) {
      set((s) => ({
        pendingFor: { ...s.pendingFor, [cap]: null },
        lastError: describeError(e),
      }));
    }
  },
```

- [ ] 改 `restartCapability`(约第 192 行)同样:

```ts
  async restartCapability(cap, opts) {
    if (get().pendingFor[cap]) return;
    set((s) => ({
      pendingFor: { ...s.pendingFor, [cap]: 'restart' },
      lastError: null,
    }));
    try {
      const status = await localRuntime.restartFor(cap, opts);
      set((s) => ({
        statuses: { ...s.statuses, [cap]: status },
        pendingFor: { ...s.pendingFor, [cap]: null },
      }));
    } catch (e) {
      set((s) => ({
        pendingFor: { ...s.pendingFor, [cap]: null },
        lastError: describeError(e),
      }));
    }
  },
```

(`stopCapability` 不动,stop 不需要 model_id。)

### Step 1.4: 运行测试看通过

- [ ] Run: `pnpm test --run packages/app/src/store/__tests__/localRuntime.test.ts`

  Expected: 3 个测试全部 PASS。

### Step 1.5: 运行 typecheck 确认所有 startCapability/restartCapability 调用兼容

- [ ] Run: `pnpm --filter @chayuan/app typecheck`

  Expected: exit 0。`opts` 是可选参数,所有现有 0-arg 调用(如 `LocalRuntimePanel.tsx`)继续编译通过。

### Step 1.6: Commit

- [ ] Run:

```bash
git add chayuan-client/packages/app/src/store/localRuntime.ts \
        chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts
git commit -m "$(cat <<'EOF'
feat(store): startCapability/restartCapability 可选 model_id

扩接口让调用方在启动 / 重启时指定具体本地模型,透传给
localRuntime.startFor(cap, { model_id }) — 后端已支持。
LocalRuntimePanel 现有 0-arg 调用继续兼容(opts 可选)。

为设置页"本地模型服务"卡片模型下拉准备。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 新增 `LocalRuntimeServicesSection` 组件

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeServicesSection.tsx`

### Step 2.1: 创建组件文件

- [ ] 新建 `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeServicesSection.tsx`,完整内容:

```tsx
/**
 * 设置页 `/settings` 中的「本地模型服务」分组。
 *
 * 5 个 capability(chat / embedding / rerank / asr / image-embedding)各一行:
 *   - 状态徽标 (LocalRuntimeStatusBadge)
 *   - 中文名(沿用 LocalRuntimeCapabilityCard 的 CAPABILITY_LABEL)
 *   - 当前 endpoint · pid 或 lastError
 *   - 模型下拉(从 GET /runtime/models 按 capability 分组)
 *   - 启动 / 停止 / 重启 按钮(按 state 切换)
 *
 * 顶部右侧:
 *   - 「刷新」按钮:手动触发 status + models 重拉
 *   - 「诊断」按钮:打开 DiagnoseModal
 *
 * 注:LocalRuntimePanel 完整版(配置表单 / 装机路径)保持原位,
 * 此分组只暴露"启停 + 选模型 + 诊断"三个高频动作。
 */
import * as React from 'react';
import { ClipboardList, Play, RefreshCw, RotateCw, Square } from 'lucide-react';
import {
  type LocalModelEntry,
  type LocalRuntimeCapability,
  runtimeModels,
} from '@chayuan/api';
import { Button } from '@chayuan/ui';
import { useLocalRuntimeStore } from '../../store/localRuntime';
import { reportError } from '../../store/errorDialog';
import { DiagnoseModal } from './DiagnoseModal';
import { LocalRuntimeStatusBadge } from './LocalRuntimeStatusBadge';

const CAPABILITIES: LocalRuntimeCapability[] = [
  'chat',
  'embedding',
  'rerank',
  'asr',
  'image-embedding',
];

/** 与 LocalRuntimeCapabilityCard.tsx 保持同一处真源(后续两边一起改)。 */
const CAP_LABEL: Record<LocalRuntimeCapability, string> = {
  chat: '聊天',
  embedding: '文本嵌入',
  rerank: '重排',
  asr: '语音识别',
  'image-embedding': '图像嵌入',
};

export const LocalRuntimeServicesSection: React.FC = () => {
  const { statuses, pendingFor, reachable, startCapability, stopCapability, restartCapability } =
    useLocalRuntimeStore();

  const [models, setModels] = React.useState<Record<LocalRuntimeCapability, LocalModelEntry[]>>({
    chat: [],
    embedding: [],
    rerank: [],
    asr: [],
    'image-embedding': [],
  });
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [modelsError, setModelsError] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<Partial<Record<LocalRuntimeCapability, string>>>({});
  const [diagnoseOpen, setDiagnoseOpen] = React.useState(false);

  const reloadModels = React.useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      // runtime.ts 的 runtimeModels.list 返回 { total, items } envelope
      const { items } = await runtimeModels.list();
      const grouped: Record<LocalRuntimeCapability, LocalModelEntry[]> = {
        chat: [], embedding: [], rerank: [], asr: [], 'image-embedding': [],
      };
      for (const m of items) {
        // runtime.ts LocalModelEntry.capability 是 string,需 narrow 到 LocalRuntimeCapability
        const cap = m.capability as LocalRuntimeCapability;
        if (grouped[cap]) grouped[cap].push(m);
      }
      setModels(grouped);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
    } finally {
      setModelsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reloadModels();
  }, [reloadModels]);

  const onRefresh = () => {
    void useLocalRuntimeStore.getState().refreshStatus();
    void useLocalRuntimeStore.getState().refreshRegistry();
    void reloadModels();
  };

  if (!reachable) {
    return (
      <section className="rounded-md border border-rose-500/30 bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        无法连接 sidecar (
        <code className="rounded bg-rose-100 px-1 dark:bg-rose-900/40">/runtime/llama/*</code>)。
        本地模型服务仅在集成版桌面应用中可用。
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[var(--cy-border-default)] bg-[var(--cy-surface-base)] p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--cy-text-primary)]">本地模型服务</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={modelsLoading}>
            <RefreshCw className={'mr-1 h-3.5 w-3.5' + (modelsLoading ? ' animate-spin' : '')} />
            刷新
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDiagnoseOpen(true)}>
            <ClipboardList className="mr-1 h-3.5 w-3.5" />
            诊断
          </Button>
        </div>
      </header>

      {modelsError && (
        <div className="rounded-sm border border-amber-400/40 bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          模型清单加载失败:{modelsError} · 
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => void reloadModels()}
          >
            重试
          </button>
        </div>
      )}

      <div className="space-y-2">
        {CAPABILITIES.map((cap) => (
          <CapabilityRow
            key={cap}
            capability={cap}
            label={CAP_LABEL[cap]}
            status={statuses[cap]}
            pending={pendingFor[cap]}
            models={models[cap]}
            chosen={chosen[cap]}
            onChoose={(id) => setChosen((s) => ({ ...s, [cap]: id }))}
            onStart={() => {
              const modelId = chosen[cap];
              void startCapability(cap, modelId ? { model_id: modelId } : undefined).catch((e) =>
                reportError(e, `启动 ${CAP_LABEL[cap]} 失败`),
              );
            }}
            onStop={() => {
              void stopCapability(cap).catch((e) =>
                reportError(e, `停止 ${CAP_LABEL[cap]} 失败`),
              );
            }}
            onRestart={() => {
              const modelId = chosen[cap];
              void restartCapability(cap, modelId ? { model_id: modelId } : undefined).catch((e) =>
                reportError(e, `重启 ${CAP_LABEL[cap]} 失败`),
              );
            }}
            onOpenDiagnose={() => setDiagnoseOpen(true)}
          />
        ))}
      </div>

      <DiagnoseModal open={diagnoseOpen} onOpenChange={setDiagnoseOpen} />
    </section>
  );
};

interface CapabilityRowProps {
  capability: LocalRuntimeCapability;
  label: string;
  status: import('@chayuan/api').LocalRuntimeStatus | null;
  pending: 'start' | 'stop' | 'restart' | null;
  models: LocalModelEntry[];
  chosen?: string;
  onChoose(id: string): void;
  onStart(): void;
  onStop(): void;
  onRestart(): void;
  onOpenDiagnose(): void;
}

const CapabilityRow: React.FC<CapabilityRowProps> = ({
  label,
  status,
  pending,
  models,
  chosen,
  onChoose,
  onStart,
  onStop,
  onRestart,
  onOpenDiagnose,
}) => {
  const state = status?.state ?? 'stopped';
  const isPending = pending !== null;
  const isReady = state === 'ready';
  const isFailed = state === 'failed';
  const noModels = models.length === 0;

  // 下拉默认值优先级:用户选过的 > status.model_id > 第一个可选
  const selectedId = chosen ?? status?.model_id ?? models[0]?.model_id ?? '';

  return (
    <div className="rounded-md border border-[var(--cy-border-subtle)] p-3 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <LocalRuntimeStatusBadge status={status} />
        <span className="text-sm font-medium text-[var(--cy-text-primary)]">{label}</span>
        {isReady && status?.endpoint && (
          <code className="text-xs text-[var(--cy-text-secondary)]">{status.endpoint}</code>
        )}
        {isReady && status?.pid != null && (
          <span className="text-xs text-[var(--cy-text-tertiary)]">pid {status.pid}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--cy-text-tertiary)]">模型</label>
        <select
          value={selectedId}
          onChange={(e) => onChoose(e.target.value)}
          disabled={noModels || isPending}
          className="rounded-md border border-[var(--cy-border-default)] bg-[var(--cy-surface-base)] px-2 py-1 text-xs"
        >
          {noModels ? (
            <option value="">未安装,前往「模型广场」下载</option>
          ) : (
            models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.model_id}
                {m.size_bytes ? ` (${prettyMB(m.size_bytes)})` : ''}
              </option>
            ))
          )}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          {!isReady && (
            <Button
              size="sm"
              onClick={onStart}
              disabled={isPending || noModels || state === 'starting'}
            >
              <Play
                className={'mr-1 h-3.5 w-3.5' + (pending === 'start' ? ' animate-pulse' : '')}
              />
              {isFailed ? '重试' : '启动'}
            </Button>
          )}
          {isReady && (
            <>
              <Button size="sm" variant="outline" onClick={onRestart} disabled={isPending}>
                <RotateCw
                  className={'mr-1 h-3.5 w-3.5' + (pending === 'restart' ? ' animate-spin' : '')}
                />
                重启
              </Button>
              <Button size="sm" variant="outline" onClick={onStop} disabled={isPending}>
                <Square className="mr-1 h-3.5 w-3.5" />
                停止
              </Button>
            </>
          )}
        </div>
      </div>

      {isFailed && status?.last_error && (
        <div className="rounded-sm border border-rose-500/30 bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200 whitespace-pre-wrap break-all">
          {status.last_error}
          <button
            type="button"
            className="ml-2 underline"
            onClick={onOpenDiagnose}
          >
            查看诊断
          </button>
        </div>
      )}
    </div>
  );
};

function prettyMB(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
```

### Step 2.2: 跑 typecheck 确认类型与 import 都对

- [ ] Run: `pnpm --filter @chayuan/app typecheck`

  Expected: exit 0。如果 `runtimeModels` / `LocalRuntimeModelEntry` 没找到,检查 Task 1 是否提交;如果 `@chayuan/api` re-export 缺漏,继续 Step 3.3 修。

### Step 2.3: 验证 `@chayuan/api` re-export(应该已经 OK)

- [ ] Run: `grep -n "from './runtime'" chayuan-client/packages/api/src/index.ts`

  Expected: 命中 `export * from './runtime';` —— `runtimeModels` 与 `LocalModelEntry` 都通过它暴露。无需改动。

- [ ] 跑 typecheck 二次确认 import 解析正确:

  Run: `pnpm --filter @chayuan/api typecheck && pnpm --filter @chayuan/app typecheck`

  Expected: 两个都 exit 0。组件文件里 `import { LocalModelEntry, runtimeModels } from '@chayuan/api'` 能解析。

### Step 2.4: 不挂载也运行 typecheck(确保孤儿组件至少自身能编)

- [ ] Run: `pnpm --filter @chayuan/app typecheck`

  Expected: exit 0。组件文件本身存在 + 无引用,不会触发类型错误。

### Step 2.5: Commit

- [ ] Run:

```bash
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeServicesSection.tsx
git commit -m "$(cat <<'EOF'
feat(aiPlatform): 新增 LocalRuntimeServicesSection 组件

桌面 /settings 主路径下的「本地模型服务」分组,5 个 capability 卡片
(chat/embedding/rerank/asr/image-embedding)。每张:状态徽标 + 中文名
+ endpoint/pid + 模型下拉 + 启动/停止/重启按钮 + 失败时错误条 +
查看诊断链接。顶部刷新 + 诊断入口。

LocalRuntimePanel 完整版(含配置表单 / 装机路径)保持原样作为高级入口。

尚未接到 SettingsAsPage(下个 commit)。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 在 `SettingsAsPage` 中挂载新组件

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/index.ts`
- Modify: `chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx`

### Step 3.1: 导出新组件

- [ ] 修改 `chayuan-client/packages/app/src/features/aiPlatform/index.ts`,在文件末尾(最后一行 export 后)追加:

```ts
export { LocalRuntimeServicesSection } from './LocalRuntimeServicesSection';
```

### Step 3.2: SettingsAsPage 引入并挂载

- [ ] 修改 `chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx`,在第 45 行附近(其它 `from '../...'` 的 import 群)追加 import:

```ts
import { LocalRuntimeServicesSection } from '../aiPlatform';
```

- [ ] 找到 `<DefaultModelsSection />` 的渲染位置(约第 299 行),在其**之前**插入:

```tsx
      {/* 本地模型服务(spec: 2026-05-16) */}
      <LocalRuntimeServicesSection />

      {/* 默认模型 — 模型广场配好厂商后,这里挑哪一个用做默认 */}
      <DefaultModelsSection />
```

### Step 3.3: typecheck

- [ ] Run: `pnpm --filter @chayuan/app typecheck`

  Expected: exit 0。

### Step 3.4: Commit

- [ ] Run:

```bash
git add chayuan-client/packages/app/src/features/aiPlatform/index.ts \
        chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx
git commit -m "$(cat <<'EOF'
feat(settings): 把"本地模型服务"分组挂到 /settings 页面

放在 <DefaultModelsSection /> 之前,即"模型库不完整" warning banner
上方,符合 spec 视觉位置。同步从 features/aiPlatform/index.ts re-export
LocalRuntimeServicesSection。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 移除 SettingsAsPage 的「后端服务」和「上传遥测」两行

**Files:**
- Modify: `chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx`

### Step 4.1: 删 「后端服务」 Row

- [ ] 在 `chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx` 中,找到第 234-265 行(`<Row title={t('settings.backend')}>...</Row>` 整段),整段**删除**。

  删除标记参考:
  - 开始行:`<Row title={t('settings.backend')} description={t('settings.backendUrlDesc')}>`
  - 结束行:闭合的 `</Row>`,后跟下一个 `<Row title="上传遥测"`

### Step 4.2: 删 「上传遥测」 Row

- [ ] 接着第 266-295 行(`<Row title="上传遥测">...</Row>` 整段),整段**删除**。

  删除标记参考:
  - 开始行:`<Row title="上传遥测"`
  - 结束行:闭合的 `</Row>`,后跟 `</Section>`(基础分组结束)

### Step 4.3: 清理无人使用的 state 与 handler

- [ ] 在 `SettingsAsPage` 顶部的 state 声明区(约第 53-66 行)删除以下行(逐行核对存在再删):

```ts
  const [apiInput, setApiInput] = React.useState(settings.apiBaseOverride);
  const [apiTesting, setApiTesting] = React.useState(false);
  const [apiTestResult, setApiTestResult] = React.useState<null | { ok: boolean; msg: string }>(
    null,
  );
  const [uploadTesting, setUploadTesting] = React.useState(false);
  const [uploadTestResult, setUploadTestResult] = React.useState<null | {
    ok: boolean;
    msg: string;
  }>(null);
```

- [ ] 删除 handler 函数(约第 79-145 行,扫描整文件找 `onApplyApi` / `onTestApi` / `onTestUpload` 三个 const 函数定义,逐个删除整段):

  - `const onApplyApi = () => { ... }`
  - `const onTestApi = async () => { ... }`
  - `const onTestUpload = async () => { ... }`

### Step 4.4: 清理无人使用的 imports

- [ ] Run: `pnpm --filter @chayuan/app typecheck`

  Expected: 可能报"unused import"warning 或 strict 模式下 error。处理方法:

  - `Loader2` — 如其它行还在用(如 `DefaultModelsSection` 内部下载进度),保留;否则删
  - `configureClient` — `onApplyApi` 删后无人用,从 import 行删
  - `notifySuccess` — 是否还有其它调用?Run: `grep -n 'notifySuccess' chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx`。若仅在已删 handler 内出现,从 import 删

  按需修 import,直到 typecheck exit 0。

### Step 4.5: 启动 dev server 手测

> 这一步**不可自动化**,subagent / executor 把命令打出来,由人去操作并报告结果。

- [ ] Run: `pnpm --filter @chayuan/web dev`(或在 Tauri desktop 项目根 `npm run dev:desktop`)

- [ ] 浏览器/Tauri 窗口访问 `/settings`,逐项核对:

  | 验收点 | 期望 |
  |---|---|
  | 「基础」分组里没有「后端服务」「上传遥测」两行 | ✓ |
  | 「模型库不完整」warning banner 上方出现「本地模型服务」分组 | ✓ |
  | 5 个 capability 卡片显示中文名(聊天/文本嵌入/重排/语音识别/图像嵌入) | ✓ |
  | 状态徽标渲染正常(灰/绿/黄/红其一) | ✓ |
  | 顶部「刷新」点击后 status / models 重拉 | ✓ |
  | 顶部「诊断」点击后 DiagnoseModal 打开 | ✓ |
  | 模型下拉有可选项(假设至少装了一个 bundled model) | ✓ |
  | 模型下拉切换后,点「启动」/「重启」后端收到带 model_id 的 POST | ✓ |
  | 状态 `failed` 时显示错误条 + 「查看诊断」链接 | ✓ |
  | `reachable=false` 时整个 section 替换为「无法连接」提示 | ✓(可拔后端 sidecar 模拟) |

### Step 4.6: Commit

- [ ] Run:

```bash
git add chayuan-client/packages/app/src/features/placeholders/SettingsAsPage.tsx
git commit -m "$(cat <<'EOF'
refactor(settings): 移除"后端服务"和"上传遥测"两行

桌面单机版 baseURL 由 Tauri sidecar 注入到 apiBaseOverride,用户改了
反而会断开;telemetry pipeline 桌面版未启用,开关只是本地偏好持久化,
误导。两行在设置页面无业务价值,移除腾出视觉空间给「本地模型服务」。

保留 store 字段 apiBaseOverride / telemetry(可能被别处或 SettingsDialog
使用),仅删 UI 行 + 仅服务这两行的局部 state/handler/import。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## 完工后

- [ ] 全量 typecheck:`pnpm typecheck`(在 `chayuan-client` 根)

  Expected: exit 0。

- [ ] 全量测试:`pnpm test --run`

  Expected: 全绿,新增的 4 个测试(1 API + 3 store)PASS,原有测试不退化。

- [ ] `git status` 确认工作区干净:

  Run: `git status --short`
  Expected: nothing to commit, working tree clean。

- [ ] 用户验收(手测清单见 Step 5.5)通过后,push 到 `origin/main`(按 CLAUDE.md 固定分支约束):

  Run: `git push origin main`

## 风险与回滚

- 若组件挂载后某个 capability 在 status payload 中字段命名跟 type 不一致(`state` 取值错), 单独修 `LocalRuntimeStatusBadge` 或本组件 row 状态判断逻辑, 不要改 store / API。
- 若 `/runtime/models` 返回的 `capability` 字段含未来新增的 capability(超出 5 项白名单), 当前 row 会忽略它(不渲染下拉项),不会崩。
- 若 `LocalRuntimePanel.tsx` (老入口)出问题, 直接 git revert 本 plan 的 5 个 commit, 不影响主进程。
