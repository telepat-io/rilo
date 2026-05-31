---
slug: /reference/config-schema
sidebar_position: 2
title: Vollständiges Konfigurationsschema
---

Diese Seite dokumentiert jede Konfigurationsoption sowohl der **Projektkonfiguration** (`projects/<project>/config.json`) als auch der **App/Laufzeit-Konfiguration** (`~/.rilo/config.json` + Schlüsselbund).

## Projektkonfiguration (projects/\<project\>/config.json)

### Erforderliche und Kernefelder

| Schlüssel | Typ | Standard | Hinweise |
|----------|-----|---------|----------|
| `aspectRatio` | string | `"9:16"` | `"1:1"` \| `"16:9"` \| `"9:16"` — Seitenverhältnis des Ausgabevideos |
| `targetDurationSec` | number | `60` | Ziel-Drehbuch/Sprechertext-Dauer in Sekunden; beeinflusst das Tempo |
| `finalDurationMode` | string | `"match_audio"` | `"match_audio"` \| `"match_visual"` — Umgang mit finaler Kompositionsdauer |
| `pauseAfterKeyframes` | boolean | `true` | Wenn `true`, stoppt die Pipeline nach der Schlüsselbildgenerierung zur Überprüfung. Auf `false` setzen, um alle Stufen in einem Durchlauf auszuführen (gleichbedeutend mit `--full-run` in der CLI) |

### Schlüsselbildmaße

| Schlüssel | Typ | Standard | Hinweise |
|----------|-----|---------|----------|
| `keyframeWidth` | number | Automatisch abgeleitet | Schlüsselbildbreite in Pixeln (muss mit `keyframeHeight` gepaart werden); ≥ 512 |
| `keyframeHeight` | number | Automatisch abgeleitet | Schlüsselbildhöhe in Pixeln (muss mit `keyframeWidth` gepaart werden); ≥ 512 |

Wenn beide weggelassen werden, werden sie aus `aspectRatio` und einer Standard-Basisgröße berechnet (z. B. `9:16` → 576×1024).

### Modellauswahl

| Schlüssel | Typ | Standard | Hinweise |
|----------|-----|---------|----------|
| `models` | object | `{}` | Ordnet Modellkategorie dem ausgewählten Modell zu |
| `models.textToText` | string | Aus Standards auto-gefüllt | Drehbuch/Shot-Generierungsmodell (z. B. `"deepseek-ai/deepseek-v3"`) |
| `models.textToSpeech` | string | Aus Standards auto-gefüllt | Sprechertext-Modell (z. B. `"minimax/speech-02-turbo"`) |
| `models.textToImage` | string | Aus Standards auto-gefüllt | Schlüsselbildgenerierungsmodell (z. B. `"prunaai/z-image-turbo"`) |
| `models.imageTextToVideo` | string | Aus Standards auto-gefüllt | Videosegment-Generierungsmodell (z. B. `"wan-video/wan-2.2-i2v-fast"`) |

Automatisch gefüllte Standards stammen aus Modellkatalogmetadaten in `models/<model-id>.json`. Siehe [Modellkatalog](/reference/model-catalog) für verfügbare Modelle.

### Modelloptionen (Modellspezifische Parameter)

| Schlüssel | Typ | Standard | Hinweise |
|----------|-----|---------|----------|
| `modelOptions` | object | `{}` | Ordnet Modellkategorie den Parameterüberschreibungen zu |
| `modelOptions.textToText` | object | `{}` | LLM-Parameter (z. B. `max_tokens`, `temperature`) für Drehbuchmodell |
| `modelOptions.textToSpeech` | object | `{}` | TTS-Parameter (z. B. `voice_id`, `speed`) für Sprechertextmodell |
| `modelOptions.textToImage` | object | `{}` | Bildgenerierungsparameter (z. B. `num_inference_steps`, `guidance_scale`) |
| `modelOptions.imageTextToVideo` | object | `{}` | Videogenerierungsparameter (z. B. `sample_shift`, `go_fast`) |

**Gültige Parameter pro Modell:** Definiert durch den Adapter des Modells in `src/steps/textToImageAdapters.js`, `src/steps/imageToVideoAdapters.js` usw. Siehe [Modell-Adapter und Optionen](/guides/model-adapters-and-options) für detaillierte Parameterdokumentation.

