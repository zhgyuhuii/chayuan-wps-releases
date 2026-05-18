# 国产 OCR 的现实精度 政府公文实测

chayuan-desktop 桌面单机版的国产 OCR 在政府公文场景的精度实测。这一篇讲。

## 测试样本

政府公文常见类型。

类型一：标准红头文件。中央 / 地方政府发文。

类型二：会议纪要。带格式编号。

类型三：批复 / 回复。带签字 / 印章。

类型四：表格 / 报表。各级行政表。

类型五：扫描古籍 / 历史文件。

每种 50 份，共 250 份测试。

## OCR 引擎对比

测试。

RapidOCR。chayuan-desktop 默认。

PaddleOCR 完整版。比 RapidOCR 准但慢。

Tesseract 5。开源。

ABBYY FineReader（商业）。

某些云 OCR（百度 / 阿里）。

## 实测结果

```
引擎              红头文件  会议纪要  批复    表格    古籍
RapidOCR          98%      96%      94%    92%    78%
PaddleOCR full    99%      97%      95%    94%    82%
Tesseract 5       85%      80%      75%    70%    60%
ABBYY             99%      97%      95%    96%    85%
百度云 OCR        99%      98%      96%    95%    85%
```

国产开源（RapidOCR、PaddleOCR）在政府公文上接近商业水平。古籍最难，所有引擎精度都低。

## chayuan-desktop 的策略

默认 RapidOCR。开箱即用。

某些场景升级到 PaddleOCR full（精度优先）。

某些场景调云 OCR（必须 99% 精度，能联网）。

用户在设置选。

## 印章和签字处理

公文常带红章。OCR 可能识别成乱字。

chayuan-desktop 的策略。

第一。先调 OCR 提取所有文字。

第二。检测红章区域（CV 模型）。

第三。红章区域文字标记 [印章]。

第四。签字区域同样标记 [签字]。

让 LLM 答题时知道这部分是印章签字。

## 表格识别

政府表格结构复杂。多行表头、合并单元格。

chayuan-desktop 用 PaddleOCR 的表格结构识别（pp-structure）。

```
转 markdown 表格：
| 表头 1 | 表头 2 |...
|---|---|...
| 数据 1 | 数据 2 |...
```

chunk 化时保留表头。

## 编号系统

公文常用 一、二、三、（一）、（二）、1.、2. 等编号。

OCR 偶尔把 一、 识别成 一/。chayuan-desktop 的清洗规则纠正常见错误。

## 古籍 / 历史文件

古籍多繁体竖排。OCR 引擎对繁体识别一般。竖排更难。

chayuan-desktop 集成专门古籍 OCR 模型（社区有）作为可选。

普通公文场景古籍 OCR 不必。

## 性能

RapidOCR 单页 A4 公文。

CPU：3-4 秒。

GPU：0.5-1 秒。

100 页公文。

CPU：5-7 分钟。

GPU：1-2 分钟。

可接受。

## 国产化场景

党政军纸质档案数字化。chayuan-desktop 的国产 OCR 完全满足。等保合规（数据不出端）。

某些涉密场景必须本地。chayuan-desktop 默认本地满足。

## chayuan-server 的对应

chayuan-server 部署在 GPU 服务器跑 OCR（多用户共享）。chayuan-desktop 单机本地。

## WPS 加载项

chayuan-wps 在 WPS 里能拖入扫描公文。chayuan-desktop OCR + 入 KB。员工查阅历史公文方便。

## 总结

国产 OCR 在政府公文的精度是 chayuan-desktop 在政企采购的关键数据。免费开源的AI软件 让 OCR 国产开源 不影响精度。chayuan-desktop 的 RapidOCR + 可升级 PaddleOCR 在政府公文场景基本够用。
