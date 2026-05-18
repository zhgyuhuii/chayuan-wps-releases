# 免费开源的AI软件如何把后端打成单可执行 PyInstaller的onedir与onefile取舍

chayuan-desktop 桌面单机版的后端 sidecar 是用 PyInstaller 打成可执行文件塞进 Tauri 安装包的。PyInstaller 提供 onedir 和 onefile 两种打包模式。这一篇讲清楚 chayuan-desktop 选哪个、为什么、踩了哪些坑。

先看两种模式的差别。onefile 模式把所有依赖打成一个单独的 exe（或 ELF 二进制），运行时解压到临时目录再跑。onedir 模式把依赖以目录结构展开，主可执行加一堆 .dll、.so、.pyd 平铺在同一目录。

onefile 的优点是分发简单，给用户一个文件就行。缺点是启动慢（每次启动要解压临时文件），在杀毒软件下被拦的概率高（单文件可执行体特征异常），且某些操作系统会把临时解压目录清理掉。

onedir 的优点是启动快，依赖文件可见可审计。缺点是文件多（几百到上千个文件），分发时要打包成一个目录或者外层用安装程序包装。

chayuan-desktop 选 onedir。理由几个。一是启动速度。onefile 启动慢一两秒在用户体验上很影响。二是杀毒软件友好。onedir 的二进制结构更接近常规软件，不像 onefile 那样容易被认作可疑。三是调试便利。onedir 模式下出问题能直接看依赖文件，确认是不是某个 .dll 丢了。四是 Tauri 主进程对 onedir 形态的子进程 spawn 更稳，不需要等解压。

onedir 形态的目录结构。chayuan-server 主可执行加一堆 .dll/.so（依赖动态库）加 _internal 目录（Python 标准库和第三方包）加 base_data 目录（默认配置和模型 metadata）。整体大小约 200-300MB，比 chayuan-desktop 的 Tauri 主进程那部分要大得多。

打包配置。chayuan-desktop 的 PyInstaller spec 文件位置在 chayuan-server/packaging/。spec 里声明：入口点（chayuan-server 的 main 函数）、数据文件（base_data、模型卡片库）、隐藏导入（PyInstaller 自动检测不到的动态导入模块）、运行时 hook（特殊依赖的初始化逻辑）、平台特定二进制（sqlite-vec 的 .dll/.so）。

打包过程的步骤。先 poetry install 装好开发态依赖，再 poetry export 导出锁定版本的 wheel 列表，再 pyinstaller chayuan-server.spec 跑打包。完整一次打包在 SSD 上 5-10 分钟。

各平台的差异。Windows 上 PyInstaller 输出 .exe 加一堆 .dll，需要 MSVC 运行时（vcruntime140.dll）。macOS 上输出可执行二进制加 .dylib，需要 codesign 签名才能在新版 macOS 上跑。Linux 上输出可执行加 .so，需要确保依赖的 glibc 版本足够新。

跨平台 CI。chayuan-desktop 的打包流水线在 GitHub Actions 上跑，三个平台并行。每个平台用对应 OS 的 runner，PyInstaller 在原生平台上构建避免交叉编译的复杂。Linux 上还要分 x86_64 和 aarch64 两个 runner，国产化场景下 loongarch64 走单独构建机。

体积优化。PyInstaller 默认会包很多不必要的依赖。chayuan-desktop 通过几个手段减体积：用 UPX 压缩可执行（节省 30-50MB）；显式排除不用的库（比如 pandas、scipy 大多场景不需要）；用 ONNX Runtime 的 light 版本而不是完整版；剔除测试数据。最终 sidecar onedir 体积控制在 250MB 左右。

模型权重不打进包。bge-m3-onnx、RapidOCR 这些模型权重总共一个 G 多，不打进 PyInstaller 包，首启动时下载到 CHAYUAN_ROOT/models。这样 chayuan-desktop 安装包不会膨胀到 1.5G。这种 主体打包 + 权重按需下载 的策略让发布包小、用户也能控制权重位置。

sqlite-vec 扩展的处理。sqlite-vec 是 SQLite 的 C 扩展，跨平台需要专门编译。chayuan-desktop 在打包时按平台带上对应的 .so 或 .dll，PyInstaller spec 里通过 datas 字段把这些扩展文件附进去。运行时 sqlite-vec 的 Python wrapper 自动找到对应文件加载。

依赖冲突的处理。PyInstaller 不擅长处理某些动态导入的依赖（比如 importlib 加载的模块）。chayuan-desktop 通过 spec 里的 hiddenimports 显式声明这些隐藏依赖，避免运行时找不到模块。

启动后的 Bootstrapping。PyInstaller onedir 启动时主可执行先加载内嵌 Python 解释器，再 import chayuan-server 入口模块，再启动 FastAPI server。这一段在 SSD 上一两秒，机械盘上 3-4 秒。Tauri 主进程的健康检查会等到 FastAPI 起来才放行。

国产化支持下的特别处理。loongarch64 平台需要专门构建的 PyInstaller 加 Python 3.12 加各种依赖的龙芯版本 wheel。chayuan-desktop 通过自家构建机做这件事，发布包里包含龙芯专用 sidecar。

WPS AI 插件 chayuan-wps 不需要 PyInstaller 打包，加载项是 JS/Vue 资源直接打进 WPS 加载项目录。两个产品的打包方式不同但都不依赖用户机器装运行时。

PyInstaller 打包是 chayuan-desktop 单机版能做到 装到电脑里就能用 的关键工程。免费开源的AI软件 在打包这一关把所有事情做好，用户的体感才是 一个 msi 装好就能用。
