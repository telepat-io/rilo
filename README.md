# VIDEOGEN

JavaScript system to generate short vertical videos from a story using Replicate models:
- Script + dynamic shot count (computed from target duration): `deepseek-ai/deepseek-v3`
- Keyframes: `prunaai/z-image-turbo`
- Video segments: `wan-video/wan-2.2-i2v-fast`
- Narration: `minimax/speech-02-turbo`
- Final composition: `ffmpeg`

Project config supports selecting the model per generation category, defaulting to the model IDs above.
Project config also supports per-category model input overrides via `modelOptions`.

## Requirements

- Node.js 20+
- `ffmpeg` available in PATH
- Replicate API token

## Setup

```bash
cp .env.example .env
npm install
```

Set `VIDEOGEN_REPLICATE_API_TOKEN` in `.env`.

Set `VIDEOGEN_API_BEARER_TOKEN` in `.env` to protect API routes.

Legacy `REPLICATE_API_TOKEN` and `API_BEARER_TOKEN` are still accepted as fallbacks.

## Testing

This repo uses Node's built-in test runner (`node:test`) and is configured for offline unit tests.

Run tests:

```bash
npm test
```

Run coverage:

```bash
npm run test:coverage
```

Current test profile:
- Unit tests are written to avoid live model inference and external network calls.
- Core modules now support dependency injection seams for deterministic tests (pipeline orchestration, provider polling, ffmpeg wrappers, step modules, and firebase backends).
- Coverage is currently above 90% line coverage.

Recommended local check before pushing:

```bash
npm test && npm run lint && npm run test:coverage
```

Additional runtime hardening env knobs:

```bash
PREDICTION_POLL_INTERVAL_MS=1500
PREDICTION_MAX_WAIT_MS=600000
DOWNLOAD_TIMEOUT_MS=20000
DOWNLOAD_MAX_BYTES=104857600
DOWNLOAD_ALLOWED_HOSTS=replicate.delivery,replicate.com
API_DEFAULT_LOGS_LIMIT=100
API_MAX_LOGS_LIMIT=1000
```

## Output backends

The project supports multiple backends for data + asset output:

- `local` (default): stores everything under `./projects/<project>/`
- `firebase`: mirrors project documents to Firestore and files to Cloud Storage

Set in `.env`:

```bash
VIDEOGEN_OUTPUT_BACKEND=local
```

For Firebase backend:

