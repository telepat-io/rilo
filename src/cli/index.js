#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJob } from '../store/jobStore.js';
import { runPipeline } from '../pipeline/orchestrator.js';
import {
  ensureProject,
  ensureProjectConfig,
  projectStoryExists,
  readProjectStory,
  resolveProjectName,
  writeProjectStory
} from '../store/projectStore.js';
import { openSettings } from './commands/settingsFlow.js';
import { openHome } from './commands/openHome.js';
import { applyStoredSettings } from '../config/env.js';

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function readCliVersion() {
  try {
    const cliDir = path.dirname(fileURLToPath(import.meta.url));
    const packagePath = path.resolve(cliDir, '../../package.json');
    const raw = await fs.readFile(packagePath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed.version === 'string' ? parsed.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  if (process.argv.includes('--version')) {
    console.log(await readCliVersion());
    return;
  }

  if (process.argv.includes('--help')) {
    const helpText = `
Rilo — Story-first vertical video generation

USAGE
  rilo --project <name> [--story-file <path>] [--force]
  rilo settings
  rilo home
  rilo --help
  rilo --version

COMMANDS
  rilo --project <name> [--story-file <path>] [--force]
    Generate a complete video from a story
    
    --project <name>         Project identifier (required); creates projects/<name>/
    --story-file <path>      Path to story text file (required on first run)
    --force                  Force restart from earlier stages (use after config changes)

  rilo settings
    Configure API tokens, timeouts, and binary paths interactively

  rilo home
    Open ~/.rilo, the default home for projects and output files

FLAGS
  --help                     Show this help message
  --version                  Show version information

EXAMPLES
  # First run: create project and generate
  rilo --project wedding-case --story-file ./story.txt

  # Subsequent runs: reuse saved story
  rilo --project wedding-case

  # Update config and regenerate
  rilo --project wedding-case --force

  # Configure settings
  rilo settings

  # Open the default Rilo home folder
  rilo home

  # Using npx (no installation needed)
  npx @telepat/rilo --project wedding-case --story-file ./story.txt
  npx @telepat/rilo home

DOCUMENTATION
  Quick start:          https://docs.telepat.io/rilo/getting-started/quickstart
  CLI reference:        https://docs.telepat.io/rilo/reference/cli-reference
  Configuration:        https://docs.telepat.io/rilo/guides/configuration
  Troubleshooting:      https://docs.telepat.io/rilo/guides/troubleshooting
  All docs:             https://docs.telepat.io/rilo/

PROJECT OUTPUT
  Generated files are stored in:
  projects/<name>/
  ├── config.json          Project settings (models, aspect ratio, duration, etc.)
  ├── story.md             Formatted story
  ├── final.mp4            Final video
  ├── artifacts.json       Generation metadata (paths, durations, etc.)
  ├── run-state.json       Checkpoint for resume/invalidation
  ├── assets/              Keyframes, audio, video segments
  └── logs/                Detailed generation logs

SETTINGS
  Configure via interactive menu:
    rilo settings

  Or with environment variables:
    export RILO_REPLICATE_API_TOKEN=r8_xxxxx
    export RILO_MAX_RETRIES=5
    export PREDICTION_MAX_WAIT_MS=900000
    rilo --project my-project --story-file ./story.txt

  Settings precedence (highest to lowest):
    1. Environment variable
    2. ~/.rilo/config.json (saved via 'rilo settings')
    3. Schema default

INVOCATION METHODS
  Global install:        rilo --project <name> --story-file <path>
  No install (npx):      npx @telepat/rilo --project <name> --story-file <path>
  Local development:     npm run dev -- --project <name> --story-file <path>
`;
    console.log(helpText);
    return;
  }

  // `rilo settings` subcommand
  if (process.argv[2] === 'settings') {
    await openSettings();
    return;
  }

  if (process.argv[2] === 'home') {
    await openHome();
    return;
  }

  // Merge stored settings (config.json + keystore) into env before running
  await applyStoredSettings();

  const projectArg = getArg('--project');
  if (!projectArg) {
    throw new Error('Missing --project argument');
  }

  const project = resolveProjectName(projectArg);
  const forceRestart = hasFlag('--force');
  const storyFile = getArg('--story-file');

  await ensureProject(project);
  await ensureProjectConfig(project);

  let story;
  const storyExists = await projectStoryExists(project);
  if (storyExists) {
    story = await readProjectStory(project);
  } else if (storyFile) {
    story = await fs.readFile(path.resolve(storyFile), 'utf8');
    await writeProjectStory(project, story);
  } else {
    throw new Error('Project story.md not found. Provide --story-file once to initialize the project.');
  }

  const job = createJob({ story, project });
  const result = await runPipeline(job.id, { forceRestart });

  if (result.status !== 'completed') {
    throw new Error(`Generation failed: ${result.error || 'unknown error'}`);
  }

  console.log(JSON.stringify({
    jobId: result.id,
    project,
    finalVideoPath: result.artifacts.finalVideoPath
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
