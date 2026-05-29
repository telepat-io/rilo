---
slug: /guides/regeneration-and-invalidation
sidebar_position: 5
title: 重新生成和失效
---

Rilo 通过在上游输入更改时使下游阶段失效来支持部分重新运行。

示例：
- 故事/脚本编辑会使旁白和所有后续视觉阶段失效
- 关键帧模型或提示编辑会使关键帧和后续阶段失效

使用项目重新生成 API 进行有针对性的重新运行，而不是完全重新创建项目。

## 常见的失效模式

- `PATCH /projects/:project/content` 包含故事/脚本更改：
  旁白、关键帧、片段和合成将失效。
- 模型选择或模型选项更改：
  失效从受影响的类别开始（如果需要，从更早的阶段开始）。
- 字幕选项更改：
  字幕对齐和烧录输出将失效。

## 有针对性的重新生成

使用 `POST /projects/:project/regenerate` 进行范围化的重新运行。
当只有一个关键帧或片段需要替换时，这是理想的选择。

## 并发注意事项

Rilo 强制执行项目运行锁。如果项目已有活动运行，
重新生成请求应等待或使用不同的项目。

请参阅[管道和失效图表](/technical/pipeline-and-invalidation-diagrams)了解可视化流程。