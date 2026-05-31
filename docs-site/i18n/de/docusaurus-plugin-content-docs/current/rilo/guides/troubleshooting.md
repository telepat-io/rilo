---
slug: /guides/troubleshooting
sidebar_position: 10
title: Fehlerbehebung
---

## Schnelle Erstbewertung

**Häufigste Probleme:**
1. Fehlende oder falsche API-Token `TELEPAT_REPLICATE_TOKEN`
2. ffmpeg/ffprobe nicht im PATH oder falsch konfiguriert
3. Modell-IDs oder modelOptions ungültig oder inkompatibel mit ausgewählten Adaptoren
4. Vorhersagen Timeout (erhöhen Sie `PREDICTION_MAX_WAIT_MS`)
5. Download-Fehler (überprüfen Sie `DOWNLOAD_ALLOWED_HOSTS`, Timeout und max-bytes-Einstellungen)

**Beginnen Sie hier:**
```bash
rilo settings
# Überprüfen Sie, ob Replicate API Token gesetzt ist ✓
# Überprüfen Sie, ob ffmpeg und ffprobe Pfade korrekt sind ✓
# Überprüfen Sie Max Prediction Wait (erhöhen Sie bei Bedarf) ✓
```

---

## CLI-Fehler

### "Missing --project argument"

**Fehlermeldung:**
```
Error: Missing --project argument
```

**Ursache:** Das `--project`-Flag wurde weggelassen.

**Lösung:**
```bash
# Richtige Verwendung:
rilo --project housing-case --story-file ./story.txt

# Nicht:
rilo --story-file ./story.txt  # Fehlendes --project
```

### "Project story.md not found"

**Fehlermeldung:**
```
Error: Project story.md not found. Provide --story-file once to initialize the project.
```

**Ursache:** Das Projekt existiert, hat aber kein `story.md`. Rilo konnte die Geschichte nicht finden oder sie wurde beim ersten Lauf nicht gespeichert.

**Lösungen:**
1. Übergeben Sie `--story-file` beim nächsten Lauf:
   ```bash
   rilo --project housing-case --story-file ./my-story.txt
   ```

2. Überprüfen Sie manuell das Projektverzeichnis:
   ```bash
   ls -la projects/housing-case/
   ```
   Wenn `story.md` fehlt, erstellen Sie es aus einer Textdatei neu.

3. Überprüfen Sie, ob das Projektverzeichnis erfolgreich erstellt wurde:
   ```bash
   cat projects/housing-case/config.json  # Sollte existieren
   ```

### "Validation error: invalid model ID" oder "Unknown model"

**Fehlermeldung:**
```
Error: Model "invalid-model-name" is not recognized or not supported
```

**Ursache:** Eine Modell-ID in `projects/<project>/config.json` existiert nicht im Modellkatalog.

**Lösung:**
1. Verfügbare Modelle auflisten:
   ```bash
   ls models/ | head -10
   # Siehe: deepseek-ai__deepseek-v3.json, minimax__speech-02-turbo.json usw.
   ```

2. Bearbeiten Sie die Konfiguration mit gültigen Modell-IDs:
   ```bash
   cat projects/housing-case/config.json | jq '.models'
   # Überprüfen Sie das Format: "org/name" wird zu "org__name" im models/ Verzeichnis
   ```

3. Verwenden Sie `rilo settings`, um verfügbare Standardwerte zu überprüfen (noch nicht UI-gesteuert, aber im Modellkatalog dokumentiert).

### "Invalid modelOption parameter"

**Fehlermeldung:**
```
Warning: modelOption "unknown_param" for textToImage is not recognized
```

**Ursache:** Ein Parameter in `modelOptions` wird vom Adapter des ausgewählten Modells nicht unterstützt.

**Lösung:**
1. Siehe [Modell-Adapter und Optionen](/guides/model-adapters-and-options) für gültige Parameter pro Modell und Kategorie.

2. Häufige Modelloptionen, die funktionieren:
   - **textToImage** (Flux): `num_inference_steps`, `guidance_scale`, `output_format`
   - **textToImage** (Z-Image): `num_inference_steps`, `output_format`, `output_quality`
   - **imageTextToVideo** (Kling): `interpolate_output`, `go_fast`
   - **imageTextToVideo** (Wan): `sample_shift`, `go_fast`, `disable_safety_checker`

