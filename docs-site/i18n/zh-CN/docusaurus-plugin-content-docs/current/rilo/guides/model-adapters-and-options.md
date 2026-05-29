---
slug: /guides/model-adapters-and-options
sidebar_position: 2
title: 模型适配器和选项
---

Rilo 使用适配器模块来规范化特定于模型的输入：
- 文本到图像适配器
- 图像到视频适配器

这允许在不更改编排逻辑的情况下更换模型。

## 选项如何应用

- `models` 选择每个类别使用哪个提供商模型。
- `modelOptions` 根据所选模型元数据进行解析。
- 未知的键、无效的类型和超出范围的值将被拒绝。

## 类别

- `textToText`：脚本生成模型选项
- `textToSpeech`：语音和语音控制
- `textToImage`：关键帧生成选项
- `imageTextToVideo`：片段生成选项

## 推荐的调优工作流

1. 从默认模型和无覆盖开始。
2. 在 `modelOptions` 中一次添加一个选项。
3. 运行一个短项目并检查输出质量和运行时间。
4. 在项目配置中保存稳定的预设以实现可重复性。

请参阅：
- [模型目录](/reference/model-catalog)
- [配置](/guides/configuration)
- [故障排除](/guides/troubleshooting)