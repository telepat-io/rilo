---
slug: /guides/pipeline-stages
sidebar_position: 4
title: Pipeline-Stufen
---

Stufenreihenfolge:
1. Drehbuch
2. Sprechertext
3. Schlüsselbilder
4. Segmente
5. Finale Komposition
6. Untertitel ausrichten (optional)
7. Untertitel einbrennen (optional)

Jede Stufe schreibt Artefakte und aktualisiert den Laufzustand für sicheres Fortsetzen.

## Stufenabhängigkeiten

- `Sprechertext` hängt vom generierten Drehbuch ab.
- `Schlüsselbilder` hängen von Drehbuch-Shots/Prompts ab.
- `Segmente` hängen von Schlüsselbildausgaben und Prompt-Kontext ab.
- `Komposition` hängt vom Sprechertext plus generierten Segmenten ab.

## Laufzeitverhalten

- Die Segmentanzahl wird aus der gemessenen Sprechertext-Dauer abgeleitet.
- Abgeschlossene Stufenartefakte werden bei Gültigkeit wiederverwendet.
- Wenn ein erforderliches Artefakt fehlt, regeneriert Rilo ab der frühesten notwendigen Stufe.

## Zustand und Artefakte

Hauptdateien unter `projects/<project>/`:
- `run-state.json`: Stufenabschluss und Fortsetzungszustand
- `artifacts.json`: Generierte Pfade/URLs und Zeitachsendaten
- `assets/`: Heruntergeladene und generierte Medien

Siehe:
- [Regeneration und Invalidierung](/guides/regeneration-and-invalidation)
- [Ausgabeartefakte](/reference/output-artifacts)
- [Pipeline- und Invalidierungsdiagramme](/technical/pipeline-and-invalidation-diagrams)
