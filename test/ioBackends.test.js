import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { appendApiTrace } from '../src/observability/apiTrace.js';
import { syncProjectSnapshot } from '../src/backends/outputBackend.js';
import {
  getProjectDir,
  readProjectSync,
  writeProjectSync
} from '../src/store/projectStore.js';
import { archiveProjectAssets, listProjectSnapshots } from '../src/store/staleAssetStore.js';

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

test('appendApiTrace writes jsonl records when projectDir is provided', async () => {
  const project = uniqueProject('ut-trace');
  const projectDir = getProjectDir(project);
  const record = { type: 'request_start', model: 'm', ts: '2026-01-01T00:00:00.000Z' };

  await appendApiTrace(projectDir, record);
  await appendApiTrace(projectDir, { ...record, type: 'request_succeeded' });

  const tracePath = path.join(projectDir, 'assets', 'debug', 'api-requests.jsonl');
  const raw = await fs.readFile(tracePath, 'utf8');
  const parsed = raw.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].type, 'request_start');
  assert.equal(parsed[1].type, 'request_succeeded');

  await cleanupProject(project);
});

test('archiveProjectAssets moves assets/final and listProjectSnapshots returns entries', async () => {
  const project = uniqueProject('ut-snapshots');
  const projectDir = getProjectDir(project);
  const assetsDir = path.join(projectDir, 'assets', 'text');
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, 'script.json'), JSON.stringify({ script: 'x', shots: ['s'] }), 'utf8');
  await fs.writeFile(path.join(projectDir, 'final.mp4'), 'video', 'utf8');

  const snapshotDir = await archiveProjectAssets(projectDir);
  assert.ok(snapshotDir);

  const snapshots = await listProjectSnapshots(projectDir);
  assert.ok(snapshots.length >= 1);
  assert.equal(snapshots[0].root, 'snapshots');

  const movedAssets = path.join(snapshotDir, 'assets', 'text', 'script.json');
  const movedFinal = path.join(snapshotDir, 'final.mp4');
  await fs.access(movedAssets);
  await fs.access(movedFinal);

  await cleanupProject(project);
});

test('syncProjectSnapshot local backend writes sync metadata', async () => {
  const project = uniqueProject('ut-sync-local');
  const projectDir = getProjectDir(project);
  await fs.mkdir(projectDir, { recursive: true });

  await writeProjectSync(project, { backend: 'local', syncedAt: '2026-01-01T00:00:00.000Z' });
  await syncProjectSnapshot({ project, projectDir });

  const sync = await readProjectSync(project);
  assert.equal(sync.backend, 'local');
  assert.ok(sync.syncedAt);

  await cleanupProject(project);
});
