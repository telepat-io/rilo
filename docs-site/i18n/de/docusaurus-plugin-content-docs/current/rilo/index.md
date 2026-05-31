---
slug: /
title: Rilo
sidebar_label: Willkommen
sidebar_position: 0
---

import HomepageFeatures from '@site/src/components/HomepageFeatures';

Rilo ist eine story-orientierte vertikale Videogenerierungspipeline.

Sie verwandelt eine Geschichte in Drehbuch, Sprechertext, Schlüsselbilder, Segmente und ein zusammengesetztes Video mit optionaler Untertitelausrichtung und Einbrennung.

## Schnellstart

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project demo --story-file ./story.txt
```

Wenn Sie Umgebungsvariablen bevorzugen, exportieren Sie diese vor dem Ausführen:

```bash
export TELEPAT_REPLICATE_TOKEN=...
export RILO_API_BEARER_TOKEN=...
```

Wenn Sie Rilo aus Quelle für Entwicklung ausführen, siehe [/contributing/development](/contributing/development) für `npm run dev` und `npm run dev:all` Workflows.

Wenn Sie API-gesteuerte Läufe aus einem ausgecheckten Repository bevorzugen, starten Sie den HTTP-Server mit `npm run api` und prüfen Sie:
- Swagger UI unter `/docs`
- OpenAPI JSON unter `/openapi.json`

## Abschnitte

- Einführung: Installation und erster Lauf
- Anleitungen: Pipeline-Workflows und Betrieb
- Referenz: CLI, Umgebungsvariablen, Modelle, Artefakte, API-Auth/Webhooks
- Technisch: Architektur und Laufzustand-Internas
- Beitragen: Entwicklung und Docs/Release-Prozess

## Empfohlener Leseweg

1. [Installation](/getting-started/installation)
2. [Schnellstart](/getting-started/quickstart)
3. [Konfiguration](/guides/configuration)
4. [Pipeline-Stufen](/guides/pipeline-stages)
5. [Regeneration und Invalidierung](/guides/regeneration-and-invalidation)
6. [Glossar](/reference/glossary)

<HomepageFeatures />
