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

Install from npm and configure settings:

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project demo --story-file ./story.txt
```

If you prefer environment variables instead of the interactive settings menu:

```bash
export RILO_REPLICATE_API_TOKEN=your-token
export RILO_API_BEARER_TOKEN=your-api-bearer-token
```

## Contributor Workflow

For development in this repository:

```bash
npm install
cp .env.example .env
npm run dev:all
```

## Settings

Configure rilo interactively without editing files:

```bash
rilo settings
```

If you're working from a checked-out repository instead of an installed package:

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

If you prefer not to install globally:

```bash
npx @telepat/rilo --help
```

## CLI Quick Reference

### Launch dashboard preview

```bash
rilo preview
```

Starts local API + worker + dashboard on `127.0.0.1:3000` and opens the browser.

For container/tunnel scenarios (unsafe unauthenticated access):

```bash
rilo preview --expose --unsafe-no-auth --host 0.0.0.0 --port 3000
```

Use exposed mode only on trusted networks or isolated environments.

### Generate a video from a story

```bash
rilo --project <name> --story-file <path>
```

Examples:
```bash
# First run: create project and start generation
rilo --project wedding-case --story-file ./story.txt

# On subsequent runs: reuse story
rilo --project wedding-case

# Force restart from earlier stages (after config change)
rilo --project wedding-case --force
```

### Configure settings

```bash
rilo settings
```

Opens an interactive menu to set API tokens, timeouts, and binary paths.

### Open the Rilo home folder

```bash
rilo home
```

Opens `~/.rilo`, the default location for saved settings, projects, and generated output.

### Help and version

```bash
rilo --help                    # Show usage
rilo --version                 # Show version
```

### Invocation methods

| Method | Command |
|--------|---------|
| **Global install** | `rilo --project <name> --story-file <path>` |
| **No install (npx)** | `npx @telepat/rilo --project <name> --story-file <path>` |
| **Contributor dev** | `npm run dev -- --project <name> --story-file <path>` |

### Key flags

| Flag | Type | Notes |
|------|------|-------|
| `--project` | `<name>` | **Required.** Project identifier; creates `projects/<name>/` |
| `--story-file` | `<path>` | Path to story text file (required on first run) |
| `--force` | flag | Restart from earlier stages; used after config changes |

### Common tasks

**Update project config and regenerate:**
```bash
# Edit projects/wedding-case/config.json (aspect ratio, models, etc.)
rilo --project wedding-case --force
```

**Change app settings (tokens, timeouts, binary paths):**
```bash
rilo settings
# Arrow keys to navigate, Enter to edit, "Done" to save
```

**Open the default app folder for projects/output:**
```bash
rilo home
# Opens ~/.rilo in your system file manager
```

**Check where generated files are stored:**
```bash
ls projects/wedding-case/
# Outputs: config.json, story.md, final.mp4, artifacts.json, run-state.json, assets/, logs/
```

---

## CLI Documentation

For comprehensive CLI documentation, see:
- **[Quickstart](/docs.telepat.io/rilo/getting-started/quickstart)** — Step-by-step guide to your first generation
- **[CLI Reference](/docs.telepat.io/rilo/reference/cli-reference)** — All commands, flags, and invocation methods
- **[Complete Config Schema](/docs.telepat.io/rilo/reference/config-schema)** — Every config key with types and defaults
- **[Configuration Guide](/docs.telepat.io/rilo/guides/configuration)** — Project and app settings with examples
- **[Troubleshooting](/docs.telepat.io/rilo/guides/troubleshooting)** — Common errors and solutions
- **[Environment Variables](/docs.telepat.io/rilo/reference/environment-variables)** — Setting precedence and env var reference

## Full Documentation

Guides, API reference, architecture notes, and advanced configuration:

https://docs.telepat.io/rilo/

## License

MIT
