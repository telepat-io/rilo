# Rilo

Story-first vertical video generation platform.

- Repository: https://github.com/telepat-io/rilo
- Homepage: https://docs.telepat.io/rilo/

JavaScript system to generate short vertical videos from a story using Replicate models:
- Script + dynamic shot count (computed from target duration): `deepseek-ai/deepseek-v3`
- Keyframes: `prunaai/z-image-turbo` (default), optional `black-forest-labs/flux-2-pro`, `black-forest-labs/flux-schnell`, `google/nano-banana-pro`, or `bytedance/seedream-4`
- Video segments: `wan-video/wan-2.2-i2v-fast` (default), optional `kwaivgi/kling-v3-video`, `pixverse/pixverse-v5.6`, `google/veo-3.1`, or `google/veo-3.1-fast`
- Narration: `minimax/speech-02-turbo` (default), optional `resemble-ai/chatterbox-turbo` or `jaaari/kokoro-82m`
- Final composition: `ffmpeg`

Project config supports selecting the model per generation category, defaulting to the model IDs above.
Project config also supports per-category model input overrides via `modelOptions`.

## Requirements

- Node.js 22+
- `ffmpeg` available in PATH
- Replicate API token

## Setup

```bash
cp .env.example .env
npm install
```

Set `RILO_REPLICATE_API_TOKEN` in `.env`.

Set `RILO_API_BEARER_TOKEN` in `.env` to protect API routes.

When `OUTPUT_DIR` and `PROJECTS_DIR` are not set, Rilo defaults to:
- `~/.rilo/output`
- `~/.rilo/projects`

## Documentation site

Rilo docs are powered by Docusaurus in `docs-site/`.

Local docs commands:

```bash
npm run docs:start
npm run docs:build
npm run docs:serve
```

GitHub Pages deployment uses `.github/workflows/docs-pages.yml` and publishes `docs-site/build`.

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

Frontend React lint (separate ruleset):

```bash
npm run frontend:lint
```

## Releases

