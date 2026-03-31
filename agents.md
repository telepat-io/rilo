# Agent Notes

## Architecture (quick map)
- `src/pipeline/orchestrator.js`: central workflow coordinator (script → voiceover → shot prompts → keyframes → segments → compose), checkpointing, resume logic, and run-state transitions.
- `src/steps/*`: pure-ish stage modules for generation and media assembly.
- `src/steps/textToImageAdapters.js`: model-specific keyframe request adapters (registry + per-model input mapping).
- `src/steps/imageToVideoAdapters.js`: model-specific segment request adapters (registry + per-model input mapping).
- `src/steps/alignSubtitles.js` + `src/steps/burnInSubtitles.js`: optional post-compose subtitle alignment (ffsubsync) and ASS burn-in stages.
- `src/api/routes/*`: HTTP surface for jobs/projects/webhooks.
- `src/api/routes/projectAssets.js`: local-backend asset file serving route for browser previews (`/projects/:project/assets/*`).
- `src/api/middleware/auth.js`: Bearer token auth middleware (`Authorization: Bearer <API_BEARER_TOKEN>`) + optional `access_token` query support for media requests.
- `src/api/openapi/spec.js`: OpenAPI 3.1 spec builder shared by runtime API docs and file generation.
- `src/config/keystore.js`: secure token storage via OS keystore (keytar) with AES-256 encrypted file fallback.
- `src/config/settingsSchema.js`: declarative schema for editable settings (secure tokens, timeouts, binary paths, etc.).
- `src/store/settingsStore.js`: read/write orchestration for `~/.rilo/config.json` (public settings) and keystore (tokens).
- `src/cli/commands/settingsFlow.js`: interactive `@inquirer/prompts` UI for `rilo settings` command.
- `src/config/env.js`: exports both static `env` object and async `applyStoredSettings()` to merge config.json + keystore.
- `docs-site/*`: Docusaurus documentation site (GitHub Pages build target at `docs-site/build`, workflow in `.github/workflows/docs-pages.yml`).
- `frontend/*`: Vite + React app for project CRUD/editing, polling status, targeted regeneration, and media preview.
- `src/api/firebaseFunction.js`: Firebase Functions HTTP adapter for serverless API hosting.
- `src/api/openapi/generateOpenApi.js`: generator script for writing `openapi/openapi.json`.
- `src/store/*`: local persistence (jobs, project config/state, analytics, assets/snapshots).
- `src/backends/*`: output/metadata backends (`local` + `firebase`) and sync behavior.
- `src/providers/*`: Replicate prediction calls and polling/retry behavior.

## Structure rules
- Keep changes minimal and targeted; preserve existing DI/test seams.
- Prefer adding tests near affected modules in `test/*.test.js`.
- Avoid introducing live network/inference in tests; mock/stub dependencies.

## Required checks before finishing
- Run `npm run lint` in both root and `frontend/` to ensure no lint errors.
- Run `npm test` and `npm run test:coverage`.
- Verify frontend builds: `npm run build` in `frontend/`.
- Update the API specs and docs if any API changes were made.
- Keep coverage high; do not regress branch/line coverage for touched core files.
- Update README.md with any relevant changes to architecture, configuration, or usage.
- If it makes sense, also update docs-site with any relevant changes to architecture, configuration, or usage - but keep docs-site focused on user-facing documentation and guides, and avoid deep architectural details.
- If it makes sense, also update agents.md with notes for future agent work - but keep agents.md really concise and high-level.
