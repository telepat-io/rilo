---
slug: /getting-started/installation
sidebar_position: 2
title: Installation
---

Requirements:
- Node.js 22+
- ffmpeg in PATH
- Replicate API token

Recommended installation:

```bash
npm install -g @telepat/rilo
```

Then configure credentials interactively:

```bash
rilo settings
```

Or set credentials with environment variables:

```bash
RILO_REPLICATE_API_TOKEN=...
RILO_API_BEARER_TOKEN=...
```

If you prefer not to install globally, use `npx`:

```bash
npx @telepat/rilo settings
```

`rilo settings` stores secure tokens in your OS keystore (or encrypted local fallback), and stores non-sensitive runtime settings in `~/.rilo/config.json`.

If you're contributing from a checked-out repository, see [/contributing/development](/contributing/development) for the `npm run dev` workflow.