**Parametervalidierung:** Parameter werden zur Zeit der Modellanfrage validiert. Ungültige Parameter werden möglicherweise protokolliert oder stillschweigend ignoriert, je nach Modelladapter.

**Änderung von Modelloptionen:** Invalidiert nur die zwischengespeicherten Ausgaben der betroffenen Stufe.

### Untertitelkonfiguration (Optional)

| Schlüssel | Typ | Standard | Hinweise |
|----------|-----|---------|----------|
| `subtitleOptions` | object | `undefined` | Hauptumschalter und Stilierung für Untertitelgenerierung |
| `subtitleOptions.enabled` | boolean | `false` | Untertitelgenerierung für dieses Projekt aktivieren/deaktivieren |
| `subtitleOptions.templateId` | string | `"social_center_clean"` | Vordefinierte Untertitelstil-Vorlagen-ID |
| `subtitleOptions.position` | string | `"center"` | `"top"` \| `"center"` \| `"bottom"` |
| `subtitleOptions.fontName` | string | `"Helvetica"` | Schriftname (systeminstalliert); z. B. `"Arial"`, `"Helvetica"`, `"Courier"` |
| `subtitleOptions.fontSize` | number | `92` | Schriftgröße in Pixeln; typischerweise 80–120 für mobile vertikale Videos |
| `subtitleOptions.bold` | boolean | `false` | Fettschrift anwenden |
| `subtitleOptions.italic` | boolean | `false` | Kursivstil anwenden |
| `subtitleOptions.makeUppercase` | boolean | `false` | Gesamten Text in Großbuchstaben umwandeln |
| `subtitleOptions.primaryColor` | string | `"#ffffff"` | Textfarbe im Hexadezimalformat |
| `subtitleOptions.activeColor` | string | `"#9ae6ff"` | Hervorhebungsfarbe für aktuell gesprochenes Wort in Hexadezimal |
| `subtitleOptions.outlineColor` | string | `"#111111"` | Textkonturen-/Strichfarbe in Hexadezimal |
| `subtitleOptions.backgroundEnabled` | boolean | `true` | Halbtransparenten Hintergrund hinter Text aktivieren |
| `subtitleOptions.backgroundColor` | string | `"#000000"` | Hintergrundfarbe in Hexadezimal |
| `subtitleOptions.backgroundOpacity` | number | `0.45` | Hintergrund-Transparenz; 0.0 (transparent) bis 1.0 (deckend) |
| `subtitleOptions.outline` | number | `3` | Textkonturenstärke in Pixeln |
| `subtitleOptions.shadow` | number | `0` | Text-Schattengröße in Pixeln |
| `subtitleOptions.marginV` | number | `120` | Vertikaler Abstand vom oberen/unteren Rand, wenn `position` nicht `"center"` ist |
| `subtitleOptions.maxWordsPerLine` | number | `4` | Wörter pro Zeile vor dem Umbruch |
| `subtitleOptions.maxLines` | number | `2` | Maximale gleichzeitig angezeigte Untertitelzeilen |
| `subtitleOptions.highlightMode` | string | `"current_only"` | Wie aktuell gesprochener Text hervorgehoben wird; weitere Werte können unterstützt werden |

**Hinweis:** Wenn `subtitleOptions.enabled` auf `false` gesetzt ist, werden alle anderen Untertitelfelder während der Generierung ignoriert.

### Beispiel vollständige Projektkonfiguration