3. Entfernen Sie nicht erkannte Parameter oder aktualisieren Sie die Modellauswahl.

### "unauthorized" oder "invalid API token"

**Fehlermeldung:**
```
Error: Replicate API returned: unauthorized
```

**Ursache:**
- API-Token fehlt oder ist falsch
- Token hat keine Berechtigung oder wurde widerrufen
- Token-Prioritätsproblem (Umgebungsvariable vs. gespeicherte Einstellung)

**Lösungen:**
1. Überprüfen Sie, ob Token gesetzt ist:
   ```bash
   echo $TELEPAT_REPLICATE_TOKEN  # oder $TELEPAT_REPLICATE_TOKEN
   ```

2. Überprüfen Sie über `rilo settings`:
   ```bash
   rilo settings
   # Zu "Replicate API Token" navigieren und überprüfen, ob es befüllt ist
   ```

3. Wenn über Umgebungsvariable gesetzt, stellen Sie sicher, dass sie exportiert ist:
   ```bash
   export TELEPAT_REPLICATE_TOKEN=r8_xxxxx
   rilo --project demo --story-file ./story.txt

   # Nicht:
   TELEPAT_REPLICATE_TOKEN=r8_xxxxx rilo ...  # Funktioniert möglicherweise nicht in allen Shells
   ```

