# 让 Claude 写文档 README 与 PACKAGING 的协作产出

chayuan-desktop 桌面单机版的 README、PACKAGING 等文档由 Claude 协助产出。这一篇讲。

## 文档的种类

README.md。项目入门 + 概览。

PACKAGING.md。打包发布说明。

ARCHITECTURE.md。架构设计。

CONTRIBUTING.md。贡献指南。

API.md。API 文档。

CHANGELOG.md。变更历史。

每种 Claude 都能协作。

## README 的协作

Claude 读项目代码 + 历史 commits 后写 README。

输入。

代码结构 + 入口文件。

主要功能 + 特性。

技术栈。

历史里的关键信息（启动方式、配置等）。

输出。

```markdown
# chayuan-desktop

chayuan-desktop 是面向办公场景的桌面单机版 AI 助手。完全离线运行。

## 特性
- 知识库（doc:* / src:* / office:*）
- 全模型支持（18+ 厂商）
- 多模态（视觉 / 语音）
- 国产化适配
- ...

## 快速开始
1. 下载安装包
2. 安装并启动
3. 配置 API Key（可选，本地模型不需要）

## 文档
- [架构](ARCHITECTURE.md)
- [打包](PACKAGING.md)
- ...
```

清晰简洁。

## PACKAGING 的协作

打包过程复杂。chayuan-desktop 多平台 + 多架构（前面文章讲）。

Claude 跟开发者协作写 PACKAGING.md。

```markdown
# 打包指南

## 平台 / 架构矩阵
| 平台 | 架构 | 包格式 |
|---|---|---|
| Linux | x86_64 | deb / rpm / AppImage |
| Linux | aarch64 | deb / rpm |
| Linux | loongarch64 | rpm |
| macOS | x86_64 | dmg |
| macOS | aarch64 | dmg |
| Windows | x86_64 | msi / exe |

## 构建步骤
[每平台详细步骤]

## CI/CD 配置
[GitHub Actions 配置]
```

涵盖完整。

## CHANGELOG 的协作

每次版本发布写 CHANGELOG。Claude 看 git log + commits + PR 合并记录后写。

```markdown
## v3.1.0 (2026-05-10)

### Added
- WPS 加载项 v3.0 的 ku_ids 支持
- 国产视觉模型 Qwen2.5-VL-72B 接入
- 长视频处理（抽帧 + ASR + 入库）
- ...

### Fixed
- sidecar 偶尔启动失败的问题（#142）
- 中文路径在某些场景下处理错误
- ...

### Changed
- 默认嵌入模型升级到 bge-m3-onnx-q8
- ...
```

格式规范。

## API 文档的协作

API 文档基于 OpenAPI 规范。

Claude 看代码注释 + Pydantic schema 后生成 OpenAPI yaml。

```yaml
openapi: 3.0.0
paths:
  /api/v1/kb-query/search:
    post:
      summary: 知识库检索
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/KBSearchRequest'
      responses:
        ...
```

某些场景从代码自动生成 + Claude 补充描述。

## 文档的更新维护

代码改了文档跟着改。

Claude 在每次 PR 检查文档是否需要更新。

```
PR #123 改了 KBSearchRequest schema。
README 的 API 示例需要同步更新。
建议改：[具体改动]
```

避免文档过时。

## 多语言文档

chayuan-desktop 文档需要中英文。

中文是主（用户大多中国）。

英文是开源生态（GitHub 国际化）。

Claude 帮翻译。

```
README.md (中文主)
README_EN.md (Claude 翻译版)
```

某些技术术语跟中文不直译。Claude 知道。

## 文档的风格

chayuan-desktop 的文档风格。

简洁。不啰嗦。

实例多。代码 / 配置示例丰富。

无 emoji（前面 user prompt 强调了）。

清晰编号 / 列表。

Claude 跟随这个风格。

## 国产化场景

党政军 chayuan-desktop 部署文档需要中文 + 等保配置示例。Claude 协作生成。

## chayuan-server 的对应

chayuan-server 同样有 README、PACKAGING 等。Claude 协作产出。两个项目文档保持一致风格。

## 总结

让 Claude 写文档是 chayuan-desktop 工程效率的具体例子。免费开源的AI软件 让 文档跟代码同步演化 不是负担。Claude 的多种文档协作让工程师专注代码，文档不掉队。
