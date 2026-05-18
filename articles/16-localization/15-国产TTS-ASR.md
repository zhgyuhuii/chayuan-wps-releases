# 国产 TTS ASR 的接入与替换

chayuan-desktop 桌面单机版的国产 TTS / ASR 接入。这一篇讲。

## ASR 选项

FunASR（阿里达摩院）。chayuan-desktop 默认。

Paraformer-large 中文 ASR。

实时流式。

CTranslate2 加速。

ONNX 版本。

PaddleSpeech（百度）。

百度的语音工具集。中文好。

社区维护。

讯飞 ASR（商业 API）。

云服务。精度极高。需要联网。

阿里云 NLS（商业 API）。

腾讯云 ASR（商业）。

## TTS 选项

Piper（本地 TTS）。

中文 Piper 模型 zh_CN-huayan-medium。

CPU 友好。

CosyVoice（阿里）。

Cosy 系列开源。声音自然。

GPU 加速更好。

GPT-SoVITS。

社区开源。能 voice cloning。

讯飞 TTS（商业 API）。

阿里云 TTS / 腾讯云 TTS。商业。

## 接入方式

chayuan-desktop 内置 FunASR + Piper 作为默认本地。

其他通过 OpenAI 兼容协议接入。

```yaml
asr_providers:
  - name: 讯飞
    base_url: ...
    auth: app_id + api_key
  - name: 阿里 NLS
    ...
```

## 评测对比

ASR 中文准确率（标准普通话朗读）。

```
FunASR Paraformer: 96%
PaddleSpeech: 94%
讯飞 ASR: 98%
百度 ASR: 97%
阿里 NLS: 97%
```

商业云 ASR 略胜。本地 FunASR 也够用。

ASR 方言识别（如四川话、粤语）。

```
FunASR: 普通话好，方言一般
讯飞: 方言模型多
```

方言场景商业云更好。

## TTS 自然度对比

```
Piper（本地）: 7/10（机器味）
CosyVoice: 8.5/10（自然）
讯飞 TTS: 9/10
阿里 TTS: 9/10
GPT-SoVITS: 8/10（可克隆）
```

商业 TTS 更自然。

## 选型建议

家用 / 个人。Piper 本地够用。免费。

办公场景。FunASR + Piper 默认。需要更好质量时切 CosyVoice 本地。

商务场景。可以配讯飞 / 阿里。完全合规。

涉密场景。必须本地。FunASR + Piper。

## 替换流程

chayuan-desktop 设置 - 语音 - ASR / TTS。

```
ASR: [本地 FunASR ▼]
  [本地 FunASR]
  [本地 PaddleSpeech]
  [讯飞 ASR (云)]
  [阿里 NLS (云)]

TTS: [本地 Piper ▼]
```

切换无缝。需要时 chayuan-desktop 自动下载新模型。

## 流式 ASR

会议直播场景需要流式。

FunASR 支持流式。chayuan-desktop 默认开。

讯飞 ASR / 阿里 NLS 也支持流式。chayuan-desktop 实现 WebSocket 流。

## TTS 的克隆

某些场景希望 TTS 用特定声音（领导声音、定制语音助手）。

GPT-SoVITS / VoiceClone。需要 5-10 秒目标声音样本，生成相似声音。

chayuan-desktop 的可选模块。隐私和合规风险大。默认禁用。需要明确授权才开。

## 国产化场景

党政军场景对 ASR / TTS 国产化有要求。chayuan-desktop 的 FunASR + Piper 全国产化栈满足。

某些场景需要方言（粤语、闽南语等）支持。chayuan-desktop 可配多个 ASR 引擎按场景选。

## chayuan-server 的对应

chayuan-server 部署 GPU 服务器跑 ASR / TTS（多用户共享）。chayuan-desktop 单机本地。两者协议一致。

## WPS 加载项

chayuan-wps 在 WPS 里支持语音输入和朗读。走 chayuan-desktop 的 ASR / TTS 后端。员工感知就是 WPS 里能 说和听。

## 总结

国产 TTS / ASR 接入是 chayuan-desktop 在多模态国产化上的工程能力。免费开源的AI软件 让 语音功能 全国产可用。chayuan-desktop 的本地 + 商业云双轨 + 灵活替换让语音场景覆盖完整。
