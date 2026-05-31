---
slug: /reference/cli-reference
sidebar_position: 1
title: CLI-Referenz
---

## Generierungsbefehl

Hauptbefehl zur Generierung eines vollständigen Videos aus einer Geschichte:

```bash
rilo --project <name> [--story-file <path>] [--force] [--full-run]
```

### Flags

| Flag | Typ | Beschreibung |
|------|------|-------------|
| `--project` | `<name>` | **Erforderlich.** Projektbezeichner (alphanumerisch, Bindestriche erlaubt). Erstellt `projects/<name>/` Verzeichnis. |
| `--story-file` | `<path>` | Pfad zur Geschichtentextdatei. Beim ersten Lauf initialisiert das Projekt mit dieser Geschichte. Bei nachfolgenden Läufen überschreibt sie die Geschichte des Projekts (erfordert `--force`). Weglassen, wenn das Projekt bereits eine Geschichte hat. |
| `--force` | flag | Erzwungener Neustart von früheren Stufen, wo anwendbar. Invalidiert Artefakte, die von Konfigurationsänderungen abhängen. |
| `--full-run` | flag | Überspringt die Schlüsselbild-Review-Pause und führt alle Pipeline-Stufen in einem Durchlauf aus (überschreibt `pauseAfterKeyframes: true` in der Projektkonfiguration). |
| `--help` | flag | Gibt Nutzungsinformationen aus. |
| `--version` | flag | Gibt CLI-Version aus. |

### Beispiele

**Erster Lauf mit neuem Projekt:**
```bash
rilo --project housing-case --story-file ./story.txt
```

**Neuaufruf eines bestehenden Projekts (wiederverwendet Geschichte):**
```bash
rilo --project housing-case
```

**Erzwungener Neustart nach Konfigurationsänderung:**
```bash
# Bearbeiten Sie projects/housing-case/config.json
# Dann mit --force neu starten, um betroffene Stufen neu zu generieren
rilo --project housing-case --force
```

**Geschichte aktualisieren und neu generieren:**
```bash
rilo --project housing-case --story-file ./new-story.txt --force
```

### Projekt-Ausgabestruktur

Bei der Ausführung erstellt Rilo das Verzeichnis `projects/<name>/` mit:

```
projects/<name>/
├── config.json              # Projekt-Generierungseinstellungen
├── story.md                 # Formaterte Geschichte
├── artifacts.json           # Generierungsmetadaten und Pfade
├── run-state.json           # Checkpoint zum Fortsetzen/Invalidierung
├── final.mp4                # Hauptausgabe-Video
├── final_captioned.mp4      # Ausgabe mit Untertiteln (falls aktiviert)
├── assets/                  # Generierte Schlüsselbilder, Audio, Segmente
├── logs/                    # Detaillierte Generierungsprotokolle
└── analytics/               # Leistungsmetriken pro Stufe
```

### Beendigungscodes

| Code | Bedeutung |
|------|---------|
| `0` | Erfolg — Videogenerierung abgeschlossen. |
| `1` | Fehler — Fehlendes Argument, Datei nicht gefunden oder Generierungsfehler. Überprüfen Sie die stderr-Ausgabe. |

### Ausgabe bei Erfolg

Bei erfolgreichem Abschluss gibt Rilo ein JSON-Objekt an stdout aus:

```json
{
  "jobId": "job-abc123xyz789",
  "project": "housing-case",
  "finalVideoPath": "projects/housing-case/final.mp4"
}
```

Analysieren Sie diese Ausgabe in Skripten:
```bash
OUTPUT=$(rilo --project demo --story-file ./story.txt)
VIDEO_PATH=$(echo "$OUTPUT" | jq -r '.finalVideoPath')
echo "Video gespeichert unter: $VIDEO_PATH"
```

### Timeout- und Wiederholungsverhalten

