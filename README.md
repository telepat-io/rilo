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

Set required environment variables in .env:

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
