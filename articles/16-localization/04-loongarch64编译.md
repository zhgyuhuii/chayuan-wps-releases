# loongarch64架构 编译链的特殊处理

chayuan-desktop 桌面单机版支持 loongarch64（龙芯）架构需要特殊编译链。这一篇讲技术细节。

loongarch64 是龙芯 3A5000 后的指令集架构。设计独立于 x86 ARM。Linux 内核 5.19+ 原生支持。

编译链挑战。

挑战一：Rust 工具链。Tauri 主进程是 Rust。需要 rustc 支持 loongarch64 目标。Rust 1.74+ 加 nightly 通道支持。chayuan-desktop CI 用 nightly 跑龙芯构建。

挑战二：Python wheels。chayuan-desktop sidecar 依赖大量 Python 库（FastAPI、SQLAlchemy、PyMuPDF、ONNX Runtime 等）。loongarch64 上的 wheel 需要从源码构建。某些库的 C 扩展需要特殊编译参数。

挑战三：sqlite-vec 扩展。需要从源码构建龙芯版本 .so。chayuan-desktop 维护一份龙芯专用构建脚本。

挑战四：ONNX Runtime。微软官方 ONNX Runtime 不提供 loongarch64 wheel。需要从源码编译，但部分依赖（比如 protobuf 老版本）可能有兼容问题。chayuan-desktop 团队跟社区合作维护龙芯版 ONNX Runtime。

挑战五：PyInstaller 打包。PyInstaller 需要 loongarch64 上的 bootloader。社区有补丁但官方支持滞后。chayuan-desktop 团队带补丁版本。

构建机器。chayuan-desktop CI 没有 GitHub Actions 上的 loongarch64 runner（截至 2026-05）。需要自家维护一台龙芯服务器跑 CI。每次发布构建龙芯版本。

发行包格式。

deb 包。给麒麟 UOS 等 Debian 系国产 OS。

rpm 包。给中标麒麟、统信 UOS 等部分版本。

文件名带 loong64 后缀（chayuan-desktop_x.y.z_loong64.deb）。

性能。

CPU 性能比 ARM/x86 略低（前面文章数据）。

二进制 size 比 x86 略大（编译优化程度）。

启动稍慢但功能完整。

测试覆盖。chayuan-desktop 在每次发布前在龙芯样机做基础测试。

启动测试。

RAG 入库测试。

text2sql 测试。

模型对抗测试。

WPS 加载项联动测试（如果适用）。

社区贡献。loongarch64 在国产化清单里位置重要但生态相对滞后。chayuan-desktop 团队跟开源社区合作推动相关库的龙芯支持。这是 免费开源的AI软件 给国产生态的回报。

未来。

3A6000、3C6000 性能更高，跑大模型有基础。

loongarch64 生态在补，越来越多 wheel 直接可用。

chayuan-desktop 继续跟随。

WPS AI 插件 chayuan-wps 在龙芯版 WPS Office 上的部署是政企信创的最后一公里。当前 WPS Linux 版的龙芯支持仍在演进。

loongarch64 编译链是 chayuan-desktop 国产化全栈支持的硬骨头。免费开源的AI软件 不躲过这块，是因为国产化的诚意必须落到 100% 全平台覆盖。chayuan-desktop 在龙芯上的投入是这种诚意的具体体现。
