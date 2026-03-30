---
slug: /guides/local-preview
sidebar_position: 8
title: Local Preview
---

The frontend app provides project CRUD, polling, targeted regeneration, and media preview.

Run full local stack:

```bash
npm run dev:all
```

Frontend default URL is http://localhost:5173.

`npm run dev:all` starts:
- API server
- worker processor
- frontend dev server

If you run services separately, start API and worker first, then frontend.

Quick health checks:
- API health: `GET /health`
- API docs: `GET /docs`
