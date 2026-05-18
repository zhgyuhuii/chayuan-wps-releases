# 本地离线知识库的最小依赖 Linux下不联外网装包跑通

Linux 上把察元AI 桌面单机版装起来这件事，比 Windows 和 macOS 多一些细节。一来发行版多，glibc 版本差异不可忽视；二来 GUI 应用对 GTK、WebKit 这些底层依赖有要求；三来政企内网经常不开外网，只允许从内部源拿包。这一篇专门给 Linux 用户一份装包流程，覆盖国产化支持下的常见发行版。

先看 chayuan-desktop 在 Linux 上的形态。release 通常会出 deb 包、rpm 包和 AppImage。x86_64 是默认架构，aarch64 在国产化清单里也有。安装包里同样是两段：Tauri 主进程二进制、PyInstaller 打的嵌入式 Python sidecar。

第一步看依赖。在 Ubuntu 22.04 或 Debian 12 上装 deb 包前，确认这几个包齐：libwebkit2gtk-4.1-0、libssl3、libsqlite3-0、ca-certificates、libgtk-3-0、libayatana-appindicator3-1。命令行 dpkg -l | grep webkit2gtk 看一眼。如果是内网无外网环境，提前从可信镜像拿好这些 deb，cp 到目标机器后用 dpkg -i 安装，依赖问题用 dpkg --get-selections 对账。

第二步装 chayuan-desktop。sudo dpkg -i chayuan-desktop_x.y.z_amd64.deb，遇到依赖缺失会报错，根据提示 sudo apt-get install -f 补依赖，但 -f 这一步在无外网环境下会失败，必须提前把所有依赖 deb 一起带过来。

第三步首启动。GUI 环境下双击桌面图标，命令行环境下运行 /usr/bin/chayuan-desktop。FirstRunSetup 跳出来，CHAYUAN_ROOT 指到 ~/.local/share/chayuan-desktop 或者一个独立分区。

第四步无外网环境的特别处理。chayuan-desktop 在首启动会下载内嵌的 bge-m3-onnx 嵌入模型和 RapidOCR 权重，文件总大小约一个 G。如果这台机器没外网，需要从一台有外网的机器先把模型拉下来，再拷贝到目标机器的 CHAYUAN_ROOT/models 目录下。模型文件结构在仓库 packaging 文档里有详细列。这一步是无外网部署的关键，跳过就会卡在首启动模型加载。

第五步配置模型供应商。无外网情况下，外部厂商钥匙都用不上，只能配本地推理。在内网先部署一台 Ollama 或 vLLM 服务，把模型权重拷进去，让它监听内网某个 IP 端口。回到 chayuan-desktop 的设置，新建 OpenAI 兼容路由供应商，地址填内网那台机器的 http://10.x.x.x:11434/v1，保存。这种内网拓扑是政企部署察元AI 的常见做法。

第六步测试一句对话。新建对话，挑刚配的模型，问一句话。流式输出正常说明全栈跑通。再拖一份 PDF 进去做 RAG 测试，看引用气泡是否能展开。本地离线知识库 默认使用 sqlite-vec，KB 数据全部在本机。

第七步排查工具。内网装包出了问题不好搜资料，给一份本地诊断命令清单。systemctl status 看 sidecar 是不是被 systemd 起了；ss -ltnp | grep 62581 看端口；ldd /usr/lib/chayuan-desktop/chayuan-server | grep not 找缺失的动态库；strace -e trace=openat /usr/bin/chayuan-desktop 看启动时找哪些文件失败。这几条命令是 Linux 装包问题排查的万能锤。

国产化支持下的几个特别情况。麒麟 V10 GA 上 webkit2gtk 版本不一定够新，需要从软件商店或者社区 ppa 装更新一份。统信 UOS 1060 自带的 webkit 版本通常足够，但需要打开 Wine 兼容关相关选项。openKylin 上情况类似 Ubuntu，问题不大。loongarch64 架构的发行版需要专门的 chayuan-desktop 二进制构建，这个由发行渠道单独提供。

WPS AI 插件 chayuan-wps 在 Linux 上目前需要 Linux 版 WPS Office，但 WPS Office Linux 版本对加载项的支持还不如 Windows。建议 Linux 上先把 chayuan-desktop 桌面端跑稳，加载项作为后期补充。免费开源的AI软件 在 Linux 上的优势是装机灵活，劣势是细节散，给自己留半天时间装第一台。
