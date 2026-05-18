# 让 Claude 跑 e2e 用 Playwright 桥接桌面端

chayuan-desktop 桌面单机版的 e2e 测试用 Playwright + Claude 协作。这一篇讲。

## e2e 测试的需求

UI 自动化测试。

模拟用户启动 chayuan-desktop。

模拟用户点按钮 / 输入。

验证 UI 显示。

验证后端响应。

某些 bug 只在 e2e 才暴露。

## Playwright 跨平台

Playwright 是 Microsoft 开源 UI 自动化。支持 Chromium / WebKit / Firefox。

chayuan-desktop 的 Tauri 内嵌 WebView。Playwright 能控制。

```js
import { test } from '@playwright/test';

test('启动并发起首次对话', async ({ page }) => {
  await page.goto('http://localhost:62581');
  await page.fill('[data-testid="chat-input"]', '你好');
  await page.click('[data-testid="send-button"]');
  await expect(page.locator('[data-testid="response"]')).toContainText('你好');
});
```

## Claude 写测试用例

Claude 帮写 e2e 测试。

提示。

```
为 chayuan-desktop 的 KB 选择器写 e2e 测试。覆盖：
- 打开 KbSelectorDialog
- 搜索 KB
- 多选
- 确认应用
- 验证 KbSourceStrip 更新
```

Claude 输出完整测试代码。

## 数据准备

测试需要预制数据。

KB 已存在。

模型已配。

某些聊天历史。

Claude 帮写 setup 脚本。

```js
test.beforeEach(async ({ page }) => {
  await setupTestKB();
  await page.goto('...');
});
```

## 跨平台测试

Linux / macOS / Windows 上分别跑。

CI 矩阵。

```yaml
matrix:
  os: [ubuntu-latest, macos-latest, windows-latest]
```

发现平台差异（某 OS 上 UI 元素位置略不同）。Claude 帮调试。

## 视觉回归

Playwright 支持截图对比。chayuan-desktop 的 UI 改动可能引入视觉回归。

```js
await expect(page).toHaveScreenshot('home.png');
```

之前的 UI 截图作为基线。变化时 CI 提示。

## 性能测试

某些场景测响应延迟。

```js
const start = Date.now();
await sendMessage('hi');
const duration = Date.now() - start;
expect(duration).toBeLessThan(2000);  // 2 秒内出回答
```

## 失败诊断

测试失败时。

Playwright 自动截图。

Claude 看截图 + 测试代码后给诊断。

```
看截图 chat-input 元素不可见。可能是。
- 选择器变了
- UI 滚动了
- 加载未完成
建议：等待 page.waitForSelector 后再操作。
```

## chayuan-wps 的 e2e

chayuan-wps 在 WPS 里。Playwright 不直接控制 WPS。需要 WPS 自家自动化。

WPS 提供 COM API（Windows）或 AppleScript（macOS）。

测试。开 WPS → 装加载项 → 模拟用户。

## 国产化场景

党政军开发 chayuan-desktop 类项目。Playwright 跨平台 e2e 同样适用。

## chayuan-server 的对应

chayuan-server 是后端服务。e2e 走 API 测（Postman 类）+ 前端独立 e2e。chayuan-desktop 的桌面 UI e2e 不直接复用。

## 总结

让 Claude 跑 e2e 用 Playwright 是 chayuan-desktop 在质量保证上的工程实践。免费开源的AI软件 让 e2e 测试 跟工程师协作高效产出。Claude 的写测试 + 跨平台 + 视觉回归 + 失败诊断让 e2e 全面可靠。
