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
});

test('writeProjectConfig and readProjectConfig enforce canonical validated config', async () => {
  const project = uniqueProject('ut-project-config');
  await ensureProject(project);

  const written = await writeProjectConfig(project, {
    aspectRatio: '1:1',
    targetDurationSec: 45,
    finalDurationMode: 'match_visual',
    keyframeWidth: 512,
    keyframeHeight: 512
  });

  assert.equal(written.aspectRatio, '1:1');
  assert.equal(written.targetDurationSec, 45);
  assert.equal(written.finalDurationMode, 'match_visual');

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

  const persistedRaw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(persistedRaw.aspectRatio, '9:16');

  await cleanupProject(project);
});
