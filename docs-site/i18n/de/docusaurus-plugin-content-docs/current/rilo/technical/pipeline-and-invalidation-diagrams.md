---
slug: /technical/pipeline-and-invalidation-diagrams
sidebar_position: 2
title: Pipeline- und Invalidierungsdiagramme
---

Diese Seite bietet eine kompakte visuelle Referenz für Stufenfluss, Checkpointing und Invalidierung.

## Pipeline-Ablauf

```text
Geschichteneingabe
   |
   v
[Drehbuch] -> [Sprechertext] -> [Schlüsselbilder] -> [Segmente] -> [Komposition]
                                                               |
                                                               v
                                                    [Untertitel ausrichten] (optional)
                                                               |
                                                               v
                                                     [Untertitel einbrennen] (optional)
```

Hinweise:
- Die Segmentanzahl wird aus der gemessenen Sprechertext-Dauer geplant.
- Jede Stufe persistiert Artefakte, bevor die nächste Stufe beginnt.

## Checkpoint- und Fortsetzungsmodell

```text
run-state.json
  - Stufenabschluss-Flags
  - Status/Fehler
  - Zeitstempel der letzten Aktualisierung

artifacts.json
  - Drehbuch/Ton/Shots
  - Media-URLs/Pfade
  - Finale Ausgaben und Untertitelartefakte
```

Fortsetzungsregel:
- Wenn erforderliche Artefakte vorhanden und gültig sind, werden abgeschlossene Stufen wiederverwendet.
- Wenn Artefakte fehlen/ungültig sind, beginnt die Regeneration ab der frühesten erforderlichen Stufe.

## Invalidierungskaskade

```text
Story/Drehbuch-Änderung
  => Sprechertext, Schlüsselbilder, Segmente, Komposition, Ausrichten, Einbrennen

Text-zu-Bild-Modell/Optionsänderung
  => Schlüsselbilder, Segmente, Komposition, Ausrichten, Einbrennen

Bild-zu-Video-Modell/Optionsänderung
  => Segmente, Komposition, Ausrichten, Einbrennen

Untertiteloptionsänderung
  => Ausrichten, Einbrennen
```

## Betriebliche Schutzmaßnahme

Eine projektweite Laufsperre verhindert gleichzeitige Schreibvorguche auf dasselbe Projekt.
Verwenden Sie separate Projekte für parallele Experimente.

Siehe auch:
- [Pipeline-Stufen](/guides/pipeline-stages)
- [Regeneration und Invalidierung](/guides/regeneration-and-invalidation)
- [Orchestrator und Checkpointing](/technical/orchestrator-and-checkpointing)
