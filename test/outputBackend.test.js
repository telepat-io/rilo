import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { getProjectDir, readProjectSync } from '../src/store/projectStore.js';
import { syncProjectSnapshot } from '../src/backends/outputBackend.js';

const execFileAsync = promisify(execFile);

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

test('syncProjectSnapshot writes local sync metadata', async () => {
  const project = uniqueProject('ut-output-local');
  const projectDir = getProjectDir(project);
  await fs.mkdir(projectDir, { recursive: true });

  await syncProjectSnapshot({ project, projectDir });

  const sync = await readProjectSync(project);
  assert.equal(sync.backend, 'local');
  assert.ok(sync.syncedAt);

  await cleanupProject(project);
});

test('syncProjectSnapshot propagates errors for invalid project names', async () => {
  await assert.rejects(
    syncProjectSnapshot({ project: 'INVALID PROJECT NAME!', projectDir: '/tmp/none' }),
    /Invalid project name/
  );
});

test('getOutputBackend selects firebase backend when OUTPUT_BACKEND=firebase', async () => {
  const script = `
    const mod = await import('./src/backends/outputBackend.js');
    const instance = mod.getOutputBackend();
    console.log(instance.constructor.name);
  `;

  const { stdout } = await execFileAsync('node', ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      OUTPUT_BACKEND: 'firebase'
    }
  });

  assert.match(stdout.trim(), /FirebaseOutputBackend/);
});
