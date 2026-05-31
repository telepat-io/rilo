---
slug: /reference/api-auth-and-webhooks
sidebar_position: 2
title: API-Auth und Webhooks
---

Bearer-Token-Auth:

`Authorization: Bearer <RILO_API_BEARER_TOKEN>`

Jobs:
- `POST /jobs`
- `GET /jobs/:jobId`

Projekte:
- `GET /projects`
- `POST /projects`
- `GET /projects/:project`
- `PATCH /projects/:project/config`
- `PATCH /projects/:project/metadata`
- `PATCH /projects/:project/content`
- `POST /projects/:project/regenerate`

Projekt-Inspektion:
- `GET /projects/:project/logs`
- `GET /projects/:project/prompts`
- `GET /projects/:project/artifacts`
- `GET /projects/:project/sync`
- `GET /projects/:project/snapshots`
- `GET /projects/:project/analytics`
- `GET /projects/:project/analytics/runs`
- `GET /projects/:project/analytics/runs/:runId`

Dokumentation und Webhooks:
- `GET /docs`
- `GET /openapi.json`
- `POST /webhooks/replicate`

Verwenden Sie WEBHOOK_SECRET für die Webhook-Überprüfung, wo konfiguriert.

Konfigurieren Sie `RILO_API_BEARER_TOKEN` mit `rilo settings` oder verwenden Sie `npm run dev -- settings`, wenn Sie aus einem ausgecheckten Repository arbeiten. Webhook- und Firebase-Konfiguration bleiben nur über Umgebungsvariablen einstellbar.

Für interaktive Schemata und Beispiele verwenden Sie `/docs`, während der API-Server läuft.
