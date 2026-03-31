---
slug: /getting-started/installation
sidebar_position: 2
title: Installation
---

Requirements:
- Node.js 22+
- ffmpeg in PATH
- Replicate API token

Setup:

```bash
npm install
cp .env.example .env
```

Set credentials in `.env`:

```bash
RILO_REPLICATE_API_TOKEN=...
RILO_API_BEARER_TOKEN=...
```

Or set them interactively with the local dev CLI entrypoint:

```bash
npm run dev -- settings
```

`rilo settings` stores secure tokens in your OS keystore (or encrypted local fallback), and stores non-sensitive runtime settings in `~/.rilo/config.json`.