```json
{
  "aspectRatio": "9:16",
  "targetDurationSec": 45,
  "finalDurationMode": "match_audio",
  "keyframeWidth": 576,
  "keyframeHeight": 1024,
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "black-forest-labs/flux-2-pro",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  },
  "modelOptions": {
    "textToText": {
      "max_tokens": 2048,
      "temperature": 0.1
    },
    "textToSpeech": {
      "voice_id": "Deep_Voice_Man",
      "speed": 1,
      "emotion": "auto"
    },
    "textToImage": {
      "num_inference_steps": 20,
      "guidance_scale": 3,
      "output_format": "jpg"
    },
    "imageTextToVideo": {
      "go_fast": true,
      "sample_shift": 12
    }
  },
  "subtitleOptions": {
    "enabled": true,
    "templateId": "social_center_clean",
    "position": "center",
    "fontName": "Helvetica",
    "fontSize": 92,
    "bold": true,
    "italic": false,
    "makeUppercase": true,
    "primaryColor": "#ffffff",
    "activeColor": "#9ae6ff",
    "outlineColor": "#111111",
    "backgroundEnabled": true,
    "backgroundColor": "#000000",
    "backgroundOpacity": 0.45,
    "outline": 3,
    "shadow": 0,
    "marginV": 120,
    "maxWordsPerLine": 4,
    "maxLines": 2,
    "highlightMode": "current_only"
  }
}
```

---

## App/Laufzeit-Konfiguration (~/.rilo/config.json + Schlüsselbund)

App-Einstellungen werden über `rilo settings` oder Umgebungsvariablen verwaltet. Sichere Token leben im OS-Schlüsselbund; öffentliche Einstellungen leben in `~/.rilo/config.json`.

### Sichere Einstellungen (Schlüsselbund / verschlüsselte Datei)

| Schlüssel | Einstellungsname | Umgebungsvariablen | Typ | Hinweise |
|----------|-----------------|-------------------|------|----------|
| `replicateApiToken` | Replicate API Token | `TELEPAT_REPLICATE_TOKEN`, `TELEPAT_REPLICATE_TOKEN` | string | API-Schlüssel von replicate.com/account/api-tokens. Erforderlich für Modellvorhersagen. |
| `apiBearerToken` | API Bearer Token | `RILO_API_BEARER_TOKEN`, `API_BEARER_TOKEN` | string | Bearer-Token zur Authentifizierung von Anfragen an rilo HTTP-API-Endpunkte. Erforderlich, wenn HTTP-API mit Authentifizierung ausgeführt wird. |

**Speicherung:** OS-Schlüsselbund (macOS Keychain, Windows Credential Manager, Linux Secret Service) oder AES-256-verschlüsselte Datei unter `~/.rilo/.secrets`, wenn kein nativer Schlüsselbund verfügbar ist.

### Öffentliche Einstellungen (~/.rilo/config.json)

#### Vorhersage- und Wiederholungsverhalten

| Schlüssel | Einstellungsname | Umgebungsvariable | Typ | Standard | Hinweise |
|----------|-----------------|-------------------|------|---------|----------|
| `maxRetries` | Max Retries | `MAX_RETRIES` | number | `2` | Anzahl der Wiederholungen für fehlgeschlagene Vorhersagen; ≥ 0 |
| `retryDelayMs` | Retry Delay (ms) | `RETRY_DELAY_MS` | number | `2500` | Millisekunden Wartezeit zwischen Wiederholungen; ≥ 0 |
| `predictionPollIntervalMs` | Poll Interval (ms) | `PREDICTION_POLL_INTERVAL_MS` | number | `1500` | Wie oft der Vorhersagestatus überprüft wird; ≥ 100 |
| `predictionMaxWaitMs` | Max Prediction Wait (ms) | `PREDICTION_MAX_WAIT_MS` | number | `600000` (10 Min.) | Max. Wartezeit für den Abschluss einer einzelnen Vorhersage; ≥ 1000 |

#### Download-Verhalten

| Schlüssel | Einstellungsname | Umgebungsvariable | Typ | Standard | Hinweise |
|----------|-----------------|-------------------|------|---------|----------|
| `downloadTimeoutMs` | Download Timeout (ms) | `DOWNLOAD_TIMEOUT_MS` | number | `20000` | Timeout für das Herunterladen generierter Mediendateien; ≥ 1000 |
| `downloadMaxBytes` | Download Max Size (bytes) | `DOWNLOAD_MAX_BYTES` | number | `104857600` (100 MB) | Harte Obergrenze für Dateigröße bei Downloads; > 0 |
| `downloadAllowedHosts` | Download Allowed Hosts | `DOWNLOAD_ALLOWED_HOSTS` | string | `"replicate.delivery,replicate.com"` | Kommagetrennte Liste erlaubter Hostnamen für Media-Downloads; nicht leer |

