---
slug: /reference/api-auth-and-webhooks
sidebar_position: 2
title: API Auth and Webhooks
---

Bearer token auth:

`Authorization: Bearer <RILO_API_BEARER_TOKEN>`

Jobs:
- `POST /jobs`
- `GET /jobs/:jobId`

Projects:
- `GET /projects`
- `POST /projects`
- `GET /projects/:project`
- `PATCH /projects/:project/config`
- `PATCH /projects/:project/metadata`
- `PATCH /projects/:project/content`
- `POST /projects/:project/regenerate`

Project introspection:
- `GET /projects/:project/logs`
- `GET /projects/:project/prompts`
- `GET /projects/:project/artifacts`
- `GET /projects/:project/sync`
- `GET /projects/:project/snapshots`
- `GET /projects/:project/analytics`
- `GET /projects/:project/analytics/runs`
- `GET /projects/:project/analytics/runs/:runId`

Docs and webhooks:
- `GET /docs`
- `GET /openapi.json`
- `POST /webhooks/replicate`

Use WEBHOOK_SECRET for webhook verification where configured.

Configure `RILO_API_BEARER_TOKEN` with `rilo settings`, or use `npm run dev -- settings` when working from a checked-out repository. Webhook and Firebase configuration remain environment-variable only.

For interactive schemas and examples, use `/docs` while the API server is running.
