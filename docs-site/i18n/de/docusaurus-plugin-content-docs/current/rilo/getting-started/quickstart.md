---
slug: /getting-started/quickstart
sidebar_position: 3
title: Schnellstart
---

## Installation und Einrichtung

Empfohlener Workflow:

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project housing-case --story-file ./examples/story.txt
```

Oder über npx ohne globale Installation ausführen:

```bash
npx @telepat/rilo settings
npx @telepat/rilo --project housing-case --story-file ./examples/story.txt
```

Wenn Sie aus Quelle in diesem Repository beitragen, siehe [/contributing/development](/contributing/development) für den `npm run dev`-Workflow.

## Ihr erster Generierungslauf

### Schritt 1: API-Token konfigurieren

Bevor Sie Ihren ersten Generierungslauf starten, richten Sie Ihren Replicate-API-Token ein:

**Option A: Interaktives Einstellungsmenü (empfohlen)**
```bash
rilo settings
```

Dies öffnet ein Menü, in dem Sie Ihren Replicate-API-Token sicher eingeben und andere Einstellungen konfigurieren können.

**Option B: Umgebungsvariable**
```bash
export TELEPAT_REPLICATE_TOKEN=r8_xxxxxxxxxxxxx
```

### Schritt 2: Neues Projekt mit einer Geschichte erstellen

Erstellen Sie eine einfache Datei:

```bash
cat > wedding-story.txt <<'EOF'
A couple's love story begins at a cozy coffee shop where they first locked eyes
over a shared latte. Years later, they return to the same spot and exchange vows
in an intimate ceremony surrounded by friends and family who witnessed the beginning
of their journey. The video celebrates the beauty of finding forever in familiar places.
EOF
```

Initialisieren Sie Ihr Projekt:

```bash
rilo --project wedding-case --story-file ./wedding-story.txt
```

Beim ersten Lauf:
1. Erstellt `projects/wedding-case/` Verzeichnis
2. Speichert `config.json` (Projekt-Generierungseinstellungen)
3. Speichert `story.md` (formatierte Geschichte)
4. Beginnt den Generierungspipeline
5. Gibt `projects/wedding-case/final.mp4` aus, wenn fertig

### Schritt 3: Fortschritt überwachen

Beobachten Sie den Generierungsfortschritt in der Terminalausgabe:

```
✓ Script generation completed (2.3s)
✓ Voiceover generation completed (8.1s)
  Generating keyframes... (1/12)
  Generating keyframes... (2/12)
  ...
✓ Composition completed (15.2s)
```

Finden Sie Ausgaben hier:
```
projects/wedding-case/
├── config.json              # Projekteinstellungen
├── story.md                 # Ihre Geschichte
├── final.mp4                # Hauptausgabe-Video
├── artifacts.json           # Generierungsmetadaten
├── run-state.json           # Checkpoint zum Fortsetzen
├── assets/                  # Generierte Schlüsselbilder, Audio usw.
└── logs/                    # Detaillierte Generierungsprotokolle
```

## Häufige Workflows

### Von einer bestimmten Stufe neu ausführen (--force)

Wenn die Generierung unterwegs fehlschlägt, verwenden Sie `--force`, um von einer früheren Stufe neu zu starten, ohne abgeschlossene Arbeit neu zu generieren:

```bash
# Von der Schlüsselbildgenerierung neu starten (vorherige Stufen werden wiederverwendet)
rilo --project wedding-case --force

# Gesamte Pipeline neu ausführen (mit Vorsicht verwenden)
rilo --project wedding-case --force
```

Weitere Details finden Sie unter [Regeneration und Invalidierung](/guides/regeneration-and-invalidation).

### Projekteinstellungen während des Projekts aktualisieren

Wenn Sie Seitenverhältnis, Dauer oder Modellauswahlen nach Projektstart ändern möchten:

1. Bearbeiten Sie `projects/wedding-case/config.json`:
   ```json
   {
     "aspectRatio": "9:16",
     "targetDurationSec": 30,
     "models": {
       "textToImage": "black-forest-labs/flux-2-pro"
     }
   }
   ```

2. Führen Sie mit `--force` neu aus, um betroffene Stufen zu invalidieren und neu zu generieren:
   ```bash
   rilo --project wedding-case --force
   ```

### App-weite Einstellungen konfigurieren

Passen Sie Timeouts, Wiederholungen oder Binärpfad global an:

```bash
rilo settings
# Zu "Max Retries", "Poll Interval", "ffmpeg Binary" usw. navigieren
Auf/Ab-Tasten zum Auswählen → Enter zum Bearbeiten → Enter zum Speichern → "Done" zum Beenden
```

Diese Einstellungen werden in `~/.rilo/config.json` gespeichert und die Priorität ist:
1. Umgebungsvariablen (höchste Priorität)
2. `~/.rilo/config.json` (Einstellungen, die Sie über `rilo settings` konfigurieren)
3. Schema-Standardwerte (niedrigste Priorität)

### Benutzerdefinierte Geschichtendatei bei nachfolgenden Läufen verwenden

Wenn Sie die Geschichte für ein bestehendes Projekt aktualisieren möchten, übergeben Sie erneut `--story-file`:

```bash
cat > new-wedding-story.txt <<'EOF'
... aktualisierter Geschichtentext ...
EOF

rilo --project wedding-case --story-file ./new-wedding-story.txt --force
```

Dies überschreibt `projects/wedding-case/story.md` und startet die Generierung von vorne.

## Aufrufmuster

Wählen Sie die Aufrufmethode, die zu Ihrem Workflow passt:

| Methode | Befehl | Am besten geeignet für |
|---------|--------|----------------------|
| **Globale Installation** | `rilo --project <name> --story-file <path>` | Nach `npm install -g @telepat/rilo` |
| **npx** | `npx @telepat/rilo --project <name> --story-file <path>` | Keine Installation erforderlich; CI/CD |
| **Mitarbeiter-Entwicklung** | `npm run dev -- --project <name> --story-file <path>` | Arbeit aus einem ausgecheckten Repo |

## Nächste Schritte

- **[CLI-Referenz](/reference/cli-reference)** — Alle Flags und Befehle
- **[Konfiguration](/guides/configuration)** — Projekteinstellungen, Modelle und Optionen
- **[Fehlerbehebung](/guides/troubleshooting)** — Häufige Probleme und Lösungen
- **[Modellkatalog](/reference/model-catalog)** — Verfügbare Modelle und ihre Fähigkeiten
