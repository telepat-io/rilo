import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  ensureProject,
  ensureProjectConfig,
  getProjectConfigPath,
  getProjectDir,
  normalizeAndValidateProjectConfig,
  readProjectConfig,
  resolveProjectName,
  writeProjectConfig
} from '../src/store/projectStore.js';
import { DEFAULT_MODEL_SELECTIONS } from '../src/config/models.js';

function uniqueProject(prefix) {
  const project = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  createdProjects.add(project);
  return project;
}

async function cleanupProject(project) {
  await fs.rm(getProjectDir(project), { recursive: true, force: true });
}

const createdProjects = new Set();

after(async () => {
  await Promise.all([...createdProjects].map((project) => cleanupProject(project)));
  createdProjects.clear();
});

test('resolveProjectName normalizes valid names and rejects invalid names', () => {
  assert.equal(resolveProjectName('  MY_Project-01 '), 'my_project-01');

  assert.throws(() => resolveProjectName(''), /Project name is required/);
  assert.throws(() => resolveProjectName('bad project!'), /Invalid project name/);
  assert.throws(() => resolveProjectName('_badstart'), /Invalid project name/);
});

test('normalizeAndValidateProjectConfig applies defaults and validates fields', () => {
  const normalized = normalizeAndValidateProjectConfig({ targetDurationSec: 30 });
  assert.equal(normalized.aspectRatio, '9:16');
  assert.equal(normalized.targetDurationSec, 30);
  assert.equal(normalized.finalDurationMode, 'match_audio');
  assert.deepEqual(normalized.models, DEFAULT_MODEL_SELECTIONS);

  assert.throws(
    () => normalizeAndValidateProjectConfig({ targetDurationSec: '30' }),
    /targetDurationSec must be an integer/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ finalDurationMode: 'other' }),
    /finalDurationMode must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ keyframeWidth: 512 }),
    /keyframeWidth and keyframeHeight must be set together/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ models: { unknownCategory: 'deepseek-ai/deepseek-v3' } }),
    /not a supported model category/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ models: { textToText: 'unknown/model' } }),
    /must reference a supported model id/
  );
});

test('normalizeAndValidateProjectConfig supports partial model overrides', () => {
  const normalized = normalizeAndValidateProjectConfig({
    models: {
      textToText: 'deepseek-ai/deepseek-v3'
    }
  });

  assert.equal(normalized.models.textToText, 'deepseek-ai/deepseek-v3');
  assert.equal(normalized.models.textToSpeech, DEFAULT_MODEL_SELECTIONS.textToSpeech);
  assert.equal(normalized.models.textToImage, DEFAULT_MODEL_SELECTIONS.textToImage);
  assert.equal(normalized.models.imageTextToVideo, DEFAULT_MODEL_SELECTIONS.imageTextToVideo);
});

test('writeProjectConfig and readProjectConfig enforce canonical validated config', async () => {
  const project = uniqueProject('ut-project-config');
  await ensureProject(project);

  const written = await writeProjectConfig(project, {
    aspectRatio: '1:1',
    targetDurationSec: 45,
    finalDurationMode: 'match_visual',
    keyframeWidth: 512,
    keyframeHeight: 512,
    models: {
      textToText: 'deepseek-ai/deepseek-v3',
      textToSpeech: 'minimax/speech-02-turbo',
      textToImage: 'prunaai/z-image-turbo',
      imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
    }
  });

  assert.equal(written.aspectRatio, '1:1');
  assert.equal(written.targetDurationSec, 45);
  assert.equal(written.finalDurationMode, 'match_visual');
  assert.equal(written.models.textToImage, 'prunaai/z-image-turbo');

  const readBack = await readProjectConfig(project);
  assert.deepEqual(readBack, written);

  await cleanupProject(project);
});

test('ensureProjectConfig writes default config when missing', async () => {
  const project = uniqueProject('ut-project-default');
  await ensureProject(project);
  const configPath = getProjectConfigPath(project);
  await fs.rm(configPath, { force: true });

  const config = await ensureProjectConfig(project);
  assert.equal(config.aspectRatio, '9:16');
  assert.equal(config.finalDurationMode, 'match_audio');
  assert.deepEqual(config.models, DEFAULT_MODEL_SELECTIONS);

  const persistedRaw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(persistedRaw.aspectRatio, '9:16');

  await cleanupProject(project);
});
