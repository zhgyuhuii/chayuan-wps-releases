# 配额 RBAC governance 模块在单机的退化

chayuan-desktop 桌面单机版的配额、RBAC、governance 模块在单机场景下的退化。这一篇讲。

## 服务端版的完整功能

chayuan-server 多用户场景下。

RBAC。完整 admin / editor / viewer / guest 多角色。

配额。每用户月度 token 上限、并发上限。

governance。数据脱敏策略、审计策略、合规检查。

复杂完整。

## 单机版的退化

chayuan-desktop 单机简化。

RBAC 退化。一个用户（owner）+ 可选 reader（多身份）。

配额退化。一个用户的月预算（自己定）。无并发限制（单用户）。

governance 退化。脱敏 / 审计仍有但配置简化。

少了多用户协调的复杂度。

## 单一用户 RBAC

chayuan-desktop 默认。

owner = 当前 OS 用户 = 全权限。

非 owner 看不到 chayuan-desktop（OS 级隔离）。

没有角色概念。

## 多身份 RBAC

某些场景一台机器多 OS 账号或多身份。

每身份是 owner 自己的 KB。

跨身份共享 KB（office:dept:* 类）需要明确配 ACL。

简化版 RBAC（owner / reader / none）。

## 配额的简化

单一用户。

```yaml
budget:
  monthly: 100  # ¥100 月度预算
  alert_at: 80%  # 80% 告警
  hard_stop_at: 100%  # 满了暂停付费模型
```

简单粗暴。

无需多用户协调（每用户独立预算）。

## governance 的简化

数据脱敏。配置简化。

```yaml
governance:
  pii_redaction: 
    enabled: true
    method: partial  # 部分脱敏
  audit:
    retention_days: 30
  compliance_check:
    enabled: true
    standards: ["等保二级"]
```

够用。

复杂场景升级到 chayuan-server。

## 单机版能做的合规

等保 2.0 二级 / 三级合规。chayuan-desktop 单机能满足。

个人信息保护法。chayuan-desktop 满足。

GDPR。理论上满足（数据本地）。

某些行业特殊（金融、医疗）需要 chayuan-server。

## 升级路径

某政企从 chayuan-desktop 单机扩展到 chayuan-server。

数据迁移。chayuan-desktop 的 KB 导出 + chayuan-server 导入。

权限映射。单机的 owner / reader 映射到服务端的 admin / editor 等。

配额配置。重新规划企业级配额。

平滑升级。

## 不强制企业版

很多用户单机版够用。

个人用户。

小团队（< 10 人，每人独立 chayuan-desktop）。

党政军某些场景（每人独立机器）。

只有大规模 + 复杂 RBAC 场景才必须 chayuan-server。

## 国产化场景

党政军场景大多 一人一机。chayuan-desktop 单机的 RBAC 简化够用。

某些大单位（部委级、央企）才需要 chayuan-server。

## chayuan-server 的对应

chayuan-server 是 RBAC / 配额 / governance 的完整实现。chayuan-desktop 单机是子集。两者协议一致便于升级。

## WPS 加载项

chayuan-wps 跟 chayuan-desktop 同样简化。在 chayuan-server 模式下用完整 RBAC。

## 总结

配额 RBAC governance 在单机的退化是 chayuan-desktop 的设计哲学。免费开源的AI软件 不强制企业级复杂性。chayuan-desktop 的简化让单机用户够用，企业用户能升级。两端都不浪费。
