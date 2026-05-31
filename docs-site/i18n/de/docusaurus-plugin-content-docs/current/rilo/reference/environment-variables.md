---
slug: /reference/environment-variables
sidebar_position: 3
title: Umgebungsvariablen
---

## Konfiguration

Rilo wird über Umgebungsvariablen konfiguriert (aus `.env` oder Systemumgebung). Sie können die meisten nicht-sensiblen Einstellungen auch interaktiv mit `rilo settings` verwalten (siehe [CLI-Referenz](/reference/cli-reference#settings-befehl)).

## API-Anmeldedaten

Erforderlich:

```bash
TELEPAT_REPLICATE_TOKEN=
RILO_API_BEARER_TOKEN=
```

Diese können auch über `rilo settings` verwaltet werden, wo sie sicher in Ihrem OS-Schlüsselbund (oder einer verschlüsselten lokalen Datei, wenn kein nativer Schlüsselbund verfügbar ist) gespeichert werden.

Speicherung und Backend-Auswahl:

```bash
RILO_OUTPUT_BACKEND=local
OUTPUT_DIR=~/.rilo/output
PROJECTS_DIR=~/.rilo/projects
```

Firebase-Backend:

```bash
RILO_FIREBASE_PROJECT_ID=
RILO_FIREBASE_STORAGE_BUCKET=
RILO_FIREBASE_CLIENT_EMAIL=
RILO_FIREBASE_PRIVATE_KEY=
```

Laufzeit-Feinabstimmung:

```bash
PREDICTION_POLL_INTERVAL_MS=1500
PREDICTION_MAX_WAIT_MS=600000
MAX_RETRIES=2
RETRY_DELAY_MS=2500
DOWNLOAD_TIMEOUT_MS=20000
DOWNLOAD_MAX_BYTES=104857600
DOWNLOAD_ALLOWED_HOSTS=replicate.delivery,replicate.com
API_PORT=3000
API_DEFAULT_LOGS_LIMIT=100
API_MAX_LOGS_LIMIT=1000
```

Medienwerkzeuge:

```bash
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
FFSUBSYNC_BIN=ffsubsync
```

Wenn Ihr Deployment geheimnispräfixierte Umgebungsvariablen verwendet, unterstützt Rilo `SECRET_*`-Äquivalente für Kernanmeldedaten und Backend-Konfiguration.

## Konfiguration über CLI

Die meisten der oben genannten Einstellungen können interaktiv bearbeitet werden (außer Firebase, Webhooks und API-Port, die nur über Umgebungsvariablen bleiben):

```bash
rilo settings
```

Wenn Sie eine Einstellung über `rilo settings` speichern, wird sie in `~/.rilo/config.json` für öffentliche Einstellungen oder in Ihrem OS-Schlüsselbund für API-Token gespeichert.

**Priorität:**
1. **Umgebungsvariable** (höchste Priorität — gewinnt immer)
2. **Gespeicherte Einstellung** (`~/.rilo/config.json` oder OS-Schlüsselbund)
3. **Schema-Standardwert** (niedrigste Priorität)

Das bedeutet, wenn Sie eine Umgebungsvariable setzen, wird jeder Wert, der von `rilo settings` gespeichert wurde, für diese Variable ignoriert. Umgebungsvariablen sind ideal für Deployments und CI/CD, während der Settings-Befehl für die interaktive Workstation-Einrichtung bequem ist.

## Versteckte Einstellungen

Die folgenden Einstellungen sind **nur-Umgebungsvariablen** und erscheinen nicht im `rilo settings`-Menü:
- Firebase-Anmeldedaten (`RILO_FIREBASE_*`)
- Webhook-Konfiguration (`USE_WEBHOOKS`, `WEBHOOK_SECRET`)
- Ausgabe-Backend-Auswahl (`RILO_OUTPUT_BACKEND`)
- API-Port (`API_PORT`)
- Benutzerdefinierte Datenverzeichnisse (`OUTPUT_DIR`, `PROJECTS_DIR`)
