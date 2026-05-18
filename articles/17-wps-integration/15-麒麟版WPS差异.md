# 国产化支持下的 WPS 适配 麒麟版 WPS 的差异

chayuan-wps 加载项在不同版 WPS 上的兼容差异。这一篇讲。

## WPS 的几个版本

WPS Office 普通版（金山官方）。中国大陆主流个人版。

WPS Office 专业版。商业版。

WPS Office Linux 版。Linux 上原生。

WPS Office 麒麟版。麒麟 OS 上的版本（金山合作）。

WPS Office 海外版。国外版本，跟国内有差异。

每个版本对加载项 API 支持略有差。

## chayuan-wps 的兼容

chayuan-wps 主要支持。

WPS Office 普通版（Windows、Mac、Linux）。

WPS Office 麒麟版。

不专门支持海外版（API 略不同）。

## 加载项 API 差异

WPS API 在不同版本上稍有差异。

文档操作 API。基本一致。chayuan-wps 用通用 API。

UI 风格 API。某些按钮样式调用方法不同。chayuan-wps 用最通用方法。

事件回调。某些事件名称在版本间不同。chayuan-wps 维护映射表。

## 麒麟版的特殊

麒麟版 WPS 是 WPS 跟麒麟合作的定制版。某些 API 行为跟普通 WPS 略不同。

文件路径中文支持。麒麟版处理中文路径优化。chayuan-wps 兼容。

国密支持。麒麟版可能支持国密签名加载项。chayuan-wps 路线图。

国产模型集成。麒麟版可能内置部分 AI 接口。chayuan-wps 跟它协同（不重复造轮子）。

## 测试矩阵

chayuan-wps 的 CI/CD 测试。

```
WPS Office 11.x (Windows)
WPS Office 11.x (Mac)
WPS Office 11.x (Linux)
WPS Office 麒麟版
```

每个版本跑加载项功能测试。发现差异时 chayuan-wps 加 fallback。

## 用户感知

chayuan-wps 在不同 WPS 版本上行为一致（90% 功能）。

少数功能（特定 WPS 版本不支持的）UI 上灰显。

```
某加载项功能：[不可用 - 需 WPS 11.5+]
```

让用户知道为什么。

## 加载项的发布

chayuan-wps 加载项发布到。

WPS 公共加载项市场。普通用户从这里装。

某些政企的内部加载项市场。

国产应用商店（路线图）。

每个渠道有不同审核流程。

## 升级

WPS 升级时加载项可能不兼容。

WPS 自动检查加载项兼容性。chayuan-wps 升级前提示。

普通用户升级 WPS 后 chayuan-wps 自动适配（如果版本兼容）。

## 国产化场景

党政军采购的 WPS 多是麒麟版。chayuan-wps 必须主测麒麟版。

某些政府场景指定 WPS 版本（不能升级）。chayuan-wps 在固定 WPS 版本上稳定运行。

## chayuan-server 的对应

chayuan-server 后端跟 chayuan-wps 版本无关（API 协议一致）。chayuan-wps 适配 WPS 版本即可。

## chayuan-desktop 的协同

chayuan-desktop 后端在不同 OS 上跑。chayuan-wps 在不同 WPS 上跑。两者通过 127.0.0.1:62581 解耦。

后端不关心 chayuan-wps 跑在哪个 WPS 上。

## 总结

国产化下 WPS 适配是 chayuan-wps 的工程现实。免费开源的AI软件 让加载项 在主流 WPS 上都可用。chayuan-wps 的多版本测试 + 麒麟版定制 + 通用 API 让 WPS 集成 在国产生态完整覆盖。
