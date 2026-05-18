# 同一份 KB 在桌面与 WPS 之间共用

chayuan-wps 加载项跟 chayuan-desktop 共用同一套 KB。这一篇讲。

## 共用的核心

KB 数据存在 chayuan-desktop 后端（127.0.0.1:62581）。

桌面 chayuan-desktop UI 用这些 KB。

WPS 加载项 chayuan-wps 也用这些 KB。

无需重复存储 / 同步。

## 实现机制

chayuan-desktop 暴露 KB 检索 API（OpenAI 兼容 + 自定义扩展）。

chayuan-wps 通过 HTTP API 调用 chayuan-desktop。

```
POST http://127.0.0.1:62581/api/v1/kb/search
{
  "query": "...",
  "ku_ids": ["doc:contracts", "office:zhangsan:notes"]
}
```

返回 chunk + 引用信息。

## KB 列表的同步

chayuan-wps 启动时调 chayuan-desktop 拉 KB 列表。

```
GET http://127.0.0.1:62581/api/v1/kb/list
```

显示在 KbSelectorDialog 让用户选。

新建 KB 在 chayuan-desktop UI 完成。chayuan-wps 自动看到新 KB（重启或定时刷新）。

## 引用的一致性

桌面端和 WPS 看到的引用气泡一致。

颜色编码相同。

来源信息相同。

跳转行为相同（在 WPS 内跳 WPS 文档，在桌面跳桌面应用）。

## 检索结果的差异

桌面端用户和 WPS 用户问同问题。

理论上结果一致（同 KB、同检索逻辑）。

实际可能差异。

桌面端可能勾选了更多 KB。

WPS 可能只默认勾当前文档相关的 KB。

每个用户能自己选 KB 范围。

## 权限的共用

某用户对 office:lisi:* KB 无权限。

桌面端不显示这个 KB。

WPS 加载项也不显示。

权限统一管理。chayuan-desktop 后端是单一权威。

## 多账号

某些场景一台电脑多 OS 账号。每个账号自己的 chayuan-desktop。

chayuan-wps 在 WPS 里。WPS 用当前 OS 账号身份。chayuan-wps 也用这个身份。

跟当前 chayuan-desktop（同账号）共用 KB。

不同账号的 chayuan-desktop 实例 + chayuan-wps 实例独立工作。

## 离线支持

chayuan-desktop 离线时（前面文章讲）。chayuan-wps 也跟着离线。

加载项 UI 显示离线状态。

```
[离线模式]
当前能用：本地 KB、本地 LLM。
不可用：联网工具。
```

## 性能

WPS 用户提问 → chayuan-wps → chayuan-desktop → KB 检索 → 返回。

延迟主要在 chayuan-desktop（检索 + LLM）。chayuan-wps 跟 chayuan-desktop 通信走 127.0.0.1，几毫秒延迟。

总体跟桌面端体验一致。

## chayuan-server 模式

某些场景 chayuan-wps 不连本地 chayuan-desktop，而连远程 chayuan-server。

```
chayuan-wps 配置：
  backend_url: https://chayuan-server.corp.com
```

KB 在 chayuan-server。chayuan-wps 跟 chayuan-server 通信。

某些政企部署是这种（chayuan-server 集中，chayuan-desktop 不必装）。

## 共用 vs 独立

chayuan-wps 跟 chayuan-desktop 共用（默认）。

某些场景独立。比如某员工只用 chayuan-wps（不装 chayuan-desktop）。

这种独立场景 chayuan-wps 直连云模型，无 KB（或自己维护 mini KB）。功能受限。

主流仍是共用。

## 国产化场景

党政军场景 chayuan-desktop + chayuan-wps 同时部署是标准。同一份 KB 在桌面和 WPS 间共享是采购需求。

## chayuan-server 的对应

chayuan-server 多用户场景下 KB 集中。chayuan-desktop 和 chayuan-wps 都连 chayuan-server。多端共用更彻底。

## 总结

同一份 KB 在桌面与 WPS 之间共用是 chayuan-desktop + chayuan-wps 的核心架构。免费开源的AI软件 让 KB 不分客户端。chayuan-desktop 的统一后端 + chayuan-wps 的客户端协同让数据真正一份多用。
