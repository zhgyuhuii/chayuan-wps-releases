# KbSourceStrip 引用源类型的展示

chayuan-wps 加载项的 KbSourceStrip 组件展示当前选中的 KB。这一篇讲。

## 组件位置

加载项主界面顶部。

```
[KbSourceStrip]
当前知识源: [doc:contracts] [office:zhangsan:meetings] [+]
```

可视化用户当前选了哪些 KB。

## 设计

水平条带。

每个 KB 一个 chip。

颜色编码（蓝橙紫绿）。

末尾 [+] 按钮添加 KB（调起 KbSelectorDialog）。

每个 chip 上有 X 移除该 KB。

## 紧凑展示

KB 名长时省略中间。

```
[doc:contracts...] 
[office:zhangsan...]
```

hover 看完整名。

## 多 KB 折叠

5 个以上 KB 时折叠。

```
[doc:contracts] [office:meetings] [+3 个] [+]
```

点 +3 个 展开看全部。

## 类型筛选

用户能在 KbSourceStrip 上筛选只看某种类型。

```
[全部] [文档] [私库] [向量] [结构化]
```

只显示选中类型的 chip。便于管理混合 KB。

## 状态指示

每个 chip 有状态指示。

绿点：KB 在线（chayuan-desktop 能访问）。

红点：KB 不可达（chayuan-desktop 没启动或 KB 损坏）。

黄点：KB 同步中（folder-sync 正在更新）。

## 引用反馈

某次回答用了某 KB 的 chunk。该 KB 的 chip 高亮。

```
[doc:contracts] (高亮 - 本次回答用过)
[office:meetings] (灰 - 本次未用)
```

让用户看到哪些 KB 在贡献。

## 编辑模式

长按 chip 进入编辑模式。

```
当前 KB:
  [✗ doc:contracts]
  [✗ office:meetings]
[完成]
```

✗ 移除。完成 退出编辑。

## 默认 KB 标识

某些 KB 是 默认 KB（用户配置的常用）。chip 上有 ⭐ 标识。

```
[⭐ doc:my_default]  ← 默认
[office:zhangsan]   ← 临时
```

## 跟当前文档的关联

如果 chayuan-wps 检测到当前 WPS 文档相关的 KB（基于路径 / 文档名）。chip 上加 智能推荐 标记。

```
[💡 doc:legal_templates]  ← 因当前文档是合同
```

让用户知道为什么这个 KB 出现。

## 国产化场景

党政军用户 WPS 写公文时 KbSourceStrip 让 当前查的资料范围 一目了然。

## chayuan-server 的对应

chayuan-server 模式下 KbSourceStrip 的逻辑一样。chayuan-wps 通用。

## 总结

KbSourceStrip 是 chayuan-wps 加载项的 UI 关键组件。免费开源的AI软件 让 用户对当前知识源 一目了然。chayuan-wps 的紧凑展示 + 颜色编码 + 状态指示 + 智能推荐让 KB 管理 在小空间内仍清晰。
