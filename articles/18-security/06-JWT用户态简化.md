# JWT 用户态在多用户场景 单机版的简化

chayuan-desktop 桌面单机版的 JWT 用户态在多用户场景的简化。这一篇讲。

## JWT 是什么

JWT（JSON Web Token）。标准的用户身份令牌。

含 header.payload.signature 三部分。

服务端签名。客户端持有。

服务端校验签名 + payload 验证身份。

## chayuan-server 的 JWT

chayuan-server 多用户场景下 JWT 是核心。

每个用户登录拿 JWT。

JWT 含 user_id、role、expiry 等。

chayuan-server 校验 JWT 决定权限。

复杂完整。

## chayuan-desktop 单机的简化

chayuan-desktop 单机一般一个用户。

不必 JWT。

用 session-based 简易认证。

启动时主密码解锁 → 所有操作直接通过身份。

## 多身份模式的 JWT

某些场景一台 chayuan-desktop 多身份。

```
身份 A: zhangsan
身份 B: lisi
```

每个身份有独立 keystore + 数据。

chayuan-desktop 用简易 session token 区分（不必正式 JWT）。

```
session_token = HMAC(身份名 + nonce + 启动时间)
```

够用。

## 应用模式的 JWT

chayuan-desktop 暴露 OpenAI 兼容 API 给本机其他应用。

某些场景用 JWT。

```
某第三方应用通过 chayuan-server 拿 JWT。
该 JWT 带到 chayuan-desktop。
chayuan-desktop 校验 JWT（用 chayuan-server 的公钥）。
```

这种场景 chayuan-desktop 是 JWT 验证方而非签发方。

## 不强制 JWT

chayuan-desktop 单机不强制 JWT。简单的 API Key（HMAC）够用。

```
应用：
  - 类型: hmac
    app_id: app_xyz
    secret: <stored in stronghold>
  - 类型: jwt（少数场景）
    public_key: <用于校验>
```

灵活选择。

## JWT 的生命周期

JWT 有过期时间。chayuan-desktop 校验过期。

过期的 JWT 拒绝。要求应用重新拿。

某些场景 JWT 长有效期（24 小时）。某些短（5 分钟）。chayuan-desktop 配置可调。

## 刷新令牌

某些场景需要刷新令牌（refresh token）延长会话。

chayuan-desktop 支持。但单机一般不必（session 跟着 chayuan-desktop 进程，进程关了 session 没了）。

## JWT 的存储

chayuan-desktop 不主动存 JWT（不签发）。

应用调用 chayuan-desktop 时把 JWT 通过 header 传。

```
Authorization: Bearer <JWT>
```

chayuan-desktop 校验后忘掉。不持久化。

## 国产化场景

党政军场景对身份认证严格。chayuan-desktop 的简化模式也支持 JWT（验证方）满足合规。

某些场景要求 JWT 用 SM2 签名（国密）。chayuan-desktop 路线图。

## chayuan-server 的对应

chayuan-server 是 JWT 主战场。chayuan-desktop 单机简化版本。

## 总结

JWT 在单机版的简化是 chayuan-desktop 在 不要为简单事过度工程化 上的考量。免费开源的AI软件 让 单机版默认无 JWT 也能用。chayuan-desktop 的简化模式 + 应用级 JWT 支持让单机够用，企业场景能升级。
