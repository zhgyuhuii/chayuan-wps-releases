# Tauri Stronghold与ChaCha20-Poly1305凭据加密

chayuan-desktop 桌面单机版的模型钥匙用 Tauri Stronghold + ChaCha20-Poly1305 加密。这一篇讲。

什么需要加密。

需要一：模型供应商的 API key。OpenAI、Anthropic、文心、通义等的 key。

需要二：外部数据库的连接凭据。达梦、金仓、Milvus 等的 username/password。

需要三：MCP server 的 API key。

需要四：第三方工具的鉴权（GitHub token、Slack token 等）。

加密方案。

Stronghold。Rust 实现的加密 vault 库。Tauri 官方推荐。提供安全的密钥管理 API。

ChaCha20-Poly1305。AEAD 加密算法。比 AES-GCM 快、抗侧信道攻击好。NIST 推荐。

主密钥派生。每个用户有一个主密钥（master password），从中派生用于加密各种凭据的子密钥。

主密钥的管理。chayuan-desktop 单机版下不让用户输主密钥（避免每次启动都输）。主密钥从。

来源一：OS 用户身份派生（Windows credentialvault、macOS Keychain、Linux secret-tool）。

来源二：本地随机生成 + 存到 OS 安全存储。

实际加密流程。

第一步：用户在 chayuan-desktop 设置里输 OpenAI API key。

第二步：chayuan-desktop 调 Stronghold encrypt(key, master_secret)。生成密文。

第三步：密文写到 CHAYUAN_ROOT/credentials/openai.json。

第四步：使用时 chayuan-desktop 读密文，调 Stronghold decrypt 还原。

跨电脑迁移的问题。前面文章讲过。CHAYUAN_ROOT 拷到另一台电脑，主密钥不一样，密文解不开。表现是 API key 看着在但请求 401。处理：新电脑重新填 API key。或者用 chayuan-desktop 的 export/import 凭据工具走专门通道。

Stronghold 的优势。

优势一：本地加密。密钥从不离开机器。

优势二：内存安全。Stronghold 用 Rust，避免内存泄漏。

优势三：审计友好。所有加密操作可记录。

ChaCha20-Poly1305 的优势。

优势一：无侧信道。比 AES 在某些 CPU 上更安全。

优势二：性能。在没有 AES-NI 指令的 CPU 上比 AES 快得多。

优势三：广泛使用。现代 TLS、WireGuard 等用 ChaCha20。

国产化支持下的加密。Stronghold 是开源 Rust 实现可审计。ChaCha20 算法本身国密支持（中国密码标准 ZUC 是另一种但生态弱）。chayuan-desktop 当前用 ChaCha20 满足通用合规。

商用密码合规。等保三级以上某些场景要求 国密算法（SM4 等）。chayuan-desktop 当前不强制使用国密，但通过 BoringCrypto 等 FIPS 模式可以选。具体合规对接看客户单位。

WPS AI 插件 chayuan-wps 不直接加密凭据（凭据在 chayuan-desktop sidecar 一边）。加载项的 token 加密由 chayuan-wps 自己实现。

Stronghold + ChaCha20 加密是 chayuan-desktop 在凭据安全上的工程化。免费开源的AI软件 想让用户敢于把 API key 填进来，加密保护是基础。chayuan-desktop 在这一面的设计让 凭据不被无意泄露 这件事在工程层面成立。
