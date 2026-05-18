# 自定义 Shell 工具 给运维的快速接入

chayuan-desktop 桌面单机版支持自定义 Shell 工具。运维场景能快速接入。这一篇讲。

## 场景

运维想让 LLM 能。

查询服务器 CPU 负载。

重启某服务。

查看 Nginx 日志的最新错误。

部署应用到 K8s。

这些命令行工具天然适合 Shell 包装。

## 注册方式

chayuan-desktop 设置 - 工具 - 自定义 Shell 工具。

```yaml
- name: check_cpu_load
  description: 查询服务器 CPU 负载
  command: "uptime"
  parameters: []
- name: restart_nginx
  description: 重启 Nginx 服务
  command: "sudo systemctl restart nginx"
  parameters: []
  require_confirm: true
- name: tail_log
  description: 查看日志的最后 N 行
  command: "tail -n {lines} /var/log/nginx/error.log"
  parameters:
    - name: lines
      type: integer
      default: 50
```

简单声明命令和参数。

## 执行流程

LLM 决定调 tail_log(lines=100)。

chayuan-desktop。

第一。校验参数（lines 必须是整数）。

第二。如果 require_confirm 弹用户确认。

第三。把参数填进命令模板。tail -n 100 /var/log/nginx/error.log。

第四。在 shell 里执行命令。

第五。捕获 stdout / stderr / exit code。

第六。返回给 LLM。

## 安全：沙箱限制

Shell 命令权限大。chayuan-desktop 默认严格。

策略一：白名单命令。只允许配置里定义的工具能跑。LLM 不能调任意 shell。

策略二：参数注入防护。参数填入命令模板时严格转义。避免 注入攻击（user_input='; rm -rf /'）。

```python
# 不安全
cmd = f"tail -n {lines} /var/log/error.log"

# 安全
cmd = ["tail", "-n", str(lines), "/var/log/error.log"]
subprocess.run(cmd, shell=False)
```

策略三：require_confirm 默认。所有 shell 工具默认要求用户确认。除非用户明确加 auto_allow。

策略四：执行环境隔离。子进程运行权限继承当前用户但可以收紧。

## 输出截断

tail -n 1000 输出可能很大。chayuan-desktop 截断到 50KB 给 LLM。

```
[tail_log 输出，已截断到前 50KB]
```

避免 LLM 上下文爆掉。

## 失败处理

命令 exit code 非 0。chayuan-desktop 返回错误给 LLM。

```
{"exit_code": 1, "stderr": "Permission denied"}
```

LLM 看到能尝试其他方式（sudo？ 换路径？）。

## 跨平台

Shell 命令在不同 OS 行为不同。

uptime。Linux 和 Mac 能用。Windows 没有。

chayuan-desktop 在 Windows 用 PowerShell。

```yaml
- name: check_cpu_load
  command:
    linux: "uptime"
    mac: "uptime"
    windows: "Get-Counter '\\Processor(_Total)\\% Processor Time'"
```

按 OS 选命令。

## 团队共享 Shell 工具集

某团队写了 50 个运维 Shell 工具。

chayuan-desktop 工具集 YAML 文件。

```yaml
# corp_ops_tools.yaml
tools:
  - name: check_k8s_pods
    ...
  - name: deploy_app
    ...
```

发到内部仓库或员工各自电脑导入。

## 执行的可观测

每次 Shell 工具执行记审计。

```json
{
  "tool": "tail_log",
  "args": {"lines": 100},
  "command": "tail -n 100 /var/log/nginx/error.log",
  "exit_code": 0,
  "duration_ms": 234
}
```

便于排查。

## 国产化场景

党政军内网运维场景。chayuan-desktop 的 Shell 工具让运维 用 AI 跑命令。

某些等保场景对运维操作有详细审计要求。chayuan-desktop 的工具审计满足。

## chayuan-server 的对应

chayuan-server 多用户场景下 Shell 工具集中部署在专门运维机器。员工通过 chayuan-server 调用。chayuan-desktop 单机本地。

## WPS 加载项

chayuan-wps 一般不调 Shell 工具（WPS 里运维少）。但理论上能用。员工在 WPS 里问 服务器现在什么状态 能查。

## 总结

自定义 Shell 工具是 chayuan-desktop 给运维的快速 AI 接入能力。免费开源的AI软件 让 命令行工具 也能被 LLM 调用。chayuan-desktop 的白名单 + 参数注入防护 + 审计让 Shell 工具 在工程上安全可用。
