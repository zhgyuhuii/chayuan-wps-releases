# macOS首次启动报无法验证 开发者签名与公证的现实做法

很多 macOS 用户首次双击察元AI 桌面单机版的 dmg，会看到一个灰色对话框 无法打开，因为 Apple 无法检查它是否包含恶意软件。这一篇专门讲清楚这个对话框背后的事，给一份能直接照做的处置步骤。

苹果的安全模型对 macOS 应用做了三层校验。第一层是 codesign 数字签名，验证应用是不是被开发者签过；第二层是 notarization 公证，验证开发者把应用提交给苹果做了恶意代码扫描；第三层是 Gatekeeper，决定双击运行时弹什么提示。免费开源的AI软件 在公证这一关常常踩坑，因为公证服务每次提交要花时间，开源项目维护者的发布节奏不一定能赶上。

第一种现象：dmg 双击之后打不开。最可能的是开发者证书被吊销了，或者 dmg 没经过公证。处置思路有两条。第一条是简单粗暴：打开终端，cd 到 dmg 挂载点，对应用做 xattr 清理 sudo xattr -cr /Applications/察元AI.app，把扩展属性里的 com.apple.quarantine 标记清掉，再双击就能跑。第二条是去系统设置里手动允许：系统设置 隐私与安全性 拉到底，会看到 已阻止 chayuan-desktop 字样，旁边一个 仍要打开 按钮，点一下，再来一次输入管理员密码即可。

第二种现象：跑起来但功能不全。比如 RAG 入库失败、模型供应商无法保存。这通常跟 macOS 的沙盒目录权限有关。FirstRunSetup 选了一个 chayuan-desktop 没读写权限的目录作为 CHAYUAN_ROOT，写盘失败。重新走一次首启动向导，把 CHAYUAN_ROOT 指到 ~/Library/Application Support/chayuan-desktop，这是最稳的位置；或者放在 ~/Documents/Chayuan，便于备份。

第三种现象：sidecar 进程起不来，活动监视器里看不到 chayuan-server。日志在 CHAYUAN_ROOT/logs/server.log。最常见的报错是 dyld: Library not loaded，缺少某个动态库。Apple Silicon 上偶尔会遇到 PyInstaller 打包的 sidecar 在新版 macOS 上跑出 codesign 校验失败的情况。处置思路是给整个 .app 重新签一次本地证书，命令是 sudo codesign --force --deep --sign - /Applications/察元AI.app，签完再运行。这种本地伪签的做法只对个人电脑有用，企业分发还是要走正经的开发者签名。

第四种现象：完成了所有步骤但还是有警告。这通常是 Gatekeeper 的策略被组织层面强化了。打开 spctl --status，如果输出 assessments enabled 表示 Gatekeeper 在跑严格模式。在企业环境下，IT 管理员需要在 MDM 里把 chayuan-desktop 的 team ID 加到允许列表，普通用户没办法绕开。

我个人建议的安装顺序是：从仓库 release 拿 dmg，先不双击，先在终端 xattr -cr ~/Downloads/chayuan-desktop-x.y.z.dmg 清掉下载属性，然后挂载、拖到 Applications，再双击。这样三步就能避免大部分弹窗。如果仍然弹，按上面的步骤手动允许一次。

签名与公证这件事对察元AI 是一个长期问题。AGPL-3.0 的开源项目要做正式的苹果开发者签名要每年交年费，而且每次发布要走公证流程。社区版本可能选择只在 release 里附 sha256 校验和，让有需要的用户自己重签。企业用户如果要部署到上百台 Mac，最稳的做法是把签名外包给 IT，由 IT 用企业证书重签发布给员工。

WPS AI 插件 chayuan-wps 在 macOS WPS 上的接入跟桌面单机版是松耦合的，加载项不直接受 macOS 公证策略影响，但桌面单机版起不来的话加载项就失去了后端。所以装机第一天，先把 chayuan-desktop 这一关过掉，剩下的事都是顺带的。
