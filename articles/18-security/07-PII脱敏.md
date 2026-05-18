# PII 脱敏 governance redact 在察元 AI 的位置

chayuan-desktop 桌面单机版的 PII 脱敏（governance redact）。这一篇讲。

## PII 是什么

PII（Personal Identifiable Information）。个人身份信息。

姓名、电话、身份证号、银行卡、地址、邮箱等。

合规要求处理 PII 时谨慎。

## chayuan-desktop 的脱敏场景

场景一：发送给云 LLM 时脱敏。

用户问含 PII 的 prompt。chayuan-desktop 默认提示。

```
您的 prompt 含 PII（电话号码）。
是否脱敏后发送？
[脱敏]（推荐） [原文] [取消]
```

场景二：导出 KB 时脱敏。

法务想把私库导给律师。可选脱敏。

场景三：聊天导出时脱敏。

把聊天记录导出给同事。脱敏 PII。

场景四：审计日志脱敏。

审计日志默认不记完整 PII。

## 检测的 PII 类型

姓名（中英文）。

电话号码（11 位 / 7 位 / 国际）。

身份证号（18 位）。

银行卡号（13-19 位）。

邮箱地址。

地址（含门牌、街道、区县）。

公司名称。

车牌号。

护照号 / 驾驶证号。

自定义实体（项目代号、内部 ID）。

## 检测方法

方法一：正则表达式。简单常见 PII 用正则。快但有误识别。

```
身份证号: \d{17}[\dX]
手机号: 1[3-9]\d{9}
邮箱: [\w.]+@[\w.]+
```

方法二：NER（命名实体识别）。本地小模型识别复杂 PII。

```
使用 chayuan-desktop 的本地 NER 模型（基于 BERT 中文）。
识别 姓名、地址 等需要语义的 PII。
```

方法三：组合。chayuan-desktop 默认正则 + NER 组合。准且全。

## 脱敏方式

方式一：完全打码。

```
张三 → ***
13800138000 → ***********
```

方式二：部分脱敏。

```
张三 → 张*
13800138000 → 138****8000
```

方式三：占位符。

```
张三 → [姓名_001]
13800138000 → [手机号_001]
```

便于上下文跟踪。

方式四：加密替换。

```
张三 → AES(张三, key)
```

授权方能解密回原文。

chayuan-desktop 默认部分脱敏。设置可调。

## 脱敏的时机

时机一：用户输入时实时检测。

聊天框输入时识别 PII，提示用户。

时机二：发送给 LLM 前。

最后一次脱敏机会。

时机三：写入 KB 前。

文档入库时按用户配置脱敏。

时机四：导出时。

按导出场景脱敏。

每个时机都有脱敏入口。

## 自定义规则

某些行业有特殊 PII。

医疗：病历号、医保号。

金融：账号、客户号。

科研：项目代号。

chayuan-desktop 配置自定义正则。

```yaml
custom_pii_patterns:
  - name: "病历号"
    regex: "BL\d{8}"
    redact_method: "占位符"
```

## 国产化场景

党政军场景的 PII 脱敏严格。chayuan-desktop 的多种脱敏方式 + 自定义规则满足。

个人信息保护法对 PII 处理有明确要求。chayuan-desktop 的脱敏满足合规。

## chayuan-server 的对应

chayuan-server 多用户场景下脱敏由企业级配置。chayuan-desktop 单机用户级。

## WPS 加载项

chayuan-wps 在 WPS 里调 chayuan-desktop。脱敏对 chayuan-wps 透明。

## 总结

PII 脱敏是 chayuan-desktop 在合规和隐私保护上的工程能力。免费开源的AI软件 让 含 PII 的工作 也能用 AI 不出事。chayuan-desktop 的多类型识别 + 多方式脱敏 + 多时机覆盖让 PII 处理 在工程上可靠。
