# 本地 LLM Runtime 前端集成 实施计划 (Plan 2: Sprint 3 + 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 桌面端「设置 → AI 平台」新增「本地模型」分页:暴露 `/runtime/llama/*` 控制面 (状态 / 启停 / 端口 / API key / LAN 开关 / 装机路径透出);Composer 选模型下拉新增「本地」分组;前端检测本地 runtime ready 后自动 surface 模型,可一键设为默认聊天模型。

**Architecture:** Plan 1 已经在 chayuan-server 暴露好 7 个 `/runtime/llama/*` REST API。本 Plan 在 chayuan-client (React/TypeScript pnpm workspace) 加一层 API 客户端 + zustand store + 两个 UI 组件 (Settings 页 + Composer 选模型分组)。WPS 加载项 (`chayuan` 仓库) 不在本 Plan 范围。

**Tech Stack:** TypeScript, React, vitest, zustand, lucide-react icons, @chayuan/ui design tokens, @chayuan/api 现有 `request` 客户端。

**Spec 关联:** `docs/superpowers/specs/2026-05-15-local-llm-runtime-integration-design.md` §4.4-4.5 (Module 4+5)。

**Plan 1 关联:** Plan 1 commits `978824a..a240516` 已完成后端。本 Plan 假定 sidecar 跑 `localhost:62581`,`/runtime/llama/{status,start,stop,restart,config,install-info}` 可用。

---

## File Structure

### 新建文件

| 文件 | 责任 |
|---|---|
| `chayuan-client/packages/api/src/localRuntime.ts` | `/runtime/llama/*` TypeScript 类型 + fetch 客户端 (status / start / stop / restart / getConfig / setConfig / installInfo) |
| `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts` | API 契约单测 (vitest + fake fetch) |
| `chayuan-client/packages/app/src/store/localRuntime.ts` | zustand store:轮询 status + 缓存 config + 派发 actions |
| `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts` | store 单测 |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx` | 设置页「本地模型」分页主组件 |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeStatusBadge.tsx` | 状态色块 (running/stopped/failed/restarting) |
| `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeConfigForm.tsx` | host/port/api_key/expose_lan/preload 表单 |

### 修改文件

| 文件 | 改什么 |
|---|---|
| `chayuan-client/packages/api/src/index.ts` | export `localRuntime` 模块 |
| `chayuan-client/packages/app/src/features/aiPlatform/AiPlatformPanel.tsx` | 加第 5 个 tab `local`,值为 `LocalRuntimePanel` |
| `chayuan-client/packages/app/src/features/aiPlatform/index.ts` | re-export `LocalRuntimePanel` |
| `chayuan-client/packages/app/src/features/composer/ModelMenuList.tsx` | 识别 `platform_name === 'local'` 渲染本地分组 (logo + 显示名「本地模型」) |
| `chayuan-client/packages/app/src/features/composer/ComposerModelPill.tsx` | 在 models 列表前 prepend 本地 runtime 合成的 model entry (当 state === 'ready') |

---

## Sprint 3: API client + Store + Settings UI (Task 1-10)

### Task 1: 加 `/runtime/llama/*` TypeScript 类型 + 客户端骨架

**Files:**
- Create: `chayuan-client/packages/api/src/localRuntime.ts`

- [ ] **Step 1: 写文件**

写入 `chayuan-client/packages/api/src/localRuntime.ts`:

```typescript
/**
 * 本地 LLM runtime 控制面 API 客户端。
 *
 * 对齐 chayuan-server `/runtime/llama/*`:
 *   GET  /runtime/llama/status        → 状态机 + endpoint + pid
 *   POST /runtime/llama/start         → 拉起 llama-server.exe
 *   POST /runtime/llama/stop          → 关停
 *   POST /runtime/llama/restart       → stop + start
 *   GET  /runtime/llama/config        → LocalRuntimeSettings
 *   POST /runtime/llama/config        → 部分更新 + 持久化 yaml
 *   GET  /runtime/llama/install-info  → 装机路径 + 二进制版本
 *
 * 设计:仅在桌面端有意义 (集成版 .msi 装机后 vendor llama-server 才在),
 * Web 端调用会返回 404 — 调用方需自己用 platform.kind 守卫。
 */

import { request } from './client';

// ─── types ───────────────────────────────────────────────────────────

export type LocalRuntimeState =
  | 'stopped'
  | 'starting'
  | 'ready'
  | 'failed'
  | 'restarting';

export interface LocalRuntimeStatus {
  state: LocalRuntimeState;
  endpoint?: string | null;
  pid?: number | null;
  model_id?: string | null;
  model_path?: string | null;
  started_at?: string | null;
  last_health_at?: string | null;
  last_error?: string | null;
}

export interface LocalRuntimeSettings {
  preload_on_startup: boolean;
  host: string;
  port: number;
  api_key: string;
  expose_lan: boolean;
  default_chat_model: string;
}

export type LocalRuntimeSettingsPatch = Partial<LocalRuntimeSettings>;

export interface LocalRuntimeInstallInfo {
  chayuan_root: string;
  models_root: string;
  bundled_models_root: string;
  llama_server_exe: string | null;
  build_version: string | null;
}

// 注:`request<T>(path)` 内部已经自动拆 `{code, msg, data}` 信封 (见 client.ts:198-211),
// `r.data` 就是已解包的内层 payload。我们这里只声明内层 T 类型即可。

// ─── client ──────────────────────────────────────────────────────────

async function getStatus(): Promise<LocalRuntimeStatus> {
  return (await request<LocalRuntimeStatus>('/runtime/llama/status')).data;
}

async function start(opts?: { model_id?: string }): Promise<LocalRuntimeStatus> {
  return (
    await request<LocalRuntimeStatus>('/runtime/llama/start', {
      method: 'POST',
      body: opts ?? {},
      timeoutMs: 90_000, // 启动 + 60s health probe 留余量
    })
  ).data;
}

async function stop(): Promise<LocalRuntimeStatus> {
  return (
    await request<LocalRuntimeStatus>('/runtime/llama/stop', {
      method: 'POST',
      timeoutMs: 20_000,
    })
  ).data;
}

async function restart(opts?: { model_id?: string }): Promise<LocalRuntimeStatus> {
  return (
    await request<LocalRuntimeStatus>('/runtime/llama/restart', {
      method: 'POST',
      body: opts ?? {},
      timeoutMs: 90_000,
    })
  ).data;
}

async function getConfig(): Promise<LocalRuntimeSettings> {
  return (await request<LocalRuntimeSettings>('/runtime/llama/config')).data;
}

