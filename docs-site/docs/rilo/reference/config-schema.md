---
slug: /reference/config-schema
sidebar_position: 2
title: Complete Config Schema
---

This page documents every configuration option across both **project config** (`projects/<project>/config.json`) and **app/runtime config** (`~/.rilo/config.json` + keystore).

## Project Config (projects/\<project\>/config.json)

### Required and Core Fields

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `aspectRatio` | string | `"9:16"` | `"1:1"` \| `"16:9"` \| `"9:16"` — output video aspect ratio |
| `targetDurationSec` | number | `60` | Target script/narration duration in seconds; influences pacing |
| `finalDurationMode` | string | `"match_audio"` | `"match_audio"` \| `"match_visual"` — how to handle final composition duration |

### Keyframe Dimensions

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `keyframeWidth` | number | Auto-derived | Keyframe width in pixels (must pair with `keyframeHeight`); ≥ 512 |
| `keyframeHeight` | number | Auto-derived | Keyframe height in pixels (must pair with `keyframeWidth`); ≥ 512 |

If both are omitted, they are calculated from `aspectRatio` and a default base dimension (e.g., `9:16` → 576×1024).

### Model Selection

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `models` | object | `{}` | Maps model category to selected model ID |
| `models.textToText` | string | Auto-filled from defaults | Script/shot generation model (e.g., `"deepseek-ai/deepseek-v3"`) |
| `models.textToSpeech` | string | Auto-filled from defaults | Narration/voiceover model (e.g., `"minimax/speech-02-turbo"`) |
| `models.textToImage` | string | Auto-filled from defaults | Keyframe generation model (e.g., `"prunaai/z-image-turbo"`) |
| `models.imageTextToVideo` | string | Auto-filled from defaults | Video segment generation model (e.g., `"wan-video/wan-2.2-i2v-fast"`) |

Auto-filled defaults come from model catalog metadata in `models/<model-id>.json`. See [Model Catalog](/reference/model-catalog) for available models.

### Model Options (Per-Model Parameters)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `modelOptions` | object | `{}` | Maps model category to parameter overrides |
| `modelOptions.textToText` | object | `{}` | LLM parameters (e.g., `max_tokens`, `temperature`) for script model |
| `modelOptions.textToSpeech` | object | `{}` | TTS parameters (e.g., `voice_id`, `speed`) for narration model |
| `modelOptions.textToImage` | object | `{}` | Image generation parameters (e.g., `num_inference_steps`, `guidance_scale`) |
| `modelOptions.imageTextToVideo` | object | `{}` | Video generation parameters (e.g., `sample_shift`, `go_fast`) |

**Valid parameters per model:** Defined by the model's adapter in `src/steps/textToImageAdapters.js`, `src/steps/imageToVideoAdapters.js`, etc. See [Model Adapters and Options](/guides/model-adapters-and-options) for detailed parameter documentation.

**Parameter validation:** Parameters are validated at model request time. Invalid parameters may be logged or silently ignored depending on the model adapter.

**Changing model options:** Invalidates only the affected stage's cached outputs.

### Subtitle Configuration (Optional)

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `subtitleOptions` | object | `undefined` | Master toggle and styling for subtitle generation |
| `subtitleOptions.enabled` | boolean | `false` | Enable/disable subtitle generation for this project |
| `subtitleOptions.templateId` | string | `"social_center_clean"` | Predefined subtitle style template ID |
| `subtitleOptions.position` | string | `"center"` | `"top"` \| `"center"` \| `"bottom"` |
| `subtitleOptions.fontName` | string | `"Helvetica"` | Font name (system-installed); e.g., `"Arial"`, `"Helvetica"`, `"Courier"` |
| `subtitleOptions.fontSize` | number | `92` | Font size in pixels; typically 80–120 for mobile vertical video |
| `subtitleOptions.bold` | boolean | `false` | Apply bold weight |
| `subtitleOptions.italic` | boolean | `false` | Apply italic style |
| `subtitleOptions.makeUppercase` | boolean | `false` | Convert all text to uppercase |
| `subtitleOptions.primaryColor` | string | `"#ffffff"` | Text color in hex format |
| `subtitleOptions.activeColor` | string | `"#9ae6ff"` | Highlight color for currently speaking word in hex |
| `subtitleOptions.outlineColor` | string | `"#111111"` | Text outline/stroke color in hex |
| `subtitleOptions.backgroundEnabled` | boolean | `true` | Enable semi-transparent background behind text |
| `subtitleOptions.backgroundColor` | string | `"#000000"` | Background color in hex |
| `subtitleOptions.backgroundOpacity` | number | `0.45` | Background opacity; 0.0 (transparent) to 1.0 (opaque) |
| `subtitleOptions.outline` | number | `3` | Text outline thickness in pixels |
| `subtitleOptions.shadow` | number | `0` | Text drop shadow size in pixels |
| `subtitleOptions.marginV` | number | `120` | Vertical margin from top/bottom edge when `position` is not `"center"` |
| `subtitleOptions.maxWordsPerLine` | number | `4` | Words per line before wrapping |
| `subtitleOptions.maxLines` | number | `2` | Maximum concurrent subtitle lines shown |
| `subtitleOptions.highlightMode` | string | `"current_only"` | How to highlight currently spoken text; other values may be supported |

