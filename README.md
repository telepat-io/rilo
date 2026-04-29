<p align="center"><img src="./rilo-logo.webp" width="128" alt="Rilo"></p>
<h1 align="center">Rilo</h1>
<p align="center"><em>From story to screen.</em></p>

<p align="center">
  <a href="https://docs.telepat.io/rilo">📖 Docs</a>
  · <a href="./README.md">🇺🇸 English</a>
  · <a href="./README.zh-CN.md">🇨🇳 简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/telepat-io/rilo/actions/workflows/ci.yml"><img src="https://github.com/telepat-io/rilo/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build"></a>
  <a href="https://codecov.io/gh/telepat-io/rilo"><img src="https://codecov.io/gh/telepat-io/rilo/graph/badge.svg" alt="Codecov"></a>
  <a href="https://www.npmjs.com/package/@telepat/rilo"><img src="https://img.shields.io/npm/v/@telepat/rilo" alt="npm"></a>
  <a href="https://github.com/telepat-io/rilo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License"></a>
</p>

Story-first vertical video generation.

Rilo turns one story into a complete short-form video pipeline: script generation, voiceover generation, keyframe generation, video segment generation, final composition, and optional subtitle alignment and burn-in.

## What It Solves

Rilo is built for creators and teams who need reproducible, high-quality short-form video at scale.

- Turn a plain-text story into a finished vertical video in one command.
- Iterate quickly with checkpointed runs and targeted regeneration.
- Choose your models and override per-model options for full creative control.
- Output to local disk or Firebase for team collaboration.
- Run via CLI, API, or worker for production pipelines.

## Quick Start

Requirements: Node.js 22+, ffmpeg in PATH, and a Replicate API token.

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project demo --story-file ./story.txt
```

Expected outcome:

- A project folder is created under `projects/demo/`.
- The full pipeline runs through script, voiceover, keyframes, segments, and composition.
- Final video is written to `projects/demo/final.mp4`.
- Dashboard preview available via `rilo preview`.

## Requirements

- Node.js 22+
- ffmpeg in PATH
- Replicate API token
- macOS, Linux, or Windows

## How It Works

Rilo runs a staged pipeline: script generation, voiceover synthesis, shot prompt generation, keyframe rendering, segment generation, and final video composition. Each stage writes checkpointed artifacts so you can resume or regenerate selectively.

Configuration merges CLI flags, environment variables, and `~/.rilo/config.json` with schema defaults. The preview dashboard (`rilo preview`) starts a local API, worker, and Vite React frontend for monitoring and editing.

## Using With AI Agents

Rilo provides multiple surfaces for agentic and automated workflows:

- **CLI automation** — All generation is driven by CLI flags and environment variables. No interactive prompts are required after initial setup.
- **HTTP API** — `rilo preview` starts an Express API with full job and project CRUD, asset serving, and webhook endpoints. Bearer-token auth via `Authorization: Bearer <API_BEARER_TOKEN>`.
- **OpenAPI spec** — Auto-generated OpenAPI 3.1 spec for schema-driven agent integration.
- **Webhooks** — Subscribe to job lifecycle events for external orchestration.
- **Firebase Functions** — Deploy `src/api/firebaseFunction.js` for serverless API hosting.
- **Agent docs** — [API Reference](https://docs.telepat.io/rilo/reference/api-reference) covers endpoints, auth, and webhooks.

## Security And Trust

- API tokens and Replicate credentials are stored in the OS keystore (macOS Keychain, Windows Credential Manager, Linux Secret Service) when available.
- Falls back to an AES-256 encrypted file at `~/.rilo/.secrets` if no native keystore is available.
- Environment variables (`RILO_REPLICATE_API_TOKEN`, `RILO_API_BEARER_TOKEN`) take highest precedence and override stored values.
- Preview `--expose` mode should only be used on trusted networks or isolated environments.

## Documentation And Support

- [Documentation site](https://docs.telepat.io/rilo)
- [Quickstart](https://docs.telepat.io/rilo/getting-started/quickstart)
- [CLI Reference](https://docs.telepat.io/rilo/reference/cli-reference)
- [Configuration Guide](https://docs.telepat.io/rilo/guides/configuration)
- [API Reference](https://docs.telepat.io/rilo/reference/api-reference)
- [Troubleshooting](https://docs.telepat.io/rilo/guides/troubleshooting)
- [Repository](https://github.com/telepat-io/rilo)
- [npm package](https://www.npmjs.com/package/@telepat/rilo)

## Contributing

Contributions are welcome. See [Development](https://docs.telepat.io/rilo/contributing/development) for local setup, build commands, and test workflows.

## License

MIT. See [LICENSE](./LICENSE).
