# 模型生成内容的合规 NSFW 与敏感词

chayuan-desktop 桌面单机版对模型生成内容的合规检查。这一篇讲。

## 合规的几个维度

NSFW（不适合工作）。色情、暴力、血腥等。

敏感词（中国法规）。涉政、涉稳、涉黄、涉暴等。

法律风险（如教唆犯罪、传授不当方法）。

价值观（社会主义核心价值观）。

商业合规（涉嫌侵权、伪造）。

每维度都需要检查。

## 检查的时机

时机一：用户输入时。

某些 prompt 本身违规（让 LLM 生成色情、暴力内容）。chayuan-desktop 拒绝。

时机二：LLM 输出时。

LLM 生成的内容违规。chayuan-desktop 过滤或屏蔽。

时机三：图像 / 视频生成时。

生成的图像 / 视频 NSFW。chayuan-desktop 拦截。

## 检查方法

方法一：关键词匹配。简单粗暴。

```
banned_words = ["...", "...", "..."]
if any(word in text for word in banned_words):
    block()
```

不准但快。

方法二：分类模型。

chayuan-desktop 内置轻量分类器（基于 BERT 中文）。

```
text → classifier → safe / unsafe (label)
```

更准。但慢一些。

方法三：LLM 自审。

某些场景让 LLM 自己审查输出是否合规。

```
LLM: 让我检查刚才的回答是否合规...
LLM: 包含敏感内容，我重新回答。
```

## 中国敏感词词典

党政军场景需要中国合规。

涉政词（领导人、政策敏感）。

涉稳词（特定事件）。

涉黄涉暴词。

涉宗教词。

chayuan-desktop 内置词典（基于公开法规）。也支持用户扩展。

## 国产模型的内置合规

国产 LLM（文心、Qwen、智谱等）训练时已经做合规。某些 prompt 直接拒绝。

```
用户：[违规 prompt]
LLM：抱歉，我无法回答这个问题。
```

chayuan-desktop 的 二次检查 是叠加保险。

## 国外模型的合规差距

GPT-4 / Claude 对中国合规不熟。某些回答可能不符中国规定。

chayuan-desktop 的本地合规过滤 拦截不当输出。

## 拦截的处理

拦截后 chayuan-desktop。

提示用户。

```
您的请求或回答包含不合规内容，已被屏蔽。
```

记审计。

某些场景给 LLM fallback 让它换个表述（合规版）。

## 误拦截

某些正常内容被误拦（如学术讨论某历史事件）。

chayuan-desktop 提供 误报反馈。用户能标记。

某些场景用户能 临时绕过（自己负责）。但记审计。

## 国产化场景

党政军场景对合规严格。chayuan-desktop 默认严格拦截。

某些场景需要根据当地法规调整。chayuan-desktop 配置可调。

生成式 AI 服务管理办法 要求 AI 输出合法合规。chayuan-desktop 默认满足。

## 图像 NSFW

视觉生成 NSFW 检测（前面文章讲）。chayuan-desktop 的 CV 模型检测 + 关键词检测组合。

## 视频检测

视频时间长。chayuan-desktop 抽关键帧检测。

某帧 NSFW → 整个视频标记。

## chayuan-server 的对应

chayuan-server 多用户场景下合规由企业级管理（管理员配置词典）。chayuan-desktop 单机用户级。

## WPS 加载项

chayuan-wps 在 WPS 里的 AI 输出经过 chayuan-desktop 过滤。WPS 文档不会被插入不当内容。

## 总结

模型生成内容的合规是 chayuan-desktop 在合规和负责任 AI 上的工程基础。免费开源的AI软件 不能因为 AI 自由 让 内容违规。chayuan-desktop 的多层检查 + 国产词典 + 误报反馈让 AI 合规生成。
