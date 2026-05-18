# MCP 在国产化场景的注意点 国产 OS 下的进程模型

chayuan-desktop 桌面单机版在国产 OS（麒麟、统信、openKylin）上跑 MCP 有特别注意点。这一篇讲。

## 国产 OS 的进程模型

国产 OS 大多基于 Linux（麒麟、统信都是）或自研内核（openKylin、Loongnix）。

进程模型跟标准 Linux 接近。fork、exec、stdin/stdout 都正常工作。MCP 的 stdio 传输天然支持。

但是。

## 注意点一：runtime 安装

某些 MCP 工具基于 Node.js 或 Python。国产 OS 默认可能不带 Node.js（统信带，麒麟某些版本没）。

chayuan-desktop 安装时检测 runtime。

如果缺 Node.js 提示用户。

```
检测到缺少 Node.js（运行 MCP 工具需要）。
是否安装？
[安装内嵌 Node] [使用系统 Node] [跳过，仅用内置工具]
```

chayuan-desktop 内嵌 Node.js 二进制（约 70MB），完全不依赖系统。也支持系统 Node。

## 注意点二：依赖镜像

MCP 工具大多用 npm 或 pip 安装。国产 OS 内网环境一般无法直连 npmjs.org 或 pypi.org。

chayuan-desktop 配置国内镜像。

```
npm: https://registry.npmmirror.com
pypi: https://pypi.tuna.tsinghua.edu.cn/simple
```

或政企内网镜像。

## 注意点三：进程隔离工具

Linux 上的 unshare、cgroups 在国产 OS 上可能有差异。

麒麟 V10。systemd 完整。进程隔离 OK。

统信 UOS。同上。

openKylin。新发行版，进程模型基本兼容。

Loongnix（龙芯）。LoongArch 架构。某些 cgroups 特性可能弱。

chayuan-desktop 的进程隔离用 fallback 策略。如果某 OS 不支持完整 cgroups，降级到基本进程隔离。安全性略降但能跑。

## 注意点四：TCP 端口绑定

某些国产 OS 默认开启 SELinux 或类似的安全模块。chayuan-desktop 子进程需要绑定本机端口（127.0.0.1）。可能被安全策略阻挡。

chayuan-desktop 安装时提示用户配置安全策略例外。或者用 SSE over Unix socket 替代 TCP。

## 注意点五：文件路径

国产 OS 路径常用中文（用户名是中文）。某些 MCP 工具不处理中文路径。

chayuan-desktop 的工作目录默认 ~/.chayuan/，避免在中文路径下运行子进程。如果 home 含中文，chayuan-desktop 用 /var/lib/chayuan/<uid>/ 替代。

## 注意点六：ARM 架构

某些国产 OS 跑在 ARM（鲲鹏、飞腾）。MCP 工具二进制需要 ARM 版本。

chayuan-desktop 的内嵌工具有 ARM 二进制。社区 MCP 工具如果是 Node/Python 一般没问题（跨架构）。如果是 Go 或 Rust 编译的需要对应架构二进制。

chayuan-desktop 自动检测架构，下对应版本。

## 注意点七：GUI 集成

chayuan-desktop 是 Tauri 桌面应用。在国产 OS 上 GUI 跟 Wayland / X11 集成。

国产 OS 大多用 X11（KDE 或 GNOME）。Tauri WebView2 / WebKit 在 X11 上稳定。

某些 OS 用 Wayland（统信 V20 SP1+）。Tauri 在 Wayland 兼容性持续完善。chayuan-desktop 测试覆盖。

## 注意点八：等保合规

党政军场景对 MCP 工具有审批要求。chayuan-desktop 的 MCP 配置默认 仅内置工具。MCP 第三方工具默认禁用，需要用户主动开启 + 输入审批理由（写到 audit_log）。

## chayuan-server 的对应

chayuan-server 在国产服务器上部署同样这些注意点。chayuan-desktop 单机的经验复用。

## WPS 加载项

chayuan-wps 在 WPS 里调用 MCP 工具，国产 OS 上经过 chayuan-desktop 走子进程。WPS 不直接管 MCP。

## 总结

MCP 在国产化场景的注意点是 chayuan-desktop 在 国产 OS 适配 上的工程细节。免费开源的AI软件 让 MCP 工具 在国产 OS 上一致可用。chayuan-desktop 的内嵌 runtime + 国内镜像 + 架构适配 + 安全例外让 国产化 MCP 在工程上有路径。
