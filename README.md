# Rilo

[![CI](https://github.com/telepat-io/rilo/actions/workflows/ci.yml/badge.svg)](https://github.com/telepat-io/rilo/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/telepat-io/rilo/graph/badge.svg)](https://codecov.io/gh/telepat-io/rilo)
[![npm version](https://img.shields.io/npm/v/%40telepat%2Frilo)](https://www.npmjs.com/package/@telepat/rilo)
[![npm downloads](https://img.shields.io/npm/dm/%40telepat%2Frilo)](https://www.npmjs.com/package/@telepat/rilo)
[![Docs](https://img.shields.io/badge/docs-live-22c55e)](https://docs.telepat.io/rilo/)
[![License](https://img.shields.io/github/license/telepat-io/rilo)](./LICENSE)

Story-first vertical video generation.

Rilo turns one story into a complete short-form video pipeline:
- script generation
- voiceover generation
- keyframe generation
- video segment generation
- final composition
- optional subtitle alignment and burn-in

## Why Rilo

- Built for vertical video workflows
- Checkpointed runs with resume support
- Targeted regeneration for faster iteration
- Model selection and per-model option overrides
- Local and Firebase output backends
- API, worker, and frontend flow for production usage

## Quick Start

Requirements:
- Node.js 22+
- ffmpeg in PATH
- Replicate API token

Setup:

```bash
npm install
cp .env.example .env
```

Set required environment variables in .env, **or use the interactive settings command** (see below):

```bash
RILO_REPLICATE_API_TOKEN=your-token
RILO_API_BEARER_TOKEN=your-api-bearer-token
```

Run the full local stack:

```bash
npm run dev:all
```

Run a CLI generation:

```bash
rilo --project demo --story-file ./story.txt
```

## Settings

Configure rilo interactively without editing files:

```bash
rilo settings
```

For local development in this repository:

```bash
npm run dev -- settings
npm run dev -- --project demo --story-file ./story.txt
```

This opens a menu where you can edit all non-sensitive settings and manage API tokens securely. Navigate with arrow keys, select with Enter, and use "Done" or "Cancel" to exit. You can also press Ctrl+C at any time to quit.

**What gets stored where:**

| Setting type | Storage |
|---|---|
| Replicate API Token, API Bearer Token | OS keystore (macOS Keychain, Windows Credential Manager, Linux Secret Service) — or an AES-256 encrypted file at `~/.rilo/.secrets` if no native keystore is available |
| All other settings (timeouts, limits, binary paths, etc.) | `~/.rilo/config.json` |

**Precedence** (highest → lowest): environment variable > `~/.rilo/config.json` > schema default.  
If an env var is set, the settings command shows it as read-only and any stored value is ignored while the env var is present.

**Hidden from settings UI** (env-only): Firebase credentials, webhook settings, output backend, API port, custom output/projects directories.

## Install from npm

```bash
npm install -g @telepat/rilo
rilo --help
```

Or without global install:

```bash
npx @telepat/rilo --help
```

## Full Documentation

Guides, API reference, architecture notes, and advanced configuration:

https://docs.telepat.io/rilo/

## License

MIT
