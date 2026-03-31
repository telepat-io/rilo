---
slug: /getting-started/quickstart
sidebar_position: 3
title: Quickstart
---

## Installation and Setup

Recommended workflow:

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project housing-case --story-file ./examples/story.txt
```

Or run via npx without a global install:

```bash
npx @telepat/rilo settings
npx @telepat/rilo --project housing-case --story-file ./examples/story.txt
```

If you're contributing from source in this repository, see [/contributing/development](/contributing/development) for the `npm run dev` workflow.

## Your First Generation

### Step 1: Configure API tokens

Before running your first generation, set up your Replicate API token:

**Option A: Interactive settings menu (recommended)**
```bash
rilo settings
```

This opens a menu where you can securely enter your Replicate API token and configure other settings.

**Option B: Environment variable**
```bash
export RILO_REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

### Step 2: Create a new project with a story

Create a simple story file:

```bash
cat > wedding-story.txt <<'EOF'
A couple's love story begins at a cozy coffee shop where they first locked eyes
over a shared latte. Years later, they return to the same spot and exchange vows
in an intimate ceremony surrounded by friends and family who witnessed the beginning
of their journey. The video celebrates the beauty of finding forever in familiar places.
EOF
```

Initialize your project:

```bash
rilo --project wedding-case --story-file ./wedding-story.txt
```

On first run, rilo:
1. Creates `projects/wedding-case/` directory
2. Stores `config.json` (project generation settings)
3. Saves `story.md` (formatted story)
4. Begins the generation pipeline
5. Outputs `projects/wedding-case/final.mp4` when complete

### Step 3: Monitor progress

Watch generation progress in the terminal output:

```
✓ Script generation completed (2.3s)
✓ Voiceover generation completed (8.1s)
  Generating keyframes... (1/12)
  Generating keyframes... (2/12)
  ...
✓ Composition completed (15.2s)
```

Find outputs here:
```
projects/wedding-case/
├── config.json              # Project settings
├── story.md                 # Your story
├── final.mp4                # Main output video
├── artifacts.json           # Generation metadata
├── run-state.json           # Checkpoint for resume
├── assets/                  # Generated keyframes, audio, etc.
└── logs/                    # Detailed generation logs
```

## Common Workflows

### Re-run from a specific stage (--force)

If generation fails partway through, use `--force` to restart from an earlier stage without re-generating completed work:

```bash
# Restart from keyframe generation (previous stages reused)
rilo --project wedding-case --force

# Re-run entire pipeline (use with caution)
rilo --project wedding-case --force
```

See [Regeneration and Invalidation](/guides/regeneration-and-invalidation) for more details.

### Update project settings mid-project

If you want to change aspect ratio, duration, or model selections after starting a project:

1. Edit `projects/wedding-case/config.json`:
   ```json
   {
     "aspectRatio": "9:16",
     "targetDurationSec": 30,
     "models": {
       "textToImage": "black-forest-labs/flux-2-pro"
     }
   }
   ```

2. Re-run with `--force` to invalidate and regenerate affected stages:
   ```bash
   rilo --project wedding-case --force
   ```

### Configure app-wide settings

Adjust timeouts, retries, or binary paths globally:

```bash
rilo settings
# Navigate to "Max Retries", "Poll Interval", "ffmpeg Binary", etc.
arrow keys to select → Enter to edit → Enter to save → "Done" to exit
```

These settings are stored in `~/.rilo/config.json` and precedence is:
1. Environment variables (highest priority)
2. `~/.rilo/config.json` (settings you configure via `rilo settings`)
3. Schema defaults (lowest priority)

### Use custom story file on subsequent runs

If you want to update the story for an existing project, pass `--story-file` again:

```bash
cat > new-wedding-story.txt <<'EOF'
... updated story text ...
EOF

rilo --project wedding-case --story-file ./new-wedding-story.txt --force
```

This overwrites `projects/wedding-case/story.md` and restarts generation from the beginning.

## Invocation Patterns

Choose the invocation method that fits your workflow:

| Method | Command | Best for |
|--------|---------|----------|
| **Global install** | `rilo --project <name> --story-file <path>` | After `npm install -g @telepat/rilo` |
| **npx** | `npx @telepat/rilo --project <name> --story-file <path>` | No installation required; CI/CD |
| **Contributor dev** | `npm run dev -- --project <name> --story-file <path>` | Working from a checked-out repo |

## Next Steps

- **[CLI Reference](/reference/cli-reference)** — All flags and commands
- **[Configuration](/guides/configuration)** — Project settings, models, and options
- **[Troubleshooting](/guides/troubleshooting)** — Common issues and solutions
- **[Model Catalog](/reference/model-catalog)** — Available models and their capabilities
