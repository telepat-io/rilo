---
slug: /reference/cli-reference
sidebar_position: 1
title: CLI Reference
---

## Generation command

Core command:

```bash
rilo --project <name> --story-file <path>
```

Common flags:
- `--project`: target project name
- `--story-file`: path to story input file
- `--force`: force restart from earlier stages where applicable
- `--help`: print usage
- `--version`: print package version

## Settings command

Interactively configure rilo without editing files:

```bash
rilo settings
```

This opens an interactive menu where you can:
- Edit performance and runtime settings (timeouts, retries, limits)
- Configure binary paths (ffmpeg, ffprobe, ffsubsync)
- Manage API credentials securely (stored in OS keystore or encrypted file)

**Where settings are stored:**

| Setting | Storage | Editable via CLI |
|---|---|---|
| Replicate API Token, API Bearer Token | OS keystore (or encrypted file) | ✓ |
| Timeouts, retries, limits, binary paths | `~/.rilo/config.json` | ✓ |
| Firebase credentials, webhooks, API port | Environment variables only | ✗ |

**Precedence** (highest to lowest):
1. Environment variable
2. `~/.rilo/config.json` (if set via `rilo settings`)
3. Schema default

If an environment variable is set, the settings command shows it as read-only and any stored value is ignored while the env var is present.

For local development, run CLI commands through the dev entrypoint:

```bash
npm run dev -- settings
npm run dev -- --project demo --story-file ./story.txt
```

Install globally:

```bash
npm install -g @telepat/rilo
```

Run without global install:

```bash
npx @telepat/rilo --help
```

Example:

```bash
rilo --project housing-case --story-file ./examples/story.txt
```