async function setConfig(patch: LocalRuntimeSettingsPatch): Promise<LocalRuntimeSettings> {
  return (
    await request<LocalRuntimeSettings>('/runtime/llama/config', {
      method: 'POST',
      body: patch,
    })
  ).data;
}

async function getInstallInfo(): Promise<LocalRuntimeInstallInfo> {
  return (await request<LocalRuntimeInstallInfo>('/runtime/llama/install-info')).data;
}

export const localRuntime = {
  getStatus,
  start,
  stop,
  restart,
  getConfig,
  setConfig,
  getInstallInfo,
};
```

- [ ] **Step 2: 跑 typecheck 确认无错**

```bash
cd /work/chayuan-desktop/chayuan-client/packages/api
pnpm exec tsc -p tsconfig.json --noEmit
```

Expected: 无输出 (无类型错误)。如果 `request` 函数签名 / body 字段名不一致,根据当前 `client.ts` 实际签名调整。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/api/src/localRuntime.ts
git commit -m "feat(api): 加 localRuntime 客户端模块 (/runtime/llama/*)"
```

---

### Task 2: 加 contract 单测 + export 到 index

**Files:**
- Create: `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts`
- Modify: `chayuan-client/packages/api/src/index.ts`

- [ ] **Step 1: 写单测**

写入 `chayuan-client/packages/api/src/__tests__/localRuntime.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@chayuan/platform-shared';
import { configureClient } from '../client';
import { localRuntime } from '../localRuntime';

interface MockCall {
  url: string;
  init?: RequestInit;
}

let calls: MockCall[] = [];
let response: (call: MockCall) => Response = () =>
  new Response('{}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const fakeFetch: typeof globalThis.fetch = async (input, init) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  const call = { url, init: init ?? undefined };
  calls.push(call);
  return response(call);
};

beforeEach(() => {
  calls = [];
  response = () =>
    new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  setPlatform({
    kind: 'web',
    runtime: {
      appName: 't',
      appVersion: '0',
      release: 't@0',
      defaultApiBase: 'http://api.local',
    },
    secure: { get: async () => null, set: async () => undefined, del: async () => undefined },
    db: { exec: async () => undefined, query: async () => [] },
    fs: { pickFiles: async () => [], saveText: async () => undefined, readDropped: async () => [] },
  } as never);
  configureClient({ baseURL: 'http://api.local', fetch: fakeFetch });
});

describe('localRuntime client', () => {
  it('getStatus 命中 GET /runtime/llama/status 并解包 envelope', async () => {
    response = () =>
      new Response(
        JSON.stringify({ code: 0, data: { state: 'ready', endpoint: 'http://127.0.0.1:62582', pid: 1234 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const s = await localRuntime.getStatus();
    expect(s.state).toBe('ready');
    expect(s.endpoint).toBe('http://127.0.0.1:62582');
    expect(s.pid).toBe(1234);
    expect(calls[0].url).toMatch(/\/runtime\/llama\/status$/);
    expect(calls[0].init?.method ?? 'GET').toBe('GET');
  });

  it('start 命中 POST 并把 model_id 写进 body', async () => {
    response = () =>
      new Response(JSON.stringify({ code: 0, data: { state: 'ready' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await localRuntime.start({ model_id: 'Qwen3-4B-Q3' });
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].url).toMatch(/\/runtime\/llama\/start$/);
    const body = calls[0].init?.body;
    expect(typeof body).toBe('string');
    expect(JSON.parse(body as string)).toEqual({ model_id: 'Qwen3-4B-Q3' });
  });

  it('start 默认参数发空 body', async () => {
    response = () =>
      new Response(JSON.stringify({ code: 0, data: { state: 'ready' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await localRuntime.start();
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({});
  });

  it('setConfig 把 patch 透传到 body', async () => {
    response = () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            preload_on_startup: true,
            host: '127.0.0.1',
            port: 62590,
            api_key: '',
            expose_lan: true,
            default_chat_model: '',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const s = await localRuntime.setConfig({ port: 62590, expose_lan: true });
    expect(s.port).toBe(62590);
    expect(s.expose_lan).toBe(true);
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ port: 62590, expose_lan: true });
  });

  it('getInstallInfo 命中 GET /runtime/llama/install-info', async () => {
    response = () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            chayuan_root: '/data/cy',
            models_root: '/data/cy/models',
            bundled_models_root: '/data/cy/models/bundled',
            llama_server_exe: '/install/services/llama-server/llama-server.exe',
            build_version: 'b4404',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const info = await localRuntime.getInstallInfo();
    expect(info.build_version).toBe('b4404');
    expect(info.llama_server_exe).toMatch(/llama-server\.exe$/);
  });

  it('stop / restart 命中正确 path', async () => {
    response = () =>
      new Response(JSON.stringify({ code: 0, data: { state: 'stopped' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await localRuntime.stop();
    expect(calls.at(-1)?.url).toMatch(/\/runtime\/llama\/stop$/);
    expect(calls.at(-1)?.init?.method).toBe('POST');

    await localRuntime.restart();
    expect(calls.at(-1)?.url).toMatch(/\/runtime\/llama\/restart$/);
  });
});
```

- [ ] **Step 2: 跑测试,确认全 pass**

```bash
cd /work/chayuan-desktop/chayuan-client/packages/api
pnpm exec vitest run src/__tests__/localRuntime.test.ts
```

Expected: 6 passed。

- [ ] **Step 3: 在 `packages/api/src/index.ts` 末尾追加 export**

先看现状:`grep -n "export" packages/api/src/index.ts | tail -5`

末尾追加(放在文件最末,跟其它 export 一起):

```typescript
export { localRuntime } from './localRuntime';
export type {
  LocalRuntimeState,
  LocalRuntimeStatus,
  LocalRuntimeSettings,
  LocalRuntimeSettingsPatch,
  LocalRuntimeInstallInfo,
} from './localRuntime';
```

- [ ] **Step 4: 顶层 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/api run typecheck
```

Expected: 无错。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/api/src/__tests__/localRuntime.test.ts
git add chayuan-client/packages/api/src/index.ts
git commit -m "test(api): localRuntime 客户端契约单测 + 顶层 export"
```

---

### Task 3: zustand store 骨架 (state + cache,无 polling)

**Files:**
- Create: `chayuan-client/packages/app/src/store/localRuntime.ts`

- [ ] **Step 1: 写 store**

