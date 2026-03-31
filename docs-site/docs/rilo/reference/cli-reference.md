---
slug: /reference/cli-reference
sidebar_position: 1
title: CLI Reference
---

## Generation command

Core command to generate a complete video from a story:

```bash
rilo --project <name> [--story-file <path>] [--force]
```

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--project` | `<name>` | **Required.** Project identifier (alphanumeric, hyphens allowed). Creates `projects/<name>/` directory. |
| `--story-file` | `<path>` | Path to story text file. On first run, initializes the project with this story. On subsequent runs, overwrites the project's story (requires `--force`). Omit if project already has a story. |
| `--force` | flag | Force restart from earlier stages where applicable. Invalidates artifacts that depend on config changes. |
| `--help` | flag | Print usage information. |
| `--version` | flag | Print CLI version. |

### Examples

**First run with a new project:**
```bash
rilo --project housing-case --story-file ./story.txt
```

**Re-run an existing project (reuses story):**
```bash
rilo --project housing-case
```

**Force restart after config change:**
```bash
# Edit projects/housing-case/config.json
# Then restart with --force to regenerate affected stages
rilo --project housing-case --force
```

**Update story and regenerate:**
```bash
rilo --project housing-case --story-file ./new-story.txt --force
```

### Project Output Structure

On execution, rilo creates the directory `projects/<name>/` with:

```
projects/<name>/
├── config.json              # Project generation settings
├── story.md                 # Formatted story
├── artifacts.json           # Generation metadata and paths
├── run-state.json           # Checkpoint for resume/invalidation
├── final.mp4                # Main output video
├── final_captioned.mp4      # Output with subtitles (if enabled)
├── assets/                  # Generated keyframes, audio, segments
├── logs/                    # Detailed generation logs
└── analytics/               # Performance metrics per stage
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — video generation completed. |
| `1` | Error — missing argument, file not found, or generation failure. Check stderr output. |

### Output on Success

On successful completion, rilo prints a JSON object to stdout:

```json
{
  "jobId": "job-abc123xyz789",
  "project": "housing-case",
  "finalVideoPath": "projects/housing-case/final.mp4"
}
```

Parse this output in scripts:
```bash
OUTPUT=$(rilo --project demo --story-file ./story.txt)
VIDEO_PATH=$(echo "$OUTPUT" | jq -r '.finalVideoPath')
echo "Video saved to: $VIDEO_PATH"
```

### Timeout and Retry Behavior

Generation timeouts and retries are controlled by app settings (see [Settings command](#settings-command)):

- **Prediction timeout**: `PREDICTION_MAX_WAIT_MS` (default: 600,000 ms / 10 min)
- **Retry count**: `maxRetries` (default: 2)
- **Retry delay**: `retryDelayMs` (default: 2,500 ms)

Configure these via `rilo settings` or environment variables (see [Environment Variables](/reference/environment-variables)).

## Settings command

Interactively configure rilo without editing files:

```bash
rilo settings
```

This opens an interactive menu where you can:
- Securely enter and update API credentials (Replicate, API Bearer Token)
- Adjust performance settings (timeouts, retries, poll intervals)
- Configure binary paths (ffmpeg, ffprobe, ffsubsync)
- View current settings and their sources (env var, config file, or default)

### Navigation

- **Arrow keys** — Move up/down through settings
- **Enter** — Edit selected setting
- **Esc / Ctrl+C** — Exit without saving
- **Done** — Save and exit
- **Cancel** — Exit without saving

### Where Settings Are Stored

| Setting Type | Storage Location | Notes |
|---|---|---|
| **API Tokens** (Replicate, Bearer) | OS keystore or encrypted file | Stored securely, never in plain-text config.json |
| **Performance** (timeouts, retries, limits) | `~/.rilo/config.json` | Plain-text JSON; non-sensitive settings |
| **Binary paths** (ffmpeg, ffprobe, ffsubsync) | `~/.rilo/config.json` | Plain-text JSON |
| **Firebase credentials, webhooks, API port** | Environment variables only | Not editable via settings command |

### Precedence Rules

When resolving a setting's value, rilo checks in this order (first match wins):

1. **Environment variable** (highest priority)
   - `RILO_<SETTING_NAME>` or `<SETTING_NAME>`
   - Example: `RILO_MAX_RETRIES=5` overrides any saved setting

2. **~/.rilo/config.json** (if present and set via `rilo settings`)
   - Applies only if no env var is set

3. **Schema default** (lowest priority)
   - Built-in fallback value

**Note:** If an environment variable is set, the `rilo settings` menu shows that setting as "read-only (via environment variable)" and ignores any saved config.json value while the env var is present.

## Invocation Methods

Choose the invocation pattern that fits your environment:

### Local Development (in this repository)

Use `npm run dev` as a wrapper:

```bash
npm run dev -- settings
npm run dev -- --project demo --story-file ./story.txt
npm run dev -- --project demo --force
```

This ensures the correct Node.js environment and local code is used.

### Global Installation

Install globally from npm:

```bash
npm install -g @telepat/rilo
rilo --help
rilo settings
rilo --project demo --story-file ./story.txt
```

### npx (No Installation Required)

Run directly without any installation:

```bash
npx @telepat/rilo --help
npx @telepat/rilo settings
npx @telepat/rilo --project demo --story-file ./story.txt
```

This downloads and runs the latest version from npm in one command. Useful for CI/CD and one-off runs.

## Help Text

Display built-in help:

```bash
rilo --help
```

Output:
```
Usage: rilo --project <name> [--story-file <path>] [--force]
       rilo settings
Example: rilo --project housing-case --story-file ./story.txt
```

## Related Documentation

- **[Configuration](/guides/configuration)** — Project settings, models, and options
- **[Environment Variables](/reference/environment-variables)** — All env vars and precedence
- **[Troubleshooting](/guides/troubleshooting)** — Common CLI and generation issues
- **[API Auth and Webhooks](/reference/api-auth-and-webhooks)** — Bearer token setup for API endpoints
