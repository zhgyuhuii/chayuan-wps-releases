# 国产化支持下的统信UOS 装察元AI的依赖与运行时对账

统信 UOS 1060 在政企部署里逐渐普及，办公场景用得越来越多。chayuan-desktop 桌面单机版对 UOS 是有专门适配的发行包，但首装一台到能跑通中间还是有不少细节。这一篇给一份完整的依赖清单和运行时对账，省掉摸索时间。

UOS 1060 的内核是 Linux 5.10，glibc 2.31，桌面环境基于 Deepin。整个发行版偏 Debian 系，但内置的软件源是统信自己的镜像。chayuan-desktop 在 UOS 上发的是 deb 包，amd64 和 arm64 各一份，也有针对 loongarch64 的特殊构建走单独通道。

必装依赖列表如下。libwebkit2gtk-4.1-0 用于 Tauri 2 的 WebView 渲染；libssl3 给 sidecar 的 HTTPS 客户端用；libsqlite3-0 给本地离线知识库 的 SQLite 文件读写用；libgtk-3-0 给 Tauri 主进程的 GTK 集成用；libayatana-appindicator3-1 给系统托盘图标用；ca-certificates 给可信证书集用；fonts-noto-cjk 给中文字体显示用。这几个包在 UOS 1060 默认源里都有，apt-get install 一遍即可。

可选依赖按需装。libmagic1 给文件类型探测用，提升文档解析的稳定性；libreoffice 不是必需但建议装一个，部分 doc 旧格式解析需要；libxml2 给 OCR 流水线用；ffmpeg 给多模态视频解析用，单机版默认不开多模态可以不装。

装包步骤。先 sudo apt-get update 同步源信息；如果是无外网环境，先把所有依赖 deb 拷到本机然后 dpkg -i 安装；最后 sudo dpkg -i chayuan-desktop_x.y.z_amd64.deb。装完用 dpkg -l | grep chayuan 确认。

首启动。命令行直接跑 /usr/bin/chayuan-desktop，或者从开始菜单点图标。FirstRunSetup 跳出来，把 CHAYUAN_ROOT 指到 ~/.local/share/chayuan-desktop 或者 /data/chayuan，避免放在系统根目录。模型权重首次会下载约一个 G，无外网环境提前拷贝。

UOS 上的几个特殊点。第一，UOS 商店对第三方应用有一套白名单机制，自家发行渠道分发的应用可能默认不被信任。表现是双击图标没反应。处理方法是命令行直接跑可执行文件，或者在系统设置里把开发者证书加白。

第二，UOS 的安全子系统在某些版本上会对 sqlite-vec 加载做拦截。日志里看到 SELinux 或 Audit 相关报错时，临时把策略调成 permissive 测试一遍。生产环境推荐让 IT 部门给 chayuan-desktop 做一次安全审视后加白名单。

第三，UOS 的输入法在某些情况下与 webview 交互不稳定。表现是对话窗口里中文输入卡顿或者光标位置不对。这是 Tauri 2 与 fcitx5 的兼容问题，新版 chayuan-desktop 已经修过一轮，遇到再装一次最新发行包。

第四，UOS 上的 WPS Office 是 Linux 原生版，目前对 chayuan-wps WPS AI 插件 的支持仍在演进。我们给客户的建议是 UOS 上先把桌面单机版用起来，加载项在 Windows WPS 上稳定使用，等 Linux WPS 加载项的支持完整后再上。

UOS 上跑察元智库 完整体验。我装的那台是 UOS 1060 加 WPS Office Linux 加 chayuan-desktop。对话、模型供应商配置、RAG 入库、引用气泡都正常工作。本地离线知识库 用 sqlite-vec，全部数据落在 CHAYUAN_ROOT 下面，没有数据出本机。这个体验已经能给政企客户演示。

国产化支持下的部署经验，最稳的做法是先在一台 UOS 笔记本上把流程跑顺，把所有要装的依赖、要配的目录、要授权的进程列成 SOP，再批量复制到其他机器。免费开源的AI软件 在国产 OS 上的优势是不依赖任何商业云，所有数据自己掌控；劣势是首次部署细节多，建议预留一天时间做第一台样机。
