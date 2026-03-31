---
slug: /guides/configuration
sidebar_position: 1
title: Configuration
---

Rilo has two configuration scopes:
- **Project config** (`projects/<project>/config.json`): generation options like duration, aspect ratio, model selections, and model options.
- **App/runtime config** (`~/.rilo/config.json` + secure keystore): API tokens, retries, timeouts, binary paths, and related runtime settings managed by `rilo settings`.

## Project Configuration

Rilo project configuration lives in `config.json`.

### Example config.json

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

### Core Settings

#### `aspectRatio`
- **Type:** `string`
- **Allowed values:** `"1:1"`, `"16:9"`, `"9:16"`
- **Default:** `"9:16"`
- **Description:** Output video aspect ratio. Determines keyframe dimensions and final composition. Changing this invalidates all keyframes and segments.

#### `targetDurationSec`
- **Type:** `number`
- **Default:** `60`
- **Description:** Target narration/script duration in seconds. Influences script planning (number of shots, pacing) and downstream segment planning. Segment count is derived from actual narration duration, typically in 5-second chunks.

#### `finalDurationMode`
- **Type:** `string`
- **Allowed values:** `"match_audio"`, `"match_visual"`
- **Default:** `"match_audio"`
- **Description:** Controls composition duration:
  - `"match_audio"` — Final video duration = narration + silence padding (if needed)
  - `"match_visual"` — Final video duration = sum of all visual segments (may clip audio)

#### `keyframeWidth` and `keyframeHeight`
- **Type:** `number`
- **Default:** Derived from `aspectRatio` (e.g., `9:16` → 576x1024)
- **Description:** Dimensions (in pixels) for generated keyframes. Must be provided as a pair; both must be integers ≥ 512. Changing these invalidates all keyframes and segments.

### Models Configuration

#### `models`

Object mapping generation stage to selected model:

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

**Model categories:**
- `textToText` — Script generation (input: story → output: script)
- `textToSpeech` — Voiceover generation (input: script → output: narration audio)
- `textToImage` — Keyframe generation (input: shot description → output: still images)
- `imageTextToVideo` — Segment generation (input: keyframe + text overlay → output: video segment)

**Valid model IDs:** See [Model Catalog](/reference/model-catalog) for the complete list and capabilities of each model.

**Missing selections:** If a category is omitted, rilo falls back to a default model for that category (defined in `models/<model-id>.json`).

#### `modelOptions`

Per-model parameter overrides. Each key is a model category; each value is an object of parameter names → values:

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

**Valid parameters per model:** Defined by the selected model's adapter. See [Model Adapters and Options](/guides/model-adapters-and-options) for detailed parameter documentation per model and category.

**Validation:** Parameters are validated at runtime. Invalid parameters are logged; commonly, unused parameters are silently ignored. Changing model options invalidates only that stage's outputs.

### Subtitle Configuration

#### `subtitleOptions`

Optional object enabling and configuring subtitle generation:

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

**Key fields:**
- `enabled` — Enable/disable subtitle generation; if `false`, other subtitle fields are ignored.
- `templateId` — Predefined style template (e.g., `"social_center_clean"`).
- `position` — Subtitle position: `"top"`, `"center"`, `"bottom"`.
- `fontSize` — Font size in pixels (e.g., `92`).
- `fontName` — Font name (e.g., `"Helvetica"`, `"Arial"`).
- `primaryColor` — Text color in hex (e.g., `"#ffffff"`).
- `activeColor` — Highlight color for currently speaking text in hex (e.g., `"#9ae6ff"`).
- `outlineColor` — Text outline color in hex (e.g., `"#111111"`).
- `backgroundEnabled` — Enable semi-transparent background behind text.
- `backgroundColor` — Background color in hex.
- `backgroundOpacity` — Background opacity (0.0–1.0).
- `outline` — Text outline thickness in pixels.
- `marginV` — Vertical margin from screen edge in pixels.
- `maxWordsPerLine` — Maximum words per line; controls line wrapping.
- `maxLines` — Maximum lines displayed at once.
- `highlightMode` — `"current_only"` highlights only the currently spoken word; other modes available.

