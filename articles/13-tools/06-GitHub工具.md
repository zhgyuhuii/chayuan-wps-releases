# GitHub 工具 私库与公共库的处理

chayuan-desktop 桌面单机版的 GitHub 工具区分私库和公共库。这一篇讲。

## 工具能力

chayuan-desktop 内置 / MCP 接入的 GitHub 工具能。

list_repos。列出用户的 repo。

get_repo。某个 repo 的详情。

list_issues。某 repo 的 issues。

create_issue。开 issue。

list_prs。pull requests。

get_file_content。某文件内容。

search_code。代码搜索。

等等。

## 鉴权

GitHub Token 是关键。

chayuan-desktop 设置 - 工具 - GitHub。填 Personal Access Token。

Token 的 scope。

只读：repo:read（公库 + 私库读取）。

写：repo（开 issue、commit）。

完整：repo + workflow + admin（极少需要）。

chayuan-desktop 默认建议只读。需要写时用户主动提升。

## 私库的处理

GitHub 私库需要 Token 才能访问。Token scope 含 repo 时能读私库。

chayuan-desktop 调 list_repos 时用户私库一并返回（标 private=true）。

LLM 答题时如果引用私库内容，UI 上提示 此引用来自您的私库。

## 私库内容上云的提示

如果用户用云模型（GPT-4o）。LLM 看到私库代码内容。

chayuan-desktop 弹提示。

```
您的查询命中 GitHub 私库内容。这些代码会随 prompt 发送给 OpenAI。继续？
[继续] [改用本地模型] [取消]
```

让用户对私库代码出云有知情权。

## 公共库的处理

公库无需鉴权。chayuan-desktop 也用 Token 调（避免 GitHub 匿名限速）。

公库内容自由处理，无隐私顾虑。

## rate limit

GitHub API 限速。

匿名：60 req/h。

Token：5000 req/h（基础）。

GitHub Enterprise：自家限制。

chayuan-desktop 监控 rate limit。接近耗尽提示用户。

## 自托管 GitHub

某些公司用 GitHub Enterprise（自托管）。

chayuan-desktop 配置自定义 base_url。

```
github_base_url: https://github.corp.com
```

GitHub Enterprise 跟公共 GitHub 协议一致。chayuan-desktop 透明支持。

## GitLab / Gitea 协议

GitHub 工具实际上不能直接用于 GitLab。chayuan-desktop 提供独立 gitlab-mcp、gitea-mcp。

某些工具（如 git 操作）跨平台通用。chayuan-desktop 抽象成 git_local 工具。

## 国产化场景

党政军内网常用国产 git 平台（如 Gitee 内部版、腾讯工蜂）。chayuan-desktop 的 GitHub 工具协议接近 GitHub，能直接用 Gitee 等仿 GitHub 的接口。

## chayuan-server 的对应

chayuan-server 多用户场景下 GitHub 工具的 Token 集中管理。chayuan-desktop 单机用户级。

## WPS 加载项

chayuan-wps 在 WPS 里某些场景调用 GitHub 工具（比如 帮我列下我的 repo 写到文档里）。chayuan-wps 走 chayuan-desktop 调。私库提示同样弹。

## 总结

GitHub 工具的私库与公共库处理是 chayuan-desktop 在敏感数据保护上的工程细节。免费开源的AI软件 让 私库代码 不被无意识发到云端。chayuan-desktop 的 Token 管理 + 私库标识 + 上云提示让 GitHub 工具 既好用又安全。
