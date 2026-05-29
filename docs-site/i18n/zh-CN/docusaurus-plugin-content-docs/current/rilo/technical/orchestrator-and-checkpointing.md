---
slug: /technical/orchestrator-and-checkpointing
sidebar_position: 2
title: 编排器和检查点
---

编排器协调阶段执行并持久化检查点，以便运行可以恢复。

检查点支持：
- 故障后的确定性恢复
- 上游编辑后的部分重新运行
- 跨重试的稳定项目级工件

## 什么是检查点

每次项目运行，Rilo 持久化：
- `run-state.json` 中的阶段完成状态
- `artifacts.json` 中的生成输出和路径
- `assets/` 中的本地媒体文件

## 恢复行为

如果为同一项目重新启动运行：
- 当工件有效时，重用已完成的阶段
- 缺失或无效的工件会触发从最早的必需阶段开始重新生成
- 下游阶段在先决条件重建之前保持失效状态

## 运行锁定

Rilo 应用项目级运行锁以防止对同一项目的并发修改。
如果项目已在运行，新的运行/重新生成请求应等待。

请参阅：
- [管道阶段](/guides/pipeline-stages)
- [重新生成和失效](/guides/regeneration-and-invalidation)