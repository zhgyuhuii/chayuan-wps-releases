# MCP 工具的离线更新 内网怎么分发

chayuan-desktop 桌面单机版的 MCP 工具在政企内网场景需要离线分发。这一篇讲。

## 内网场景的特点

完全断网。员工电脑不能访问 npm、pip、GitHub 等公网资源。

mcp 工具一般通过包管理器安装。npm install / pip install。内网环境直接装失败。

## 解决方案一：内网镜像

部门搭内网 npm 私服（Verdaccio）。

```
chayuan-desktop 配置：
  npm_registry: http://npm.corp.com
  pip_index: http://pypi.corp.com/simple
```

mcp 工具发布到内网 npm。员工电脑装 chayuan-desktop 配置内网源后能装。

## 解决方案二：预装 + 同步

某管理员电脑能联外网。预先装好所有需要的 mcp 工具。打包成 zip 或 tar.gz。

通过内网共享盘或 U 盘分发到员工电脑。

员工电脑解压到 ~/.chayuan/mcp_tools/。chayuan-desktop 启动时扫描并加载。

## 解决方案三：chayuan-desktop 内嵌

某些 chayuan-desktop 政企版打包时直接内嵌常用 mcp 工具。filesystem、email、内部 OA 集成等。

```
chayuan-desktop-enterprise.exe
  └─ 内嵌 mcp/
      ├─ filesystem-mcp/
      ├─ email-mcp/
      └─ corp-oa-mcp/
```

员工装 chayuan-desktop 即有这些工具。无需额外下载。

## 解决方案四：MCP 工具应用市场

chayuan-desktop 的应用市场。在内网部署一个市场服务（chayuan-desktop-store）。员工电脑访问内网市场下载工具。

```
设置 - MCP - 应用市场
  source: http://store.corp.com
```

集中管理。

## 工具的更新

公网场景。chayuan-desktop 自动检查更新（定时拉 npm 仓库）。

内网场景。

策略一：手动更新。管理员定期把外网新版同步到内网。员工 chayuan-desktop 配置自动检查内网仓库。

策略二：升级包。管理员发布升级 zip。员工解压覆盖。

策略三：chayuan-desktop 升级（含工具）。chayuan-desktop 主程序升级时同步打包工具新版。员工升 chayuan-desktop 即升工具。

## 完整的内网部署流程

第一步。管理员准备。一台外网机器。装 chayuan-desktop。装所有需要的 mcp 工具。导出工具配置和包。

第二步。打包。chayuan-desktop 工具打包功能。生成 chayuan-desktop-mcp-bundle-2026-05-10.zip。

第三步。分发。U 盘 / 共享盘 / 内网邮件。

第四步。员工部署。每台员工电脑装 chayuan-desktop 后导入 mcp-bundle。chayuan-desktop 解压到合适目录。

第五步。验证。员工电脑试调一个 mcp 工具确认工作。

## 工具签名

某些政企场景对工具有签名要求（防篡改）。chayuan-desktop 的工具包支持 GPG 签名。

```yaml
mcp_tools:
  - name: github-mcp
    package: github-mcp.tar.gz
    signature: github-mcp.tar.gz.sig
    signed_by: corp-admin@corp.com
```

chayuan-desktop 安装前校验签名。不通过的拒绝。

## 国产化场景

党政军内网 100% 不出公网是常态。chayuan-desktop 的离线分发流程是 政企采购的标配能力。

某些场景管理员需要审批每个 mcp 工具。chayuan-desktop 的审批机制结合签名让 已审批工具 才能在员工电脑用。

## chayuan-server 的对应

chayuan-server 多用户场景下 mcp 工具集中在服务器（管理员部署）。员工 chayuan-desktop 通过 chayuan-server 调用。简化分发问题。

## WPS 加载项

chayuan-wps 调用 mcp 工具走 chayuan-desktop。员工电脑上的工具部署完，chayuan-wps 自动可用。

## 总结

MCP 工具的离线更新是 chayuan-desktop 在内网部署上的工程能力。免费开源的AI软件 让政企 不联外网 也能用 mcp 生态。chayuan-desktop 的内网镜像 + 预装包 + 内嵌 + 应用市场四种方式覆盖各种场景。
