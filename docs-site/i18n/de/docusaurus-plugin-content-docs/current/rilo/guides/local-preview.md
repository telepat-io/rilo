---
slug: /guides/local-preview
sidebar_position: 8
title: Lokale Vorschau
---

Die Frontend-App bietet Projekt-CRUD, Abfrage, gezielte Regeneration und Medienvorschau.

Vollständigen lokalen Stack ausführen:

```bash
npm run dev:all
```

Standard-URL des Frontends ist http://localhost:5173.

`npm run dev:all` startet:
- API-Server
- Worker-Prozessor
- Frontend-Entwicklungsserver

Wenn Sie Dienste separat ausführen, starten Sie zuerst API und Worker, dann das Frontend.

Schnelle Gesundheitsprüfungen:
- API-Gesundheit: `GET /health`
- API-Dokumentation: `GET /docs`
