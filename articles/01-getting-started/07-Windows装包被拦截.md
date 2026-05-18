# Windows装包被防病毒拦了 看安装日志和签名链的实战

Windows 上装察元AI 桌面单机版被拦的情况不少见，特别是公司发的电脑、安装了 360、火绒、Defender 等多重防护的环境。这一篇专门讲怎么诊断，怎么处置，给装机第一天就遇到这堆灰窗口的人一份清单。

先说清楚 chayuan-desktop 的安装包结构。msi 安装包里至少有两段二进制：Tauri 编译出来的 .exe 主进程，PyInstaller 打出来的 chayuan-server.exe sidecar。两者都需要数字签名，否则在 SmartScreen 默认设置下会先弹出警告。免费开源的AI软件 在签名这一关比较吃亏，证书要花钱，开源项目通常自费续。

第一种现象：双击 msi 没反应。任务管理器里看不到安装进程。这种情况通常是 SmartScreen 静默拦了。右键 msi，看属性，下面有一行 这个文件来自其它电脑，需要解锁。打勾解锁，再双击。

第二种现象：装到一半弹窗 该应用未通过 Microsoft Defender SmartScreen 验证。这是签名链没被识别为可信。点 详细信息，然后 仍要运行 即可。如果按钮被企业策略禁用，找 IT 把签名证书的指纹加进白名单。

第三种现象：装完之后 chayuan-desktop 启动一秒就退出。任务管理器里看到 chayuan-server.exe 短暂出现就消失。这是杀毒软件把 sidecar 隔离了。打开杀毒软件的隔离区，看有没有 chayuan-server.exe 的记录，把它恢复，并加到信任列表。Defender 的话，去 病毒和威胁防护，找到 隔离的威胁，恢复并加信任。如果是 360 或火绒，类似操作。

第四种现象：sidecar 起来了但 SQLite 写不进去。表现是 splash 一直转，前端报错连不上 62581。看 CHAYUAN_ROOT/logs/server.log，有没有 PermissionError 或 sqlite3.OperationalError。这通常是杀毒软件实时扫描了 SQLite 文件锁，导致连接失败。把 CHAYUAN_ROOT 整个目录加到杀毒软件的扫描排除项。

第五种现象：网络拦截。chayuan-desktop 默认只监听 127.0.0.1:62581，但有些公司装了 EDR 类产品，对所有进程的本地网络监听做拦截。表现是 sidecar 起来了，前端也连不上，且日志里没有明显报错。这种情况要找 IT 申请允许 chayuan-desktop 监听本地 loopback，提交进程路径和端口号即可。

第六种现象：MSI 安装失败但提示信息很短。这种时候要拿安装日志。右键以管理员身份运行命令行，执行 msiexec /i chayuan-desktop-x.y.z.msi /l*v install.log，把详细日志写到 install.log。日志里搜 Error 或 Return value 3，能看到具体哪一步失败。常见的失败包括：磁盘空间不足、目标目录权限不足、上一个版本卸载残留。

第七种现象：解决了所有上面问题，应用还是装不上。这时候考虑系统层面。是不是 Windows 版本太老，比如 Win7 SP1 没装 KB 补丁，缺了 Webview2 Runtime；是不是 .NET Framework 不全；是不是组策略禁用了非签名应用的安装。Webview2 在 Win10 较新版和 Win11 上都自带，老版本需要额外装 Microsoft Edge WebView2 Runtime。

最后一招是用便携模式。如果 IT 实在不让装 msi，把整个安装目录拷过来，或者用 zip 解压版直接运行。chayuan-desktop 的核心文件都在安装目录里，便携模式一样能跑。这种部署方式适合有限权限账号，但需要手动建桌面快捷方式。

WPS AI 插件 chayuan-wps 在同样的环境里有相似的拦截风险，加载项的 dll 在 WPS 里加载需要 WPS 信任。处理思路一致：看签名、看权限、看日志、看防护。装 chayuan-desktop 的同时把 WPS 加载项一起列进白名单，省事。