Versioning and changelogs are managed automatically by [release-please](https://github.com/googleapis/release-please).

How it works:
1. Merge commits to `main` following [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `feat!:`, etc.).
2. release-please maintains an open "Release PR" that accumulates version bumps and CHANGELOG entries.
3. Merge the Release PR to cut a release: `package.json` version is bumped, changelog entries are updated, a git tag is created, and the package publish workflow can run with matching tag/version checks.

Commit types and semver mapping (while version < 1.0.0):
- `fix:` -> patch bump
- `feat:` -> patch bump (minor bump is suppressed pre-1.0)
- `feat!:` or `fix!:` (breaking change) -> minor bump (major bump is suppressed pre-1.0)

Additional runtime hardening env knobs:

```bash
PREDICTION_POLL_INTERVAL_MS=1500
PREDICTION_MAX_WAIT_MS=600000
DOWNLOAD_TIMEOUT_MS=20000
DOWNLOAD_MAX_BYTES=104857600
DOWNLOAD_ALLOWED_HOSTS=replicate.delivery,replicate.com
API_DEFAULT_LOGS_LIMIT=100
API_MAX_LOGS_LIMIT=1000
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
FFSUBSYNC_BIN=ffsubsync
```

## Output backends

The project supports multiple backends for data + asset output:

- `local` (default): stores everything under `./projects/<project>/`
- `firebase`: mirrors project documents to Firestore and files to Cloud Storage

Set in `.env`:

```bash
RILO_OUTPUT_BACKEND=local
```

For Firebase backend:

```bash
RILO_OUTPUT_BACKEND=firebase
OUTPUT_BACKEND=firebase
RILO_FIREBASE_PROJECT_ID=your-project-id
RILO_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
RILO_FIREBASE_CLIENT_EMAIL=service-account@your-project-id.iam.gserviceaccount.com
RILO_FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

When `RILO_OUTPUT_BACKEND=firebase`, every checkpoint sync uploads project files to Cloud Storage at `projects/<project>/...` and writes project data docs in Firestore under `projects/<project>/documents/*`.

## CLI usage

From npm (global):

```bash
npm install -g @telepat/rilo
rilo --help
```

From npm (without global install):

```bash
npx @telepat/rilo --help
```

```bash
rilo --project housing-case --story-file ./examples/story.txt
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

For `models.textToSpeech = "resemble-ai/chatterbox-turbo"`, supported `modelOptions.textToSpeech` keys are:
- `voice` (`Aaron`, `Abigail`, `Anaya`, `Andy`, `Archer`, `Brian`, `Chloe`, `Dylan`, `Emmanuel`, `Ethan`, `Evelyn`, `Gavin`, `Gordon`, `Ivan`, `Laura`, `Lucy`, `Madison`, `Marisol`, `Meera`, `Walter`)
- `temperature` (number `0.05` to `2`)
- `top_p` (number `0.5` to `1`)
- `top_k` (integer `1` to `2000`)
- `repetition_penalty` (number `1` to `2`)
- `seed` (nullable integer)

Chatterbox voice cloning is documented in model metadata (`reference_audio`) but intentionally disabled in this app for now.

For `models.textToSpeech = "jaaari/kokoro-82m"`, supported `modelOptions.textToSpeech` keys are:
- `voice` (`af_alloy`, `af_aoede`, `af_bella`, `af_jessica`, `af_kore`, `af_nicole`, `af_nova`, `af_river`, `af_sarah`, `af_sky`, `am_adam`, `am_echo`, `am_eric`, `am_fenrir`, `am_liam`, `am_michael`, `am_onyx`, `am_puck`, `bf_alice`, `bf_emma`, `bf_isabella`, `bf_lily`, `bm_daniel`, `bm_fable`, `bm_george`, `bm_lewis`, `ff_siwis`, `hf_alpha`, `hf_beta`, `hm_omega`, `hm_psi`, `if_sara`, `im_nicola`, `jf_alpha`, `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo`, `zf_xiaobei`, `zf_xiaoni`, `zf_xiaoxiao`, `zf_xiaoyi`, `zm_yunjian`, `zm_yunxi`, `zm_yunxia`, `zm_yunyang`)
- `speed` (number `0.1` to `5`)

For `models.textToImage = "black-forest-labs/flux-2-pro"`, supported `modelOptions.textToImage` keys are:
- `safety_tolerance` (integer `1` to `5`)
- `seed` (nullable integer)
- `output_format` (`webp`, `png`, `jpg`, `jpeg`)
- `output_quality` (integer `0` to `100`)

For `models.textToImage = "black-forest-labs/flux-schnell"`, supported `modelOptions.textToImage` keys are:
- `num_outputs` (integer `1` to `4`)
- `num_inference_steps` (integer `1` to `4`)
- `seed` (nullable integer)
- `output_format` (`webp`, `jpg`, `png`)
- `output_quality` (integer `0` to `100`)
- `disable_safety_checker` (boolean)
- `go_fast` (boolean)
- `megapixels` (string)

For `models.textToImage = "google/nano-banana-pro"`, supported `modelOptions.textToImage` keys are:
- `resolution` (`1K`, `2K`, `4K`)
- `output_format` (`jpg`, `png`, `webp`)
- `safety_filter_level` (`block_low_and_above`, `block_medium_and_above`, `block_only_high`)
- `allow_fallback_model` (boolean)

For `models.textToImage = "bytedance/seedream-4"`, supported `modelOptions.textToImage` keys are:
- `size` (`1K`, `2K`, `4K`)
- `sequential_image_generation` (`disabled`, `auto`)
- `max_images` (integer `1` to `15`)
- `enhance_prompt` (boolean)

For `models.imageTextToVideo = "kwaivgi/kling-v3-video"`, supported `modelOptions.imageTextToVideo` keys are:
- `negative_prompt` (string)
- `mode` (`standard`, `pro`)
- `generate_audio` (boolean, currently forced to `false` by the pipeline)

Kling v3 keeps segment duration fixed at `5` seconds in the current pipeline and maps keyframes as `start_image`/`end_image`.
Native audio generation remains disabled in the current pipeline.

For `models.imageTextToVideo = "pixverse/pixverse-v5.6"`, supported `modelOptions.imageTextToVideo` keys are:
- `quality` (`360p`, `540p`, `720p`, `1080p`)
- `negative_prompt` (nullable string)
- `seed` (nullable integer)
- `generate_audio_switch` (boolean, currently forced to `false` by the pipeline)
- `thinking_type` (string)

PixVerse v5.6 keeps segment duration fixed at `5` seconds in the current pipeline and maps keyframes as `image`/`last_frame_image`.
Native audio generation remains disabled in the current pipeline.

For `models.imageTextToVideo = "google/veo-3.1-fast"`, supported `modelOptions.imageTextToVideo` keys are:
- `resolution` (`720p`, `1080p`)
- `negative_prompt` (nullable string)
- `seed` (nullable integer)

Veo 3.1 Fast keeps segment duration fixed at `5` seconds in the current pipeline and maps keyframes as `image`/`last_frame`.
Native audio generation remains disabled in the current pipeline.

For `models.imageTextToVideo = "google/veo-3.1"`, supported `modelOptions.imageTextToVideo` keys are:
- `resolution` (`720p`, `1080p`)
- `negative_prompt` (nullable string)
- `seed` (nullable integer)

Veo 3.1 keeps segment duration fixed at `5` seconds in the current pipeline and maps keyframes as `image`/`last_frame`.
Native audio generation remains disabled in the current pipeline.

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
    - `textToSpeech`: `minimax/speech-02-turbo`, `resemble-ai/chatterbox-turbo`, `jaaari/kokoro-82m`
    - `textToImage`: `prunaai/z-image-turbo`, `black-forest-labs/flux-2-pro`, `black-forest-labs/flux-schnell`, `google/nano-banana-pro`, `bytedance/seedream-4`
    - `imageTextToVideo`: `wan-video/wan-2.2-i2v-fast`, `kwaivgi/kling-v3-video`, `pixverse/pixverse-v5.6`, `google/veo-3.1`, `google/veo-3.1-fast`
  - Effect: controls which model implementation each generation stage uses.

- `modelOptions` (optional object)
  - Type: object keyed by category: `textToText`, `textToSpeech`, `textToImage`, `imageTextToVideo`
  - Effect: passes validated model-specific input options to each stage.
  - Validation: strict allowlist per selected model id, including type/range/enum checks.
  - Runtime precedence: pipeline-managed fields (for example prompt, text, image, width/height, frames/resolution) override conflicting user values.

- `subtitleOptions` (optional object)
  - Type: object
  - Fields:
    - `enabled` (boolean)
    - `templateId` (`custom`, `social_center_punch`, `social_center_clean`, `social_center_story`)
    - `position` (`top`, `center`, `bottom`)
    - `fontName` (string)
    - `fontSize` (16-120)
    - `bold` (boolean), `italic` (boolean), `makeUppercase` (boolean)
    - `primaryColor`, `activeColor`, `outlineColor` (hex `#RRGGBB`), where `outlineColor` is the caption border color
    - `backgroundEnabled` (boolean), `backgroundColor` (hex `#RRGGBB`), `backgroundOpacity` (0-0.85)
    - `outline` (0-12), `shadow` (0-12), `marginV` (0-400)
    - `maxWordsPerLine` (1-20)
    - `maxLines` (1-3)
    - `highlightMode` (`spoken_upcoming`, `current_only`)
  - Effect: enables post-compose subtitle alignment using ffsubsync, ASS karaoke generation, and optional burn-in output (`final_captioned.mp4`).

Default normalized config:

```json
{
  "aspectRatio": "9:16",
  "targetDurationSec": 60,
  "finalDurationMode": "match_audio",
  "subtitleOptions": {
    "enabled": false,
    "templateId": "custom",
    "position": "center",
    "fontName": "Poppins",
    "fontSize": 100,
    "bold": true,
    "italic": false,
    "primaryColor": "#ffffff",
    "activeColor": "#ffe066",
    "outlineColor": "#111111",
    "backgroundEnabled": false,
    "backgroundColor": "#000000",
    "backgroundOpacity": 0.45,
    "outline": 3,
    "shadow": 0,
    "marginV": 70,
    "maxWordsPerLine": 7,
    "maxLines": 2,
    "highlightMode": "spoken_upcoming"
  },
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
- Captions (optional): when `subtitleOptions.enabled=true`, the composed video is aligned with ffsubsync, converted to ASS karaoke word highlights, and burned into `final_captioned.mp4`.
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
- `RILO_OUTPUT_BACKEND=firebase`
- `RILO_API_BEARER_TOKEN=<your-api-bearer-token>`
- `RILO_REPLICATE_API_TOKEN=<your-replicate-token>`
- `RILO_FIREBASE_PROJECT_ID=<your-project-id>`
- `RILO_FIREBASE_STORAGE_BUCKET=<your-project-id>.appspot.com` (or your configured bucket)

Secret naming note:
- local/dev `.env` should use `RILO_*` keys.
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
- `kwaivgi/kling-v3-video`:
  - Uses `pricingRules.basis = output_video`.
  - Selects tier by `mode` and `generate_audio`.
  - Applies `usdPerSecond * duration` (current pipeline duration is fixed at 5 seconds).
- `pixverse/pixverse-v5.6`:
  - Uses `pricingRules.basis = output_video`.
  - Selects tier by `quality`.
  - Applies `usdPerSecond * duration` (current pipeline duration is fixed at 5 seconds).
- `google/veo-3.1-fast`:
  - Uses `pricingRules.basis = output_video`.
  - Selects tier by `generate_audio`.
  - Applies `usdPerSecond * duration` (current pipeline duration is fixed at 5 seconds, audio disabled).
- `google/veo-3.1`:
  - Uses `pricingRules.basis = output_video`.
  - Selects tier by `generate_audio`.
  - Applies `usdPerSecond * duration` (current pipeline duration is fixed at 5 seconds, audio disabled).
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
- `models/black-forest-labs__flux-2-pro.json`
- `models/black-forest-labs__flux-schnell.json`
- `models/google__nano-banana-pro.json`
- `models/bytedance__seedream-4.json`
- `models/wan-video__wan-2.2-i2v-fast.json`
- `models/kwaivgi__kling-v3-video.json`
- `models/pixverse__pixverse-v5.6.json`
- `models/google__veo-3.1.json`
- `models/google__veo-3.1-fast.json`
- `models/minimax__speech-02-turbo.json`
- `models/resemble-ai__chatterbox-turbo.json`
- `models/jaaari__kokoro-82m.json`

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