#### Binärpfade

| Schlüssel | Einstellungsname | Umgebungsvariable | Typ | Standard | Hinweise |
|----------|-----------------|-------------------|------|---------|----------|
| `ffmpegBin` | ffmpeg Binary | `FFMPEG_BIN` | string | `"ffmpeg"` | Pfad oder Befehlsname für ffmpeg; nicht leer; typischerweise im PATH |
| `ffprobeBin` | ffprobe Binary | `FFPROBE_BIN` | string | `"ffprobe"` | Pfad oder Befehlsname für ffprobe; nicht leer; typischerweise im PATH |
| `ffsubsyncBin` | ffsubsync Binary | `FFSUBSYNC_BIN` | string | `"ffsubsync"` | Pfad oder Befehlsname für ffsubsync (optionales Untertitel-Ausrichtungstool); nicht leer |

#### API-Protokollierung

| Schlüssel | Einstellungsname | Umgebungsvariable | Typ | Standard | Hinweise |
|----------|-----------------|-------------------|------|---------|----------|
| `apiDefaultLogsLimit` | Default Logs Limit | `API_DEFAULT_LOGS_LIMIT` | number | `100` | Standardanzahl der von der HTTP-API pro Anfrage zurückgegebenen Logeinträge; > 0 |
| `apiMaxLogsLimit` | Max Logs Limit | `API_MAX_LOGS_LIMIT` | number | `1000` | Harte Obergrenze für von der HTTP-API zurückgegebene Logeinträge; > 0 |

#### Nur-Umgebungsvariablen-Einstellungen (Nicht in ~/.rilo/config.json)

Diese können nur über Umgebungsvariablen gesetzt werden; sie sind nicht über `rilo settings` editierbar:

| Umgebungsvariable | Typ | Hinweise |
|------------------|------|----------|
| `FIREBASE_PROJECT_ID` | string | Firebase-Projekt-ID für Firestore/Storage (optional) |
| `FIREBASE_PRIVATE_KEY` | string | Firebase-Service-Konto privater Schlüssel (optional) |
| `FIREBASE_CLIENT_EMAIL` | string | Firebase-Service-Konto Client-E-Mail (optional) |
| `RILO_WEBHOOK_SECRET` | string | Gemeinsames Geheimnis zur Überprüfung eingehender Webhook-Signaturen (optional) |
| `RILO_WEBHOOK_URL` | string | URL, an die Job-Statusaktualisierungen gesendet werden (optional) |
| `RILO_API_PORT` | string | HTTP-API-Port; Standard `3000` |
| `RILO_PROJECTS_DIR` | string | Benutzerdefiniertes Projektverzeichnis; Standard `"projects/"` |
| `RILO_OUTPUTS_DIR` | string | Benutzerdefiniertes Ausgabeverzeichnis für Backends; Standard `"outputs/"` |
| `RILO_BACKEND` | string | Ausgabe-Backend: `"local"` oder `"firebase"` (Standard: `"local"`) |

### Beispiel ~/.rilo/config.json

```json
{
  "maxRetries": 3,
  "retryDelayMs": 3000,
  "predictionPollIntervalMs": 2000,
  "predictionMaxWaitMs": 900000,
  "downloadTimeoutMs": 25000,
  "downloadMaxBytes": 209715200,
  "downloadAllowedHosts": "replicate.delivery,replicate.com,cdn.example.com",
  "ffmpegBin": "/usr/local/bin/ffmpeg",
  "ffprobeBin": "/usr/local/bin/ffprobe",
  "ffsubsyncBin": "ffsubsync",
  "apiDefaultLogsLimit": 200,
  "apiMaxLogsLimit": 2000
}
```

Sichere Einstellungen (`replicateApiToken`, `apiBearerToken`) sind **nicht** in dieser Datei vorhanden; sie werden im Schlüsselbund gespeichert.

---

## Konfigurationspriorität

Für jede Einstellung löst Rilo den Wert in dieser Reihenfolge auf (erster Treffer gewinnt):

