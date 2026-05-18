# MCP 工具与权限 不能让任何人都能调任何工具

chayuan-desktop 桌面单机版的 MCP 工具有权限控制。不是任何调用方都能调任何工具。这一篇讲。

## 权限的层次

层一：用户级。当前 chayuan-desktop 用户对工具的权限。

层二：应用级。本机其他应用通过 chayuan-desktop 网关调工具时的权限。

层三：远程级。如果 chayuan-desktop 暴露到局域网，远程用户的权限。

## 用户级权限

chayuan-desktop 的设置里能给每个工具配启用 / 禁用。

```yaml
mcp_tools:
  github_mcp:
    enabled: true
  slack_mcp:
    enabled: false  # 用户不想用
  internal_oa:
    enabled: true
```

禁用的工具 LLM 看不到（不在工具列表）。无法调用。

## 应用级权限

本机其他应用（chayuan-wps 加载项、第三方插件）通过 chayuan-desktop 网关调工具。

每个应用有自己的 API Key 和 scope。

```yaml
applications:
  chayuan-wps:
    allowed_tools: ["*"]  # 所有工具
  third_party_x:
    allowed_tools: ["web_search", "kb_search"]  # 只读类
    denied_tools: ["delete_file", "send_email"]
```

恶意应用就算拿到 chayuan-desktop API Key 也只能调允许的工具。

## 工具级粒度

某些工具有多个子操作。某些操作敏感。chayuan-desktop 支持工具级 + 操作级权限。

```yaml
github_mcp:
  list_repos: auto_allow
  get_repo: auto_allow
  create_repo: require_confirm
  delete_repo: deny
```

deny 的子工具 LLM 看不到。require_confirm 的执行前弹用户确认。

## 用户确认的体验

LLM 想调 require_confirm 的工具。chayuan-desktop UI 弹窗。

```
LLM 想调用：
  工具: github_mcp.create_repo
  参数: {"name": "test-repo", "private": true}

是否允许？
[允许此次] [总是允许此工具] [拒绝]
```

总是允许 后改成 auto_allow，下次不弹。

## 危险工具的特别保护

某些工具天然危险（删文件、发邮件、调用第三方 API 改数据）。chayuan-desktop 默认 require_confirm。

```yaml
default_policy:
  destructive_actions: require_confirm  # 删除、发送、写
  read_only_actions: auto_allow
```

工具描述里的关键词识别（delete、send、create、update 等）自动归类。

## 拒绝的处理

用户拒绝某次调用。chayuan-desktop 把拒绝消息返回给 LLM。

```
{"error": "user_denied", "message": "User declined this tool call"}
```

LLM 看到决定换别的方案或告诉用户不能做。

## 临时允许 vs 永久允许

某次允许是临时的。

```
[允许此次]：本次调用允许
[总是允许此工具]：以后该工具该子操作都自动允许
[本次会话]：本会话内允许，关闭会话后撤销
```

精细控制。

## 跟身份的绑定

如果 chayuan-desktop 多身份模式（多个 OS 账号或同进程多身份）。每个身份独立的工具权限配置。

```
zhangsan: github_mcp 启用
lisi: github_mcp 禁用（只能用 OA 工具）
```

## 国产化场景

党政军场景对工具调用严格限制。chayuan-desktop 的权限配置满足。

某些场景部门管理员配置员工电脑只能用某几个工具。chayuan-desktop 配置文件能由管理员预置（员工无法改）。

## chayuan-server 的对应

chayuan-server 多用户场景下工具权限是 RBAC 完整版。chayuan-desktop 单机是简化版。两者协议一致便于升级。

## WPS 加载项

chayuan-wps 在 WPS 里调工具按 chayuan-wps 应用的 scope 走。用户能精细配置 WPS 加载项能调哪些工具。

## 总结

MCP 工具与权限是 chayuan-desktop 在工具调用安全性上的工程关键。免费开源的AI软件 让 不是所有人都能调所有工具 在工程上落地。chayuan-desktop 的多层权限 + 用户确认 + 默认保护让 MCP 工具 安全可控。
