# 自检 chayuan doctor 自检

chayuan-desktop 桌面单机版的自检命令 chayuan doctor。这一篇讲。

## chayuan doctor 是什么

类似 brew doctor、git doctor。健康自检命令。

```bash
chayuan-desktop doctor
```

或在 chayuan-desktop UI 设置 - 自检 一键运行。

输出系统状态报告。

## 自检的项目

类别一：环境。

OS 版本。

CPU 架构。

可用内存。

可用磁盘。

类别二：依赖。

Python 运行时（sidecar 用）。

Node.js 可选（mcp 用）。

CUDA / Metal（GPU 加速）。

类别三：模型。

主嵌入模型（bge-m3）。

主 LLM 模型（Qwen-7B 或 Ollama）。

主重排模型（bce-reranker）。

OCR / ASR / TTS。

每个模型 SHA256 校验。

类别四：服务。

chayuan-desktop 主进程。

Python sidecar 进程。

Ollama 进程（如果有）。

类别五：网络。

127.0.0.1:62581 端口可用。

外网可达性（如果联网模式）。

类别六：配置。

主密码已设。

KB 已创建。

API Key 已配（如果联网）。

类别七：安全。

数据目录加密。

审计日志可写。

签名校验。

类别八：合规。

等保配置。

数据保留期。

每项有 [✓] / [⚠] / [✗] 状态。

## 报告输出

```
chayuan-desktop doctor 报告
========================

[✓] OS：Ubuntu 22.04
[✓] CPU：x86_64 i7-13700H
[✓] 可用内存：12 GB（足够）
[⚠] 可用磁盘：18 GB（建议 50 GB+）
[✓] Python sidecar：正常
[✓] Ollama：未安装（可选）
[✓] CUDA：12.4
[✓] 主嵌入模型：bge-m3-onnx-q8 (200MB)
[✓] 主 LLM：ollama:qwen2.5:7b
[✓] 主进程：正常运行 PID 12345
[✓] 端口 62581：可用
[✓] 外网：可达
[✓] 主密码：已设
[✓] 5 个 KB 已配置
[✓] 数据目录加密：是
[✓] 审计日志：30 天保留
[⚠] 备份：未配置远程备份

整体健康度：92/100
建议：
  - 配置远程备份
  - 释放磁盘空间
```

## 异常处理

某项 [✗]。chayuan-desktop 提供修复建议。

```
[✗] Python sidecar 无响应
  原因：Python 进程异常退出
  建议：[重启 sidecar]
  或：查看 ~/.chayuan/logs/sidecar.log

[修复] [详情] [跳过]
```

某些自动修复（重启服务）。某些手动。

## 持续监控

chayuan-desktop 后台定期跑（每小时）轻量自检。发现问题主动通知。

```
[chayuan-desktop 通知]
检测到问题：
- 磁盘空间不足
[查看详情]
```

让用户及时知情。

## 报告导出

doctor 报告能导出 JSON。便于发给开发者排查。

```bash
chayuan-desktop doctor --export-json > report.json
```

包含完整信息（脱敏后）。

## 国产化场景

党政军场景对系统健康监控有要求。chayuan-desktop 的 doctor 满足。

某些场景定期发健康报告给运维。chayuan-desktop 支持定时运行 doctor + 报告导出。

## chayuan-server 的对应

chayuan-server 有更完整的健康监控（多组件多用户）。chayuan-desktop 单机简化。

## WPS 加载项

chayuan-wps 也有自家自检。chayuan-desktop doctor 检查 chayuan-wps 是否在 WPS 里正确加载。

## 总结

chayuan doctor 自检是 chayuan-desktop 在工程可维护性上的工具。免费开源的AI软件 让 用户能自己排查 而不必每次找 IT。chayuan-desktop 的多类别检查 + 修复建议 + 持续监控让系统健康可观察。
