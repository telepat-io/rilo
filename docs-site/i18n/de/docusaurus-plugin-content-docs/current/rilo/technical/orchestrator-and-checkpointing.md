---
slug: /technical/orchestrator-and-checkpointing
sidebar_position: 2
title: Orchestrator und Checkpointing
---

Der Orchestrator koordiniert die Stufenausführung und persistiert Checkpoints, damit Läufe fortgesetzt werden können.

Checkpointing ermöglicht:
- Deterministische Wiederherstellung nach Fehlern
- Teilweise Neuläufe nach obigen Bearbeitungen
- Stabile projektweite Artefakte über Wiederholungen hinweg

## Was gecheckpointet wird

Pro Projektlauf persistiert Rilo:
- Stufenabschlusszustand in `run-state.json`
- Generierte Ausgaben und Pfade in `artifacts.json`
- Lokale Mediendateien in `assets/`

## Fortsetzungsverhalten

Wenn ein Lauf für dasselbe Projekt neu gestartet wird:
- Abgeschlossene Stufen werden bei gültigen Artefakten wiederverwendet
- Fehlende oder ungültige Artefakte lösen die Regeneration ab der frühesten erforderlichen Stufe aus
- Nachgelagerte Stufen bleiben invalidiert, bis Voraussetzungen neu aufgebaut sind

## Laufsperre

Rilo wendet eine projektweite Laufsperre an, um gleichzeitige Mutationen am selben Projekt zu verhindern.
Wenn ein Projekt bereits läuft, sollten neue Lauf-/Regenerierungsanfragen warten.

Siehe:
- [Pipeline-Stufen](/guides/pipeline-stages)
- [Regeneration und Invalidierung](/guides/regeneration-and-invalidation)