**Optional subtitle alignment:** If enabled, rilo can align subtitles more precisely using `ffsubsync` (requires binary in PATH or configured via settings). See [Subtitles: Align and Burn-In](/guides/subtitles-align-and-burn-in).

## App/Runtime Configuration

App-level settings are stored in `~/.rilo/config.json` (plain-text public settings) and OS keystore/encrypted file (secure tokens). Manage these via `rilo settings` or set environment variables.

### Secure Settings (Stored in Keystore)
- `replicateApiToken` — Replicate API key
- `apiBearerToken` — Bearer token for rilo API endpoints

### Public Settings (Stored in ~/.rilo/config.json)
- `maxRetries` — Number of retries for failed predictions (default: 2)
- `retryDelayMs` — Delay between retries in milliseconds (default: 2500)
- `predictionPollIntervalMs` — Polling interval for prediction status (default: 1500)
- `predictionMaxWaitMs` — Max wait time for a single prediction (default: 600000)
- `downloadTimeoutMs` — Timeout for downloading media files (default: 20000)
- `downloadMaxBytes` — Max file size for downloads (default: 104857600 / 100 MB)
- `downloadAllowedHosts` — Comma-separated hostnames allowed for downloads
- `ffmpegBin` — Path to ffmpeg binary (default: `"ffmpeg"`)
- `ffprobeBin` — Path to ffprobe binary (default: `"ffprobe"`)
- `ffsubsyncBin` — Path to ffsubsync binary (default: `"ffsubsync"`)
- `apiDefaultLogsLimit` — Default log entries returned by API (default: 100)
- `apiMaxLogsLimit` — Hard cap on log entries (default: 1000)

### Configuration Precedence

When resolving any setting:

1. **Environment variable** (highest priority) — e.g., `RILO_MAX_RETRIES=5`
2. **~/.rilo/config.json** (if set via `rilo settings`)
3. **Schema default** (lowest priority)

If an env var is set, `rilo settings` shows it as read-only.

### Managing Settings

**Interactive menu:**
```bash
rilo settings
```

**Environment variables:**
```bash
export RILO_REPLICATE_API_TOKEN=r8_xxxxx
export RILO_MAX_RETRIES=5
export PREDICTION_MAX_WAIT_MS=900000
rilo --project demo --story-file ./story.txt
```

**Direct file edit (not recommended):**
```bash
cat ~/.rilo/config.json
```

## Configuration Workflow

**First run:**
1. Run `rilo settings` to enter your Replicate API token securely
2. Optionally adjust timeouts, retries, binary paths
3. These settings apply globally to all projects

**New project:**
1. Run `rilo --project <name> --story-file <path>` to initialize
2. This creates `projects/<name>/config.json` with sensible defaults
3. Edit this file to customize models, aspect ratio, duration, etc.
4. Re-run with `--force` to apply changes

**Iterate:**
1. Change `projects/<name>/config.json`
2. Run `rilo --project <name> --force`
3. Rilo invalidates affected stages and regenerates

## Notes

- `targetDurationSec` influences script planning; it's not enforced strictly; actual duration depends on generated content.
- Segment count is derived from measured narration duration (typically 5-second chunks), not `targetDurationSec`.
- If `keyframeWidth` and `keyframeHeight` aren't provided, rilo calculates them from `aspectRatio`.
- Changing `aspectRatio`, `keyframeWidth`, `keyframeHeight`, or models invalidates all downstream work.
- Model-specific parameter validation happens at runtime; invalid parameters are logged.
- Subtitle burning is optional; enable/disable without affecting video generation.

## See Also

- [CLI Reference](/reference/cli-reference) — Commands and flags
- [Environment Variables](/reference/environment-variables) — All env vars and precedence
- [Model Adapters and Options](/guides/model-adapters-and-options) — Detailed parameter docs per model
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation) — How config changes trigger regeneration
- [Subtitles: Align and Burn-In](/guides/subtitles-align-and-burn-in) — Subtitle options and workflow
