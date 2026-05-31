---
slug: /guides/regeneration-and-invalidation
sidebar_position: 5
title: Regeneration und Invalidierung
---

Rilo unterstützt teilweise Neuläufe durch Invalidierung nachgelagerter Stufen, wenn sich obere Eingaben ändern.

Beispiele:
- Story/Drehbuch-Bearbeitungen invalidieren Sprechertext und alle nachfolgenden visuellen Stufen
- Schlüsselbildmodell- oder Prompt-Bearbeitungen invalidieren Schlüsselbilder und spätere Stufen

Verwenden Sie Projektregenerierungs-APIs für gezielte Neuläufe statt vollständiger Projektnacherstellung.

## Häufige Invalidierungsmuster

- `PATCH /projects/:project/content` mit Story/Drehbuch-Änderungen:
  Sprechertext, Schlüsselbilder, Segmente und Komposition werden invalidiert.
- Modellauswahl- oder Modelloptionsänderungen:
  Die Invalidierung beginnt bei der betroffenen Kategorie (oder früher, falls nötig).
- Untertiteloptionsänderungen:
  Untertitel-Ausrichtungs- und Einbrennausgaben werden invalidiert.

## Gezielte Regeneration

Verwenden Sie `POST /projects/:project/regenerate` für begrenzte Neuläufe.
Dies ist ideal, wenn nur ein Schlüsselbild oder Segment ersetzt werden muss.

## Nebenlaufhinweis

Rilo setzt eine projektweite Laufsperre durch. Wenn ein Projekt bereits einen aktiven Lauf hat,
sollten Regenerierungsanfragen warten oder ein anderes Projekt verwenden.

Siehe [Pipeline- und Invalidierungsdiagramme](/technical/pipeline-and-invalidation-diagrams) für den visuellen Ablauf.
