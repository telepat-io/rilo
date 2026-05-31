---
slug: /guides/model-adapters-and-options
sidebar_position: 2
title: Modell-Adapter und Optionen
---

Rilo verwendet Adapter-Module zur Normalisierung modellspezifischer Eingaben:
- Text-zu-Bild-Adapter
- Bild-zu-Video-Adapter

Dies ermöglicht den Modellaustausch ohne Änderung der Orchestrierungslogik.

## Wie Optionen angewendet werden

- `models` wählt aus, welches Provider-Modell pro Kategorie verwendet wird.
- `modelOptions` wird gegen die Metadaten des ausgewählten Modells aufgelöst.
- Unbekannte Schlüssel, ungültige Typen und Werte außerhalb des Bereichs werden abgelehnt.

## Kategorien

- `textToText`: Drehbuchgenerierungs-Modelloptionen
- `textToSpeech`: Sprach- und Sprechsteuerung
- `textToImage`: Schlüsselbildgenerierungs-Optionen
- `imageTextToVideo`: Segmentgenerierungs-Optionen

## Empfohlener Abstimmungsworkflow

1. Beginnen Sie mit Standardmodellen und ohne Überschreibungen.
2. Fügen Sie nach und nach eine Option in `modelOptions` hinzu.
3. Führen Sie ein kurzes Projekt aus und überprüfen Sie Ausgabequalität und Laufzeit.
4. Speichern Sie stabile Voreinstellungen in der Projektkonfiguration für Wiederholbarkeit.

Siehe:
- [Modellkatalog](/reference/model-catalog)
- [Konfiguration](/guides/configuration)
- [Fehlerbehebung](/guides/troubleshooting)