**Note:** If `subtitleOptions.enabled` is `false`, all other subtitle fields are ignored during generation.

### Example Complete Project Config

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

## App/Runtime Config (~/.rilo/config.json + Keystore)

App-level settings are managed via `rilo settings` or environment variables. Secure tokens live in the OS keystore; public settings live in `~/.rilo/config.json`.

### Secure Settings (Keystore / Encrypted File)

| Key | Settings Label | Env Vars | Type | Notes |
|-----|---|---|------|-------|
| `replicateApiToken` | Replicate API Token | `RILO_REPLICATE_API_TOKEN`, `REPLICATE_API_TOKEN` | string | API key from replicate.com/account/api-tokens. Required for model predictions. |
| `apiBearerToken` | API Bearer Token | `RILO_API_BEARER_TOKEN`, `API_BEARER_TOKEN` | string | Bearer token for authenticating requests to rilo HTTP API endpoints. Required if running HTTP API with authentication. |

**Storage:** OS keystore (macOS Keychain, Windows Credential Manager, Linux Secret Service) or AES-256 encrypted file at `~/.rilo/.secrets` if no native keystore is available.

### Public Settings (~/. rilo/config.json)

#### Prediction & Retry Behavior

| Key | Settings Label | Env Var | Type | Default | Notes |
|-----|---|---|------|---------|-------|
| `maxRetries` | Max Retries | `MAX_RETRIES` | number | `2` | Number of retries for failed predictions; ≥ 0 |
| `retryDelayMs` | Retry Delay (ms) | `RETRY_DELAY_MS` | number | `2500` | Milliseconds to wait between retries; ≥ 0 |
| `predictionPollIntervalMs` | Poll Interval (ms) | `PREDICTION_POLL_INTERVAL_MS` | number | `1500` | How often to check prediction status; ≥ 100 |
| `predictionMaxWaitMs` | Max Prediction Wait (ms) | `PREDICTION_MAX_WAIT_MS` | number | `600000` (10 min) | Max time to wait for a single prediction to complete; ≥ 1000 |

#### Download Behavior

| Key | Settings Label | Env Var | Type | Default | Notes |
|-----|---|---|------|---------|-------|
| `downloadTimeoutMs` | Download Timeout (ms) | `DOWNLOAD_TIMEOUT_MS` | number | `20000` | Timeout for downloading generated media files; ≥ 1000 |
| `downloadMaxBytes` | Download Max Size (bytes) | `DOWNLOAD_MAX_BYTES` | number | `104857600` (100 MB) | Hard cap on file size for downloads; > 0 |
| `downloadAllowedHosts` | Download Allowed Hosts | `DOWNLOAD_ALLOWED_HOSTS` | string | `"replicate.delivery,replicate.com"` | Comma-separated list of allowed hostnames for media downloads; non-empty |

#### Binary Paths

| Key | Settings Label | Env Var | Type | Default | Notes |
|-----|---|---|------|---------|-------|
| `ffmpegBin` | ffmpeg Binary | `FFMPEG_BIN` | string | `"ffmpeg"` | Path or command name for ffmpeg; non-empty; typically in PATH |
| `ffprobeBin` | ffprobe Binary | `FFPROBE_BIN` | string | `"ffprobe"` | Path or command name for ffprobe; non-empty; typically in PATH |
| `ffsubsyncBin` | ffsubsync Binary | `FFSUBSYNC_BIN` | string | `"ffsubsync"` | Path or command name for ffsubsync (optional subtitle alignment tool); non-empty |

#### API Logging

| Key | Settings Label | Env Var | Type | Default | Notes |
|-----|---|---|------|---------|-------|
| `apiDefaultLogsLimit` | Default Logs Limit | `API_DEFAULT_LOGS_LIMIT` | number | `100` | Default number of log entries returned by HTTP API per request; > 0 |
| `apiMaxLogsLimit` | Max Logs Limit | `API_MAX_LOGS_LIMIT` | number | `1000` | Hard cap on log entries returned by HTTP API; > 0 |

