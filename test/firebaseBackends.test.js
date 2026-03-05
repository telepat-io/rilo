import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  __resetFirebaseClientsForTests,
  buildStorageHttpUrl,
  getFirebaseClients
} from '../src/backends/firebaseClient.js';
import {
  __resetOutputBackendForTests,
  FirebaseOutputBackend,
  getOutputBackend,
  syncProjectSnapshot
} from '../src/backends/outputBackend.js';
import {
  FirebaseProjectMetadataBackend,
  getProjectMetadataBackend
} from '../src/backends/projectMetadataBackend.js';
import { getProjectDir, writeProjectConfig } from '../src/store/projectStore.js';
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

function createFakeFirestore() {
  const docs = new Map();

  function clone(value) {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  function mergeValue(current, next) {
    return { ...(current || {}), ...(next || {}) };
  }

  class DocRef {
    constructor(pathKey) {
      this.pathKey = pathKey;
    }

    async set(data, options = {}) {
      if (options.merge) {
        docs.set(this.pathKey, mergeValue(docs.get(this.pathKey), clone(data)));
      } else {
        docs.set(this.pathKey, clone(data));
      }
    }

    async get() {
      const value = docs.get(this.pathKey);
      return {
        exists: value !== undefined,
        data: () => clone(value)
      };
    }

    collection(name) {
      return new CollectionRef(`${this.pathKey}/${name}`);
    }
  }

  class CollectionRef {
    constructor(basePath) {
      this.basePath = basePath;
    }

    doc(id) {
      return new DocRef(`${this.basePath}/${id}`);
    }

    async get() {
      const prefix = `${this.basePath}/`;
      const directIds = new Set();

      for (const key of docs.keys()) {
        if (!key.startsWith(prefix)) continue;
        const remainder = key.slice(prefix.length);
        if (!remainder || remainder.includes('/')) continue;
        directIds.add(remainder);
      }

      return {
        docs: [...directIds].map((id) => ({ id }))
      };
    }
  }

  return {
    collection(name) {
      return new CollectionRef(name);
    },
    _docs: docs
  };
}

test('firebaseClient supports explicit credentials, app-default, caching, and url builder', async () => {
  __resetFirebaseClientsForTests();

  const calls = {
    cert: 0,
    appDefault: 0,
    init: 0
  };

  const fakeDb = { name: 'db' };
  const fakeBucket = { name: 'bucket-name' };

  const makeAdminModule = () => ({
    default: {
      credential: {
        cert(input) {
          calls.cert += 1;
          return { mode: 'cert', input };
        },
        applicationDefault() {
          calls.appDefault += 1;
          return { mode: 'appDefault' };
        }
      },
      initializeApp() {
        calls.init += 1;
      },
      firestore() {
        return fakeDb;
      },
      storage() {
        return {
          bucket() {
            return fakeBucket;
          }
        };
      }
    }
  });

  const explicitEnv = {
    firebaseProjectId: 'p1',
    firebaseClientEmail: 'e@x',
    firebasePrivateKey: 'line1\\nline2',
    firebaseStorageBucket: 'bucket-1'
  };

  const first = await getFirebaseClients({
    env: explicitEnv,
    importFirebaseAdmin: async () => makeAdminModule()
  });

  assert.equal(first.db, fakeDb);
  assert.equal(first.bucket, fakeBucket);
  assert.equal(calls.cert, 1);
  assert.equal(calls.init, 1);

  const cached = await getFirebaseClients({
    env: explicitEnv,
    importFirebaseAdmin: async () => makeAdminModule()
  });
  assert.equal(cached.db, fakeDb);
  assert.equal(calls.init, 1);

  __resetFirebaseClientsForTests();
  await getFirebaseClients({
    env: {
      firebaseProjectId: '',
      firebaseClientEmail: '',
      firebasePrivateKey: '',
      firebaseStorageBucket: ''
    },
    importFirebaseAdmin: async () => makeAdminModule()
  });
  assert.equal(calls.appDefault, 1);

  __resetFirebaseClientsForTests();
  await getFirebaseClients({
    importFirebaseAdmin: async () => makeAdminModule()
  });
  assert.ok(calls.init >= 2);

  const url = buildStorageHttpUrl('my-bucket', 'projects/a b/file#.mp4');
  assert.equal(url, 'https://storage.googleapis.com/my-bucket/projects/a%20b/file%23.mp4');
});

test('FirebaseOutputBackend sync uploads files and writes firebase documents', async () => {
  const project = uniqueProject('ut-firebase-output');
  const projectDir = getProjectDir(project);
  await fs.mkdir(path.join(projectDir, 'assets', 'debug'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'run-state.json'), JSON.stringify({ ok: true }), 'utf8');
  await fs.writeFile(path.join(projectDir, 'artifacts.json'), JSON.stringify({ finalVideoPath: 'final.mp4' }), 'utf8');
  await writeProjectConfig(project, { aspectRatio: '9:16', targetDurationSec: 60, finalDurationMode: 'match_audio' });
  await fs.writeFile(path.join(projectDir, 'story.md'), 'story', 'utf8');
  await fs.writeFile(path.join(projectDir, 'assets', 'debug', 'api-requests.jsonl'), '{}\n', 'utf8');

  const db = createFakeFirestore();
  const uploads = [];
  const bucket = {
    name: 'fake-bucket',
    async upload(filePath, { destination }) {
      uploads.push([filePath, destination]);
    }
  };

  const syncWrites = [];
  const backend = new FirebaseOutputBackend({
    getFirebaseClientsFn: async () => ({ db, bucket }),
    writeProjectSyncFn: async (p, value) => {
      syncWrites.push([p, value]);
    },
    logInfoFn: () => {}
  });

  await backend.syncProjectSnapshot({ project, projectDir });

  assert.ok(uploads.length >= 4);
  assert.equal(syncWrites.length, 1);
  assert.equal(syncWrites[0][0], project);

  const syncDoc = await db.collection('projects').doc(project).collection('documents').doc('sync').get();
  assert.equal(syncDoc.exists, true);
  assert.equal(syncDoc.data().backend, 'firebase');

  await cleanupProject(project);
});

test('output backend selectors and sync wrapper support overrides and error logging', async () => {
  __resetOutputBackendForTests();

  const backend = getOutputBackend({
    backendType: 'firebase',
    getFirebaseClientsFn: async () => ({ db: createFakeFirestore(), bucket: { name: 'b', upload: async () => {} } }),
    logInfoFn: () => {}
  });
  assert.equal(backend.constructor.name, 'FirebaseOutputBackend');

  let logged = null;
  await assert.rejects(
    syncProjectSnapshot(
      { project: 'p', projectDir: '/tmp' },
      {
        outputBackend: {
          async syncProjectSnapshot() {
            throw new Error('boom');
          }
        },
        logErrorFn: (_message, payload) => {
          logged = payload;
        },
        backendType: 'firebase'
      }
    ),
    /boom/
  );
  assert.equal(logged.error, 'boom');

  __resetOutputBackendForTests();
});

test('FirebaseProjectMetadataBackend supports core CRUD and analytics paths', async () => {
  const project = uniqueProject('ut-firebase-meta');
  const db = createFakeFirestore();
  const backend = new FirebaseProjectMetadataBackend({
    getFirebaseClientsFn: async () => ({ db })
  });

  const created = await backend.createProject({
    project,
    story: 'This is a sufficiently long firebase story for backend tests.',
    config: { targetDurationSec: 45 },
    metadata: { title: 'Firebase Title' }
  });
  assert.equal(created.project, project);
  assert.equal(created.backend, 'firebase');
  assert.equal(created.config.targetDurationSec, 45);

  await db.collection('projects').doc(project).collection('documents').doc('run-state').set(
    { artifacts: { script: 's', shots: ['a'] } },
    { merge: true }
  );
  await db.collection('projects').doc(project).collection('documents').doc('assets-manifest').set(
    {
      refs: [
        { relativePath: 'assets/debug/api-requests.jsonl', url: 'https://example.com/logs' },
        { relativePath: 'snapshots/abc/file.txt', url: 'https://example.com/snap' }
      ]
    },
    { merge: true }
  );
  await db.collection('projects').doc(project).collection('documents').doc('sync').set(
    { backend: 'firebase' },
    { merge: true }
  );

  const details = await backend.getProject(project);
  assert.equal(details.assets.length, 2);

  const logs = await backend.getRequestLogs(project, { includeEntries: false });
  assert.equal(logs.entries, null);
  assert.equal(logs.logs.path, 'assets/debug/api-requests.jsonl');

  await assert.rejects(backend.getRequestLogs(project, { includeEntries: true }), /not supported/);

  const prompts = await backend.getPromptData(project, {});
  assert.equal(prompts.script, 's');
  assert.equal(prompts.shots.length, 1);

  const artifacts = await backend.getArtifacts(project);
  assert.deepEqual(artifacts.artifacts, { script: 's', shots: ['a'] });

  const sync = await backend.getSyncStatus(project);
  assert.equal(sync.sync.backend, 'firebase');

  const snapshots = await backend.getSnapshots(project);
  assert.equal(snapshots.snapshots.length, 1);

  const updated = await backend.updateMetadata(project, { owner: 'team-firebase' });
  assert.equal(updated.metadata.owner, 'team-firebase');

  const run = createRunRecord({ runId: 'f-run-1', project, jobId: 'job-1', forceRestart: false });
  await writeRunRecord(project, run);

  const summary = await backend.getAnalyticsSummary(project);
  assert.equal(summary.summary.totalRuns, 1);

  const runs = await backend.getAnalyticsRuns(project, { limit: 1 });
  assert.equal(runs.runs.length, 1);

  const runDetail = await backend.getAnalyticsRun(project, 'f-run-1');
  assert.equal(runDetail.run.runId, 'f-run-1');

  await assert.rejects(backend.getAnalyticsRun(project, 'missing'), /Run not found/);

  await cleanupProject(project);
});

test('metadata backend factory supports backend override and firebase injection', () => {
  const firebaseBackend = getProjectMetadataBackend({
    backendType: 'firebase',
    getFirebaseClientsFn: async () => ({ db: createFakeFirestore() })
  });
  assert.equal(firebaseBackend.constructor.name, 'FirebaseProjectMetadataBackend');

  const localBackend = getProjectMetadataBackend({ backendType: 'local' });
  assert.equal(localBackend.constructor.name, 'LocalProjectMetadataBackend');
});
