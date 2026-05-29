---
slug: /guides/story-format-and-script-generation
sidebar_position: 3
title: 故事格式和脚本生成
---

提供一个清晰的故事，包含上下文、节拍和期望的语调。

Rilo 脚本生成以持续时间为目标，并在输出长度超出目标范围时进行重试。

故事输入的提示：
- 包括场景、时间线和关键转折点。
- 优先考虑具体细节而非抽象提示。
- 每个项目保持一个清晰的叙事弧线。

视觉规划使用测量的旁白持续时间：

`segments = ceil(audioDurationSec / 5)`

这可以防止视觉内容在旁白之前结束。

相关页面：
- [管道阶段](/guides/pipeline-stages)
- [重新生成和失效](/guides/regeneration-and-invalidation)