1. **Umgebungsvariable** (höchste Priorität)
   - Beispiele: `RILO_MAX_RETRIES=5`, `TELEPAT_REPLICATE_TOKEN=r8_xxx`
   - Spezifische Umgebungsvariable + allgemeine Umgebungsvariable wird der Reihe nach geprüft (z. B. `TELEPAT_REPLICATE_TOKEN` vor `TELEPAT_REPLICATE_TOKEN`)
   - Wenn gesetzt, zeigt das `rilo settings`-Menü den Wert als "schreibgeschützt (über Umgebungsvariable)" an

2. **~/.rilo/config.json** (wenn vorhanden und Schlüssel geschrieben)
   - Gilt nur, wenn keine Umgebungsvariable gesetzt ist
   - Editierbar über `rilo settings`

3. **Schema-Standardwert** (niedrigste Priorität)
   - Eingebauter Fallback-Wert

**Beispiel:**
```bash
# Umgebungsvariable gewinnt
export MAX_RETRIES=10
rilo settings  # Zeigt "Max Retries: 10 (via Umgebungsvariable) — schreibgeschützt"

# Keine Umgebungsvariable; config.json-Wert wird verwendet
cat ~/.rilo/config.json | jq .maxRetries  # 3
# Wenn weder Umgebungsvariable noch config.json vorhanden sind, wird der Schema-Standardwert (2) verwendet
```

---

## Validierungsregeln

### Projektkonfiguration

- `aspectRatio`: Muss einer von `"1:1"`, `"16:9"`, `"9:16"` sein
- `targetDurationSec`: Muss eine positive Ganzzahl sein (> 0)
- `finalDurationMode`: Muss `"match_audio"` oder `"match_visual"` sein
- `keyframeWidth`, `keyframeHeight`: Wenn beide angegeben, müssen sie ganzzahlige Werte ≥ 512 sein; wenn eines angegeben, müssen beide angegeben werden; wenn keines, automatisch abgeleitet aus Seitenverhältnis
- `models.<category>`: Muss einer gültigen Modell-ID im Modellkatalog entsprechen
- `modelOptions.<category>.<param>`: Wird pro Modelladapter validiert; ungültige Parameter werden möglicherweise protokolliert oder ignoriert
- `subtitleOptions.enabled`: Muss ein Boolean sein; wenn `false`, werden andere Untertitelfelder ignoriert
- Hex-Farbfelder: Muss gültige Hex-Farbe sein (z. B. `"#ffffff"`, `"#000000"`)
- Transparenzfelder: Muss eine Zahl zwischen 0.0 und 1.0 sein

Validierungsfehler werden protokolliert; die Generierung kann fehlschlagen, wenn kritische Konfiguration ungültig ist.

### App-Konfiguration

- `maxRetries`, `apiDefaultLogsLimit`, `apiMaxLogsLimit`: Müssen nicht-negative Ganzzahlen sein
- `retryDelayMs`, `downloadTimeoutMs`, `downloadMaxBytes`, `predictionPollIntervalMs`, `predictionMaxWaitMs`: Müssen positive Ganzzahlen sein
- `predictionPollIntervalMs`: Muss ≥ 100 sein
- `predictionMaxWaitMs`: Muss ≥ 1000 sein
- `downloadTimeoutMs`: Muss ≥ 1000 sein
- `ffmpegBin`, `ffprobeBin`, `ffsubsyncBin`: Müssen nicht-leere Strings sein
- `downloadAllowedHosts`: Muss nicht-leer sein; kommagetrennte Liste von Hostnamen

Ungültige App-Konfiguration wird beim Speichern von Einstellungen oder beim Anwenden von Umgebungsvariablen abgelehnt.

---

## Verwandte Dokumentation

- **[Konfiguration](/guides/configuration)** — Konfigurationsworkflow und Beispiele
- **[CLI-Referenz](/reference/cli-reference)** — Befehle und Flags
- **[Umgebungsvariablen](/reference/environment-variables)** — Alle Umgebungsvariablen mit Beispielen
- **[Modell-Adapter und Optionen](/guides/model-adapters-and-options)** — Modellspezifische Parameterdokumentation
- **[Modellkatalog](/reference/model-catalog)** — Verfügbare Modelle nach Kategorie