```typescript
/**
 * 本地 LLM runtime 桌面端状态缓存。
 *
 * 职责:
 * - 缓存最新 status / config / installInfo
 * - 派发 actions:start / stop / restart / saveConfig
 * - 暴露轮询 hook (Task 4):mount 时拉一次 + 每 5s 一次
 *
 * 设计:不持久化 (后端是唯一真源,前端只是 cache layer);
 * 网络错误时保留旧值 + 写 lastError 让 UI 知会。
 */

import { create } from 'zustand';
import {
  localRuntime,
  type LocalRuntimeInstallInfo,
  type LocalRuntimeSettings,
  type LocalRuntimeSettingsPatch,
  type LocalRuntimeStatus,
} from '@chayuan/api';

export interface LocalRuntimeStoreState {
  /** 最近一次 GET /status 返回 */
  status: LocalRuntimeStatus | null;
  /** 最近一次 GET /config 返回 (form 初始值来源) */
  config: LocalRuntimeSettings | null;
  /** 装机路径 (首次打开 panel 时拉) */
  installInfo: LocalRuntimeInstallInfo | null;

  /** 进行中的操作 (避免双击 start) */
  pending: 'start' | 'stop' | 'restart' | 'save-config' | null;
  /** 最近一次网络错误描述 */
  lastError: string | null;
  /** 后端是否可达 (404 / network error 时置 false) */
  reachable: boolean;

  refreshStatus(): Promise<void>;
  refreshConfig(): Promise<void>;
  refreshInstallInfo(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  saveConfig(patch: LocalRuntimeSettingsPatch): Promise<void>;
  clearError(): void;
}

export const useLocalRuntimeStore = create<LocalRuntimeStoreState>((set, get) => ({
  status: null,
  config: null,
  installInfo: null,
  pending: null,
  lastError: null,
  reachable: true,

  async refreshStatus() {
    try {
      const status = await localRuntime.getStatus();
      set({ status, reachable: true });
    } catch (e) {
      set({ reachable: false, lastError: describeError(e) });
    }
  },

  async refreshConfig() {
    try {
      const config = await localRuntime.getConfig();
      set({ config, reachable: true });
    } catch (e) {
      set({ reachable: false, lastError: describeError(e) });
    }
  },

  async refreshInstallInfo() {
    try {
      const installInfo = await localRuntime.getInstallInfo();
      set({ installInfo, reachable: true });
    } catch (e) {
      set({ reachable: false, lastError: describeError(e) });
    }
  },

  async start() {
    if (get().pending) return;
    set({ pending: 'start', lastError: null });
    try {
      const status = await localRuntime.start();
      set({ status, pending: null });
    } catch (e) {
      set({ pending: null, lastError: describeError(e) });
    }
  },

  async stop() {
    if (get().pending) return;
    set({ pending: 'stop', lastError: null });
    try {
      const status = await localRuntime.stop();
      set({ status, pending: null });
    } catch (e) {
      set({ pending: null, lastError: describeError(e) });
    }
  },

  async restart() {
    if (get().pending) return;
    set({ pending: 'restart', lastError: null });
    try {
      const status = await localRuntime.restart();
      set({ status, pending: null });
    } catch (e) {
      set({ pending: null, lastError: describeError(e) });
    }
  },

  async saveConfig(patch) {
    if (get().pending) return;
    set({ pending: 'save-config', lastError: null });
    try {
      const config = await localRuntime.setConfig(patch);
      set({ config, pending: null });
    } catch (e) {
      set({ pending: null, lastError: describeError(e) });
    }
  },

  clearError() {
    set({ lastError: null });
  },
}));

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
```

- [ ] **Step 2: 跑 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/store/localRuntime.ts
git commit -m "feat(app): localRuntime zustand store (cache + actions)"
```

---

### Task 4: store 单测

**Files:**
- Create: `chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts`

- [ ] **Step 1: 写单测**

```typescript
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { useLocalRuntimeStore } from '../localRuntime';

// 拦截 @chayuan/api 的 localRuntime,所有调用走 mock
vi.mock('@chayuan/api', () => ({
  localRuntime: {
    getStatus: vi.fn(),
    getConfig: vi.fn(),
    getInstallInfo: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    setConfig: vi.fn(),
  },
}));

import { localRuntime as api } from '@chayuan/api';

