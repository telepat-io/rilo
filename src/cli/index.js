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
    console.log('Usage: rilo --project <name> [--story-file <path>] [--force]');
    console.log('Example: npx @telepat/rilo --project housing-case --story-file ./story.txt');
    return;
  }

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
