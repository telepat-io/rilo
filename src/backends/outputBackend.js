import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { logError, logInfo } from '../observability/logger.js';
import { buildStorageHttpUrl, getFirebaseClients } from './firebaseClient.js';
import { writeProjectSync } from '../store/projectStore.js';

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listProjectFiles(projectDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  if (await pathExists(projectDir)) {
    await walk(projectDir);
  }

  return files;
}

export class LocalOutputBackend {
  async syncProjectSnapshot({ project }) {
    await writeProjectSync(project, {
      backend: 'local',
      syncedAt: new Date().toISOString()
    });
  }
}

export class FirebaseOutputBackend {
  constructor(options = {}) {
    this.db = null;
    this.bucket = null;
    this.getFirebaseClientsFn = options.getFirebaseClientsFn || getFirebaseClients;
    this.buildStorageHttpUrlFn = options.buildStorageHttpUrlFn || buildStorageHttpUrl;
    this.writeProjectSyncFn = options.writeProjectSyncFn || writeProjectSync;
    this.logInfoFn = options.logInfoFn || logInfo;
  }

  async ensureInitialized() {
    if (this.db && this.bucket) {
      return;
    }

    const clients = await this.getFirebaseClientsFn();
    this.db = clients.db;
    this.bucket = clients.bucket;
  }

  async syncProjectSnapshot({ project, projectDir }) {
    await this.ensureInitialized();

    const files = await listProjectFiles(projectDir);
    const assetRefs = [];
    for (const filePath of files) {
      const relativePath = path.relative(projectDir, filePath).split(path.sep).join('/');
      const destination = `projects/${project}/${relativePath}`;
      await this.bucket.upload(filePath, { destination });
      assetRefs.push({
        relativePath,
        storagePath: destination,
        url: this.buildStorageHttpUrlFn(this.bucket.name, destination)
      });
    }

    const runStatePath = path.join(projectDir, 'run-state.json');
    const artifactsPath = path.join(projectDir, 'artifacts.json');
    const configPath = path.join(projectDir, 'config.json');
    const storyPath = path.join(projectDir, 'story.md');

    const projectRef = this.db.collection('projects').doc(project);
    await projectRef.set(
      {
        project,
        backend: 'firebase',
        syncedAt: new Date().toISOString()
      },
      { merge: true }
    );

    if (await pathExists(runStatePath)) {
      const runState = JSON.parse(await fs.readFile(runStatePath, 'utf8'));
      await projectRef.collection('documents').doc('run-state').set(runState, { merge: true });
    }

    if (await pathExists(artifactsPath)) {
      const artifacts = JSON.parse(await fs.readFile(artifactsPath, 'utf8'));
      await projectRef.collection('documents').doc('artifacts').set(artifacts, { merge: true });
    }

    if (await pathExists(configPath)) {
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      await projectRef.collection('documents').doc('config').set(config, { merge: true });
    }

    if (await pathExists(storyPath)) {
      const story = await fs.readFile(storyPath, 'utf8');
      await projectRef.collection('documents').doc('story').set({ markdown: story }, { merge: true });
    }

    await projectRef.collection('documents').doc('assets-manifest').set(
      {
        refs: assetRefs,
        syncedAt: new Date().toISOString()
      },
      { merge: true }
    );

    await projectRef.collection('documents').doc('sync').set(
      {
        backend: 'firebase',
        syncedAt: new Date().toISOString(),
        uploadedFiles: files.length
      },
      { merge: true }
    );

    await this.writeProjectSyncFn(project, {
      backend: 'firebase',
      syncedAt: new Date().toISOString(),
      uploadedFiles: files.length
    });

    this.logInfoFn('firebase_sync_completed', { project, uploadedFiles: files.length });
  }
}

let backend;

export function getOutputBackend(options = {}) {
  const backendType = options.backendType || env.outputBackend;

  if (backend) {
    return backend;
  }

  if (backendType === 'firebase') {
    backend = new FirebaseOutputBackend({
      getFirebaseClientsFn: options.getFirebaseClientsFn,
      buildStorageHttpUrlFn: options.buildStorageHttpUrlFn,
      writeProjectSyncFn: options.writeProjectSyncFn,
      logInfoFn: options.logInfoFn
    });
  } else {
    backend = new LocalOutputBackend();
  }

  return backend;
}

export function __resetOutputBackendForTests() {
  backend = undefined;
}

export async function syncProjectSnapshot(payload, options = {}) {
  const outputBackend = options.outputBackend || getOutputBackend(options);
  const logErrorFn = options.logErrorFn || logError;
  try {
    await outputBackend.syncProjectSnapshot(payload);
  } catch (error) {
    logErrorFn('output_backend_sync_failed', {
      backend: options.backendType || env.outputBackend,
      project: payload.project,
      error: error.message
    });
    throw error;
  }
}