#### Environment-Only Settings (Not in ~/.rilo/config.json)

These can only be set via environment variables; they are not editable via `rilo settings`:

| Env Var | Type | Notes |
|---------|------|-------|
| `FIREBASE_PROJECT_ID` | string | Firebase project ID for Firestore/Storage (optional) |
| `FIREBASE_PRIVATE_KEY` | string | Firebase service account private key (optional) |
| `FIREBASE_CLIENT_EMAIL` | string | Firebase service account client email (optional) |
| `RILO_WEBHOOK_SECRET` | string | Shared secret for validating incoming webhook signatures (optional) |
| `RILO_WEBHOOK_URL` | string | URL to POST job status updates to (optional) |
| `RILO_API_PORT` | string | HTTP API port; default `3000` |
| `RILO_PROJECTS_DIR` | string | Custom projects directory; default `"projects/"` |
| `RILO_OUTPUTS_DIR` | string | Custom outputs directory for backends; default `"outputs/"` |
| `RILO_BACKEND` | string | Output backend: `"local"` or `"firebase"` (default: `"local"`) |

### Example ~/.rilo/config.json

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

Secure settings (`replicateApiToken`, `apiBearerToken`) are **not** present in this file; they are stored in the keystore.

---

## Configuration Precedence

For any setting, rilo resolves the value in this order (first match wins):

1. **Environment variable** (highest priority)
   - Examples: `RILO_MAX_RETRIES=5`, `REPLICATE_API_TOKEN=r8_xxx`
   - Specific env + generic env checked in order (e.g., `RILO_REPLICATE_API_TOKEN` before `REPLICATE_API_TOKEN`)
   - When set, the `rilo settings` menu shows the value as "read-only (via environment variable)"

2. **~/.rilo/config.json** (if present and key is written)
   - Applies only if no env var is set
   - Editable via `rilo settings`

3. **Schema default** (lowest priority)
   - Built-in fallback value

**Example:**
```bash
# Env var wins
export MAX_RETRIES=10
rilo settings  # Shows "Max Retries: 10 (via environment variable) — read-only"

# No env var; config.json value used
cat ~/.rilo/config.json | jq .maxRetries  # 3
# If both env and config.json are absent, schema default (2) is used
```

---

## Validation Rules

### Project Config

- `aspectRatio`: Must be one of `"1:1"`, `"16:9"`, `"9:16"`
- `targetDurationSec`: Must be a positive integer (> 0)
- `finalDurationMode`: Must be `"match_audio"` or `"match_visual"`
- `keyframeWidth`, `keyframeHeight`: If both provided, must be integers ≥ 512; if one is provided, both must be provided; if neither, auto-derived from aspect ratio
- `models.<category>`: Must correspond to a valid model ID in the model catalog
- `modelOptions.<category>.<param>`: Validated per model adapter; invalid params may be logged or ignored
- `subtitleOptions.enabled`: Must be boolean; if `false`, other subtitle fields are ignored
- Hex color fields: Must be valid hex color (e.g., `"#ffffff"`, `"#000000"`)
- Opacity fields: Must be number between 0.0 and 1.0

Validation errors are logged; generation may fail if critical config is invalid.

### App Config

- `maxRetries`, `apiDefaultLogsLimit`, `apiMaxLogsLimit`: Must be non-negative integers
- `retryDelayMs`, `downloadTimeoutMs`, `downloadMaxBytes`, `predictionPollIntervalMs`, `predictionMaxWaitMs`: Must be positive integers
- `predictionPollIntervalMs`: Must be ≥ 100
- `predictionMaxWaitMs`: Must be ≥ 1000
- `downloadTimeoutMs`: Must be ≥ 1000
- `ffmpegBin`, `ffprobeBin`, `ffsubsyncBin`: Must be non-empty strings
- `downloadAllowedHosts`: Must be non-empty; comma-separated list of hostnames

Invalid app config is rejected during settings save or env var apply.

---

## Related Documentation

- **[Configuration](/guides/configuration)** — Configuration workflow and examples
- **[CLI Reference](/reference/cli-reference)** — Commands and flags
- **[Environment Variables](/reference/environment-variables)** — All env vars with examples
- **[Model Adapters and Options](/guides/model-adapters-and-options)** — Per-model parameter documentation
- **[Model Catalog](/reference/model-catalog)** — Available models by category