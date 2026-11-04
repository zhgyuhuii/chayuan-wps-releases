# screenshots/ — README 配图统一目录

本目录集中存放仓库 README（中文 `README.md` / 英文 `README.en.md`）引用的全部界面截图。
**目录自包含**：把本文件夹整体复制到其它项目根目录，并保持 README 中的相对路径 `screenshots/…`，引用即可继续生效。

## 命名规则

`<两位序号>-<宿主/模块>-<内容>.png`

- `writer-`：WPS 文字端
- `settings-`：加载项设置面板
- `workbench-`：察元 AI 生态 Web 工作台（桌面版 / 网络版，见 chayuan-desktop 项目）

## 文件清单

| 文件 | 内容 |
|---|---|
| `01-writer-assistant-welcome.png` | WPS 文字端「察元AI助理」选项卡打开的 AI 助手对话面板欢迎页（含微信公众号 / 微信 / 支付宝支持二维码） |
| `02-writer-text-analysis-menu.png` | 「文本分析」下拉菜单：换种方式重写 / 扩写 / 缩写 / AI 痕迹检查 / 提炼关键词等九件套 |
| `03-writer-more-tools-menu.png` | 「更多」菜单扩展功能：涉密关键词提取 / 表单智能提取 / 润色优化 / 生成会议纪要 / 创建·管理智能助手 |
| `04-writer-review-ribbon.png` | 「察元AI编审」选项卡：表单辅助 / 模板管理 / 规则管理 / 察元设置 |
| `05-settings-model-providers.png` | 设置 → 模型设置：OpenAI / Ollama / 通义千问 / DeepSeek 等供应商开关与密钥配置 |
| `06-settings-default-models.png` | 设置 → 默认设置：按用途（对话 / 生图 / 生视频 / 语音 / 截取）指定默认模型 |
| `07-settings-assistant-config.png` | 设置 → 助手设置：系统助手提示词、输入范围、执行模型等配置 |
| `08-settings-kb-connection.png` | 设置 → 知识库设置：连接列表与可访问知识库 |
| `09-settings-kb-connection-edit.png` | 编辑知识库连接：服务地址、JWT / HMAC 鉴权、连通测试 |
| `10-workbench-home.png` | 察元办公 Web 工作台主页（AI 操控 / AI 翻译 / AI 写作等快捷入口） |
| `11-workbench-new-chat.png` | Web 端新对话页（知识库 / 工具 / MCP 输入入口） |
| `12-workbench-multi-model-compare.png` | 多模型并排对比对话 |
| `13-workbench-kb-select.png` | 知识中心：选择知识库 |
| `14-workbench-kb-create.png` | 知识中心新建：文档知识库 / 图像库 / 结构化数据库 / 外部向量库 |
| `15-workbench-model-marketplace.png` | 模型广场：厂商卡片与模型下载 / 配置 / 测试 |
| `16-workbench-flow-canvas.png` | 智能空间 Flow 流程编排画布 |
| `17-workbench-training-data.png` | 训练数据中心：数据挂载 |

> 历史预览图 `public/images/about/screen-1~4.png` 为应用「关于」页内置资源，与本目录前 4 张同源，随应用分发，不在 README 中直接引用。
