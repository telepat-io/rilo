---
slug: /getting-started/installation
sidebar_position: 2
title: Installation
---

Voraussetzungen:
- Node.js 22+
- ffmpeg im PATH
- Replicate-API-Token

Empfohlene Installation:

```bash
npm install -g @telepat/rilo
```

Dann Anmeldedaten interaktiv konfigurieren:

```bash
rilo settings
```

Oder Anmeldedaten mit Umgebungsvariablen setzen:

```bash
TELEPAT_REPLICATE_TOKEN=...
RILO_API_BEARER_TOKEN=...
```

Wenn Sie nicht global installieren möchten, verwenden Sie `npx`:

```bash
npx @telepat/rilo settings
```

`rilo settings` speichert sichere Token in Ihrem OS-Schlüsselbund (oder verschlüsseltem lokalen Fallback) und speichert nicht-sensible Laufzeiteinstellungen in `~/.rilo/config.json`.

Wenn Sie aus einem ausgecheckten Repository beitragen, siehe [/contributing/development](/contributing/development) für den `npm run dev`-Workflow.
