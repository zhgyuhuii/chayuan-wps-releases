# MCP 工具的鉴权 stdio 模式下的进程隔离

chayuan-desktop 桌面单机版的 MCP stdio 模式天然进程隔离做鉴权。这一篇讲。

## stdio 模式的特点

MCP 工具以子进程方式运行。chayuan-desktop 通过 stdin/stdout 跟它通信。

子进程是独立 OS 进程。OS 级隔离。

进程的权限继承父进程（chayuan-desktop）。

## 鉴权的几个层次

层一：OS 级。子进程跑在跟 chayuan-desktop 相同的用户身份。能访问该用户能访问的文件。

层二：环境变量。chayuan-desktop 启动子进程时通过环境变量传 token / API key 给工具。

层三：MCP 协议初始化。子进程启动后，第一个 message 是 initialize，含能力声明。chayuan-desktop 校验能力是否符合预期。

## 进程隔离的好处

好处一：崩溃不影响主程。MCP 工具崩了 chayuan-desktop 还活着。重启工具即可。

好处二：资源限制。chayuan-desktop 能限制子进程的 CPU、内存、文件描述符。

好处三：权限收紧。某些 MCP 工具不需要全部用户权限。chayuan-desktop 用 OS 沙箱（macOS sandbox-exec、Linux unshare）启动收紧权限。

## token 注入

chayuan-desktop 给 MCP 工具传敏感信息走环境变量。

```
chayuan-desktop 启动子进程：
  env: 
    GITHUB_TOKEN=ghp_xxx  # 用户配置的
    SLACK_TOKEN=xoxb_xxx
```

工具读环境变量用。

## token 不入磁盘

token 在环境变量传递。不写到子进程的命令行参数（避免 ps 命令看到）。不写到日志。

子进程结束环境变量销毁。

## stdio 通信的安全

stdin/stdout 是匿名管道，OS 级别保证只在父子进程间。其他进程窃听不到。

不需要 TLS 等加密（OS 已经隔离）。

## 工具调用前的二次确认

某些工具有副作用（写文件、发邮件、调 API 删数据）。chayuan-desktop 在执行前弹用户确认。

```
LLM 想调用 delete_repo(repo="...") 工具。
是否允许？
[允许] [拒绝] [总是允许此工具]
```

避免 LLM 误操作或被 prompt injection 攻击。

## 黑名单白名单

chayuan-desktop 配置里能给每个 MCP 工具配执行策略。

```yaml
mcp_tools:
  github_mcp:
    auto_allow: [list_repos, get_repo]  # 只读自动允许
    require_confirm: [create_repo, delete_repo]  # 写操作要确认
```

用户能精细控制。

## 国产化场景

党政军场景对工具权限严格。chayuan-desktop 的进程隔离 + 用户确认 + 黑白名单符合等保要求。审计日志记录每次工具调用。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 工具鉴权更复杂（每个用户独立 token）。chayuan-desktop 单机简化。

## WPS 加载项

chayuan-wps 在 WPS 里调 chayuan-desktop 的 MCP 工具走相同鉴权路径。WPS 用户对工具调用感知一致。

## 总结

MCP 工具的鉴权在 stdio 模式下靠 OS 进程隔离 + 环境变量 + 用户确认三层。chayuan-desktop 让 工具调用安全 不需要复杂协议。免费开源的AI软件 让 MCP 在桌面安全可用。
