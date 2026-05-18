# Ollama 端口冲突的处理 多服务共存

chayuan-desktop 桌面单机版集成 Ollama。但 Ollama 默认端口 11434 可能跟用户已有 Ollama 实例冲突。这一篇讲处理。

## 端口冲突的场景

场景一。用户已经手动装了 Ollama 在跑。端口 11434 被占用。chayuan-desktop 自带的 Ollama 启动失败。

场景二。某个其他 AI 工具（LM Studio、AnythingLLM）占了 11434。

场景三。陈年僵尸进程没清理。

## chayuan-desktop 的策略

chayuan-desktop 启动时检测 11434 是否被占用。

被占用 + 是 Ollama。chayuan-desktop 直接用现有 Ollama 实例。不重新启动一个。

被占用 + 不是 Ollama。chayuan-desktop 自带 Ollama 启动到备用端口（11435），并提示用户。

未被占用。chayuan-desktop 启动自己的 Ollama 在 11434。

## 检测方法

第一步。HTTP GET http://127.0.0.1:11434/api/tags。

第二步。如果返回 200 + 含 ollama header → 是 Ollama 实例。chayuan-desktop 复用。

第三步。如果返回别的（404、500、不是 Ollama 协议）→ 端口被其他东西占。

第四步。如果连接失败 → 端口空闲。

## 复用现有 Ollama

如果用户已装 Ollama 跑着且有自己模型。chayuan-desktop 不重复下载模型。直接用。

```
chayuan-desktop 启动日志：
  [ollama] detected existing Ollama at 127.0.0.1:11434
  [ollama] models found: qwen2.5:7b, llama3.1:8b, qwen2.5:1.8b
  [ollama] reusing existing instance
```

## 备用端口

某些极端情况 chayuan-desktop 自带 Ollama 启动到 11435。配置里记录端口。

```yaml
ollama:
  base_url: http://127.0.0.1:11435
  managed_by: chayuan-desktop
```

模型选择器里 Ollama 模型仍可见。

## 用户手动配置

设置 - 模型 - Ollama。让用户填自定义。

```
ollama:
  base_url: http://192.168.1.100:11434  # 局域网另一台机器的 Ollama
```

适合家里有专门跑 Ollama 的服务器，笔记本只是客户端。

## Ollama 实例的健康检查

chayuan-desktop 每 60 秒探测 Ollama。

挂掉。chayuan-desktop 弹提示 Ollama 已停止响应。如果是 chayuan-desktop 启动的实例，自动重启。如果是用户手动的，告诉用户去检查。

## 关闭 chayuan-desktop 时的处理

chayuan-desktop 退出时。

如果 Ollama 是 chayuan-desktop 启动的。chayuan-desktop 也停止 Ollama（清理）。

如果 Ollama 是用户原本就跑的。chayuan-desktop 不动它。

避免误关用户其他工作。

## 模型源同步

chayuan-desktop 跟 Ollama 共享模型。

用户在 Ollama 自己的命令行 `ollama pull qwen2.5:14b`。chayuan-desktop 几秒后自动看到这个新模型。

用户在 chayuan-desktop UI 点 下载模型 也是调 Ollama API 拉。Ollama 自己也能看到。

互不干扰。

## 多 Ollama 实例

某些场景用户跑多个 Ollama（比如不同账户隔离）。chayuan-desktop 配置里能加多个 Ollama 厂商。

```yaml
- name: Ollama-本地
  base_url: http://127.0.0.1:11434
- name: Ollama-家用服务器
  base_url: http://192.168.1.100:11434
- name: Ollama-外部 GPU 工作站
  base_url: http://10.0.0.5:11434
```

用户能选不同 Ollama 跑模型。

## 国产化场景

党政军单机部署一台机器一个 Ollama。chayuan-desktop 自带 Ollama 后用户感觉是 装了 chayuan-desktop 自动有 Ollama。透明。

某些场景部门有专门跑模型的服务器。员工电脑装 chayuan-desktop 配上游 Ollama。

## chayuan-server 的对应

chayuan-server 通常自己跑模型服务（vLLM 或自家），不依赖 Ollama。chayuan-desktop 单机以 Ollama 为主。

## WPS 加载项

chayuan-wps 在 WPS 里发起调用走 chayuan-desktop。chayuan-desktop 内部用哪个 Ollama 透明对 WPS。

## 总结

Ollama 端口冲突的处理是 chayuan-desktop 在 多服务共存 场景的工程细节。免费开源的AI软件 跟其他工具和谐共处不打架。chayuan-desktop 的 检测复用 / 备用端口 / 用户配置 三层让 Ollama 集成 在所有场景下都不出问题。
