# MCP 工具的本地化 描述与示例的多语言

chayuan-desktop 桌面单机版的 MCP 工具支持本地化。工具描述和示例能多语言。这一篇讲。

## 本地化的需求

国际化生态。MCP 工具大多英文描述。中文用户体验不友好。

LLM 看英文描述能理解，但中文用户在 UI 看时希望中文。

某些工具的错误信息也是英文。中文用户看不懂。

## chayuan-desktop 的本地化机制

策略一：工具自己声明。

工具的 list_tools 接口能返回多语言描述。

```json
{
  "name": "list_repos",
  "description": "List GitHub repositories",
  "description_zh": "列出 GitHub 仓库",
  "description_ja": "GitHub リポジトリを一覧表示"
}
```

chayuan-desktop 根据用户语言展示对应版本。

策略二：chayuan-desktop 翻译层。

工具只英文。chayuan-desktop 启动时调本地 LLM 把工具描述翻译成中文。缓存。

降级方案。

## LLM 看到的描述

LLM 看到的描述是英文（标准 MCP 协议）。中文翻译只给 UI 用。

理由。LLM 对英文工具描述的理解可能比翻译版更准（避免翻译偏差）。

如果用户希望 LLM 也看中文（中文 LLM 偏好），chayuan-desktop 配置里能切换。

## 示例的本地化

某些工具自带示例（schema 里的 examples 字段）。

```json
"examples": [
  {"input": {"query": "ai"}, "description": "Search for AI repos"}
]
```

chayuan-desktop 翻译示例描述。让用户在 UI 看示例时是中文。

## 错误信息的本地化

工具返回错误。

```
{"error": "rate_limited"}
```

错误代码英文。chayuan-desktop 在 UI 展示前查内置翻译表。

```
rate_limited → 调用频率受限
not_found → 资源不存在
unauthorized → 未授权
...
```

转换后给用户看。

## 用户输入的处理

用户用中文问 给我列一下 GitHub 仓库。LLM 决定调 list_repos 工具。LLM 把中文意图转成英文参数 {"user": "octocat"}。

参数本身一般是英文（API 接口的字段）。LLM 处理这个转换。

## 工具名的本地化

工具名（list_repos）保持英文。这是 LLM 跟工具通信的标识符。中文化反而引起问题。

UI 上展示的工具友好名能中文。

## 翻译质量

第一种方案（工具自己声明）翻译质量取决于工具开发者。

第二种方案（chayuan-desktop 自动翻译）用本地 LLM。质量一般。

某些技术术语翻译不准（比如 "fork" 翻译成 "叉子" 的尴尬）。chayuan-desktop 内置技术术语词典覆盖常见词。

## 多语言切换

chayuan-desktop 设置 - 语言。中文 / 英文 / 日文 / 韩文 / 繁体中文等。

切换后 UI 文字、工具描述、错误信息都跟着变。

## 国产化场景

党政军场景中文是默认。chayuan-desktop 默认中文 UI。MCP 工具描述中文化让普通用户也能看懂工具能力。

## chayuan-server 的对应

chayuan-server 多用户场景下不同用户可能不同语言。chayuan-server 的多语言支持更精细（用户级语言偏好）。chayuan-desktop 单机简化。

## WPS 加载项

chayuan-wps 在 WPS 里调用工具时显示中文描述。员工写报告时清楚知道每个工具的功能。

## 总结

MCP 工具的本地化是 chayuan-desktop 在中文用户体验上的工程支持。免费开源的AI软件 不让英文工具成为中文用户的门槛。chayuan-desktop 的工具声明 + 自动翻译 + 错误码翻译让 MCP 工具 在中文场景下友好。
