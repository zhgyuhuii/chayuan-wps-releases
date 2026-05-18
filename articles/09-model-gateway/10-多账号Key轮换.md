# 多账号切换 同厂商多 Key 的轮换策略

chayuan-desktop 桌面单机版的模型网关支持同一厂商多个 Key 的轮换调度。这一篇讲为什么和怎么做。

## 多 Key 的场景

场景一。OpenAI 早期账号 RPM 500 不够用。再注册一个账号拿到 RPM 500，两个 Key 共用 RPM 1000。

场景二。一个 Key 是公司报销账号（贵但管制），一个是个人测试账号（便宜但不报销）。日常用便宜的，重要任务切到公司账号。

场景三。一个 Key 配额已超，另一个没超，自动切换继续用。

场景四。多人共用一台电脑（比如开发机），每个人用自己的 Key。

## chayuan-desktop 的多 Key 配置

设置 - 模型 - openai。

```
keys:
  - name: 主用账号
    key: sk-aaa
    rpm: 500
    monthly_budget: 100
    tags: [production]
  - name: 测试账号
    key: sk-bbb
    rpm: 500
    monthly_budget: 20
    tags: [dev]
```

多 Key 各有独立的 RPM、预算、标签。

## 轮换策略

策略一：轮询。请求依次走每个 Key。简单平均分布。

策略二：加权。按 RPM 配额加权。RPM 大的 Key 处理更多请求。

策略三：故障切换。主 Key 优先。失败时切到副 Key。

策略四：标签路由。chat 类请求走 production 标签的 Key，experimental 请求走 dev 标签。

chayuan-desktop 默认 加权 + 故障切换 混合策略。

## 配额维护

每个 Key 有独立的令牌桶（参考前一篇限速文章）。请求选 Key 时优先选当前可用配额最多的。

预算超限的 Key 自动暂停使用，不参与轮换。

## Key 的健康检查

chayuan-desktop 每隔 1 小时给每个 Key 跑一次轻量探测（GET /v1/models）。

成功 → Key 正常，参与轮换。

401 → Key 失效（被吊销或填错），从轮换池剔除，UI 标红提示用户。

429 → Key 被限速，暂时降权（按降级策略）。

5xx → 厂商问题，不影响 Key 状态。

## 失败重试

请求用 Key A 失败。chayuan-desktop 自动用 Key B 重试。如果 Key B 也失败，再 Key C。

最多重试次数限制 3 次。避免无限重试。

## Key 的安全存储

Key 是敏感信息。chayuan-desktop 用 Tauri Stronghold（基于 ChaCha20-Poly1305）加密存储。

启动 chayuan-desktop 时用户输 master password 解锁 keystore。Key 不以明文落盘。

某些场景（自动启动、CI 环境）支持禁用主密码，Key 用机器密钥加密。安全性稍低但便利。

## 多 Key 的可视化

chayuan-desktop 设置 - 模型 - 多 Key 状态。

```
openai:
  Key 主用账号 [启用] RPM:485/500 预算:¥45/¥100
  Key 测试账号 [启用] RPM:120/500 预算:¥8/¥20
```

让用户看到每个 Key 的使用情况。

## 多个厂商各自的多 Key

chayuan-desktop 支持每个厂商独立的多 Key。OpenAI 多 Key、智谱多 Key 等。各自不影响。

## 国产化场景

政企采购国产 API 也常配多 Key。比如同一公司在通义云买了多个项目的 Key（项目 A 和项目 B 各自计费）。chayuan-desktop 的多 Key 让员工切换项目方便。

## chayuan-server 的对应

chayuan-server 多用户场景下多 Key 是企业级管理的核心能力。chayuan-desktop 单机版简化版本。

## WPS 加载项

chayuan-wps 在 WPS 里调用走 chayuan-desktop 网关，多 Key 透明。WPS 不感知用了哪个 Key。

## 总结

多 Key 轮换是 chayuan-desktop 在工程性能和成本管理上的实用功能。免费开源的AI软件 让用户能并行使用多 Key 突破单 Key 配额限制。chayuan-desktop 的 Key 健康检查 + 加密存储 + 故障切换让 多 Key 这件事在工程上稳又安全。
