---
slug: /guides/configuration
sidebar_position: 1
title: Konfiguration
---

Rilo hat zwei Konfigurationsbereiche:
- **Projektkonfiguration** (`projects/<project>/config.json`): Generierungsoptionen wie Dauer, Seitenverhältnis, Modellauswahlen und Modelloptionen.
- **App/Laufzeit-Konfiguration** (`~/.rilo/config.json` + sicherer Schlüsselbund): API-Token, Wiederholungen, Timeouts, Binärpfade und verwandte Laufzeiteinstellungen, die über `rilo settings` verwaltet werden.

## Projektkonfiguration

Die Rilo-Projektkonfiguration befindet sich in `config.json`.

### Beispiel config.json

```json
{
  "aspectRatio": "9:16",
  "targetDurationSec": 60,
  "finalDurationMode": "match_audio",
  "keyframeWidth": 576,
  "keyframeHeight": 1024,
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "prunaai/z-image-turbo",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  },
  "modelOptions": {
    "textToImage": {
      "num_inference_steps": 8,
      "output_format": "jpg"
    }
  },
  "subtitleOptions": {
    "enabled": true,
    "templateId": "social_center_clean",
    "position": "center",
    "fontSize": 92,
    "bold": true,
    "primaryColor": "#ffffff"
  }
}
```

### Kerneinstellungen

#### `aspectRatio`
- **Typ:** `string`
- **Erlaubte Werte:** `"1:1"`, `"16:9"`, `"9:16"`
- **Standard:** `"9:16"`
- **Beschreibung:** Seitenverhältnis des Ausgabevideos. Bestimmt Schlüsselbildmaße und finale Komposition. Eine Änderung invalidiert alle Schlüsselbilder und Segmente.

#### `targetDurationSec`
- **Typ:** `number`
- **Standard:** `60`
- **Beschreibung:** Ziel-Sprechertext/Drehbuch-Dauer in Sekunden. Beeinflusst die Drehbuchplanung (Anzahl der Shots, Tempo) und die nachgelagerte Segmentplanung. Die Segmentanzahl wird aus der tatsächlichen Sprechertext-Dauer abgeleitet, typischerweise in 5-Sekunden-Blöcken.

#### `finalDurationMode`
- **Typ:** `string`
- **Erlaubte Werte:** `"match_audio"`, `"match_visual"`
- **Standard:** `"match_audio"`
- **Beschreibung:** Steuert die Kompositionsdauer:
  - `"match_audio"` — Finale Videodauer = Sprechertext + Stille-Padding (falls nötig)
  - `"match_visual"` — Finale Videodauer = Summe aller visuellen Segmente (kann Audio abschneiden)

#### `keyframeWidth` und `keyframeHeight`
- **Typ:** `number`
- **Standard:** Abgeleitet aus `aspectRatio` (z. B. `9:16` → 576x1024)
- **Beschreibung:** Maße (in Pixeln) für generierte Schlüsselbilder. Muss als Paar angegeben werden; beide müssen ganzzahlige Werte ≥ 512 sein. Eine Änderung invalidiert alle Schlüsselbilder und Segmente.

### Modellkonfiguration

#### `models`

Objekt-Zuordnung von Generierungsstufe zu ausgewähltem Modell:

```json
{
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "prunaai/z-image-turbo",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  }
}
```

**Modellkategorien:**
- `textToText` — Drehbuchgenerierung (Eingabe: Geschichte → Ausgabe: Drehbuch)
- `textToSpeech` — Sprechertext-Generierung (Eingabe: Drehbuch → Ausgabe: Sprechertext-Audio)
- `textToImage` — Schlüsselbildgenerierung (Eingabe: Shot-Beschreibung → Ausgabe: Standbilder)
- `imageTextToVideo` — Segmentgenerierung (Eingabe: Schlüsselbild + Text-Overlay → Ausgabe: Videosegment)

**Gültige Modell-IDs:** Siehe [Modellkatalog](/reference/model-catalog) für die vollständige Liste und Fähigkeiten jedes Modells.

**Fehlende Auswahlen:** Wenn eine Kategorie weggelassen wird, greift Rilo auf ein Standardmodell für diese Kategorie zurück (definiert in `models/<model-id>.json`).

#### `modelOptions`

