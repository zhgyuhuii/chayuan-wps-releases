# KbSelectorDialog 的设计 WPS 里挑库的 UX

chayuan-wps 加载项的 KbSelectorDialog（KB 选择对话框）的 UX 设计。这一篇讲。

## 场景

WPS 加载项侧栏空间小（约 320px 宽）。挑 KB 不能像桌面端那样大列表。

需要紧凑高效的 UX。

## 布局

```
[KbSelectorDialog]
┌─────────────────────────┐
│ 选择知识源              │
│ [搜索框]                │
│ 最近使用：              │
│ [✓] doc:contracts      │
│ [✓] office:zhangsan:meetings │
│ ─────────────────────  │
│ 全部知识源：            │
│ [+] 文档库 (5)         │
│ [+] 私库 (3)           │
│ [+] 外部向量 (2)       │
│ [+] 结构化 (4)         │
│                        │
│ [确定]                 │
└─────────────────────────┘
```

紧凑设计。

## 常用的优先

最近使用的 KB 置顶。让常用快速选。

```
最近使用：
[✓] doc:contracts (3 小时前用过)
[✓] office:zhangsan:meetings (今天)
[ ] doc:hr_policies (昨天)
```

用户大多重复用同一组 KB。

## 分类折叠

按 KB 类型分组。文档 / 私库 / 外部向量 / 结构化。

折叠状态。点击 [+] 展开。

```
[+] 文档库 (5)
[+] 私库 (3)
```

避免一次列出几十个让用户晕。

## 搜索

KB 多时搜索。

```
[搜索框：输入名字]
```

按 KB 名 / 描述实时过滤。

## 默认选中

加载项启动时记住上次选中。直接显示已勾上。

无需每次重选。

## 快速预设

某些用户常用相同组合。chayuan-wps 支持预设。

```
预设：
  [合同审查] doc:contracts + office:legal:templates
  [产品研发] doc:tech_docs + src:codebase
  [财务分析] structured:erp + doc:finance
```

一键切预设。

## 颜色编码

跟 chayuan-desktop 一致。

蓝色：doc:*。

紫色：src:*。

橙色：office:*。

绿色：structured:*（如果是 SQL 类）。

视觉识别。

## 权限过滤

用户对某 KB 无权限的不显示。chayuan-wps 调 chayuan-desktop API 时按身份过滤。

## 确认按钮

用户选好后点 确定。返回主界面。

加载项记住选择。本次会话所有问题都用这组 KB。

切换 KB 时用户能在主界面顶部看到 当前 KB 列表，点修改重新打开 KbSelectorDialog。

## 大屏适配

某些用户用宽屏 WPS。加载项侧栏可以拉宽。

KbSelectorDialog 自适应宽度。

## 高对比度

KbSelectorDialog 支持深色主题。跟 WPS 主题协调。

## 加载状态

打开 KbSelectorDialog 时如果还在拉 KB 列表（chayuan-desktop 启动慢）。显示加载占位。

```
[加载中...]
```

不让用户面对空白屏。

## 错误处理

chayuan-desktop 不可达。

```
[无法连接 chayuan-desktop]
请确认 chayuan-desktop 已启动。
[重试]
```

## 国产化场景

WPS 加载项是党政军用户日常用的。KbSelectorDialog 的中文 UX 是基础。

## chayuan-server 的对应

chayuan-server 多用户场景下 KB 列表更长。KbSelectorDialog 的搜索 + 分类设计同样重要。

## 总结

KbSelectorDialog 是 chayuan-wps 在 WPS 内挑 KB 的 UX 核心。免费开源的AI软件 让 选 KB 在小空间内仍流畅。chayuan-wps 的常用置顶 + 分类 + 搜索 + 预设让 WPS 用户挑 KB 高效。
