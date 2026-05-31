---
slug: /reference/glossary
sidebar_position: 4
title: Glossar
---

Dieses Glossar standardisiert Schlüsselbegriffe, die in der gesamten Rilo-Dokumentation verwendet werden.

## Kernbegriffe

- Stufe:
  eine Pipeline-Phase wie Drehbuch, Sprechertext, Schlüsselbilder, Segmente, Komposition, Untertitel ausrichten oder Untertitel einbrennen.
- Laufzustand:
  persistierter Stufenstatus und Laufmetadaten in `run-state.json`.
- Artefakt:
  generierte Ausgabemetadaten (Pfade, URLs, Zeitachse, Prompts), die in `artifacts.json` persistiert werden.
- Projekt:
  der benannte Arbeitsbereich unter `projects/<project>/`, der Konfiguration, Inhalte, Artefakte, Laufzustand und Assets enthält.
- Regeneration:
  erneutes Ausführen einer oder mehrerer nachgelagerter Stufen nach gezielten Änderungen.
- Invalidierung:
  Markieren nachgelagerter Stufen als veraltet, wenn sich obere Eingaben ändern.
- Laufsperre:
  projektweite Sperre, die gleichzeitige Schreibvorgänge für dasselbe Projekt verhindert.

## API-Begriffe

- Jobs-API:
  Endpunkte unter `/jobs` zum Starten eines Laufs und Abrufen des Job-Status.
- Projects-API:
  Endpunkte unter `/projects` für Projekt-CRUD, Konfigurations-/Inhaltsaktualisierungen, Protokolle, Artefakte, Analysen und gezielte Regeneration.
- Webhook:
  Callback-Endpunkt (`/webhooks/replicate`) empfängt externe Vorhersageaktualisierungen.

## Dateiebene-Referenzen

- `config.json`: Projektkonfiguration und Modellauswahlen/Optionen.
- `story.md`: Quellgeschichteneingabe.
- `run-state.json`: Stufenabschluss und Laufmetadaten.
- `artifacts.json`: Generierte Ausgaben und Referenzen.
- `assets/`: Heruntergeladene/generierte Mediendateien.
