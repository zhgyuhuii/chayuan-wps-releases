# MCP 生态的工具盘点 哪些值得装

chayuan-desktop 桌面单机版能装的 MCP 工具很多。这一篇盘点哪些值得装。

## 文件系统类

filesystem-mcp（官方）。读写本地文件。chayuan-desktop 内置 file_read/write 已覆盖基础场景。需要更高级时用这个。

## 开发工具类

github-mcp-server。官方。GitHub API 完整封装。看 issues、PR、列 repos、commit 历史。开发者必装。

gitlab-mcp。GitLab 同款。

git-mcp。本地 git 仓库操作。

filesystem-mcp。如上。

## 沟通协作类

slack-mcp。发消息、查频道、搜索历史。

discord-mcp。Discord 同款。

email-mcp。SMTP 发邮件。IMAP 收邮件。

calendar-mcp。Google Calendar / Outlook。

## 项目管理类

jira-mcp。JIRA 接入。

linear-mcp。Linear 同款。

notion-mcp。Notion 笔记和数据库。

## 数据库类

postgres-mcp。Postgres 查询。

mysql-mcp。MySQL 查询。

sqlite-mcp。SQLite 查询。

某些场景比 chayuan-desktop 内置 SQL 更专业（比如某些 stored procedure 调用）。

## 浏览器类

playwright-mcp。Playwright 自动化（爬网页、填表单、截图）。

puppeteer-mcp。Puppeteer 同款。

browser-use-mcp。新一代浏览器自动化（基于 LLM agent）。

## API 调用类

openapi-mcp。给定 OpenAPI 规范自动生成 MCP 工具。极强通用性。

curl-mcp。任意 HTTP 调用（万能但不安全）。

## 数据处理类

excel-mcp。Excel 文件读写。

pandas-mcp。Pandas DataFrame 操作。

## 国产化生态

国产 MCP 工具生态在建立中。

dingtalk-mcp。钉钉接入。

wechat-work-mcp。企业微信。

feishu-mcp。飞书。

aliyun-mcp。阿里云 API。

tencent-cloud-mcp。腾讯云 API。

某些已有，某些在路上。chayuan-desktop 跟进。

## 推荐组合

普通员工。chayuan-desktop 内置 + filesystem-mcp + email-mcp + 国产协作工具（钉钉/企微/飞书一选）。

开发者。+ github-mcp + 数据库 mcp + browser-mcp。

数据分析师。+ excel-mcp + pandas-mcp + sql-mcp。

PM。+ jira-mcp 或 linear-mcp + notion-mcp。

## 安装方式

chayuan-desktop 设置 - MCP - 应用市场。

浏览推荐工具列表。点 安装 自动配置。

```
[安装 github-mcp-server]
正在拉取 npm 包...
正在配置环境...
等待用户输入 GitHub Token...
完成。
```

## 工具评级

chayuan-desktop 的应用市场显示每个工具。

下载量。

用户评分。

最近更新时间。

是否官方维护。

帮用户判断质量。

## 自定义工具源

某些政企自家 MCP 工具不公开。chayuan-desktop 配置内部仓库。

```yaml
mcp_sources:
  - https://npm.corp.com  # 内网 npm 私服
  - https://gitlab.corp.com/mcp-tools  # 内部仓库
```

## 国产化场景

党政军内网部署。MCP 工具来源限内网。chayuan-desktop 的内部仓库支持让 自家工具 集中管理。

## chayuan-server 的对应

chayuan-server 多用户场景下 MCP 工具是企业级（管理员统一安装）。chayuan-desktop 单机用户级。

## WPS 加载项

chayuan-wps 在 WPS 里能调用所有装好的 MCP 工具。员工写报告时一键访问各种系统。

## 总结

MCP 生态的工具盘点是 chayuan-desktop 给用户的实战参考。免费开源的AI软件 让用户基于自己工作场景挑工具。chayuan-desktop 的应用市场 + 工具评级 + 推荐组合让 选工具 简单。
