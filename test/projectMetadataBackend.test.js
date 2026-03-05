import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { getProjectMetadataBackend } from '../src/backends/projectMetadataBackend.js';
import {
  getProjectDir,
  writeProjectArtifacts,
  writeProjectRunState,
  writeProjectSync
} from '../src/store/projectStore.js';
import { ensureDir } from '../src/media/files.js';
import { createRunRecord, writeRunRecord } from '../src/store/projectAnalyticsStore.js';

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

test('createProject rejects invalid payload types', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-invalid');

  await assert.rejects(
    backend.createProject({ project, story: 1 }),
    /story must be a string when provided/
  );

  await assert.rejects(
    backend.createProject({ project, story: 'ok', config: 'bad' }),
    /config must be an object when provided/
  );

  await assert.rejects(
    backend.createProject({ project, story: 'ok', metadata: [] }),
    /metadata must be an object when provided/
  );
});

test('createProject rejects invalid merged config', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-config');

  await assert.rejects(
    backend.createProject({
      project,
      story: 'hello',
      config: { targetDurationSec: 'bad' }
    }),
    /targetDurationSec must be an integer/
  );
});

test('createProject writes validated merged config with defaults', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-valid');

  const created = await backend.createProject({
    project,
    story: 'hello',
    config: { targetDurationSec: 42 },
    metadata: { title: 'Test' }
  });

  assert.equal(created.project, project);
  assert.equal(created.config.targetDurationSec, 42);
  assert.equal(created.config.aspectRatio, '9:16');
  assert.equal(created.config.finalDurationMode, 'match_audio');
  assert.equal(created.metadata.title, 'Test');

  await cleanupProject(project);
});

test('local metadata backend returns logs/prompts/artifacts/sync/snapshots and analytics', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-readpaths');
  const projectDir = getProjectDir(project);

  await backend.createProject({
    project,
    story: 'This is a sufficiently long story text to support local backend read-path tests.',
    metadata: { title: 'Read Paths' }
  });

  await writeProjectRunState(project, {
    status: 'completed',
    steps: {},
    artifacts: {
      script: 'Story script',
      shots: ['Shot 1', 'Shot 2']
    },
    updatedAt: new Date().toISOString()
  });
  await writeProjectArtifacts(project, { finalVideoPath: 'final.mp4' });
  await writeProjectSync(project, { backend: 'local', syncedAt: new Date().toISOString() });

  const logsDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(logsDir);
  await fs.writeFile(
    path.join(logsDir, 'api-requests.jsonl'),
    `${JSON.stringify({ type: 'request_start', model: 'm1', input: { prompt: 'prompt-1' }, trace: { step: 'script', index: 0 } })}\n`
      + `${JSON.stringify({ type: 'request_start', model: 'm2', input: { prompt: 'prompt-2' }, trace: { step: 'script', index: 1 } })}\n`,
    'utf8'
  );

  await ensureDir(path.join(projectDir, 'snapshots', '2026-01-01T00-00-00-000Z-aaaaaa'));

  const runA = createRunRecord({ runId: 'meta-run-a', project, jobId: 'job-a', forceRestart: false });
  runA.status = 'completed';
  runA.invokedAt = '2026-01-02T00:00:00.000Z';
  const runB = createRunRecord({ runId: 'meta-run-b', project, jobId: 'job-b', forceRestart: true });
  runB.status = 'failed';
  runB.invokedAt = '2026-01-03T00:00:00.000Z';
  runB.error = 'failed';
  await writeRunRecord(project, runA);
  await writeRunRecord(project, runB);

  const logs = await backend.getRequestLogs(project, { limit: 1 });
  assert.equal(logs.entries.length, 1);

  const prompts = await backend.getPromptData(project, { limit: 1 });
  assert.equal(prompts.prompts.length, 1);
  assert.equal(prompts.script, 'Story script');

  const artifacts = await backend.getArtifacts(project);
  assert.equal(artifacts.artifacts.finalVideoPath, 'final.mp4');

  const sync = await backend.getSyncStatus(project);
  assert.equal(sync.sync.backend, 'local');

  const snapshots = await backend.getSnapshots(project);
  assert.ok(snapshots.snapshots.length >= 1);

  const updated = await backend.updateMetadata(project, { owner: 'team-a' });
  assert.equal(updated.metadata.owner, 'team-a');

  const analyticsSummary = await backend.getAnalyticsSummary(project);
  assert.equal(analyticsSummary.summary.totalRuns, 2);

  const analyticsRuns = await backend.getAnalyticsRuns(project, { limit: 1 });
  assert.equal(analyticsRuns.runs.length, 1);

  const analyticsRun = await backend.getAnalyticsRun(project, 'meta-run-a');
  assert.equal(analyticsRun.run.runId, 'meta-run-a');

  await assert.rejects(backend.getAnalyticsRun(project, 'not-found'), /Run not found/);

  await cleanupProject(project);
});

test('local metadata backend returns empty logs when debug file is missing', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-missing-logs');

  await backend.createProject({ project, story: 'A valid story for missing logs path coverage.' });

  const logs = await backend.getRequestLogs(project, { includeEntries: true, limit: 5 });
  assert.equal(Array.isArray(logs.entries), true);
  assert.equal(logs.entries.length, 0);
  assert.equal(logs.logs.path, 'assets/debug/api-requests.jsonl');

  await cleanupProject(project);
});

test('local metadata backend skips malformed JSONL request log entries', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-bad-jsonl');
  const projectDir = getProjectDir(project);

  await backend.createProject({ project, story: 'A valid story for malformed jsonl parsing coverage.' });

  const logsDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(logsDir);
  await fs.writeFile(
    path.join(logsDir, 'api-requests.jsonl'),
    `${JSON.stringify({ type: 'request_start', model: 'm1' })}\n{bad-json\n${JSON.stringify({ type: 'request_succeeded', model: 'm1' })}\n`,
    'utf8'
  );

  const logs = await backend.getRequestLogs(project, { includeEntries: true });
  assert.equal(logs.entries.length, 2);

  await cleanupProject(project);
});

test('firebase metadata backend throws for missing project', async () => {
  const firebaseBackend = getProjectMetadataBackend({
    backendType: 'firebase',
    getFirebaseClientsFn: async () => ({
      db: {
        collection() {
          return {
            doc() {
              return {
                async get() {
                  return { exists: false, data: () => ({}) };
                },
                collection() {
                  return {
                    doc() {
                      return {
                        async get() {
                          return { exists: false, data: () => ({}) };
                        }
                      };
                    }
                  };
                }
              };
            }
          };
        }
      }
    })
  });

  await assert.rejects(
    firebaseBackend.getProject('missing-project'),
    /Project not found/
  );
});

test('createProject preserves existing story when story input is omitted', async () => {
  const backend = getProjectMetadataBackend();
  const project = uniqueProject('ut-meta-story-omit');

  await backend.createProject({ project, story: 'Original story content', metadata: { a: 1 } });
  const first = await backend.getProject(project);
  assert.match(first.story, /Original story content/);

  await backend.createProject({ project, metadata: { b: 2 } });
  const second = await backend.getProject(project);
  assert.match(second.story, /Original story content/);
  assert.equal(second.metadata.b, 2);

  await cleanupProject(project);
});
