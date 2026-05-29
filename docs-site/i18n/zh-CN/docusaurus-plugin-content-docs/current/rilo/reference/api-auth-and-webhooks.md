---
slug: /reference/api-auth-and-webhooks
sidebar_position: 2
title: API 认证和 Webhook
---

Bearer 令牌认证：

`Authorization: Bearer <RILO_API_BEARER_TOKEN>`

作业：
- `POST /jobs`
- `GET /jobs/:jobId`

项目：
- `GET /projects`
- `POST /projects`
- `GET /projects/:project`
- `PATCH /projects/:project/config`
- `PATCH /projects/:project/metadata`
- `PATCH /projects/:project/content`
- `POST /projects/:project/regenerate`

项目内省：
- `GET /projects/:project/logs`
- `GET /projects/:project/prompts`
- `GET /projects/:project/artifacts`
- `GET /projects/:project/sync`
- `GET /projects/:project/snapshots`
- `GET /projects/:project/analytics`
- `GET /projects/:project/analytics/runs`
- `GET /projects/:project/analytics/runs/:runId`

文档和 Webhook：
- `GET /docs`
- `GET /openapi.json`
- `POST /webhooks/replicate`

在配置了 Webhook 的地方使用 WEBHOOK_SECRET 进行 Webhook 验证。

使用 `rilo settings` 配置 `RILO_API_BEARER_TOKEN`，或在从检出的仓库工作时使用 `npm run dev -- settings`。Webhook 和 Firebase 配置仍仅限于环境变量。

有关交互式模式和示例，请在 API 服务器运行时使用 `/docs`。