Generierungs-Timeouts und Wiederholungen werden über App-Einstellungen gesteuert (siehe [Settings-Befehl](#settings-befehl)):

- **Vorhersage-Timeout**: `PREDICTION_MAX_WAIT_MS` (Standard: 600.000 ms / 10 Min.)
- **Wiederholungsanzahl**: `maxRetries` (Standard: 2)
- **Wiederholungsverzögerung**: `retryDelayMs` (Standard: 2.500 ms)

Konfigurieren Sie diese über `rilo settings` oder Umgebungsvariablen (siehe [Umgebungsvariablen](/reference/environment-variables)).

## Settings-Befehl

Interaktiv rilo konfigurieren, ohne Dateien zu bearbeiten:

```bash
rilo settings
```

Dies öffnet ein interaktives Menü, in dem Sie:
- API-Anmeldedaten sicher eingeben und aktualisieren können (Replicate, API-Bearer-Token)
- Leistungseinstellungen anpassen können (Timeouts, Wiederholungen, Abfrageintervalle)
- Binärpfade konfigurieren können (ffmpeg, ffprobe, ffsubsync)
- Aktuelle Einstellungen und ihre Quellen anzeigen können (Umgebungsvariable, Konfigurationsdatei oder Standard)

### Navigation

- **Auf/Ab-Tasten** — Durch Einstellungen nach oben/unten bewegen
- **Enter** — Ausgewählte Einstellung bearbeiten
- **Esc / Ctrl+C** — Ohne Speichern beenden
- **Done** — Speichern und beenden
- **Cancel** — Ohne Speichern beenden

### Wo Einstellungen gespeichert werden

| Einstellungstyp | Speicherort | Hinweise |
|---|---|---|
| **API-Token** (Replicate, Bearer) | OS-Schlüsselbund oder verschlüsselte Datei | Sicher gespeichert, nie in Klartext-config.json |
| **Leistung** (Timeouts, Wiederholungen, Limits) | `~/.rilo/config.json` | Klartext-JSON; nicht-sensible Einstellungen |
| **Binärpfade** (ffmpeg, ffprobe, ffsubsync) | `~/.rilo/config.json` | Klartext-JSON |
| **Firebase-Anmeldedaten, Webhooks, API-Port** | Nur Umgebungsvariablen | Nicht über Settings-Befehl editierbar |

### Prioritätsregeln

Bei der Auflösung eines Einstellungswerts prüft Rilo in dieser Reihenfolge (erster Treffer gewinnt):

1. **Umgebungsvariable** (höchste Priorität)
   - `RILO_<EINSTELLUNGSNAME>` oder `<EINSTELLUNGSNAME>`
   - Beispiel: `RILO_MAX_RETRIES=5` überschreibt jede gespeicherte Einstellung

2. **~/.rilo/config.json** (wenn vorhanden und gesetzt über `rilo settings`)
   - Gilt nur, wenn keine Umgebungsvariable gesetzt ist

3. **Schema-Standardwert** (niedrigste Priorität)
   - Eingebauter Fallback-Wert

**Hinweis:** Wenn eine Umgebungsvariable gesetzt ist, zeigt das `rilo settings`-Menü diese Einstellung als "schreibgeschützt (über Umgebungsvariable)" an und ignoriert jeden gespeicherten config.json-Wert, solange die Umgebungsvariable vorhanden ist.

## Home-Befehl

Öffnen Sie das Standard-Rilo-App-Verzeichnis in Ihrem Systemdateimanager:

```bash
rilo home
```

Dies öffnet `~/.rilo`, das Rilo's Standard-Lokaldaten speichert, einschließlich:

- `config.json` für gespeicherte öffentliche Einstellungen
- `projects/` für lokale Projektverzeichnisse
- `output/` für generierte Ausgaben bei Verwendung von Standards

### Beispiele

```bash
rilo home
npx @telepat/rilo home
```

### Plattformverhalten

- macOS verwendet `open`
- Linux verwendet `xdg-open`
- Windows verwendet `cmd /c start`

Wenn der erforderliche Öffner nicht verfügbar ist, beendet Rilo mit Code `1` und gibt eine klare Fehlermeldung aus.

## Preview-Befehl

Starten Sie das lokale Dashboard, die API und den Worker mit einem Befehl:

```bash
rilo preview [--port <n>] [--host <host>] [--no-open] [--expose --unsafe-no-auth]
```

### Flags

| Flag | Typ | Beschreibung |
|------|------|-------------|
| `--port` | `<n>` | Port für die Vorschau-API/Dashboard (Standard: `3000`). |
| `--host` | `<host>` | Host-Bindungsadresse (Standard: `127.0.0.1`; Standard mit `--expose` ist `0.0.0.0`). |
| `--no-open` | flag | Automatisches Browser-Öffnen überspringen. |
| `--expose` | flag | Externen/Container-Zugriff auf Vorschau erlauben. |
| `--unsafe-no-auth` | flag | Erforderlich mit `--expose`; führt Vorschau ohne API-Auth durch. |

### Beispiele

**Lokale Vorschau (empfohlener Standard):**

```bash
rilo preview
```

Dies startet die Vorschau nur auf Loopback und öffnet das Dashboard.

**Exponierte Vorschau für Container/Tunnel (unsicher):**

```bash
rilo preview --expose --unsafe-no-auth --host 0.0.0.0 --port 3000
```

Verwenden Sie den exponierten Modus nur in vertrauenswürdigen Netzwerken oder isolierten Umgebungen.

## Aufrufmethoden

Wählen Sie das Aufrufmuster, das zu Ihrer Umgebung passt:

### Globale Installation

Installieren Sie global von npm:

```bash
npm install -g @telepat/rilo
rilo --help
rilo settings
rilo home
rilo --project demo --story-file ./story.txt
```

### npx (Keine Installation erforderlich)

Direkt ohne Installation ausführen:

```bash
npx @telepat/rilo --help
npx @telepat/rilo settings
npx @telepat/rilo home
npx @telepat/rilo --project demo --story-file ./story.txt
```

Dies lädt die neueste Version von npm herunter und führt sie mit einem Befehl aus. Nützlich für CI/CD und einmalige Läufe.

### Mitarbeiter-Workflow (ausgechecktes Repository)

Verwenden Sie `npm run dev` als Wrapper:

```bash
npm run dev -- settings
npm run dev -- home
npm run dev -- --project demo --story-file ./story.txt
npm run dev -- --project demo --force
```

Dies stellt sicher, dass die richtige Node.js-Umgebung und lokaler Code verwendet werden.

## Hilfetext

Eingebauten Hilfe anzeigen:

```bash
rilo --help
```

Ausgabe:
```
Usage: rilo --project <name> [--story-file <path>] [--force] [--full-run]
       rilo settings
   rilo home
Example: rilo --project housing-case --story-file ./story.txt
```

## Verwandte Dokumentation

- **[Konfiguration](/guides/configuration)** — Projekteinstellungen, Modelle und Optionen
- **[Umgebungsvariablen](/reference/environment-variables)** — Alle Umgebungsvariablen und Priorität
- **[Fehlerbehebung](/guides/troubleshooting)** — Häufige CLI- und Generierungsprobleme
- **[API-Auth und Webhooks](/reference/api-auth-and-webhooks)** — Bearer-Token-Einrichtung für API-Endpunkte
