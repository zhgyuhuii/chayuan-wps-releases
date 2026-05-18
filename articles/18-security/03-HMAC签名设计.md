# HMAC签名 X-App-Id X-Sign X-Timestamp的设计

chayuan-desktop 桌面单机版的应用态鉴权（HMAC 模式）用三个 header 配合签名。这一篇讲设计。

应用态场景。第三方应用接 chayuan-desktop 后端。比如某个公司内部系统想用 chayuan-desktop 的 KB 查询能力。这个系统不是用户而是应用。

HMAC 流程。

第一步：应用注册。在 chayuan-server 多用户版后台注册一个 application，拿到 app_id（公开）和 app_secret（机密）。

第二步：应用每次调 chayuan-desktop API 时构造请求。

X-App-Id：明文 app_id。

X-Timestamp：当前 Unix 时间戳。

X-Sign：HMAC-SHA256(app_secret, body + timestamp)。

第三步：chayuan-desktop 收到请求。

按 X-App-Id 查应用，拿到对应 secret。

按 secret 跟 body + timestamp 重算 HMAC。

跟 X-Sign 对比。一致则鉴权通过。不一致拒绝。

校验 timestamp 是否在 5 分钟内（防重放）。

签名算法。

```
canonical = timestamp + ":" + method + ":" + path + ":" + body_hash
sign = base64(hmac_sha256(secret, canonical))
```

完整 canonical 让攻击者改任何一项都让 HMAC 不对。

防重放。

机制一：timestamp 5 分钟过期。超过的请求被拒绝。

机制二：可选的 nonce。每次请求带一个唯一 nonce，服务端缓存最近 5 分钟的 nonce 不重复。这种防止 5 分钟内的重放。

机制三：HTTPS。生产环境加密传输（chayuan-desktop 单机版本地不需要，多用户版需要）。

secret 的保密。

secret 不能泄露。一旦泄露攻击者能签任意请求。

应用方妥善保存。建议加密存储（OS keychain 或 vault）。

定期轮换。chayuan-server 多用户版后台支持重置 secret，应用方需要更新。

跟 OAuth 2.0 的对比。

OAuth 2.0 适合 用户授权应用 场景。流程复杂（重定向、token 换取）。

HMAC 适合 应用直接调 API 场景。流程简单。

chayuan-desktop 同时支持两种。看场景。

实现复杂度。HMAC 比 JWT 简单。不需要 token 管理，每次签名即可。但需要应用方实现 HMAC 计算（多数语言库都有）。

国产化支持下的 HMAC。HMAC 算法本身国际通用，国密合规需要 SM3 替代 SHA256。chayuan-desktop 当前用 SHA256，特定合规场景可换 SM3。

WPS AI 插件 chayuan-wps 在企业部署里可以用 HMAC 模式（如果 IT 选这种）。chayuan-wps 拿 app_id + secret 做签名。

HMAC 签名设计是 chayuan-desktop 给开发者的 API 鉴权方案。免费开源的AI软件 给第三方应用一个 简单可靠 的接入方式。chayuan-desktop 在 HMAC 这一面的实现让 把 chayuan-desktop 当中央 AI 服务 这件事工程上可达。
