# 国产化支持下的进程隔离 麒麟上systemd托管的可选项

chayuan-desktop 桌面单机版默认是 GUI 应用，由用户在桌面双击启动 Tauri 主进程。但在某些政企场景下，更合适的部署形态是 sidecar 后端单独跑成系统服务，前端按需启动连后端。这一篇讲麒麟和统信 UOS 上把 chayuan-desktop sidecar 跑成 systemd 服务的细节。

先看为什么需要 systemd 托管。第一种场景是多人共用一台后端。一台服务器装一份 chayuan-server，几个员工各自的 GUI 客户端连过来用。但严格说这种用法已经偏离单机版了，应该走多用户版。第二种场景是后端要随系统启动。员工不在桌面登录的情况下后端也要跑（比如夜间自动同步知识库）。第三种场景是稳定性要求高，后端崩了要自动拉起。systemd 提供这套基础设施，比应用自己管要稳。

部署方式。先单独装 chayuan-server 二进制（不需要 Tauri 主进程），放到 /opt/chayuan-server。建一份 systemd unit 文件，写到 /etc/systemd/system/chayuan-server.service。unit 内容大致如下：[Unit] 描述、依赖；[Service] 用户 chayuan、ExecStart 指向二进制、Environment 注入 CHAYUAN_ROOT、Restart=on-failure；[Install] WantedBy=multi-user.target。

启用和启动。sudo systemctl enable chayuan-server.service 加入开机启动。sudo systemctl start chayuan-server.service 立刻启动。systemctl status 看运行状态。日志走 journalctl -u chayuan-server -f 实时跟。

CHAYUAN_ROOT 的选择。systemd 跑的 sidecar 不能用 ~/.local/share，那是普通用户目录。建议放到 /var/lib/chayuan 或 /srv/chayuan，专用服务用户拥有。新建 chayuan 系统用户：sudo useradd -r -s /bin/false chayuan，sudo chown -R chayuan:chayuan /var/lib/chayuan。

权限隔离。systemd unit 里指定 User=chayuan、Group=chayuan，让 sidecar 以非特权用户跑。NoNewPrivileges=true 禁止提权。ProtectSystem=strict 限制只能写自己的 CHAYUAN_ROOT。这一套在政企等保合规场景下是基本要求。

监听地址。systemd 托管的 sidecar 仍然默认绑 127.0.0.1:62581。如果是多人场景需要绑内网 IP，要在 unit 里改环境变量 CHAYUAN_HOST=0.0.0.0 加 CHAYUAN_PORT=62581。同时打开主机防火墙允许这个端口的内网访问。绑 0.0.0.0 之后必须打开鉴权，否则数据完全暴露给内网。

GUI 客户端如何连。普通用户在自己电脑上装 chayuan-desktop 完整包，但 FirstRunSetup 之后改 Tauri 配置，让它连远程 sidecar 而不是本地 spawn。Tauri 配置里有一个 backendMode 选项，改成 external 并填 URL，主进程不再 spawn 子进程，直接连远程。

systemd 服务的崩溃恢复。Restart=on-failure 让 systemd 在 sidecar 崩溃时自动重启。RestartSec=5 控制重启间隔。配合 StartLimitBurst 和 StartLimitIntervalSec 防止无限重启循环。

升级时的处理。停服务 sudo systemctl stop chayuan-server，替换二进制，启服务 sudo systemctl start chayuan-server。如果有 schema 迁移，启动时会自动跑。期间 GUI 客户端会断连，等服务起来后自动重连。

日志接管。systemd 默认把进程的 stdout stderr 接到 journald。chayuan-server 的日志可以用 journalctl 集中查。如果你仍想要 CHAYUAN_ROOT/logs 下的滚动日志，sidecar 内部的 logger 会同时写文件和 stderr。

国产化支持下的特别注意。麒麟 UOS 的 SELinux 默认严格，需要为 chayuan-server 写一份 SELinux 策略，覆盖文件读写、网络监听、临时文件这些操作。loongarch64 平台上 systemd 托管运行没问题，但要确保 sidecar 二进制是龙芯架构构建的。

WPS AI 插件 chayuan-wps 在这种部署形态下连远程 sidecar 而不是本地。加载项配置里把 服务器地址 改成内网 IP 端口，认证模式按部署情况配 jwt 或 hmac。一台员工电脑就能用其他机器上的察元AI 后端。

systemd 托管把 chayuan-desktop 从纯单机应用扩展成轻量级共享后端的形态。免费开源的AI软件 在部署形态上的灵活性，让它能从个人桌面一直走到部门级共享，技术栈不变。
