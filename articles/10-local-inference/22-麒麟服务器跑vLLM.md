# 国产化支持下的麒麟服务器跑 vLLM 的工程化清单

chayuan-desktop 桌面单机版接入麒麟服务器上跑的 vLLM 是政企常见场景。这一篇给工程化清单。

## 场景

部门买了麒麟服务器（鲲鹏 920 + 华为昇腾 910）跑 vLLM 推理服务。所有员工电脑装 chayuan-desktop 接入这台服务器。

服务器一处部署，多电脑共享算力。

## 服务器端清单

清单一：硬件确认。

CPU 鲲鹏 920 双路。

NPU 昇腾 910 4 卡或 8 卡（每卡 32GB HBM）。

内存 256GB 起。

存储 SSD 1TB+。

网卡 千兆以上。

清单二：操作系统。

银河麒麟 V10 SP3 服务器版。

或统信 UOS 服务器版。

或 openEuler 22.03 LTS。

清单三：基础软件。

Python 3.10+。

CANN 7.0+（华为昇腾推理框架）。

vLLM 0.5.x（适配昇腾的分支版本）。

PyTorch + torch-npu。

清单四：模型权重。

Qwen2.5-7B 或 Qwen2.5-72B 权重（FP16 或 INT8）。

模型路径配置。

启动 vLLM。

```bash
vllm serve /path/to/Qwen2.5-7B-Instruct \
  --tensor-parallel-size 4 \
  --port 8000 \
  --api-key secret-key \
  --gpu-memory-utilization 0.9
```

## 网络层清单

清单五：内网域名。

internal-ai.corp.com 解析到服务器 IP。

清单六：HTTPS 证书。

公司内部 CA 颁发。或自签证书让员工电脑信任。

清单七：防火墙。

只对内网开放 8000 端口。

外网严格禁止。

清单八：负载均衡（可选）。

如果多台服务器同时跑 vLLM。Nginx 或 HAProxy 做负载均衡。

## chayuan-desktop 端清单

清单九：员工电脑配置。

chayuan-desktop 设置 - 模型 - 添加自定义厂商。

```
name: 公司 vLLM
base_url: https://internal-ai.corp.com:8000/v1
api_key: secret-key
type: openai_compatible
```

清单十：HTTPS 证书信任。

如果是自签证书，把证书指纹填到 chayuan-desktop 信任列表。

清单十一：默认模型。

设 chat 默认为 Qwen2.5-7B（公司 vLLM）。

fallback 链可加本地 Ollama 兜底（万一 vLLM 挂）。

## 测试清单

测试一：连接测试。

chayuan-desktop 的 测试连接 按钮。检查 base_url、HTTPS、API Key、/v1/models。

测试二：模型列表。

chayuan-desktop 拉到 Qwen2.5-7B 等模型。

测试三：单次对话。

发个简单问题，验证回答正常返回。

测试四：流式。

试流式响应，看 token 是否流畅来。

测试五：tools 调用。

如果 vLLM 配了 tools 支持，测试工具调用。

测试六：RAG 集成。

prompt 含引用，看 vLLM 模型是否用引用回答。

## 监控清单

清单十二：vLLM 自带监控。

vLLM 暴露 /metrics 端点（Prometheus 格式）。可观测请求数、延迟、显存使用。

清单十三：chayuan-desktop 监控。

chayuan-desktop 设置 - 监控 看每个员工对 vLLM 的调用情况。

清单十四：审计日志。

服务器记录每个请求来源 IP、API Key 哈希、耗时、状态。便于合规审计。

## 性能预期

7B 模型 + 4 卡昇腾 910。

并发能力。约 30-50 用户同时在线流畅。

每秒 token。约 2000-4000（多用户聚合）。

首字延迟。0.3-0.8 秒。

72B 模型 + 8 卡。并发力略降但仍 20+ 用户。

## 故障应对清单

故障一：vLLM 挂。重启服务。chayuan-desktop fallback 链兜底。

故障二：硬件故障。换 NPU 卡或换服务器。员工电脑切到备份服务器（fallback 链配的）。

故障三：网络中断。chayuan-desktop 的本地 Ollama 模型当兜底。

故障四：模型升级。先停 vLLM，换权重，重启。chayuan-desktop fallback 期间走云模型或本地。

## 成本评估

服务器一次性投入。鲲鹏 920 + 昇腾 910 4 卡服务器。约 30-60 万。

电费。1500W 持续运行。每月电费约 1000-1500 元（按工业电价）。

运维。每月 1-2 人天。

对比云模型 OpenAI 多用户场景。每月 1-3 万 token 费用。半年回本。

## 国产化场景

党政军单位采购国产硬件 + 国产 OS + 国产模型 + chayuan-desktop 客户端。完整国产化栈。等保合规、自主可控。

## chayuan-server 的对应

chayuan-server 部署在 vLLM 之上做用户管理 + 知识库 + RAG。chayuan-desktop 可以经过 chayuan-server 也可以直连 vLLM。

## WPS 加载项

chayuan-wps 在 WPS 里走 chayuan-desktop 走公司 vLLM。员工写报告时本地+公司模型搭配。

## 总结

麒麟服务器跑 vLLM 的工程化清单是 chayuan-desktop 在企业级国产化部署的工程指南。免费开源的AI软件 让党政军单位能完整国产化部署。chayuan-desktop 的接入和监控让 国产 AI 服务 在工程上落地有路径。
