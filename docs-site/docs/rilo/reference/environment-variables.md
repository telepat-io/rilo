---
slug: /reference/environment-variables
sidebar_position: 3
title: Environment Variables
---

## Configuration

Rilo is configured via environment variables (from `.env` or system env). You can also manage most non-sensitive settings interactively with `rilo settings` (see [CLI Reference](/reference/cli-reference#settings-command)).

## API Credentials

Required:

```bash
RILO_REPLICATE_API_TOKEN=
RILO_API_BEARER_TOKEN=
```

These can also be managed via `rilo settings`, where they are stored securely in your OS keystore (or an encrypted local file if native keystore is unavailable).

Storage and backend selection:

```bash
RILO_OUTPUT_BACKEND=local
OUTPUT_DIR=~/.rilo/output
PROJECTS_DIR=~/.rilo/projects
```

Firebase backend:

```bash
RILO_FIREBASE_PROJECT_ID=
RILO_FIREBASE_STORAGE_BUCKET=
RILO_FIREBASE_CLIENT_EMAIL=
RILO_FIREBASE_PRIVATE_KEY=
```

Runtime tuning:

```bash
PREDICTION_POLL_INTERVAL_MS=1500
PREDICTION_MAX_WAIT_MS=600000
MAX_RETRIES=2
RETRY_DELAY_MS=2500
DOWNLOAD_TIMEOUT_MS=20000
DOWNLOAD_MAX_BYTES=104857600
DOWNLOAD_ALLOWED_HOSTS=replicate.delivery,replicate.com
API_PORT=3000
API_DEFAULT_LOGS_LIMIT=100
API_MAX_LOGS_LIMIT=1000
```

Media tooling:

```bash
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
FFSUBSYNC_BIN=ffsubsync
```

If your deployment uses secret-prefixed env vars, Rilo supports `SECRET_*` equivalents for core credentials and backend config.

## Configuration via CLI

Most of the settings above can be edited interactively (except Firebase, webhooks, and API port, which remain environment-only):

```bash
rilo settings
```

When you save a setting via `rilo settings`, it is stored in `~/.rilo/config.json` for public settings or in your OS keystore for API tokens.

**Precedence:**
1. **Environment variable** (highest priority — always wins)
2. **Stored setting** (`~/.rilo/config.json` or OS keystore)
3. **Schema default** (lowest priority)

This means if you set an environment variable, any value stored by `rilo settings` is ignored for that variable. Environment variables are ideal for deployments and CI/CD, while the settings command is convenient for local development.

## Hidden Settings

The following settings are **environment-only** and do not appear in the `rilo settings` menu:
- Firebase credentials (`RILO_FIREBASE_*`)
- Webhook configuration (`USE_WEBHOOKS`, `WEBHOOK_SECRET`)
- Output backend selection (`RILO_OUTPUT_BACKEND`)
- API port (`API_PORT`)
- Custom data directories (`OUTPUT_DIR`, `PROJECTS_DIR`)
