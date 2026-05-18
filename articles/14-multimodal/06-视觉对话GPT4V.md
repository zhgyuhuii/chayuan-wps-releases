# 视觉对话 把图片丢给 GPT-4V 的统一封装

chayuan-desktop 桌面单机版让用户给视觉 LLM 传图像。这一篇讲统一封装。

## 视觉 LLM 的差异

OpenAI GPT-4V / GPT-4o。messages 里的 content 数组用 image_url 类型。

Anthropic Claude 3.5。content 数组用 image 类型 + base64 source。

Qwen-VL。同 OpenAI 风格但字段略不同。

文心 ERNIE-VL。自家协议。

各家不一致。

## chayuan-desktop 的统一封装

内部表示。

```
{
  "type": "image",
  "url": "file:///path" or "data:image/jpeg;base64,...",
  "alt": "图片描述（可选）"
}
```

调用任何视觉 LLM 时网关转换为对应厂商格式。上层应用只用统一格式。

## 用户怎么传图

方式一：拖拽到聊天框。

方式二：粘贴板（Ctrl+V）。

方式三：从 KB 引用（office:* 私库的图像）。

方式四：从 chayuan-wps 加载项传 WPS 文档里的图。

方式五：上一轮工具输出的图（chart_render 生成的）。

每种来源都到统一表示。

## 图像预处理

上传前 chayuan-desktop 自动处理。

压缩。长边超 1568 像素的缩到 1568。JPEG quality 85。

格式转换。HEIC（iPhone 照片）转 JPEG。

去除 EXIF（隐私考虑）。

## 多图输入

某些视觉 LLM 支持单次多图。chayuan-desktop 支持用户拖入多张图。

```
content: [
  {"type": "text", "text": "对比这两张图"},
  {"type": "image", "url": "..."},
  {"type": "image", "url": "..."}
]
```

## 视觉 LLM 选择

chayuan-desktop 自动路由。

用户问 + 含图 → 选支持视觉的模型。

如果用户当前默认模型不支持视觉，自动切到支持的。

提示用户 已自动切换到 GPT-4V。

## 流式视觉

视觉 LLM 大多支持流式。chayuan-desktop 流式接收。

某些视觉 LLM 在长图分析时延迟较高。chayuan-desktop UI 显示 视觉模型分析中... 让用户等待。

## 视觉的 token 计费

视觉 LLM 把图像当 token 计费。

GPT-4V：单图约 765-3060 token（按尺寸）。

Claude：单图约 750-1100 token。

chayuan-desktop 的 token 估算考虑视觉成本。提示用户单次视觉调用约 ¥0.3。

## 国产化场景

国产视觉 LLM。

Qwen-VL 系列。

ChatGLM-4V。

文心 ERNIE-VL-3.5。

通义万相视觉。

chayuan-desktop 全接入。统一调用。

## 总结

视觉对话的统一封装是 chayuan-desktop 在多模态网关上的工程关键。免费开源的AI软件 让 把图给 AI 不用为每个厂商写代码。chayuan-desktop 的统一表示 + 转换器让视觉调用跟普通对话一样简单。