beforeEach(() => {
  useLocalRuntimeStore.setState({
    status: null,
    config: null,
    installInfo: null,
    pending: null,
    lastError: null,
    reachable: true,
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLocalRuntimeStore', () => {
  it('refreshStatus 成功时 status 被缓存,reachable=true', async () => {
    (api.getStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'ready',
      endpoint: 'http://127.0.0.1:62582',
      pid: 99,
    });
    await useLocalRuntimeStore.getState().refreshStatus();
    expect(useLocalRuntimeStore.getState().status?.state).toBe('ready');
    expect(useLocalRuntimeStore.getState().reachable).toBe(true);
  });

  it('refreshStatus 失败时 reachable=false 但旧 status 保留', async () => {
    useLocalRuntimeStore.setState({
      status: { state: 'ready', endpoint: 'http://old', pid: 1 },
    });
    (api.getStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    await useLocalRuntimeStore.getState().refreshStatus();
    expect(useLocalRuntimeStore.getState().reachable).toBe(false);
    expect(useLocalRuntimeStore.getState().lastError).toContain('network');
    // 不清空旧状态,UI 仍展示
    expect(useLocalRuntimeStore.getState().status?.state).toBe('ready');
  });

  it('start 期间 pending=start,完成后归零并写入新 status', async () => {
    let resolveStart: (s: { state: string }) => void;
    (api.start as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolveStart = r;
      }),
    );
    const p = useLocalRuntimeStore.getState().start();
    expect(useLocalRuntimeStore.getState().pending).toBe('start');
    resolveStart!({ state: 'ready' });
    await p;
    expect(useLocalRuntimeStore.getState().pending).toBeNull();
    expect(useLocalRuntimeStore.getState().status?.state).toBe('ready');
  });

  it('pending 时再触发 start 立即返回,不会调第二次 api', async () => {
    let resolveStart: (s: { state: string }) => void = () => undefined;
    (api.start as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => {
        resolveStart = r;
      }),
    );
    const p1 = useLocalRuntimeStore.getState().start();
    await useLocalRuntimeStore.getState().start(); // 立即 return,不发请求
    expect((api.start as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    resolveStart({ state: 'ready' });
    await p1;
  });

  it('saveConfig 成功后 config 被刷新', async () => {
    (api.setConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      preload_on_startup: true,
      host: '127.0.0.1',
      port: 62590,
      api_key: '',
      expose_lan: true,
      default_chat_model: '',
    });
    await useLocalRuntimeStore.getState().saveConfig({ port: 62590, expose_lan: true });
    expect(useLocalRuntimeStore.getState().config?.port).toBe(62590);
    expect(useLocalRuntimeStore.getState().config?.expose_lan).toBe(true);
  });

  it('clearError 清掉 lastError', async () => {
    useLocalRuntimeStore.setState({ lastError: 'foo' });
    useLocalRuntimeStore.getState().clearError();
    expect(useLocalRuntimeStore.getState().lastError).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试**

```bash
cd /work/chayuan-desktop/chayuan-client/packages/app
pnpm exec vitest run src/store/__tests__/localRuntime.test.ts
```

Expected: 6 passed。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/store/__tests__/localRuntime.test.ts
git commit -m "test(app): localRuntime store 单测"
```

---

### Task 5: LocalRuntimeStatusBadge 组件

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeStatusBadge.tsx`

- [ ] **Step 1: 写组件**

```typescript
/**
 * 本地 LLM runtime 状态色块:小尺寸 pill,显示运行状态 + 颜色,hover 显示 tooltip。
 *
 * 状态色:
 *   ready       → 绿
 *   starting    → 蓝(脉冲)
 *   restarting  → 蓝(脉冲)
 *   stopped     → 灰
 *   failed      → 红
 */

import * as React from 'react';
import { cn } from '@chayuan/ui';
import type { LocalRuntimeState, LocalRuntimeStatus } from '@chayuan/api';

const STATE_LABEL: Record<LocalRuntimeState, string> = {
  ready: '运行中',
  starting: '启动中',
  restarting: '重启中',
  stopped: '已停止',
  failed: '失败',
};

const STATE_COLOR: Record<LocalRuntimeState, string> = {
  ready: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  starting: 'bg-sky-500/15 text-sky-700 border-sky-500/30 animate-pulse',
  restarting: 'bg-sky-500/15 text-sky-700 border-sky-500/30 animate-pulse',
  stopped: 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30',
  failed: 'bg-rose-500/15 text-rose-700 border-rose-500/30',
};

export interface LocalRuntimeStatusBadgeProps {
  status: LocalRuntimeStatus | null;
  className?: string;
}

export const LocalRuntimeStatusBadge: React.FC<LocalRuntimeStatusBadgeProps> = ({
  status,
  className,
}) => {
  const state = status?.state ?? 'stopped';
  const label = STATE_LABEL[state];
  const tooltip =
    status?.last_error && state === 'failed'
      ? status.last_error
      : status?.endpoint && state === 'ready'
        ? status.endpoint
        : label;

  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        STATE_COLOR[state],
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          state === 'ready' && 'bg-emerald-500',
          (state === 'starting' || state === 'restarting') && 'bg-sky-500',
          state === 'stopped' && 'bg-zinc-400',
          state === 'failed' && 'bg-rose-500',
        )}
      />
      {label}
    </span>
  );
};
```

- [ ] **Step 2: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeStatusBadge.tsx
git commit -m "feat(ui): LocalRuntimeStatusBadge 状态色块"
```

---

### Task 6: LocalRuntimeConfigForm 表单组件

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeConfigForm.tsx`

- [ ] **Step 1: 写组件**

```typescript
/**
 * 本地 LLM runtime 配置表单。
 *
 * 字段:
 *   - host (127.0.0.1 / 自定义,expose_lan=true 时强制 0.0.0.0)
 *   - port (1024-65535,默认 62582)
 *   - api_key (可选,设置后调用方需带 Authorization: Bearer)
 *   - expose_lan (开关,默认关;开启提示 LAN 风险)
 *   - preload_on_startup (开关,默认开)
 *
 * 不直接调 store.saveConfig:onSubmit 由父组件包一层,可加确认对话框 / 触发 restart。
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Input } from '@chayuan/ui';
import type { LocalRuntimeSettings, LocalRuntimeSettingsPatch } from '@chayuan/api';

export interface LocalRuntimeConfigFormProps {
  /** 初始值 (从 store.config 来) */
  value: LocalRuntimeSettings;
  /** 提交时调用:父组件决定是否弹确认 / 触发 restart */
  onSubmit(patch: LocalRuntimeSettingsPatch): void | Promise<void>;
  /** 表单是否禁用 (saveConfig pending 时) */
  disabled?: boolean;
}

export const LocalRuntimeConfigForm: React.FC<LocalRuntimeConfigFormProps> = ({
  value,
  onSubmit,
  disabled,
}) => {
  const [draft, setDraft] = React.useState<LocalRuntimeSettings>(value);
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  const setField = <K extends keyof LocalRuntimeSettings>(
    key: K,
    v: LocalRuntimeSettings[K],
  ) => setDraft((s) => ({ ...s, [key]: v }));

  const portError =
    Number.isFinite(draft.port) && (draft.port < 1024 || draft.port > 65535)
      ? '端口范围 1024-65535'
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (portError) return;
    // 仅发改动字段
    const patch: LocalRuntimeSettingsPatch = {};
    for (const k of Object.keys(draft) as (keyof LocalRuntimeSettings)[]) {
      if (draft[k] !== value[k]) (patch as Record<string, unknown>)[k] = draft[k];
    }
    if (Object.keys(patch).length === 0) return;
    onSubmit(patch);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="启动时预热" help="桌面启动后自动拉起本地模型(关闭后首次聊天 lazy start)">
        <Toggle
          checked={draft.preload_on_startup}
          onCheckedChange={(v) => setField('preload_on_startup', v)}
          disabled={disabled}
        />
      </Field>

      <Field label="Host" help="expose_lan 开启时自动用 0.0.0.0">
        <Input
          value={draft.expose_lan ? '0.0.0.0' : draft.host}
          onChange={(e) => setField('host', e.target.value)}
          disabled={disabled || draft.expose_lan}
          placeholder="127.0.0.1"
          className="h-8"
        />
      </Field>

      <Field label="端口" help="默认 62582;改后需 restart 生效">
        <div className="flex flex-col gap-1">
          <Input
            type="number"
            value={String(draft.port)}
            onChange={(e) => setField('port', Number(e.target.value) || 0)}
            disabled={disabled}
            min={1024}
            max={65535}
            className="h-8 max-w-[120px]"
          />
          {portError && <span className="text-xs text-rose-600">{portError}</span>}
        </div>
      </Field>

      <Field
        label="API Key"
        help="留空 = 任何本机进程可调;设置后调用方需带 Authorization: Bearer <key>"
      >
        <Input
          type="password"
          value={draft.api_key}
          onChange={(e) => setField('api_key', e.target.value)}
          disabled={disabled}
          placeholder="留空 = 不校验"
          className="h-8"
        />
      </Field>

      <Field
        label="局域网暴露"
        help={draft.expose_lan ? '⚠️ 同网络内任意机器可访问,务必配 API Key' : '只允许本机访问 (推荐)'}
      >
        <Toggle
          checked={draft.expose_lan}
          onCheckedChange={(v) => setField('expose_lan', v)}
          disabled={disabled}
        />
      </Field>

      {draft.expose_lan && !draft.api_key.trim() && (
        <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>LAN 开启但 API Key 为空:任何同网段机器都能调用本机模型。建议至少设置一个 key。</span>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={disabled || !!portError} size="sm">
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setDraft(value)}
        >
          重置
        </Button>
      </div>
    </form>
  );
};

const Field: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({
  label,
  help,
  children,
}) => (
  <div className="grid grid-cols-[160px_1fr] items-start gap-3">
    <div className="pt-1">
      <div className="text-sm font-medium text-[var(--cy-text-primary)]">{label}</div>
      {help && <div className="mt-0.5 text-xs text-[var(--cy-text-tertiary)]">{help}</div>}
    </div>
    <div>{children}</div>
  </div>
);

const Toggle: React.FC<{
  checked: boolean;
  onCheckedChange(v: boolean): void;
  disabled?: boolean;
}> = ({ checked, onCheckedChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onCheckedChange(!checked)}
    disabled={disabled}
    className={
      'inline-flex h-5 w-9 items-center rounded-full border transition-colors ' +
      (checked
        ? 'border-emerald-500/50 bg-emerald-500'
        : 'border-zinc-400/40 bg-zinc-400/30') +
      (disabled ? ' opacity-50' : '')
    }
  >
    <span
      className={
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ' +
        (checked ? 'translate-x-[18px]' : 'translate-x-[2px]')
      }
    />
  </button>
);
```

- [ ] **Step 2: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。如果 `@chayuan/ui` 没 export `Button` 或 `Input`,从同包其它组件找替代名。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimeConfigForm.tsx
git commit -m "feat(ui): LocalRuntimeConfigForm 配置表单 (host/port/key/lan/preload)"
```

---

### Task 7: LocalRuntimePanel 主组件 + 轮询 hook

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx`

- [ ] **Step 1: 写组件**

```typescript
/**
 * 「系统设置 → AI 平台 → 本地模型」分页。
 *
 * 布局:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ [状态色块]  endpoint http://127.0.0.1:62582  · pid 1234   │
 *   │   model_id: Qwen3-4B-Instruct-2507-Q3_K_S                │
 *   │ [启动][停止][重启]  最近错误:xxx                          │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ 配置                                                      │
 *   │   预热开关 / Host / Port / API Key / LAN 开关             │
 *   │   [保存]                                                  │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ 装机路径                                                  │
 *   │   chayuan_root: /data/cy                  [复制]          │
 *   │   models_root: /data/cy/models            [复制]          │
 *   │   llama_server: /install/.../llama-server.exe (b4404)     │
 *   └──────────────────────────────────────────────────────────┘
 */

import * as React from 'react';
import { Copy, Play, Square, RotateCw } from 'lucide-react';
import { Button } from '@chayuan/ui';
import { useLocalRuntimeStore } from '../../store/localRuntime';
import { LocalRuntimeStatusBadge } from './LocalRuntimeStatusBadge';
import { LocalRuntimeConfigForm } from './LocalRuntimeConfigForm';

const POLL_INTERVAL_MS = 5_000;

function useLocalRuntimePolling() {
  const refreshStatus = useLocalRuntimeStore((s) => s.refreshStatus);
  React.useEffect(() => {
    void refreshStatus();
    const t = window.setInterval(() => void refreshStatus(), POLL_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [refreshStatus]);
}

export const LocalRuntimePanel: React.FC = () => {
  const {
    status,
    config,
    installInfo,
    pending,
    lastError,
    reachable,
    refreshConfig,
    refreshInstallInfo,
    start,
    stop,
    restart,
    saveConfig,
    clearError,
  } = useLocalRuntimeStore();
  useLocalRuntimePolling();

  React.useEffect(() => {
    void refreshConfig();
    void refreshInstallInfo();
  }, [refreshConfig, refreshInstallInfo]);

  if (!reachable) {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
        无法连接 sidecar (
        <code className="rounded bg-rose-100 px-1 dark:bg-rose-900/40">/runtime/llama/*</code>)。
        本地模型功能仅在集成版桌面应用中可用,Web 端不支持。
      </div>
    );
  }

  const isPending = pending !== null;

  return (
    <div className="space-y-6">
      {/* 状态区 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <LocalRuntimeStatusBadge status={status} />
          {status?.endpoint && (
            <code className="text-xs text-[var(--cy-text-secondary)]">{status.endpoint}</code>
          )}
          {status?.pid != null && (
            <span className="text-xs text-[var(--cy-text-tertiary)]">pid {status.pid}</span>
          )}
        </div>
        {status?.model_id && (
          <div className="text-xs text-[var(--cy-text-secondary)]">
            模型:<code>{status.model_id}</code>
          </div>
        )}
        {status?.state === 'failed' && status.last_error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            <div className="font-medium">最近错误</div>
            <div className="mt-1 whitespace-pre-wrap break-all">{status.last_error}</div>
          </div>
        )}
        {lastError && (
          <div className="flex items-center justify-between rounded-md border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <span>{lastError}</span>
            <Button size="xs" variant="ghost" onClick={clearError}>
              ×
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void start()}
            disabled={isPending || status?.state === 'starting' || status?.state === 'ready'}
          >
            <Play className="mr-1 h-3.5 w-3.5" />
            启动
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void stop()}
            disabled={isPending || status?.state === 'stopped'}
          >
            <Square className="mr-1 h-3.5 w-3.5" />
            停止
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void restart()}
            disabled={isPending}
          >
            <RotateCw className={'mr-1 h-3.5 w-3.5' + (pending === 'restart' ? ' animate-spin' : '')} />
            重启
          </Button>
        </div>
      </section>

      <div className="h-px bg-[var(--cy-border-subtle)]" />

      {/* 配置区 */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--cy-text-primary)]">配置</h3>
        <p className="text-xs text-[var(--cy-text-tertiary)]">
          改 host / port / API key 后需点「重启」让 llama-server 重新 bind。
        </p>
        {config ? (
          <LocalRuntimeConfigForm
            value={config}
            disabled={isPending}
            onSubmit={(patch) => void saveConfig(patch)}
          />
        ) : (
          <div className="text-xs text-[var(--cy-text-tertiary)]">加载配置中…</div>
        )}
      </section>

      <div className="h-px bg-[var(--cy-border-subtle)]" />

      {/* 装机路径 */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-[var(--cy-text-primary)]">装机路径</h3>
        {installInfo ? (
          <div className="space-y-1.5 text-xs">
            <PathRow label="数据目录" value={installInfo.chayuan_root} />
            <PathRow label="模型根目录" value={installInfo.models_root} />
            <PathRow label="集成版模型" value={installInfo.bundled_models_root} />
            <PathRow
              label="llama-server"
              value={installInfo.llama_server_exe ?? '(未装机或集成版缺失)'}
              suffix={installInfo.build_version ? `build ${installInfo.build_version}` : undefined}
            />
          </div>
        ) : (
          <div className="text-xs text-[var(--cy-text-tertiary)]">加载装机信息中…</div>
        )}
      </section>
    </div>
  );
};

const PathRow: React.FC<{ label: string; value: string; suffix?: string }> = ({
  label,
  value,
  suffix,
}) => (
  <div className="flex items-center gap-2">
    <span className="w-24 text-[var(--cy-text-tertiary)]">{label}</span>
    <code className="flex-1 truncate rounded bg-[var(--cy-surface-1)] px-1.5 py-0.5 text-[var(--cy-text-secondary)]">
      {value}
    </code>
    {suffix && (
      <span className="text-[10px] text-[var(--cy-text-tertiary)]">{suffix}</span>
    )}
    <Button
      size="xs"
      variant="ghost"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
      }}
      title="复制路径"
    >
      <Copy className="h-3 w-3" />
    </Button>
  </div>
);

export default LocalRuntimePanel;
```

- [ ] **Step 2: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。如果 `Button` 不支持 `size="xs"` / `variant="ghost"`,改成最接近的支持值(查 `packages/ui/src/components/button.tsx`)。

- [ ] **Step 3: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/LocalRuntimePanel.tsx
git commit -m "feat(ui): LocalRuntimePanel 设置页本地模型主组件"
```

---

### Task 8: 把 LocalRuntimePanel 挂到 AiPlatformPanel 第 5 个 tab

**Files:**
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/AiPlatformPanel.tsx`
- Modify: `chayuan-client/packages/app/src/features/aiPlatform/index.ts`

- [ ] **Step 1: 看 AiPlatformPanel 现有 tab 定义**

```bash
grep -n "AiPlatformTab\|TAB_ITEMS\|tab === " chayuan-client/packages/app/src/features/aiPlatform/AiPlatformPanel.tsx | head -20
```

应该找到 line 585 附近 `type AiPlatformTab = 'models' | 'services' | 'doctor' | 'mirror';` 和后面的 TAB_ITEMS。

- [ ] **Step 2: 把 type 加 'local'**

把:
```typescript
type AiPlatformTab = 'models' | 'services' | 'doctor' | 'mirror';
```

改成:
```typescript
type AiPlatformTab = 'models' | 'services' | 'doctor' | 'mirror' | 'local';
```

- [ ] **Step 3: 在 TAB_ITEMS 加一项**

找到 `const TAB_ITEMS: ReadonlyArray<{ value: AiPlatformTab; label: string }> = [...]`,在 `mirror` 后追加:

```typescript
  { value: 'local', label: '本地模型' },
```

- [ ] **Step 4: import LocalRuntimePanel**

在文件顶部 import 区,跟其它 panel 类组件一起:

```typescript
import { LocalRuntimePanel } from './LocalRuntimePanel';
```

- [ ] **Step 5: 在 tab 渲染处加分支**

找到 `{tab === 'mirror' && <MirrorSection />}`(文件 line 698 附近),后面追加:

```typescript
      {tab === 'local' && (
        <section className="max-h-[70vh] overflow-y-auto pr-1">
          <LocalRuntimePanel />
        </section>
      )}
```

- [ ] **Step 6: index.ts 加 re-export**

`chayuan-client/packages/app/src/features/aiPlatform/index.ts` 末尾加:

```typescript
export { LocalRuntimePanel } from './LocalRuntimePanel';
export { LocalRuntimeStatusBadge } from './LocalRuntimeStatusBadge';
```

- [ ] **Step 7: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 8: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/AiPlatformPanel.tsx
git add chayuan-client/packages/app/src/features/aiPlatform/index.ts
git commit -m "feat(ui): AiPlatformPanel 加「本地模型」第 5 个 tab"
```

---

### Task 9: LocalRuntimePanel RTL 快照测试

**Files:**
- Create: `chayuan-client/packages/app/src/features/aiPlatform/__tests__/LocalRuntimePanel.test.tsx`

- [ ] **Step 1: 看 app 包 test 配置**

```bash
ls chayuan-client/packages/app/src/features/*/__tests__/ 2>&1 | head -10
grep -n "@testing-library/react\|render\b" chayuan-client/packages/app/src/features/**/__tests__/*.tsx 2>&1 | head -5
```

如果项目里有 RTL 已用模式,follow 该模式。如果没找到任何 RTL 测试,跳过此 task (改用 `pnpm typecheck` + 手测覆盖)并直接进 Task 10;但要在报告里说明。

- [ ] **Step 2: 写测试 (假设 RTL 可用)**

```typescript
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocalRuntimePanel } from '../LocalRuntimePanel';
import { useLocalRuntimeStore } from '../../../store/localRuntime';

vi.mock('@chayuan/api', () => ({
  localRuntime: {
    getStatus: vi.fn().mockResolvedValue({ state: 'stopped' }),
    getConfig: vi.fn().mockResolvedValue({
      preload_on_startup: true,
      host: '127.0.0.1',
      port: 62582,
      api_key: '',
      expose_lan: false,
      default_chat_model: '',
    }),
    getInstallInfo: vi.fn().mockResolvedValue({
      chayuan_root: '/data',
      models_root: '/data/models',
      bundled_models_root: '/data/models/bundled',
      llama_server_exe: '/install/llama-server.exe',
      build_version: 'b4404',
    }),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    setConfig: vi.fn(),
  },
}));

beforeEach(() => {
  useLocalRuntimeStore.setState({
    status: null,
    config: null,
    installInfo: null,
    pending: null,
    lastError: null,
    reachable: true,
  });
});

describe('LocalRuntimePanel', () => {
  it('reachable=false 时显示降级提示', () => {
    useLocalRuntimeStore.setState({ reachable: false });
    render(<LocalRuntimePanel />);
    expect(screen.getByText(/无法连接 sidecar/)).toBeInTheDocument();
  });

  it('stopped 状态时显示「启动」按钮可点', async () => {
    useLocalRuntimeStore.setState({
      status: { state: 'stopped' },
      config: {
        preload_on_startup: true,
        host: '127.0.0.1',
        port: 62582,
        api_key: '',
        expose_lan: false,
        default_chat_model: '',
      },
    });
    render(<LocalRuntimePanel />);
    const startBtn = await screen.findByRole('button', { name: /启动/ });
    expect((startBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('ready 状态时「启动」按钮禁用,「停止」可点', () => {
    useLocalRuntimeStore.setState({
      status: { state: 'ready', endpoint: 'http://127.0.0.1:62582', pid: 999, model_id: 'm1' },
      config: {
        preload_on_startup: true,
        host: '127.0.0.1',
        port: 62582,
        api_key: '',
        expose_lan: false,
        default_chat_model: '',
      },
    });
    render(<LocalRuntimePanel />);
    expect(screen.getByText(/运行中/)).toBeInTheDocument();
    expect(screen.getByText('http://127.0.0.1:62582')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /启动/ });
    expect((startBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 3: 跑测试**

```bash
cd /work/chayuan-desktop/chayuan-client/packages/app
pnpm exec vitest run src/features/aiPlatform/__tests__/LocalRuntimePanel.test.tsx
```

Expected: 3 passed。

- [ ] **Step 4: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/aiPlatform/__tests__/LocalRuntimePanel.test.tsx
git commit -m "test(ui): LocalRuntimePanel RTL 快照测试"
```

如果 Step 1 发现 RTL 不可用,跳本 task 直接进 Task 10,只做 typecheck。

---

### Task 10: Sprint 3 集成验证 (Settings 页可视)

**Files:** 无新文件。跑 dev server 手测。

- [ ] **Step 1: 跑桌面 dev server**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/desktop run dev
```

(如果脚本名不对,看 `apps/desktop/package.json` 的 scripts)

- [ ] **Step 2: 在浏览器打开 dev URL,触发设置对话框**

打开后用键盘快捷键 / 头像菜单进设置 → AI 平台 → 切到「本地模型」tab。

- [ ] **Step 3: 验证降级提示**

如果后端 sidecar 没跑或 `/runtime/llama/*` 不可达,应看到「无法连接 sidecar」提示而非整页崩溃。

- [ ] **Step 4: 跑后端 sidecar (本地 chayuan-server) 再验证完整流程**

```bash
# 另开一个 terminal
cd /work/chayuan-desktop/chayuan-server
PYTHONPATH=libs/chayuan-server python3 -m chayuan.server.main  # 或项目实际 entry
```

回浏览器刷新「本地模型」tab,应看到状态色块 + 启动按钮 + 配置表单 + 装机路径区。

注:开发机大概率没真装 llama-server.exe → state 会停在 `failed` (没找到二进制),但 UI 不该崩。

- [ ] **Step 5: 无 commit (sprint 标记)**

Sprint 3 完。下一 sprint 进 Composer 集成。

---

## Sprint 4: Composer 本地模型分组 (Task 11-14)

### Task 11: ModelMenuList 加 'local' 分组识别 (logo + 显示名)

**Files:**
- Modify: `chayuan-client/packages/app/src/features/composer/ModelMenuList.tsx`

- [ ] **Step 1: 找 resolveLogo 函数定义**

```bash
grep -n "resolveLogo\b\|function resolveLogo\|const resolveLogo" chayuan-client/packages/app/src/features/composer/ModelMenuList.tsx
```

应该找到一个 `resolveLogo(platform_name, model_id?)` 帮 platform 取 logo svg/png。

- [ ] **Step 2: 在 ModelMenuList.tsx 顶部 (import 之后) 加常量**

```typescript
/** 本地 runtime 合成出的虚拟 platform,跟真平台 (deepseek/qwen 等) 平行展示 */
const LOCAL_PLATFORM_KEY = 'local';
const LOCAL_PLATFORM_LABEL = '本地模型';
```

- [ ] **Step 3: 改 groupByPlatform 让 local 永远排在最前**

找到 `function groupByPlatform(...)` 末尾的:

```typescript
return Array.from(map.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([platform, { displayName, items }]) => ({...}));
```

改成:

```typescript
return Array.from(map.entries())
  .sort(([a], [b]) => {
    // 本地永远首位,其它按字母序
    if (a === LOCAL_PLATFORM_KEY) return -1;
    if (b === LOCAL_PLATFORM_KEY) return 1;
    return a.localeCompare(b);
  })
  .map(([platform, { displayName, items }]) => ({
    platform,
    displayName:
      platform === LOCAL_PLATFORM_KEY ? LOCAL_PLATFORM_LABEL : displayName || platform,
    items: items.slice().sort((a, b) => a.id.localeCompare(b.id)),
  }));
```

- [ ] **Step 4: 改 resolveLogo 加 local 兜底**

找到 `resolveLogo` 函数(可能在文件中间 / 末尾),在最前加:

```typescript
function resolveLogo(platform?: string, _modelId?: string): string | undefined {
  if (platform === LOCAL_PLATFORM_KEY) {
    // 本地用 Cpu 图标或 chayuan favicon;ui 包内部约定路径 /icons/local.svg
    // 如果没准备静态资源,就 return undefined → Logo 组件 fallback 到首字母
    return undefined;
  }
  // ... 现有逻辑保留
}
```

如果 `resolveLogo` 是 import 进来的不在本文件内部,跳过这步;Logo 组件本身已经处理 src 为 undefined 的兜底 (显示首字母圆圈)。

- [ ] **Step 5: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 6: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/composer/ModelMenuList.tsx
git commit -m "feat(composer): ModelMenuList 识别 platform_name=local 渲染本地分组"
```

---

### Task 12: ComposerModelPill 注入本地 runtime 合成模型

**Files:**
- Modify: `chayuan-client/packages/app/src/features/composer/ComposerModelPill.tsx`

- [ ] **Step 1: 看 ComposerModelPill 现在如何拿 models**

```bash
grep -n "models\|RawModelItem\|ModelMenuList\|useModelPlatform" chayuan-client/packages/app/src/features/composer/ComposerModelPill.tsx | head -25
```

应该看到它从某个 store / hook 拿 `models: RawModelItem[]` 然后传给 `ModelMenuList`。

- [ ] **Step 2: import store + buildLocalModelEntry**

在文件顶部 import 区加:

```typescript
import { useLocalRuntimeStore } from '../../store/localRuntime';
import type { RawModelItem } from '@chayuan/api';
```

(如果 RawModelItem 已 import 跳过)

- [ ] **Step 3: 在组件函数体内,models prop 拿到后,prepend 本地合成项**

找到 `const models = ...` 或 `const filteredModels = useMemo(...)`,在 models 数组使用前注入:

```typescript
const localRuntime = useLocalRuntimeStore((s) => s.status);

const modelsWithLocal: RawModelItem[] = React.useMemo(() => {
  if (!localRuntime || localRuntime.state !== 'ready' || !localRuntime.model_id) {
    return models;
  }
  const localItem: RawModelItem = {
    id: localRuntime.model_id,
    platform_name: 'local',
    platform_display_name: '本地模型',
    model_type: 'llm',
    available: true,
    // 其它 RawModelItem 必填字段按 type 给默认值;如果有 reason / size 等可选,留空
  };
  return [localItem, ...models];
}, [models, localRuntime]);
```

把后面 `<ModelMenuList models={models} />` 改成 `<ModelMenuList models={modelsWithLocal} />`。

注:`RawModelItem` 完整字段视 `packages/api/src/modelPlatform.ts` 定义。如果有更多 required field,补齐默认 (e.g., `size_bytes: 0`, `runtime: 'llama.cpp'`, `format: 'gguf'`)。

- [ ] **Step 4: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

如果 typecheck 报 `RawModelItem` 缺字段,补齐再跑。Expected: 最终无错。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/features/composer/ComposerModelPill.tsx
git commit -m "feat(composer): runtime ready 时 Pill 注入「本地」分组合成模型"
```

---

### Task 13: 启动期自动 subscribe 本地 runtime (Shell 级)

**Files:**
- Modify: `chayuan-client/packages/app/src/Shell.tsx` (或最顶层 React 组件)

- [ ] **Step 1: 找 Shell.tsx**

```bash
ls chayuan-client/packages/app/src/Shell.tsx
```

如果 Shell.tsx 不存在,在 router 或 main entry 里挂。

- [ ] **Step 2: 看 Shell 现有 useEffect 钩子**

```bash
grep -n "useEffect\|use[A-Z]" chayuan-client/packages/app/src/Shell.tsx | head -20
```

- [ ] **Step 3: 加 polling 钩子(让 Composer 也能拿到本地状态,不仅设置页打开时)**

在 Shell 顶部 import:

```typescript
import { useLocalRuntimeStore } from './store/localRuntime';
```

在 Shell 函数体内加:

```typescript
// 全局 5s 轮询本地 runtime 状态,让 Composer 模型下拉能显示本地分组
React.useEffect(() => {
  const refresh = () => void useLocalRuntimeStore.getState().refreshStatus();
  refresh();
  const t = window.setInterval(refresh, 5_000);
  return () => window.clearInterval(t);
}, []);
```

注:跟 LocalRuntimePanel 的 polling 重复 — 但两个组件不可能同时 mount (panel 在设置对话框里),
且 store 是单例,合并写入幂等,无害。如果担心 idle 期没必要轮询,可改成只在
`platform.kind === 'tauri'` 时启用:

```typescript
React.useEffect(() => {
  const platform = getPlatform();
  if (platform.kind !== 'tauri') return;  // Web 端没本地 runtime,跳过
  // ... 同上
}, []);
```

`getPlatform` 来自 `@chayuan/platform-shared`,既有项目惯例。

- [ ] **Step 4: typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/app run typecheck
```

Expected: 无错。

- [ ] **Step 5: Commit**

```bash
cd /work/chayuan-desktop
git add chayuan-client/packages/app/src/Shell.tsx
git commit -m "feat(app): Shell 启动期轮询本地 runtime (tauri 桌面)"
```

---

### Task 14: 最终 typecheck + lint + 手测 + 总验证

**Files:** 无新文件。

- [ ] **Step 1: 全仓 typecheck**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm typecheck
```

Expected: 无错。如果有错且跟本 plan 改动相关,回到对应 task 修;不相关的旧问题原样忽略并在最终报告里如实说明。

- [ ] **Step 2: 跑全部新增单测**

```bash
cd /work/chayuan-desktop/chayuan-client
pnpm --filter @chayuan/api run test
pnpm --filter @chayuan/app run test
```

Expected: 至少包含本 plan 新增的 6 + 6 (+ 3) = 12-15 个新测试,全 pass。

- [ ] **Step 3: 手测核心路径**

1. 启动桌面 dev:`cd apps/desktop && pnpm dev` (或 workspace 顶层等价命令)。
2. 后端 sidecar 不跑:验证 Composer 下拉**不**显示「本地」分组,设置页本地 tab 显示降级提示。
3. 启动 chayuan-server sidecar (Plan 1 commit `a240516` 之后版本):
   - 设置页本地 tab 能看到 stopped 状态。
   - 点「启动」→ pending 后变 ready 或 failed (开发机大概率 failed,没真 llama-server.exe)。
4. 模拟 ready 状态:可以临时改 Shell 里 polling 钩子让它把假 status 灌进 store,确认 Composer 出现「本地」分组,首位排序。

- [ ] **Step 4: 报告剩余风险**

把以下信息写到最后一次 commit 的 PR description (如果用 PR 流程) 或贴回主线对话:
- 全 typecheck pass / fail 数。
- 新增单测数 + pass 数。
- 手测覆盖到的路径 + 没能覆盖到的(如真起 llama-server,需要 Windows 装机后才行)。

- [ ] **Step 5: Commit (空 / sprint 标记)**

无需 commit。Plan 2 完成。

---

## Sprint 3 + Sprint 4 完成标志

跑通后:

1. ✅ 桌面 app 启动后,Shell 每 5s 轮询 `/runtime/llama/status`(仅 tauri 平台)
2. ✅ 「设置 → AI 平台 → 本地模型」第 5 个 tab 可视;显示状态色块 + endpoint + pid + model_id + 启停按钮 + 配置表单 + 装机路径
3. ✅ host / port / api_key / expose_lan / preload_on_startup 5 个字段可改 + 保存 + 部分更新(空 patch 不发请求)
4. ✅ expose_lan + 空 api_key 时 UI 弹 LAN 风险警告
5. ✅ Composer 选模型下拉在 state=ready + model_id 非空时,顶部出现「本地模型」分组,内含合成 model 项
6. ✅ Web 平台(非 tauri)不发起 `/runtime/llama/*` 调用,设置页 tab 显示「仅集成版可用」降级
7. ✅ 全仓 `pnpm typecheck` 无新错;新增 ~12 个单测全 pass

**后续 (不在本 Plan):**
- Plan 3 = Sprint 5:E2E 装机测试 + ASR/Embedding/Rerank 多 runtime 扩展(参考 spec §6 路线图)。
- WPS 加载项(`chayuan` 仓库)同步集成:看产品方是否要在 WPS 任务窗格也露出本地模型选择 — 不在本 Plan。
