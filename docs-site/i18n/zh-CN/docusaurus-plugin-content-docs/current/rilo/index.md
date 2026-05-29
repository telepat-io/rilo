---
slug: /
title: Rilo
sidebar_label: 欢迎
sidebar_position: 0
---

import HomepageFeatures from '@site/src/components/HomepageFeatures';

Rilo 是一个以故事为先的垂直视频生成管道。

它将故事转化为脚本、旁白、关键帧、片段，以及最终合成的视频，并可选择进行字幕对齐和烧录。

## 快速开始

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project demo --story-file ./story.txt
```

如果您更喜欢使用环境变量，请在运行前导出它们：

```bash
export TELEPAT_REPLICATE_TOKEN=...
export RILO_API_BEARER_TOKEN=...
```

如果您是从源码运行 Rilo 进行开发，请参阅 [/contributing/development](/contributing/development) 了解 `npm run dev` 和 `npm run dev:all` 工作流。

如果您更喜欢从检出的仓库进行 API 驱动运行，请使用 `npm run api` 启动 HTTP 服务器，并查看：
- Swagger UI 位于 `/docs`
- OpenAPI JSON 位于 `/openapi.json`

## 部分

- 入门：安装和首次运行
- 指南：管道工作流和操作
- 参考：CLI、环境变量、模型、工件、API 认证/ Webhook
- 技术：架构和运行状态内部机制
- 贡献：开发和文档/发布流程

## 推荐阅读路径

1. [安装](/getting-started/installation)
2. [快速开始](/getting-started/quickstart)
3. [配置](/guides/configuration)
4. [管道阶段](/guides/pipeline-stages)
5. [重新生成和失效](/guides/regeneration-and-invalidation)
6. [术语表](/reference/glossary)

<HomepageFeatures />