4. Überprüfen Sie den Token auf [replicate.com](https://replicate.com/account/api-tokens).

5. Priorität: Umgebungsvariable > ~/.rilo/config.json > Standard. Wenn eine Umgebungsvariable gesetzt ist, zeigt das `rilo settings`-Menü sie als schreibgeschützt an.

### "ffmpeg/ffprobe not found" oder "command not found"

**Fehlermeldung:**
```
Error: ffmpeg not found. Install ffmpeg or set FFMPEG_BIN in settings.
```

**Ursache:**
- ffmpeg/ffprobe nicht im PATH
- Binärpfad in den Einstellungen falsch konfiguriert
- Binärdatei nicht installiert

**Lösungen:**
1. Installieren Sie ffmpeg (wenn nicht bereits installiert):
   ```bash
   # macOS
   brew install ffmpeg

   # Linux (Ubuntu/Debian)
   sudo apt-get install ffmpeg

   # Windows
   choco install ffmpeg
   # Oder herunterladen von ffmpeg.org
   ```

2. Überprüfen Sie die Installation:
   ```bash
   which ffmpeg
   which ffprobe
   ffmpeg -version
   ```

3. Konfigurieren Sie in `rilo settings`:
   ```bash
   rilo settings
   # Zu "ffmpeg Binary" navigieren, vollen Pfad eingeben: /usr/local/bin/ffmpeg
   # Oder wenn im PATH, einfach: ffmpeg
   ```

4. Über Umgebungsvariable setzen:
   ```bash
   export FFMPEG_BIN=/usr/local/bin/ffmpeg
   rilo --project demo --story-file ./story.txt
   ```

---

## Vorhersage- und Netzwerkprobleme

### "Prediction timed out"

**Fehlermeldung:**
```
Error: Prediction timed out after 600000ms
```

**Ursache:**
- Vorhersage dauert länger als `PREDICTION_MAX_WAIT_MS`
- Netzwerkverbindungsprobleme
- Provider erlebt langsame Inferenz
- Hohe Warteschlange auf der Provider-Seite

**Lösungen:**
1. Timeout erhöhen:
   ```bash
   rilo settings
   # Zu "Max Prediction Wait (ms)" navigieren
   # Von 600000 auf 900000 (15 Min.) oder höher erhöhen
   ```

   Oder über Umgebungsvariable:
   ```bash
   export PREDICTION_MAX_WAIT_MS=900000
   rilo --project demo --story-file ./story.txt
   ```

2. Mit `--force` erneut versuchen:
   ```bash
   rilo --project demo --force
   # Startet von der fehlgeschlagenen Stufe neu
   ```

3. Netzwerk und Provider-Status überprüfen:
   - Internetverbindung überprüfen
   - Replicate-Statusseite überprüfen

### "Download failed" oder "exceeds max file size"

**Fehlermeldung:**
```
Error: Downloaded file (120MB) exceeds DOWNLOAD_MAX_BYTES (104857600)
```

**Ursache:**
- Datei ist größer als `DOWNLOAD_MAX_BYTES`
- Download-Timeout überschritten
- Download-Host nicht in `DOWNLOAD_ALLOWED_HOSTS`

**Lösungen:**
1. Maximale Download-Größe erhöhen:
   ```bash
   rilo settings
   # Zu "Download Max Size (bytes)" navigieren
   # Von 104857600 (100 MB) auf 209715200 (200 MB) oder mehr erhöhen
   ```

   Oder über Umgebungsvariable:
   ```bash
   export DOWNLOAD_MAX_BYTES=209715200
   rilo --project demo --story-file ./story.txt
   ```

2. Download-Timeout erhöhen:
   ```bash
   export DOWNLOAD_TIMEOUT_MS=30000
   ```

3. Erlaubte Hosts überprüfen:
   ```bash
   rilo settings
   # "Download Allowed Hosts" anzeigen — sollte Domains enthalten, auf denen Dateien gehostet werden
   # Standard: replicate.delivery,replicate.com
   ```

4. Bei Bedarf benutzerdefinierte Hosts hinzufügen:
   ```bash
   cat ~/.rilo/config.json | jq .downloadAllowedHosts
   # Bei Bedarf bearbeiten, um Ihr CDN einzuschließen
   ```

---

## Generierungs- und Stufenfehler

### "Story validation failed" oder "Story is too short"

**Fehlermeldung:**
```
Error: Story is required and must be at least 50 characters
```

**Ursache:**
- Geschichte ist leer oder zu kurz
- Geschichte hat nicht genug Details für die Drehbuchgenerierung

**Lösung:**
- Geben Sie eine längere, klarere Geschichte (zielen Sie auf 200+ Zeichen ab):
  ```bash
  cat > story.txt <<'EOF'
  A young couple discovers they share a love of gardening when they meet at a community plot.
  Over months, they grow vegetables and flowers together, learning about each other through patient care.
  When spring arrives, their garden blooms in full colour, and so does their relationship.
  They decide to get married and promise to grow old together, like the perennial plants they've nurtured.
  EOF

  rilo --project garden-case --story-file ./story.txt
  ```

### "Script generation failed" oder "LLM returned error"

**Fehlermeldung:**
```
Error: Script generation failed: LLM returned status 400
```

**Ursache:**
- Drehbuchmodell (z. B. DeepSeek) gab einen Fehler zurück
- LLM-spezifisches Problem (Ratenbegrenzung, ungültige Parameter, Quota überschritten)
- Netzwerkfehler beim Erreichen des Modellproviders

**Lösungen:**
1. Warten und erneut versuchen:
   ```bash
   rilo --project demo --force
   # Startet von der Drehbuch-Stufe neu
   ```

2. Anzahl der Wiederholungen erhöhen:
   ```bash
   export MAX_RETRIES=5
   export RETRY_DELAY_MS=5000
   rilo --project demo --force
   ```

3. Kompatibilität der LLM-Modelloptionen überprüfen:
   ```bash
   cat projects/demo/config.json | jq '.modelOptions.textToText'
   # Überprüfen Sie, ob Parameter wie max_tokens, temperature usw. für das Modell gültig sind
   ```

4. Versuchen Sie ein anderes Modell:
   ```bash
   # Bearbeiten Sie projects/demo/config.json
   # Ändern Sie "models.textToText" in ein anderes Modell (z. B. "gpt-4" wenn verfügbar)
   rilo --project demo --force
   ```

### "Keyframe/segment generation failure"

**Fehlermeldung:**
```
Error: Image generation failed: model returned error
```

**Ursache:**
- Bild/Video-Modell gab Fehler oder Timeout zurück
- Modellparameter inkompatibel mit ausgewähltem Modell
- Safety-Checker oder Ausgabeformat nicht unterstützt

**Lösungen:**
1. Mit erhöhtem Timeout erneut versuchen:
   ```bash
   export PREDICTION_MAX_WAIT_MS=900000
   rilo --project demo --force
   ```

2. Modelloptionen überprüfen und anpassen:
   ```bash
   cat projects/demo/config.json | jq '.modelOptions'
   # Problematische Parameter entfernen
   rilo --project demo --force
   ```

3. Zu schnellerem/stabilerem Modell wechseln:
   ```bash
   # Bearbeiten Sie projects/demo/config.json
   # "textToImage": "black-forest-labs/flux-schnell"  # Schneller als flux-pro
   rilo --project demo --force
   ```

4. Kompositions-/Ausgabeeinstellungen überprüfen:
   ```bash
   cat projects/demo/config.json | jq '{aspectRatio, keyframeWidth, keyframeHeight}'
   # Überprüfen Sie, ob die Maße angemessen sind (≥ 512 jeweils)
   ```

### "Composition failed" oder "Final video creation error"

**Fehlermeldung:**
```
Error: Composition failed: could not create final video
```

**Ursache:**
- ffmpeg-Fehler während der Komposition
- Audio/Video-Codec-Inkompatibilität
- Festplattenplatzproblem
- Untertitel-Einbrennen fehlgeschlagen (falls aktiviert)

**Lösungen:**
1. Festplattenplatz überprüfen:
   ```bash
   df -h
   # Sollte mindestens 2–5 GB frei haben für ein typisches Video
   ```

2. ffmpeg überprüfen:
   ```bash
   ffmpeg -version
   ffprobe -version
   ```

3. Wenn Untertitel aktiviert sind, deaktivieren und erneut versuchen:
   ```bash
   cat projects/demo/config.json | jq '.subtitleOptions.enabled'
   # Auf false setzen und subtitleOptions entfernen oder enabled: false setzen
   rilo --project demo --force
   ```

4. Assets überprüfen:
   ```bash
   ls -lh projects/demo/assets/
   # Überprüfen Sie, ob Audio- und Videosegmente vorhanden sind und nicht leer sind
   ```

---

## Protokollierung und Debugging

### Projekt-Log-Endpunkt prüfen (HTTP-API)

```bash
curl -H "Authorization: Bearer $RILO_API_BEARER_TOKEN" \
  http://localhost:3000/projects/demo/logs?limit=50
```

### run-state.json überprüfen

```bash
cat projects/demo/run-state.json | jq '.stages'
# Zeigt, welche Stufen erfolgreich abgeschlossen wurden
# Letzte Stufe zeigt, wo es fehlgeschlagen ist
```

### artifacts.json überprüfen

```bash
cat projects/demo/artifacts.json | jq 'keys'
# Listet alle gespeicherten Artefakte auf (Audio, Schlüsselbilder, Segmente, finales Video usw.)
# Fehlende Schlüssel zeigen an, welche Stufe fehlgeschlagen ist
```

### Ausführliche Protokollierung aktivieren (umgebungsbasiert)

Setzen Sie `DEBUG=rilo:*`, um detaillierte Protokolle zu sehen:
```bash
export DEBUG=rilo:*
rilo --project demo --force
```

Oder überprüfen Sie das generierte Protokollverzeichnis:
```bash
ls -la projects/demo/logs/
cat projects/demo/logs/generation-YYYY-MM-DD.log
```

---

## Schnelle Prüfliste

1. ✓ Projekt-Log-Endpunkt auf den neuesten Fehler prüfen:
   ```bash
   curl http://localhost:3000/projects/demo/logs
   ```

2. ✓ `run-state.json` auf die letzte abgeschlossene Stufe überprüfen:
   ```bash
   cat projects/demo/run-state.json | jq '.stages | keys[-1]'
   ```

3. ✓ `artifacts.json` auf fehlende Ausgabepfade/URLs überprüfen:
   ```bash
   cat projects/demo/artifacts.json | jq 'keys'
   ```

4. ✓ Gezielte Regeneration von der fehlgeschlagenen Stufe erneut versuchen:
   ```bash
   rilo --project demo --force
   ```

5. ✓ App-Einstellungen überprüfen:
   ```bash
   rilo settings
   # Token, Timeouts, Binärpfade überprüfen
   ```

---

## Siehe auch

- [CLI-Referenz](/reference/cli-reference) — Alle Befehle und Flags
- [Konfiguration](/guides/configuration) — Projekt- und App-Einstellungen
- [Umgebungsvariablen](/reference/environment-variables) — Einstellungspriorität und Beispiele
- [Regeneration und Invalidierung](/guides/regeneration-and-invalidation) — Wann `--force` verwenden
- [Pipeline-Stufen](/guides/pipeline-stages) — Detaillierte Stufenaufschlüsselung und Ausgaben