Modellspezifische Parameterüberschreibungen. Jeder Schlüssel ist eine Modellkategorie; jeder Wert ist ein Objekt aus Parameternamen → Werten:

```json
{
  "modelOptions": {
    "textToImage": {
      "num_inference_steps": 8,
      "guidance_scale": 0,
      "output_format": "jpg"
    },
    "textToSpeech": {
      "voice_id": "Deep_Voice_Man",
      "speed": 1.1
    }
  }
}
```

**Gültige Parameter pro Modell:** Definiert durch den Adapter des ausgewählten Modells. Siehe [Modell-Adapter und Optionen](/guides/model-adapters-and-options) für detaillierte Parameterdokumentation pro Modell und Kategorie.

**Validierung:** Parameter werden zur Laufzeit validiert. Ungültige Parameter werden protokolliert; typischerweise werden unbenutzte Parameter stillschweigend ignoriert. Eine Änderung von Modelloptionen invalidiert nur die Ausgaben der betroffenen Stufe.

### Untertitelkonfiguration

#### `subtitleOptions`

Optionales Objekt zum Aktivieren und Konfigurieren der Untertitelgenerierung:

```json
{
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

**Wichtige Felder:**
- `enabled` — Untertitelgenerierung aktivieren/deaktivieren; wenn `false`, werden andere Untertitelfelder ignoriert.
- `templateId` — Vordefinierte Stilvorlage (z. B. `"social_center_clean"`).
- `position` — Untertitelposition: `"top"`, `"center"`, `"bottom"`.
- `fontSize` — Schriftgröße in Pixeln (z. B. `92`).
- `fontName` — Schriftname (z. B. `"Helvetica"`, `"Arial"`).
- `primaryColor` — Textfarbe in Hexadezimal (z. B. `"#ffffff"`).
- `activeColor` — Hervorhebungsfarbe für aktuell gesprochenen Text in Hexadezimal (z. B. `"#9ae6ff"`).
- `outlineColor` — Textkonturenfarbe in Hexadezimal (z. B. `"#111111"`).
- `backgroundEnabled` — Halbtransparenten Hintergrund hinter Text aktivieren.
- `backgroundColor` — Hintergrundfarbe in Hexadezimal.
- `backgroundOpacity` — Hintergrund-Transparenz (0.0–1.0).
- `outline` — Textkonturenstärke in Pixeln.
- `marginV` — Vertikaler Abstand vom Bildschirmrand in Pixeln.
- `maxWordsPerLine` — Maximale Wörter pro Zeile; steuert den Zeilenumbruch.
- `maxLines` — Maximale gleichzeitig angezeigte Zeilen.
- `highlightMode` — `"current_only"` hebt nur das aktuell gesprochene Wort hervor; weitere Modi verfügbar.

**Optionale Untertitelausrichtung:** Wenn aktiviert, kann Rilo Untertitel genauer mit `ffsubsync` ausrichten (erfordert Binärdatei im PATH oder konfiguriert über Einstellungen). Siehe [Untertitel: Ausrichten und Einbrennen](/guides/subtitles-align-and-burn-in).

## App/Laufzeit-Konfiguration

App-Einstellungen werden in `~/.rilo/config.json` (Klartext-öffentliche Einstellungen) und OS-Schlüsselbund/verschlüsselter Datei (sichere Token) gespeichert. Verwalten Sie diese über `rilo settings` oder setzen Sie Umgebungsvariablen.

### Sichere Einstellungen (im Schlüsselbund gespeichert)
- `replicateApiToken` — Replicate-API-Schlüssel
- `apiBearerToken` — Bearer-Token für rilo-API-Endpunkte

### Öffentliche Einstellungen (in ~/.rilo/config.json gespeichert)
- `maxRetries` — Anzahl der Wiederholungen für fehlgeschlagene Vorhersagen (Standard: 2)
- `retryDelayMs` — Verzögerung zwischen Wiederholungen in Millisekunden (Standard: 2500)
- `predictionPollIntervalMs` — Abfrageintervall für Vorhersagestatus (Standard: 1500)
- `predictionMaxWaitMs` — Max. Wartezeit für eine einzelne Vorhersage (Standard: 600000)
- `downloadTimeoutMs` — Timeout für Download von Mediendateien (Standard: 20000)
- `downloadMaxBytes` — Maximale Dateigröße für Downloads (Standard: 104857600 / 100 MB)
- `downloadAllowedHosts` — Kommagetrennte Hostnamen für Downloads erlaubt
- `ffmpegBin` — Pfad zur ffmpeg-Binärdatei (Standard: `"ffmpeg"`)
- `ffprobeBin` — Pfad zur ffprobe-Binärdatei (Standard: `"ffprobe"`)
- `ffsubsyncBin` — Pfad zur ffsubsync-Binärdatei (Standard: `"ffsubsync"`)
- `apiDefaultLogsLimit` — Standard-Logeinträge, die von der API zurückgegeben werden (Standard: 100)
- `apiMaxLogsLimit` — Harte Obergrenze für Logeinträge (Standard: 1000)

### Konfigurationspriorität

Bei der Auflösung einer Einstellung:

1. **Umgebungsvariable** (höchste Priorität) — z. B. `RILO_MAX_RETRIES=5`
2. **~/.rilo/config.json** (wenn gesetzt über `rilo settings`)
3. **Schema-Standardwert** (niedrigste Priorität)

Wenn eine Umgebungsvariable gesetzt ist, zeigt `rilo settings` sie als schreibgeschützt an.

### Einstellungen verwalten

**Interaktives Menü:**
```bash
rilo settings
```

**Umgebungsvariablen:**
```bash
export TELEPAT_REPLICATE_TOKEN=r8_xxxxx
export RILO_MAX_RETRIES=5
export PREDICTION_MAX_WAIT_MS=900000
rilo --project demo --story-file ./story.txt
```

**Direkte Dateibearbeitung (nicht empfohlen):**
```bash
cat ~/.rilo/config.json
```

## Konfigurationsworkflow

**Erster Lauf:**
1. Führen Sie `rilo settings` aus, um Ihren Replicate-API-Token sicher einzugeben
2. Optional Timeouts, Wiederholungen, Binärpfade anpassen
3. Diese Einstellungen gelten global für alle Projekte

**Neues Projekt:**
1. Führen Sie `rilo --project <name> --story-file <path>` aus, um zu initialisieren
2. Dies erstellt `projects/<name>/config.json` mit sinnvollen Standardwerten
3. Bearbeiten Sie diese Datei, um Modelle, Seitenverhältnis, Dauer usw. anzupassen
4. Führen Sie mit `--force` neu aus, um Änderungen zu übernehmen

**Iterieren:**
1. Ändern Sie `projects/<name>/config.json`
2. Führen Sie `rilo --project <name> --force` aus
3. Rilo invalidiert betroffene Stufen und regeneriert

## Hinweise

- `targetDurationSec` beeinflusst die Drehbuchplanung; es wird nicht strikt durchgesetzt; die tatsächliche Dauer hängt vom generierten Inhalt ab.
- Die Segmentanzahl wird aus der gemessenen Sprechertext-Dauer abgeleitet (typischerweise 5-Sekunden-Blöcke), nicht aus `targetDurationSec`.
- Wenn `keyframeWidth` und `keyframeHeight` nicht angegeben sind, berechnet Rilo sie aus `aspectRatio`.
- Eine Änderung von `aspectRatio`, `keyframeWidth`, `keyframeHeight` oder Modellen invalidiert alle nachgelagerten Arbeiten.
- Modellspezifische Parametervalidierung erfolgt zur Laufzeit; ungültige Parameter werden protokolliert.
- Untertitel-Einbrennung ist optional; aktivieren/deaktivieren Sie sie, ohne die Videogenerierung zu beeinträchtigen.

## Siehe auch

- [CLI-Referenz](/reference/cli-reference) — Befehle und Flags
- [Umgebungsvariablen](/reference/environment-variables) — Alle Umgebungsvariablen und Priorität
- [Modell-Adapter und Optionen](/guides/model-adapters-and-options) — Detaillierte Parameterdokumentation pro Modell
- [Regeneration und Invalidierung](/guides/regeneration-and-invalidation) — Wie Konfigurationsänderungen die Regeneration auslösen
- [Untertitel: Ausrichten und Einbrennen](/guides/subtitles-align-and-burn-in) — Untertiteloptionen und Workflow
