# MCP 协议的安全模型 对沙箱的要求

chayuan-desktop 桌面单机版对 MCP 工具沙箱有明确要求。这一篇讲。

## 沙箱的概念

沙箱（sandbox）。给程序限制权限的执行环境。

文件访问限制。

网络访问限制。

系统调用限制。

资源限制。

## 为什么需要沙箱

MCP 工具是第三方代码。chayuan-desktop 不知道工具内部干啥。如果工具有 bug 或恶意代码，可能。

读取用户文件。

发送数据到外部。

破坏系统。

沙箱限制工具能干啥范围。

## chayuan-desktop 的沙箱实现

操作系统级沙箱。

Linux：unshare + cgroups。命名空间隔离。

macOS：sandbox-exec。Apple 自家沙箱。

Windows：Job Object + AppContainer。

chayuan-desktop 启动 mcp 子进程时套上沙箱。

## 沙箱的具体限制

文件访问。

工具默认只能读写自己的工作目录（~/.chayuan/mcp_data/<tool_name>/）。

不能访问用户其他文件（除非 chayuan-desktop 显式授权）。

某些工具确实需要访问用户文件（如 filesystem-mcp）。chayuan-desktop 让用户配置允许访问的目录白名单。

网络访问。

某些工具需要联网（如 github-mcp）。chayuan-desktop 配置允许的域名白名单。

```yaml
github_mcp:
  network_allowed: ["api.github.com"]
slack_mcp:
  network_allowed: ["slack.com", "*.slack.com"]
```

工具尝试访问白名单外的域名被拒绝。

系统调用限制。

某些危险系统调用（fork bomb、kernel module load）被禁止。

资源限制。

CPU、内存、文件描述符。前面文章讲过。

## 沙箱的边界

某些操作沙箱阻挡不了。

通过授权 API 发数据（用户已授权 GitHub Token，工具用这个 Token 发数据到 GitHub）。

通过 stdout 输出长内容（chayuan-desktop 收到后可能 LLM 把内容传到云端）。

每个层都有自己的考虑。

## 用户警示

某 mcp 工具请求宽松权限。

```
github-mcp 请求：
  ✓ 网络访问: api.github.com, github.com
  ✓ 环境变量: GITHUB_TOKEN
  ✓ 文件访问: 读取 ~/.gitconfig

是否允许？
[允许] [拒绝]
```

让用户对工具能做什么知情。

## 工具的能力声明

MCP 协议有 capabilities 字段。工具声明自己需要的能力。

```json
{
  "name": "github_mcp",
  "capabilities": {
    "network": ["api.github.com"],
    "env": ["GITHUB_TOKEN"],
    "filesystem": ["~/.gitconfig"]
  }
}
```

chayuan-desktop 按声明配沙箱。如果工具实际尝试超声明的访问，沙箱拦截并记录。

## 信任级别

chayuan-desktop 给工具分级。

trusted。官方维护或经审核。沙箱较宽松。

community。社区维护。沙箱默认。

unknown。用户自定义未审核。沙箱严格。

untrusted。未签名或已知恶意。禁止运行。

用户在 UI 看到工具的信任级别。

## 沙箱的代价

性能损耗。沙箱大概增加 5-10% 的进程启动时间。运行时影响小。

兼容性。某些 mcp 工具实现不规范，沙箱可能阻挡其正常工作。chayuan-desktop 的兼容模式能放宽特定工具。

## 国产化场景

党政军场景对工具沙箱要求严格。chayuan-desktop 的沙箱满足等保对应用隔离的要求。

某些场景需要更强沙箱（容器或 VM 级）。chayuan-desktop 路线图考虑 Docker 隔离 mcp 工具的支持。

## chayuan-server 的对应

chayuan-server 多用户场景下沙箱更严格（多用户共享服务器，相互隔离）。chayuan-desktop 单机沙箱是基础版。

## WPS 加载项

chayuan-wps 在 WPS 里调 mcp 工具走 chayuan-desktop 沙箱。WPS 不直接接触工具。安全。

## 总结

MCP 协议的安全模型靠 chayuan-desktop 的沙箱落地。免费开源的AI软件 让 第三方工具 不破坏用户系统。chayuan-desktop 的 OS 级沙箱 + 能力声明 + 信任级别 + 用户警示让 MCP 在桌面安全可用。
