# sidecar起不来怎么排查 62581端口被占的几种现实情况

察元AI 桌面单机版的启动失败十次有八次是同一类问题：Tauri 主进程已经起来了，splash 画面也亮着，但右下角一直转圈，前端日志里出现一连串 connection refused 的报错。这一篇专门聊这种情况，给一份排查清单。

先把背景讲清楚。chayuan-desktop 的后端是一个 PyInstaller 打出来的嵌入式 Python sidecar，启动时由 Tauri 主进程通过 spawn 子进程的方式拉起。sidecar 监听 127.0.0.1:62581 这个固定端口，前端 webview 通过这个端口走 HTTP 跟后端通信。一旦 sidecar 没起来或者起来之后前端连不上，整个应用就停在加载页面。

第一种情况：62581 被占。这是最常见的。打开命令行看一眼。Windows 用 netstat -aon | findstr :62581，会列出占用端口的 PID。Linux 和 macOS 用 lsof -i :62581 或者 ss -ltnp。你会看到占用方可能是上次没退干净的 chayuan-server 残留进程，也可能是别的开发服务比如某个 Node 项目刚好绑了这个端口。先把对应进程结束，再重启 chayuan-desktop。

第二种情况：杀毒软件或防病毒拦截。Windows 上特别常见。chayuan-server 是 PyInstaller 打出来的可执行，签名链对杀毒软件来说有时不被信任。表现是 sidecar 进程在任务管理器里短暂出现，然后被悄悄杀掉。打开杀毒软件的隔离区，看有没有 chayuan-server.exe 的记录，把它加到信任列表，再重启。免费开源的AI软件 在这一关比较吃亏，因为没有商业软件的扫描白名单待遇。

第三种情况：CHAYUAN_ROOT 写不进去。如果你 CHAYUAN_ROOT 选了一个权限不足的目录，比如 Program Files 下面，sidecar 启动时建立 SQLite 文件失败，会直接退出。日志在 CHAYUAN_ROOT/logs/server.log 里。打开看有没有 PermissionError。换一个有写权限的目录，比如普通用户的文档目录，重启。

第四种情况：sqlite-vec 扩展加载失败。本地离线知识库依赖 sqlite-vec 这个 SQLite 扩展，PyInstaller 打包时附带了对应平台的 .dll 或 .so。如果你装的是不常见的 Linux 发行版或者老旧的 glibc，扩展可能加载不了。日志会出现 sqlite3.OperationalError 跟 vec0 字样。这种时候最快的办法是切换到官方支持的发行版，或者从源码 build 一份匹配本机 glibc 的 sqlite-vec 替换。

第五种情况：依赖目录被同步软件锁定。OneDrive、坚果云、Dropbox 这类客户端经常会扫描整个用户目录，并对里面的文件做实时同步。CHAYUAN_ROOT 里的 SQLite 文件被同步软件占用，sidecar 写不进去。建议把 CHAYUAN_ROOT 排除在同步范围外，或者干脆把根目录放在不被同步的分区。

第六种情况：端口固定被防火墙拦了。某些公司管控终端禁止应用监听本地端口。表现是 sidecar 已经起来，但前端连不上。打开 Windows Defender 防火墙的入站规则，看有没有 chayuan 相关条目；macOS 检查防火墙的应用列表；Linux 检查 ufw 或 firewalld。把 chayuan-server 加进允许的应用列表。

第七种情况：版本不匹配。如果你之前装过老版本的 chayuan-desktop，新版本启动时数据迁移失败，sidecar 启动会卡在迁移步骤。日志里会出现 alembic upgrade 的相关报错。最稳的做法是先备份 CHAYUAN_ROOT，然后清空 data 目录，重新拉起，重新建知识库。

排查思路总结起来就一句话：先看日志，再看端口，再看权限，最后再看依赖。chayuan-desktop 的日志目录是固定的，不需要去翻系统盘。装到电脑里就能用 这件事情靠的不是没问题，而是出问题的时候能很快定位到原因。WPS AI 插件 chayuan-wps 和它共用同一套后端逻辑，sidecar 起不来同样会让加载项失效，排查路径一致。
