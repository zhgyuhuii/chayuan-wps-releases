# 国产化支持的升级路径 内网 OTA 的设计

chayuan-desktop 桌面单机版的内网 OTA（Over-The-Air）升级设计。这一篇讲。

## OTA 的常规模式

公网 OTA。chayuan-desktop 启动时检查 update.chayuan.com。

```
当前版本：3.0.0
最新版本：3.1.0
[立即升级] [稍后]
```

下载更新包 + 应用 + 重启。

## 内网的挑战

政企内网不能访问公网。

如果 chayuan-desktop 总联 update.chayuan.com 报告 升级失败 用户体验差。

需要内网 OTA 方案。

## 方案一：内网镜像服务器

部门搭一台内网更新服务器。

```
http://update.corp.com/chayuan/
  releases/
    3.0.0/
      chayuan-desktop_3.0.0_amd64.deb
      manifest.json (含签名 + 哈希)
    3.1.0/
      ...
```

chayuan-desktop 配置里指向内网。

```yaml
update_url: http://update.corp.com/chayuan
```

启动时 chayuan-desktop 查内网而非公网。

## 镜像同步流程

外网管理员定期把新版同步到内网。

流程一：外网下载到 U 盘。

流程二：U 盘进内网传到镜像服务器。

流程三：员工 chayuan-desktop 从镜像拉。

每周或每月同步。

## 方案二：手动包升级

某些场景内网都不允许 chayuan-desktop 联网（即使内网）。

管理员把升级包发给员工（邮件 / IM）。

员工从 chayuan-desktop 设置 - 升级 - 从文件升级 选包。

```
[选择 chayuan-desktop_3.1.0_amd64.deb]
[升级]
```

chayuan-desktop 校验签名后应用。

## 方案三：MDM / 集中管理

企业 IT 用 MDM（移动设备管理）工具集中推送 chayuan-desktop 升级包到员工电脑。

员工无感知升级。

## 升级安全

OTA 关键是安全。

校验签名。chayuan-desktop 仅安装通过签名校验的包。

校验哈希。下载完整性。

回滚机制。升级失败自动回滚到上一版。

## 灰度升级

某政企不希望全员同时升级（避免新版本 bug 影响所有人）。

灰度策略。

10% 员工先升级（试点）。

试点 1 周无问题。

50% 员工升级。

再 1 周。

100% 升级。

chayuan-desktop 配置支持。

```yaml
update:
  rollout_percentage: 10  # 当前阶段
```

随机让 10% 实例升级。

## 强制升级 vs 自愿升级

强制。某些安全补丁必须升级。chayuan-desktop 提示用户 必须升级，否则无法继续使用。

自愿。新功能升级。用户能延后。

chayuan-desktop 的策略可配。

## 用户感知

升级中 UI。

```
[更新中] 50%
正在下载 chayuan-desktop 3.1.0...
```

升级完成提示。

```
[已更新到 3.1.0]
新增功能：
  - ...
  - ...
```

## 升级失败

某些场景升级失败（磁盘满、签名错、依赖缺）。

chayuan-desktop 的处理。

回滚到旧版本。

弹错误提示用户。

写日志便于排查。

## 国产化场景

党政军内网升级是日常。chayuan-desktop 的内网 OTA 让升级 不需要外网。

某些等保场景要求升级有审计。chayuan-desktop 的升级日志详细。

## chayuan-server 的对应

chayuan-server 同样支持内网 OTA。chayuan-desktop 单机的 OTA 经验复用。

## WPS 加载项

chayuan-wps 跟随 WPS 升级或独立升级。chayuan-desktop 的 OTA 不直接管 WPS 加载项。

## 总结

国产化支持的内网 OTA 是 chayuan-desktop 在政企持续运营上的工程能力。免费开源的AI软件 让 内网升级 不是负担。chayuan-desktop 的镜像 + 灰度 + 校验 + 回滚让内网 OTA 安全可控。
