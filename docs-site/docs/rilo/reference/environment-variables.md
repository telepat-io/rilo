---
slug: /reference/environment-variables
sidebar_position: 3
title: Environment Variables
---

Required:

```bash
RILO_REPLICATE_API_TOKEN=
RILO_API_BEARER_TOKEN=
```

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
