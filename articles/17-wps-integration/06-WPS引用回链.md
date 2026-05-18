# 在 WPS 里调起察元智库 引用气泡的回链体验

chayuan-wps 加载项让用户在 WPS 里调起察元智库。引用气泡能跳回 WPS 文档原段落。这一篇讲。

## 场景

员工在 WPS 写月报。需要查某历史会议讨论。

打开 chayuan-wps 加载项侧栏。

输入问题 上次会议关于产品 X 的讨论。

加载项调 chayuan-desktop 的检索接口。

返回的引用气泡含原文档路径 + 段落位置。

员工点引用 → WPS 直接跳到原会议纪要的具体段落。

无需切应用。

## 实现链路

第一步。chayuan-wps 加载项检测当前打开的 WPS 文档。

第二步。用户提问。加载项调 chayuan-desktop 检索接口（127.0.0.1:62581）。

第三步。chayuan-desktop 返回结果含引用 chunk + metadata（file_path、paragraph_index 等）。

第四步。加载项渲染引用气泡。

第五步。用户点引用。加载项检测如果引用的 file_path = 当前打开的 WPS 文档，调 WPS API 跳段落。

第六步。如果引用是其他 WPS 文档，加载项调 WPS 应用打开那份。

第七步。打开后调 WPS API 定位到 paragraph_index。

## WPS API 的用法

WPS 加载项 SDK 提供。

```js
const doc = WpsApplication.ActiveDocument;
const para = doc.Paragraphs[paragraph_index];
para.Range.Select();
WpsApplication.ScrollToView(para);
```

把光标移到对应段落 + 滚动到可见区。

## 跨文档跳转

如果引用来自不同 WPS 文档。

```js
WpsApplication.Documents.Open(file_path);
const doc = WpsApplication.ActiveDocument;
// 跳到段落
```

无缝打开。

## 引用气泡的样式

加载项侧栏的引用气泡。

```
[蓝色边框] 来自 doc:contracts
合同条款...
[查看原文]
```

```
[橙色边框] 来自 office:zhangsan:meetings
会议纪要...
[在 WPS 中打开]
```

颜色编码跟 chayuan-desktop 一致。

## hover 卡片

鼠标悬停引用气泡显示 hover 卡片。

```
来源: meetings_2026_05_10.docx
段落: 第 12 段
KB: office:zhangsan:meetings
日期: 2026-05-10
预览: ...
```

完整溯源信息。

## 多引用展示

加载项侧栏空间小。多个引用紧凑展示。

```
回答内容...

引用：
[1] [2] [3] [4] [5]
```

每个数字是一个引用。点击展开看详情。

## 向回写引用

某些场景用户希望把引用插入 WPS 文档。

加载项右上角 插入引用 按钮。

```
[插入到光标位置]
插入：引用文本 + 来源链接（链接批注形式）
```

WPS 文档里出现。

```
"会议讨论了产品 X..." [批注链接]
```

读者点批注链接跳到原文。

## 国产化场景

党政军场景在 WPS 里写公文 + 查 KB 是日常工作流。chayuan-wps 的引用回链让 写公文边查资料 极顺畅。

## chayuan-server 的对应

chayuan-server 模式下 chayuan-wps 走 chayuan-server。引用回链同样工作。

## chayuan-desktop 的协同

chayuan-wps 的检索调 chayuan-desktop 的接口。chayuan-desktop 后端处理 KB 检索 + 路由 + LLM 调用。chayuan-wps 只是 UI。

## 总结

WPS 引用回链是 chayuan-desktop + chayuan-wps 的体验高地。免费开源的AI软件 让 写报告 + 查资料 在同一个 WPS 应用内完整闭环。chayuan-wps 的回链 + WPS API 跳转让 办公场景 极致流畅。
