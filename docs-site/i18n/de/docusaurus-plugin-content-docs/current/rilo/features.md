---
slug: /features
title: "Verwandeln Sie eine Geschichte in ein fertiges Video"
description: Was Rilo für Ersteller und Teams leisten kann, die reproduzierbare Videogenerierung im großen Maßstab benötigen.
keywords: [rilo, features, video generation, ai video, text-to-video, vertical video]
sidebar_label: Features
sidebar_position: 1
---

# Verwandeln Sie eine Geschichte in ein fertiges Video

Rilo verwandelt eine Klartextgeschichte in ein fertiges Video — KI-generiertes Drehbuch, Sprechertext, Schlüsselbilder und Komposition, alles mit einem Befehl.

Entwickelt für Ersteller und Teams, die reproduzierbare, hochwertige Videos im großen Maßstab ohne manuelle Bearbeitung benötigen.

---

## Vollständige Pipeline, ein Befehl

Schreiben Sie Ihre Geschichte in Klartext. Rilo übernimmt den Rest:

**Drehbuchgenerierung → Sprechertext-Synthese → Schlüsselbild-Rendering → Segmentgenerierung → Endgültige Komposition**

Kein manuelles Zusammenfügen. Keine Zeitachsenbearbeitung. Ein Befehl von der Geschichte bis zum fertigen Video.

```bash
rilo --project demo --story-file ./story.txt
```

---

## Checkpointierte Läufe

Jede Stufe speichert checkpointierte Artefakte. Setzen Sie einen unterbrochenen Lauf dort fort, wo er aufgehört hat. Regenerieren Sie nur die Segmente, wenn Sie ein Modell geändert haben. Rendern Sie nur Schlüsselbilder neu, wenn Sie Prompts angepasst haben.

```bash
rilo --project demo                         # Vom letzten Checkpoint fortfahren
rilo --project demo --force                 # Von früheren Stufen neu starten
rilo --project demo --force --full-run      # Schlüsselbild-Review überspringen, alle Stufen ausführen
```

Feingranulare Kontrolle ohne von vorne zu beginnen.

---

## Ihre Modelle, Ihre Kontrolle

Wählen Sie Ihre Text-zu-Bild- und Bild-zu-Video-Modelle. Überschreiben Sie optionale Parameter pro Modell für volle kreative Kontrolle. Wechseln Sie zwischen Läufen die Modelle, ohne Ihre Geschichte zu ändern.

Rilo's Modell-Adapter-System ordnet Ihren Geschichtenkontext dem nativen Eingabeformat jedes Modells zu — Sie müssen modellspezifische APIs nicht lernen.

---

## Codegesteuerte Pipeline

Deterministischer Code übernimmt Job-Orchestrierung, Checkpointing, Artefaktverwaltung und Zustandsverfolgung. Ihre Token fließen in die kreative Generierung — Drehbuchschreiben, Bildrendering und Videosynthese — und nicht in Infrastruktur-Overhead.

Keine Kontextfenster werden für Datei-I/O verbrannt. Keine Token werden für Orchestrierungsplauderei verschwendet. Nur Generierung dort, wo es zählt.

---

## Untertitel-Ausrichtung und Einbrennen

Automatische Ausrichtung von Untertiteln an Sprechertext-Zeitabläufen mit `ffsubsync`. Brennen Sie sie als gestylte ASS-Untertitel in das finale Video ein. Optional, konfigurierbar und vollständig automatisiert.

```bash
# In Ihrer Projektkonfiguration konfigurieren
rilo --project demo --story-file ./story.txt
```

---

## Vorschau-Dashboard

Starten Sie ein lokales Web-Dashboard für Projektverwaltung, Live-Statusüberwachung, Artefaktvorschau und gezielte Regeneration.

```bash
rilo preview
rilo preview --port 4000 --no-open
```

API-Server, Hintergrund-Worker und Vite-React-Frontend — alles mit einem Befehl gestartet. Sehen Sie sich die Job-Historie an, überprüfen Sie Artefakte und lösen Sie Regenerationen aus Ihrem Browser aus.

---

## HTTP-API & Webhooks

Betreiben Sie Rilo als Dienst. Bearer-Token-Authentifizierung. OpenAPI-3.1-Spezifikation für schemagetriebene Integration. Webhook-Abonnements für Job-Lebenszyklus-Ereignisse.

- **Swagger UI** unter `/docs` bei Ausführung von `npm run api`
- **OpenAPI JSON** unter `/openapi.json`
- **Webhook-Ereignisse** für Job erstellt, Stufe abgeschlossen, Job beendet, Job fehlgeschlagen
- **Firebase Functions**-Adapter für Serverless-Deployment

---

## Plattformübergreifend

Läuft auf macOS, Linux und Windows. Erfordert Node.js 22+ und `ffmpeg` im PATH.

---

## Bereit, Ihr erstes Video zu generieren?

[Loslegen →](./getting-started/installation.md)

Oder springen Sie direkt zum [Schnellstart](./getting-started/quickstart.md) und zur [CLI-Referenz](./reference/cli-reference.md).
