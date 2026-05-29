---
slug: /technical/architecture
sidebar_position: 1
title: 架构
---

Rilo 架构以管道编排器和隔离的阶段模块为中心。

主要领域：
- 编排器和运行状态转换
- 生成阶段和适配器注册表
- API 路由和身份验证中间件
- 存储后端和同步
- 工作进程处理循环

核心运行时循环：
1. API 或 CLI 创建/恢复项目运行。
2. 编排器按顺序执行生成阶段。
3. 每个阶段后，工件和运行状态被持久化。
4. 重新生成请求仅使下游阶段失效。

另请参阅：
- [管道和失效图表](/technical/pipeline-and-invalidation-diagrams)
- [编排器和检查点](/technical/orchestrator-and-checkpointing)