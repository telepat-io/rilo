import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import {
  ensureProject,
  ensureProjectConfig,
  getProjectDir,
  getProjectStoryPath,
  listLocalProjects,
  normalizeAndValidateProjectConfig,
  readProjectArtifacts,
  readProjectConfig,
  readProjectMetadata,
  readProjectRunState,
  readProjectSync,
  resolveProjectName,
  writeProjectConfig,
  writeProjectMetadata,
  writeProjectStory
} from '../store/projectStore.js';
import { getFirebaseClients } from './firebaseClient.js';
import { listProjectSnapshots } from '../store/staleAssetStore.js';
import {
  listRunRecords,
  readRunRecord,
  summarizeProjectAnalytics,
  summarizeRun
} from '../store/projectAnalyticsStore.js';

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function parseJsonLines(rawText) {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildPromptPayload(runState, logs = []) {
  const artifacts = runState?.artifacts || {};
  const promptCalls = logs.filter((entry) => entry?.type === 'request_start' && entry?.input?.prompt);
  return {
    script: artifacts.script || '',
    shots: artifacts.shots || [],
    prompts: promptCalls.map((entry) => ({
      model: entry.model,
      step: entry.trace?.step || '',
      index: Number.isInteger(entry.trace?.index) ? entry.trace.index : null,
      prompt: entry.input.prompt
    }))
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertCreateProjectPayload({ story, config, metadata }) {
  if (story !== undefined && typeof story !== 'string') {
    throw new Error('story must be a string when provided');
  }
  if (config !== undefined && !isPlainObject(config)) {
    throw new Error('config must be an object when provided');
  }
  if (metadata !== undefined && !isPlainObject(metadata)) {
    throw new Error('metadata must be an object when provided');
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursively(baseDir) {
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

  if (await pathExists(baseDir)) {
    await walk(baseDir);
  }

  return files;
}

export class LocalProjectMetadataBackend {
  async listProjects() {
    return listLocalProjects();
  }

  async createProject({ project, story, config, metadata }) {
    assertCreateProjectPayload({ story, config, metadata });
    const resolved = resolveProjectName(project);
    await ensureProject(resolved);
    await ensureProjectConfig(resolved);

    if (story) {
      await writeProjectStory(resolved, story);
    } else {
      const storyPath = getProjectStoryPath(resolved);
      if (!(await pathExists(storyPath))) {
        await writeProjectStory(resolved, '');
      }
    }

    if (config && typeof config === 'object') {
      const existingConfig = await readProjectConfig(resolved);
      await writeProjectConfig(resolved, { ...existingConfig, ...config });
    }

    const existingMetadata = await readProjectMetadata(resolved);
    await writeProjectMetadata(resolved, {
      ...existingMetadata,
      ...(metadata || {}),
      updatedAt: new Date().toISOString(),
      createdAt: existingMetadata.createdAt || new Date().toISOString()
    });

    return this.getProject(resolved);
  }

  async getProject(project) {
    const resolved = resolveProjectName(project);
    const projectDir = getProjectDir(resolved);
    await ensureProject(resolved);
    const config = await readProjectConfig(resolved);
    const runState = await readProjectRunState(resolved);
    const metadata = await readProjectMetadata(resolved);

    let story = '';
    try {
      story = await fs.readFile(getProjectStoryPath(resolved), 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    const files = await listFilesRecursively(projectDir);
    const assets = files.map((filePath) => ({
      referenceType: 'path',
      path: toPosixPath(path.relative(projectDir, filePath)),
      value: toPosixPath(path.relative(process.cwd(), filePath))
    }));

    return {
      project: resolved,
      backend: 'local',
      config,
      metadata,
      story,
      runState,
      assets
    };
  }

  async getRequestLogs(project, options = {}) {
    const resolved = resolveProjectName(project);
    const projectDir = getProjectDir(resolved);
    const logsPath = path.join(projectDir, 'assets', 'debug', 'api-requests.jsonl');
    const reference = {
      referenceType: 'path',
      path: 'assets/debug/api-requests.jsonl',
      value: toPosixPath(path.relative(process.cwd(), logsPath))
    };

    if (!(await pathExists(logsPath))) {
      return {
        project: resolved,
        backend: 'local',
        logs: reference,
        entries: []
      };
    }

    const raw = await fs.readFile(logsPath, 'utf8');
    let entries = parseJsonLines(raw);
    const limit = Number(options.limit || 0);
    if (Number.isInteger(limit) && limit > 0) {
      entries = entries.slice(-limit);
    }

    return {
      project: resolved,
      backend: 'local',
      logs: reference,
      entries
    };
  }

  async getPromptData(project, options = {}) {
    const resolved = resolveProjectName(project);
    const runState = await readProjectRunState(resolved);
    const logsResult = await this.getRequestLogs(resolved, options);

    return {
      project: resolved,
      backend: 'local',
      ...buildPromptPayload(runState, logsResult.entries),
      logs: logsResult.logs
    };
  }

  async getArtifacts(project) {
    const resolved = resolveProjectName(project);
    const artifacts = await readProjectArtifacts(resolved);
    return {
      project: resolved,
      backend: 'local',
      artifacts
    };
  }

  async getSyncStatus(project) {
    const resolved = resolveProjectName(project);
    const sync = await readProjectSync(resolved);
    return {
      project: resolved,
      backend: 'local',
      sync
    };
  }

  async getSnapshots(project) {
    const resolved = resolveProjectName(project);
    const projectDir = getProjectDir(resolved);
    const snapshots = await listProjectSnapshots(projectDir);
    const refs = snapshots.map((snapshot) => ({
      referenceType: 'path',
      path: `${snapshot.root}/${snapshot.name}`,
      value: toPosixPath(path.relative(process.cwd(), path.join(projectDir, snapshot.root, snapshot.name)))
    }));

    return {
      project: resolved,
      backend: 'local',
      snapshots: refs
    };
  }

  async updateMetadata(project, patch) {
    const resolved = resolveProjectName(project);
    const current = await readProjectMetadata(resolved);
    const next = {
      ...current,
      ...(patch || {}),
      updatedAt: new Date().toISOString(),
      createdAt: current.createdAt || new Date().toISOString()
    };
    await writeProjectMetadata(resolved, next);
    return this.getProject(resolved);
  }

  async getAnalyticsSummary(project) {
    const resolved = resolveProjectName(project);
    const runs = await listRunRecords(resolved);
    return {
      project: resolved,
      backend: 'local',
      summary: summarizeProjectAnalytics(runs)
    };
  }

  async getAnalyticsRuns(project, options = {}) {
    const resolved = resolveProjectName(project);
    const runs = await listRunRecords(resolved);
    const limit = Number(options.limit || 0);
    const selected = Number.isInteger(limit) && limit > 0 ? runs.slice(0, limit) : runs;
    return {
      project: resolved,
      backend: 'local',
      runs: selected.map((run) => summarizeRun(run))
    };
  }

  async getAnalyticsRun(project, runId) {
    const resolved = resolveProjectName(project);
    const run = await readRunRecord(resolved, runId);
    if (!run) {
      throw new Error('Run not found');
    }

    return {
      project: resolved,
      backend: 'local',
      run
    };
  }
}

export class FirebaseProjectMetadataBackend {
  constructor(options = {}) {
    this.db = null;
    this.getFirebaseClientsFn = options.getFirebaseClientsFn || getFirebaseClients;
  }

  async ensureInitialized() {
    if (this.db) return;
    const { db } = await this.getFirebaseClientsFn();
    this.db = db;
  }

  async listProjects() {
    await this.ensureInitialized();
    const snap = await this.db.collection('projects').get();
    return snap.docs.map((doc) => doc.id).sort((a, b) => a.localeCompare(b));
  }

  async createProject({ project, story, config, metadata }) {
    assertCreateProjectPayload({ story, config, metadata });
    await this.ensureInitialized();
    const resolved = resolveProjectName(project);

    await ensureProject(resolved);
    const existingConfig = await ensureProjectConfig(resolved);
    if (story !== undefined) {
      await writeProjectStory(resolved, story);
    }
    if (metadata && typeof metadata === 'object') {
      await writeProjectMetadata(resolved, metadata);
    }

    const projectRef = this.db.collection('projects').doc(resolved);
    await projectRef.set(
      {
        project: resolved,
        backend: 'firebase',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    if (story !== undefined) {
      await projectRef.collection('documents').doc('story').set({ markdown: story }, { merge: true });
    }
    if (config && typeof config === 'object') {
      const mergedConfig = normalizeAndValidateProjectConfig({
        ...existingConfig,
        ...config
      });
      await writeProjectConfig(resolved, mergedConfig);
      await projectRef.collection('documents').doc('config').set(mergedConfig, { merge: false });
    }
    if (metadata && typeof metadata === 'object') {
      await projectRef.collection('documents').doc('metadata').set(metadata, { merge: true });
    }

    return this.getProject(resolved);
  }

  async getProject(project) {
    await this.ensureInitialized();
    const resolved = resolveProjectName(project);
    const projectRef = this.db.collection('projects').doc(resolved);

    const [projectDoc, configDoc, runStateDoc, storyDoc, metadataDoc, manifestDoc] = await Promise.all([
      projectRef.get(),
      projectRef.collection('documents').doc('config').get(),
      projectRef.collection('documents').doc('run-state').get(),
      projectRef.collection('documents').doc('story').get(),
      projectRef.collection('documents').doc('metadata').get(),
      projectRef.collection('documents').doc('assets-manifest').get()
    ]);

    if (!projectDoc.exists && !configDoc.exists && !runStateDoc.exists && !storyDoc.exists) {
      throw new Error('Project not found in Firebase backend');
    }

    const refs = manifestDoc.exists ? manifestDoc.data().refs || [] : [];
    const assets = refs.map((ref) => ({
      referenceType: 'url',
      path: ref.relativePath,
      value: ref.url
    }));

    const resolvedConfig = normalizeAndValidateProjectConfig(configDoc.exists ? configDoc.data() : {});

    return {
      project: resolved,
      backend: 'firebase',
      config: resolvedConfig,
      metadata: metadataDoc.exists ? metadataDoc.data() : {},
      story: storyDoc.exists ? storyDoc.data().markdown || '' : '',
      runState: runStateDoc.exists ? runStateDoc.data() : null,
      assets
    };
  }

  async getRequestLogs(project, options = {}) {
    await this.ensureInitialized();
    const details = await this.getProject(project);
    const logAsset = details.assets.find((asset) => asset.path === 'assets/debug/api-requests.jsonl') || null;

    if (options.includeEntries === true) {
      throw new Error('includeEntries is not supported for firebase backend logs; use the logs URL');
    }

    return {
      project: details.project,
      backend: 'firebase',
      logs: logAsset,
      entries: null
    };
  }

  async getPromptData(project, options = {}) {
    const details = await this.getProject(project);
    const logs = await this.getRequestLogs(project, options);
    return {
      project: details.project,
      backend: 'firebase',
      script: details.runState?.artifacts?.script || '',
      shots: details.runState?.artifacts?.shots || [],
      prompts: [],
      logs: logs.logs
    };
  }

  async getArtifacts(project) {
    await this.ensureInitialized();
    const details = await this.getProject(project);
    return {
      project: details.project,
      backend: 'firebase',
      artifacts: details.runState?.artifacts || null
    };
  }

  async getSyncStatus(project) {
    await this.ensureInitialized();
    const resolved = resolveProjectName(project);
    const docRef = this.db.collection('projects').doc(resolved).collection('documents').doc('sync');
    const doc = await docRef.get();
    return {
      project: resolved,
      backend: 'firebase',
      sync: doc.exists ? doc.data() : null
    };
  }

  async getSnapshots(project) {
    const details = await this.getProject(project);
    const snapshotRefs = details.assets
      .filter((asset) => asset.path.startsWith('snapshots/') || asset.path.startsWith('stale/'))
      .map((asset) => ({
        referenceType: 'url',
        path: asset.path,
        value: asset.value
      }));

    return {
      project: details.project,
      backend: 'firebase',
      snapshots: snapshotRefs
    };
  }

  async updateMetadata(project, patch) {
    await this.ensureInitialized();
    const resolved = resolveProjectName(project);
    const docRef = this.db.collection('projects').doc(resolved).collection('documents').doc('metadata');
    const current = (await docRef.get()).data() || {};
    const next = {
      ...current,
      ...(patch || {}),
      updatedAt: new Date().toISOString(),
      createdAt: current.createdAt || new Date().toISOString()
    };
    await docRef.set(next, { merge: true });
    return this.getProject(resolved);
  }

  async getAnalyticsSummary(project) {
    const resolved = resolveProjectName(project);
    const runs = await listRunRecords(resolved);
    return {
      project: resolved,
      backend: 'firebase',
      summary: summarizeProjectAnalytics(runs)
    };
  }

  async getAnalyticsRuns(project, options = {}) {
    const resolved = resolveProjectName(project);
    const runs = await listRunRecords(resolved);
    const limit = Number(options.limit || 0);
    const selected = Number.isInteger(limit) && limit > 0 ? runs.slice(0, limit) : runs;
    return {
      project: resolved,
      backend: 'firebase',
      runs: selected.map((run) => summarizeRun(run))
    };
  }

  async getAnalyticsRun(project, runId) {
    const resolved = resolveProjectName(project);
    const run = await readRunRecord(resolved, runId);
    if (!run) {
      throw new Error('Run not found');
    }

    return {
      project: resolved,
      backend: 'firebase',
      run
    };
  }
}

export function getProjectMetadataBackend(options = {}) {
  const backendType = options.backendType || env.outputBackend;
  if (backendType === 'firebase') {
    return new FirebaseProjectMetadataBackend({
      getFirebaseClientsFn: options.getFirebaseClientsFn
    });
  }
  return new LocalProjectMetadataBackend();
}
