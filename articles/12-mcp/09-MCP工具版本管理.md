# MCP 工具的版本管理 升级时不破坏调用

chayuan-desktop 桌面单机版的 MCP 工具有版本管理。升级时不破坏现有调用。这一篇讲。

## 版本管理的必要性

社区 MCP 工具持续迭代。github-mcp-server 从 v0.1 到 v1.0。

工具的接口可能变（参数名、返回结构）。LLM 基于旧版本接口生成调用，新版本可能解析失败。

需要版本管理。

## 版本字段

每个 MCP 工具的元数据含 version。

```json
{
  "name": "github_mcp",
  "version": "1.2.3",
  "tools": [...]
}
```

chayuan-desktop 启动时拉。

## 接口兼容性

MCP 工具升级时尽量保持接口向后兼容。

新加参数。可选参数。旧调用仍能工作。

新加返回字段。LLM 看到额外字段不影响。

不破坏现有参数语义。

某些工具可能 breaking change。chayuan-desktop 的版本约束帮助。

## chayuan-desktop 的版本锁定

某些场景用户希望锁定特定版本。

配置里写。

```yaml
mcp_servers:
  github_mcp:
    command: "npx github-mcp-server@1.2.3"
    auto_update: false
```

锁定 1.2.3。即使有新版也不升级。

## 自动升级

默认开启自动升级（minor 版本）。

1.2.3 → 1.3.0：自动。

1.x.x → 2.0.0：major 版本不自动（可能 breaking change）。

用户手动确认。

## 升级前校验

chayuan-desktop 升级 MCP 工具前。

跑工具的 list_tools 接口。检查工具列表跟上一版是否一致。

如果工具被删或重命名，提示用户。

如果只是新加工具，无影响。

## 升级失败回滚

升级到新版本启动失败（依赖问题、bug）。chayuan-desktop 自动回滚到上一版。

用户日志里看到 工具升级失败已回滚。

## 多个 MCP 工具的统一升级

用户装了 5 个 MCP 工具。chayuan-desktop 设置 - MCP - 检查更新 一键检查所有工具的新版。

```
github_mcp: 1.2.3 → 1.3.0 [可升级]
slack_mcp: 0.5.1 → 1.0.0 [major 版本，需确认]
jira_mcp: 2.0.0 → 2.0.0 [最新]
```

## 工具的卸载

用户不再需要某 MCP 工具。chayuan-desktop 设置里能卸载。

卸载只是不再启动该工具，配置保留（便于将来恢复）。

完全删除走 删除配置 二级操作。

## 工具的导出导入

chayuan-desktop 能导出 MCP 工具配置。换电脑或备份用。

```
~/.chayuan/mcp_config.json 导出
```

导入时其他机器能复用。

## 国产化场景

党政军内网部署。MCP 工具升级走内网镜像。chayuan-desktop 配置内网 npm 源或 binary 镜像，不走外网。

某些场景升级前需要走变更管理流程。chayuan-desktop 的升级提示能输出变更说明文档帮助审批。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 工具版本由管理员统一管理。chayuan-desktop 单机用户级。

## WPS 加载项

chayuan-wps 调 chayuan-desktop 的 MCP 工具。版本管理对 WPS 透明。WPS 用户感知就是 工具一致工作。

## 总结

MCP 工具的版本管理是 chayuan-desktop 在生态长期维护上的工程支持。免费开源的AI软件 让 工具迭代 不打断用户。chayuan-desktop 的版本锁定 + 自动升级 + 失败回滚 + 统一管理让 工具升级 在工程上稳。
