# CHAYUAN_ROOT注入链路 从Tauri参数到Python进程环境变量

chayuan-desktop 桌面单机版的 CHAYUAN_ROOT 是后端数据落到哪里的真源。这个变量从用户在 FirstRunSetup 里选目录开始，到 sidecar 进程里真的把数据写到那个目录，中间经过几跳。这一篇把这条链路拆开讲。

第一跳：用户选目录。FirstRunSetup 向导第二屏让用户选 CHAYUAN_ROOT 路径，可以默认推荐用户目录下的子目录，也可以自己选独立分区。用户选完点下一步，前端把这个路径发给 Tauri 主进程的命令处理函数。

第二跳：Tauri 写配置。Tauri 主进程把用户选的路径存到自己的配置文件里。这个文件在系统级位置，Windows 上是 %APPDATA%\com.chayuan.desktop\config.json，macOS 上是 ~/Library/Application Support/com.chayuan.desktop/config.json，Linux 上是 ~/.config/chayuan-desktop/config.json。文件内容大致是 {"dataDir": "D:\\Chayuan", "version": "x.y.z", ...}。

为什么 Tauri 不直接用 OS 的环境变量。两个原因。一是用户不应该被要求懂环境变量这件事，配置应该 GUI 完成。二是不同 OS 的环境变量持久化方式各异，Tauri 自己管配置文件更跨平台。

第三跳：Tauri 启动 sidecar 时注入。Tauri 主进程在 spawn chayuan-server 子进程之前，从配置文件读取 dataDir 路径，通过 std::process::Command 的 .env() 方法把它作为子进程的环境变量。注入的是 CHAYUAN_ROOT 这个特定的环境变量名。

第四跳：sidecar 启动时读取。chayuan-server 进程启动后第一件事是读 CHAYUAN_ROOT 环境变量。如果没读到（比如手动跑 sidecar 没设环境变量），会用默认值 ~/.local/share/chayuan-desktop。这个默认值是开发态的兜底，正常用户不应该走这一条。

CHAYUAN_ROOT_IGNORE_STATE 这个环境变量。仓库最近的提交里加了它（commit d9945b2 fix(desktop/sidecar): export CHAYUAN_ROOT_IGNORE_STATE=1）。原因是早期 sidecar 内部有一个状态文件机制：第一次启动时把 CHAYUAN_ROOT 路径记到一个 state 文件里，后续启动如果环境变量跟 state 文件不一致，会以 state 文件为准。这个机制造成的问题是 用户在 Tauri 选了新目录，sidecar 仍然用老目录。CHAYUAN_ROOT_IGNORE_STATE=1 让 sidecar 完全相信环境变量，不再回查 state 文件。

第五跳：sidecar 内部传递。chayuan-server 内部所有需要 CHAYUAN_ROOT 的模块都从同一个 settings 模块拿。settings 在启动时一次性读取环境变量，封装成 chayuan_root: Path 字段，所有下游模块通过依赖注入拿到。任何一个内部模块都不直接 os.environ.get('CHAYUAN_ROOT')，因为这种用法会产生不一致。

第六跳：实际目录创建。settings 在启动时检查 CHAYUAN_ROOT 是否存在、是否可写，必要的子目录（data、kb、vectors、models、logs、credentials、cache）会自动创建。如果目录权限不足或者磁盘没空间，会报清晰错误并退出。日志写到 stderr，被 Tauri 主进程接管。

跨平台路径处理。Windows 路径用反斜杠，Linux/macOS 用正斜杠。Python 的 pathlib 在内部统一处理，对外接口接受字符串路径自动转换。Tauri 写到配置文件时用 JSON 字符串，反斜杠要转义。这种细节在跨平台开发里容易踩坑，chayuan-desktop 通过 pathlib + JSON 标准化避免大部分问题。

中文路径与空格路径。CHAYUAN_ROOT 支持包含中文字符的路径，Python 3.12 全 UTF-8 编码处理没问题。但是早期某些 PyInstaller 打的扩展（比如 sqlite-vec 的 .dll）在某些 Windows 版本上对中文路径支持不稳定。建议在国产化场景里用纯英文路径，比如 D:\Chayuan 而不是 D:\察元数据。

迁移与保留。用户改 CHAYUAN_ROOT 到新位置时，Tauri 主进程更新自己的配置文件，再重启 sidecar。新的 sidecar 进程拿到新 CHAYUAN_ROOT 启动，读到的就是新目录。这个过程要求用户先把旧目录数据搬到新目录，搬这件事 Tauri 不替用户做，因为路径变更的语义可能不一致（用户可能就是要重新开始）。

WPS AI 插件 chayuan-wps 不直接关心 CHAYUAN_ROOT。加载项通过 HTTP 调用 sidecar，sidecar 自己读环境变量找数据目录，加载项拿到的就是当前 CHAYUAN_ROOT 下的所有 KB。这种设计让加载项跟数据目录解耦，CHAYUAN_ROOT 改了加载项不需要重配。

CHAYUAN_ROOT 注入链路六跳，每一跳都是为了让 用户选哪 真的等于 数据落到哪。免费开源的AI软件 在数据所有权这件事上做得真，靠的就是这种细节的层层落实。
