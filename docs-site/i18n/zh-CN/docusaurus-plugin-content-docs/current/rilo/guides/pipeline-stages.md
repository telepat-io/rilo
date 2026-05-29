---
slug: /guides/pipeline-stages
sidebar_position: 4
title: 管道阶段
---

阶段顺序：
1. 脚本
2. 旁白
3. 关键帧
4. 片段
5. 合成最终视频
6. 字幕对齐（可选）
7. 字幕烧录（可选）

每个阶段都会写入工件并更新运行状态，以实现安全恢复。

## 阶段依赖关系

- `voiceover` 依赖于生成的脚本。
- `keyframes` 依赖于脚本镜头/提示。
- `segments` 依赖于关键帧输出和提示上下文。
- `compose` 依赖于旁白和生成的片段。

## 运行时行为

- 片段数量根据测量的旁白持续时间得出。
- 已完成的阶段工件在有效时会被重用。
- 如果缺少必需的工件，Rilo 会从最早的必要阶段重新生成。

## 状态和工件

`projects/<project>/` 下的主要文件：
- `run-state.json`：阶段完成和恢复状态
- `artifacts.json`：生成的路径/URL 和时间线数据
- `assets/`：下载和生成的媒体

请参阅：
- [重新生成和失效](/guides/regeneration-and-invalidation)
- [输出工件](/reference/output-artifacts)
- [管道和失效图表](/technical/pipeline-and-invalidation-diagrams)