```bash
VIDEOGEN_OUTPUT_BACKEND=firebase
OUTPUT_BACKEND=firebase
VIDEOGEN_FIREBASE_PROJECT_ID=your-project-id
VIDEOGEN_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VIDEOGEN_FIREBASE_CLIENT_EMAIL=service-account@your-project-id.iam.gserviceaccount.com
VIDEOGEN_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

When `VIDEOGEN_OUTPUT_BACKEND=firebase`, every checkpoint sync uploads project files to Cloud Storage at `projects/<project>/...` and writes project data docs in Firestore under `projects/<project>/documents/*`.

## CLI usage

```bash
node src/cli/index.js --project housing-case --story-file ./examples/story.txt
```

After first run, the project is stored in `./projects/housing-case/` with:
- `config.json` (project settings)
- `story.md`
- `run-state.json` (checkpoint for resume)
- `artifacts.json`
- `assets/` (downloaded keyframes, segments, voiceover)
- `final.mp4`

`config.json` currently supports:

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
    "textToText": {
      "temperature": 0.6,
      "top_p": 1
    },
    "textToSpeech": {
      "voice_id": "Wise_Woman",
      "speed": 1
    },
    "textToImage": {
      "num_inference_steps": 8,
      "output_format": "jpg"
    },
    "imageTextToVideo": {
      "interpolate_output": false,
      "go_fast": true
    }
  }
}
```

Allowed values: `1:1`, `16:9`, `9:16`.

`finalDurationMode` controls final mux behavior:
- `match_audio` (default): final video is trimmed to audio length (`ffmpeg -shortest`)
- `match_visual`: final video keeps full concatenated visual length, which can leave up to one segment of silence at the end

`targetDurationSec` controls target script planning length. Final keyframe/segment count is computed from measured voiceover duration with fixed 5s segments: `ceil(audioDurationSec / 5)`.

Narration duration matching behavior:
- Script generation targets a duration-based word budget (with retries if outside range).
- TTS speed is auto-adjusted to move narration closer to `targetDurationSec`.
- After TTS, measured audio duration is the source of truth for visual duration planning.
- This guarantees output video is never shorter than audio, and tail silence is capped to at most one 5s segment.
- Final mux behavior is controlled by `finalDurationMode`.

`keyframeWidth` + `keyframeHeight` are optional and override the text-to-image size directly (both must be set together).

`models` is optional and allows per-category model selection:
- `textToText`
- `textToSpeech`
- `textToImage`
- `imageTextToVideo`

Missing model keys are filled with defaults.

`modelOptions` is optional and validated strictly against metadata for the selected model in each category.
Unknown option keys, invalid types, and out-of-range values are rejected.

When `aspectRatio` changes, visual assets (keyframes, segments, final video) are regenerated on the next run.

When `targetDurationSec` changes, script/shots and all downstream assets are regenerated on the next run.

When `modelOptions` changes, regeneration cascades by category:
- `textToText`: script + downstream
- `textToSpeech`: voiceover + downstream
- `textToImage`: keyframes + downstream
- `imageTextToVideo`: segments + compose

When `finalDurationMode` changes, only final composition is regenerated on the next run.

## Project config reference

All supported `config.json` fields:

- `aspectRatio` (required after normalization)
  - Type: string
  - Allowed: `1:1`, `16:9`, `9:16`
  - Effect: controls keyframe generation size preset + video resolution preset.

- `targetDurationSec`
  - Type: integer
  - Allowed: `5` to `600`
  - Effect: guides script length budget and TTS speed planning target.

- `finalDurationMode`
  - Type: string
  - Allowed: `match_audio`, `match_visual`
  - Effect: controls whether final output follows audio duration or full visual duration.

- `keyframeWidth` + `keyframeHeight` (optional pair)
  - Type: integer pair
  - Allowed each: `64` to `2048`
  - Rule: must be set together.
  - Effect: overrides keyframe size preset directly.

- `models` (optional object)
  - Type: object
  - Keys: `textToText`, `textToSpeech`, `textToImage`, `imageTextToVideo`
  - Current allowed values:
    - `textToText`: `deepseek-ai/deepseek-v3`
    - `textToSpeech`: `minimax/speech-02-turbo`
    - `textToImage`: `prunaai/z-image-turbo`
    - `imageTextToVideo`: `wan-video/wan-2.2-i2v-fast`
  - Effect: controls which model implementation each generation stage uses.

- `modelOptions` (optional object)
  - Type: object keyed by category: `textToText`, `textToSpeech`, `textToImage`, `imageTextToVideo`
  - Effect: passes validated model-specific input options to each stage.
  - Validation: strict allowlist per selected model id, including type/range/enum checks.
  - Runtime precedence: pipeline-managed fields (for example prompt, text, image, width/height, frames/resolution) override conflicting user values.

Default normalized config:

```json
{
  "aspectRatio": "9:16",
  "targetDurationSec": 60,
  "finalDurationMode": "match_audio",
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "prunaai/z-image-turbo",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  },
  "modelOptions": {
    "textToText": {
      "max_tokens": 2048,
      "temperature": 0.1,
      "presence_penalty": 0,
      "frequency_penalty": 0,
      "top_p": 1
    },
    "textToSpeech": {
      "emotion": "auto",
      "pitch": 0,
      "speed": 1,
      "volume": 1,
      "voice_id": "Wise_Woman",
      "audio_format": "mp3",
      "sample_rate": 32000,
      "bitrate": 128000,
      "channel": "mono",
      "language_boost": "None",
      "subtitle_enable": false,
      "english_normalization": false
    },
    "textToImage": {
      "num_inference_steps": 8,
      "guidance_scale": 0,
      "go_fast": false,
      "output_format": "jpg",
      "output_quality": 80
    },
    "imageTextToVideo": {
      "interpolate_output": false,
      "go_fast": true,
      "sample_shift": 12,
      "disable_safety_checker": false,
      "lora_scale_transformer": 1,
      "lora_scale_transformer_2": 1
    }
  }
}
```

## How it works

- Planning: script generation uses `targetDurationSec` to target narration word count.
- Voice: TTS speed is tuned against target duration; then real audio duration is measured via `ffprobe`.
- Visual planning: required segment/keyframe count is recalculated from measured audio as `ceil(audioDurationSec / 5)`, then shot prompts are generated for that exact count.
- Media generation: one keyframe and one segment are generated per planned shot.
- Compose: segments are concatenated, then narration is muxed according to `finalDurationMode`.
- Resume/cache: reruns reuse valid artifacts; only affected downstream stages regenerate after changes.

Whenever regeneration is required, current project assets are moved to `snapshots/<timestamp>-<id>/` before new assets are written. This preserves full asset history without overlap.

Every Replicate invocation is logged to `assets/debug/api-requests.jsonl` with request payloads, prediction IDs, status, and outputs for debugging.

Re-run and resume from last successful step:

```bash
node src/cli/index.js --project housing-case
```

By default, reruns reuse saved generated assets (script/shots, voiceover, keyframes, segments) from the project directory.

The pipeline is change-aware and cascades updates automatically:
- If `story.md` changes, script + all downstream assets are regenerated.
- If `assets/text/script.json` `script` changes, voiceover/timeline + downstream video assembly are regenerated.
- If `assets/text/script.json` `shots` entries change, only changed keyframes regenerate, then only affected adjacent segments regenerate, then final assembly reruns.
- If measured voiceover duration changes required shot count, shot prompts are regenerated and keyframes/segments are invalidated before rerender.

Force a full restart from step 1:

```bash
node src/cli/index.js --project housing-case --force
```

## API usage

Start API:

```bash
npm run api
```

## Frontend (React MVP)

A React app is available in `frontend/` for project creation, content editing, media preview, status polling, and on-demand regeneration.

Install frontend dependencies:

```bash
npm run frontend:install
```

Create frontend env:

```bash
cp frontend/.env.example frontend/.env
```

Set in `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:5173
VITE_API_BEARER_TOKEN=<your-api-bearer-token>
VITE_POLL_INTERVAL_MS=3000
```

Run frontend dev server:

```bash
npm run frontend:dev
```

Run API + worker + frontend together:

```bash
npm run dev:all
```

Build frontend:

```bash
npm run frontend:build
```

Dev note: `frontend/vite.config.js` proxies `/jobs`, `/projects`, `/health`, `/openapi.json`, and `/docs` to `http://localhost:3000` by default (`VITE_API_PROXY_TARGET` can override this).

For local backend media preview, API now exposes a protected file route:

```bash
GET /projects/:project/assets/:assetPath
```

This endpoint supports either header auth (`Authorization: Bearer <token>`) or `?access_token=<token>` for browser media tags.

Run API on Firebase Functions (serverless):

```bash
npm run api:firebase:deploy
```

Generate OpenAPI document file:

```bash
npm run openapi:generate
```

This writes `openapi/openapi.json`.

Docs endpoints:
- `GET /openapi.json` (raw OpenAPI 3.1 spec)
- `GET /docs` (Swagger UI)

## Firebase Functions API setup (production)

This repo now includes Firebase Functions scaffolding for the API entrypoint:
- function export: `index.js` → `src/api/firebaseFunction.js`
- firebase config: `firebase.json`

1) Install/auth Firebase CLI:

```bash
npm i -g firebase-tools
firebase login
firebase use --add
```

2) Set required function secrets (for auth + model calls + firebase backend mode):

```bash
firebase functions:secrets:set SECRET_API_BEARER_TOKEN
firebase functions:secrets:set SECRET_REPLICATE_API_TOKEN
firebase functions:secrets:set SECRET_OUTPUT_BACKEND
firebase functions:secrets:set SECRET_FIREBASE_PROJECT_ID
firebase functions:secrets:set SECRET_FIREBASE_STORAGE_BUCKET
```

Use these values for backend integration:
- `VIDEOGEN_OUTPUT_BACKEND=firebase`
- `VIDEOGEN_API_BEARER_TOKEN=<your-api-bearer-token>`
- `VIDEOGEN_REPLICATE_API_TOKEN=<your-replicate-token>`
- `VIDEOGEN_FIREBASE_PROJECT_ID=<your-project-id>`
- `VIDEOGEN_FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com` (or your configured bucket)

Secret naming note:
- local/dev `.env` should use `VIDEOGEN_*` keys.
- Firebase Secret Manager should use `SECRET_*` keys.
- This prevents secret/env collisions during deploy while runtime still supports legacy non-prefixed keys as fallback.

3) Deploy API function:

```bash
npm run api:firebase:deploy
```

4) (Optional) Run emulator locally:

```bash
npm run api:firebase:serve
```

Notes for current architecture:
- `GET /openapi.json` now resolves `servers[0].url` from request headers, so hosted docs show the deployed API base URL automatically.
- API still follows existing in-process job kickoff behavior (`POST /jobs` / project regenerate routes trigger pipeline work inside the running API instance).
- For higher reliability at scale, run heavy generation in a separate worker runtime and keep Functions as the control-plane HTTP API.

Protected API routes (`/jobs` and `/projects`) require:

```bash
Authorization: Bearer <API_BEARER_TOKEN>
```

Unauthenticated routes:
- `GET /health`
- `POST /webhooks/replicate`

Create job:

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"story":"Long-form anonymized court case narrative..."}'
```

If a project already has an active job (`pending` or `running`), `POST /jobs` returns `409` with the active `jobId`.

Check job:

```bash
curl http://localhost:3000/jobs/<jobId> \
  -H "Authorization: Bearer $API_BEARER_TOKEN"
```

Projects metadata API:

```bash
# list projects
curl http://localhost:3000/projects \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# create project
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project":"example-case","story":"...","metadata":{"title":"Case A"}}'

# project names must be 1-64 chars: lowercase letters, numbers, '-' or '_', and must start/end with letter or number
# story (if provided) must be a string; config/metadata (if provided) must be objects
# config merges are normalized + validated using the same rules as project config loading

# get project metadata
curl http://localhost:3000/projects/example-case \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# get API request logs reference only (default)
curl http://localhost:3000/projects/example-case/logs \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# include entries (bounded by API_DEFAULT_LOGS_LIMIT / API_MAX_LOGS_LIMIT)
curl 'http://localhost:3000/projects/example-case/logs?includeEntries=true&limit=100' \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# get script + shot prompts + extracted model prompts
curl http://localhost:3000/projects/example-case/prompts \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# get artifact manifest
curl http://localhost:3000/projects/example-case/artifacts \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# get backend sync status
curl http://localhost:3000/projects/example-case/sync \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# get regeneration snapshots
curl http://localhost:3000/projects/example-case/snapshots \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# analytics summary for project history
curl http://localhost:3000/projects/example-case/analytics \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# analytics run list (optionally ?limit=10)
curl http://localhost:3000/projects/example-case/analytics/runs \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# analytics run drilldown
curl http://localhost:3000/projects/example-case/analytics/runs/<runId> \
  -H "Authorization: Bearer $API_BEARER_TOKEN"

# update project metadata
curl -X PATCH http://localhost:3000/projects/example-case/metadata \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metadata":{"title":"Updated title"}}'

# update story/script/shots/tone content (persists immediately and syncs backend)
curl -X PATCH http://localhost:3000/projects/example-case/content \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"story":"Updated story...","script":"Updated script...","shots":["Prompt A","Prompt B"],"tone":"cinematic"}'

# regenerate script immediately (invalidates voiceover + all downstream visual stages)
curl -X POST http://localhost:3000/projects/example-case/regenerate \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetType":"script"}'

# regenerate one keyframe immediately (marks affected downstream segments + final compose dirty)
curl -X POST http://localhost:3000/projects/example-case/regenerate \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetType":"keyframe","index":2}'

# regenerate one segment immediately (marks final compose dirty)
curl -X POST http://localhost:3000/projects/example-case/regenerate \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetType":"segment","index":1}'

# trigger normal project regeneration later (resume/invalidation-aware)
curl -X POST http://localhost:3000/projects/example-case/regenerate \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"forceRestart":false}'
```

Asset references in `/projects/:project` response:
- local backend: `assets[].value` is a local project-relative path
- firebase backend: `assets[].value` is a Cloud Storage HTTP URL

Additional metadata endpoints:
- `/projects/:project/artifacts` returns `artifacts.json` (or firebase document equivalent)
- `/projects/:project/sync` returns backend sync state and timestamps
- `/projects/:project/snapshots` lists snapshot folders created before regeneration (includes legacy `stale/` if present)
- `/projects/:project/content` updates project story/script/shots/tone and syncs immediately to selected backend
- `/projects/:project/regenerate` supports:
  - targeted immediate regeneration:
    - `{ "targetType": "script" }` (regenerates script from story and invalidates downstream stages)
    - `{ "targetType": "voiceover" }`
    - `{ "targetType": "keyframe"|"segment", "index": <0-based index> }`
  - normal pipeline regeneration job: `{ "forceRestart": false }` (or `true`)
  - returns `409` when a project already has an active job

Analytics endpoints:
- `/projects/:project/analytics` returns project-level totals across all recorded runs
- `/projects/:project/analytics/runs` returns per-run summaries
- `/projects/:project/analytics/runs/:runId` returns full run detail with per-stage and per-prediction breakdowns

Analytics notes:
- Every pipeline invocation creates a run record, including cache-hit/resume invocations.
- Tokens are best-effort and are `null` when a model does not expose token metrics.
- Cost is estimated from per-model metadata files in `models/*.json`; if pricing is not configured, cost fields are `null`.
- If `pricingRules` exists for a model, rules-based estimation is used first (for example, Wan resolution tiers or image megapixel tiers).
- Otherwise runtime pricing (`usdPerSecond`) is used when available, then token pricing (`usdPer1kInputTokens`/`usdPer1kOutputTokens`) as fallback.

## Pricing estimation

Pricing estimation is analytics-oriented (best effort), not billing-grade accounting.

Source of truth:
- Model metadata files under `models/*.json`.
- Each model can provide either simple `pricing` values and/or structured `pricingRules`.

Cost precedence per prediction:
1. `pricingRules` (preferred when available)
2. `pricing.usdPerSecond`
3. `pricing.usdPer1kInputTokens` / `pricing.usdPer1kOutputTokens`
4. `null` (when none of the above can be applied)

Current rule-based behavior:
- `wan-video/wan-2.2-i2v-fast`:
  - Uses `pricingRules.basis = output_video`.
  - Selects tier by `resolution` and `interpolate_output` (`base` vs `interpolate`).
  - Applies `usdPerVideo` directly per prediction.
- `prunaai/z-image-turbo`:
  - Uses `pricingRules.basis = output_image_megapixels`.
  - Computes megapixels from input `width * height`.
  - Selects tier by `maxMegapixels`, applies `usdPerImage` (multiplied by output image count).

Token/runtime fallback behavior:
- If rules do not apply, analytics uses runtime and token fields from prediction metrics/logs.
- Missing metrics (or unsupported model outputs) result in partial or null estimates.

What to expect in analytics output:
- `prediction.costUsd` and stage/run `costUsd` are sums of available estimates.
- `prediction.costSource` is one of:
  - `pricing_rules`
  - `model_pricing_table`
  - `unavailable`
- Fully reused runs (no model executions) naturally have `predictionCount = 0` and `costUsd = null`.

Caveats:
- Replicate pricing can change; update `models/*.json` when rates change.
- Estimates are based on captured request/response metadata and configured rules.
- Historical runs keep the values computed at run time; rerun to recalculate with updated pricing metadata.

## Model metadata

Model metadata is stored in the top-level `models/` directory, with one JSON file per model using an id-based filename:

- `models/deepseek-ai__deepseek-v3.json`
- `models/prunaai__z-image-turbo.json`
- `models/wan-video__wan-2.2-i2v-fast.json`
- `models/minimax__speech-02-turbo.json`

Each file currently includes:
- `modelId`
- `provider`
- `displayName`
- `category`
- `pricing` (`usdPerSecond`, `usdPer1kInputTokens`, `usdPer1kOutputTokens`)

This metadata is designed for future extension (capabilities, quality tiers, limits, etc.).

## Notes

- This MVP enforces strict anonymization preprocessing before generation.
- Replicate output links can expire, so artifacts are downloaded locally during compose.
- Webhook mode is intentionally disabled until full signature verification + durable queue reconciliation are implemented.
- Polling is used for prediction completion, with bounded max wait controlled by `PREDICTION_MAX_WAIT_MS`.
- On failed/incomplete runs, the next run resumes from the last completed step unless `--force` is used.

## Current gaps noticed during test hardening

These are not feature requests; they are quality/safety guardrails that are still worth adding:

- CI coverage gate is not enforced yet (for example, fail CI if line coverage drops below a defined threshold).
- Test runs still emit application logs from logger paths; adding a `LOG_LEVEL=silent`/test-mode logger policy would reduce noise.
- Firebase integration is covered with fakes/mocks; there is no dedicated integration test against emulator or staging infra.
- Some branch coverage remains lower in complex orchestration/step branching despite high line coverage.
- There is no explicit pre-commit or CI quality pipeline documented in this repo yet (`lint` + `test` + `coverage` as a required check).
