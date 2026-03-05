# Agent Notes

## Architecture (quick map)
- `src/pipeline/orchestrator.js`: central workflow coordinator (script → voiceover → shot prompts → keyframes → segments → compose), checkpointing, resume logic, and run-state transitions.
- `src/steps/*`: pure-ish stage modules for generation and media assembly.
- `src/api/routes/*`: HTTP surface for jobs/projects/webhooks.
- `src/api/routes/projectAssets.js`: local-backend asset file serving route for browser previews (`/projects/:project/assets/*`).
- `src/api/middleware/auth.js`: Bearer token auth middleware (`Authorization: Bearer <API_BEARER_TOKEN>`) + optional `access_token` query support for media requests.
- `src/api/openapi/spec.js`: OpenAPI 3.1 spec builder shared by runtime API docs and file generation.
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
- Run `npm run lint`
- Run `npm test`
- Run `npm run test:coverage`
- Verify frontend builds: `npm run build` in `frontend/`.
- Update the API specs and docs if any API changes were made.
- Keep coverage high; do not regress branch/line coverage for touched core files.
- Update README.md with any relevant changes to architecture, configuration, or usage.
- If it makes sense, also update agents.md with notes for future agent work - but keep agents.md really concise and high-level.
