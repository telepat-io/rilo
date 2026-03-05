import express from 'express';
import { getProjectMetadataBackend } from '../../backends/projectMetadataBackend.js';
import { syncProjectSnapshot } from '../../backends/outputBackend.js';
import { env } from '../../config/env.js';
import { resolveKeyframeSize, resolveProjectModelSelections } from '../../config/models.js';
import { regenerateProjectAsset, runPipeline } from '../../pipeline/orchestrator.js';
import { createJob, findActiveJobByProject } from '../../store/jobStore.js';
import { JobStep, emptyStepState } from '../../types/job.js';
import {
  ensureProject,
  getProjectDir,
  readProjectConfig,
  readProjectRunState,
  readProjectScriptAsset,
  readProjectStory,
  resolveProjectName,
  writeProjectArtifacts,
  writeProjectConfig,
  writeProjectRunState,
  writeProjectScriptAsset,
  writeProjectStory
} from '../../store/projectStore.js';

function parseBoundedLimit(input, { defaultValue, maxValue }) {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function parseBoolean(input, defaultValue) {
  if (input === undefined || input === null) {
    return defaultValue;
  }

  const value = String(input).trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return defaultValue;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function parseContentUpdatePayload(body) {
  const payload = body || {};
  const hasShots = payload.shots !== undefined;
  const hasPrompts = payload.prompts !== undefined;

  if (payload.story !== undefined && typeof payload.story !== 'string') {
    throw new Error('story must be a string when provided');
  }

  if (payload.script !== undefined && typeof payload.script !== 'string') {
    throw new Error('script must be a string when provided');
  }

  if (payload.tone !== undefined && typeof payload.tone !== 'string') {
    throw new Error('tone must be a string when provided');
  }

  if (hasShots && hasPrompts) {
    throw new Error('provide only one of shots or prompts');
  }

  const nextShots = hasShots ? payload.shots : payload.prompts;
  if (nextShots !== undefined && !isStringArray(nextShots)) {
    throw new Error('shots/prompts must be an array of strings when provided');
  }

  if (
    payload.story === undefined
    && payload.script === undefined
    && payload.tone === undefined
    && nextShots === undefined
  ) {
    throw new Error('at least one of story, script, shots/prompts, or tone is required');
  }

  return {
    story: payload.story,
    script: payload.script,
    tone: payload.tone,
    shots: nextShots
  };
}

function cloneRunStateArtifacts(runState) {
  const artifacts = runState?.artifacts || {};
  return {
    ...artifacts,
    keyframeUrls: [...(artifacts.keyframeUrls || [])],
    keyframePaths: [...(artifacts.keyframePaths || [])],
    segmentUrls: [...(artifacts.segmentUrls || [])],
    segmentPaths: [...(artifacts.segmentPaths || [])],
    shots: [...(artifacts.shots || [])],
    timeline: [...(artifacts.timeline || [])],
    shotHashes: [...(artifacts.shotHashes || [])]
  };
}

function applyRunStateInvalidationForConfigChange({ runState, previousConfig, nextConfig }) {
  if (!runState || typeof runState !== 'object') {
    return null;
  }

  const steps = {
    ...emptyStepState(),
    ...(runState.steps || {})
  };
  const artifacts = cloneRunStateArtifacts(runState);
  const previousSizeKey = resolveKeyframeSize(previousConfig || {}).key;
  const nextSizeKey = resolveKeyframeSize(nextConfig || {}).key;
  const durationChanged = previousConfig?.targetDurationSec !== nextConfig?.targetDurationSec;
  const aspectChanged = previousConfig?.aspectRatio !== nextConfig?.aspectRatio;
  const sizeChanged = previousSizeKey !== nextSizeKey;
  const previousModels = resolveProjectModelSelections(previousConfig?.models);
  const nextModels = resolveProjectModelSelections(nextConfig?.models);
  const modelsChanged = JSON.stringify(previousModels) !== JSON.stringify(nextModels);

  if (durationChanged || modelsChanged) {
    steps[JobStep.SCRIPT] = false;
    steps[JobStep.VOICE] = false;
    steps[JobStep.KEYFRAMES] = false;
    steps[JobStep.SEGMENTS] = false;
    steps[JobStep.COMPOSE] = false;
    artifacts.script = '';
    artifacts.tone = '';
    artifacts.shots = [];
    artifacts.timeline = [];
    artifacts.voiceoverUrl = '';
    artifacts.voiceoverPath = '';
    artifacts.keyframeUrls = [];
    artifacts.keyframePaths = [];
    artifacts.segmentUrls = [];
    artifacts.segmentPaths = [];
    artifacts.finalVideoPath = '';
    artifacts.scriptHash = '';
    artifacts.shotHashes = [];
    artifacts.scriptSourceStoryHash = '';
  } else if (aspectChanged || sizeChanged) {
    steps[JobStep.KEYFRAMES] = false;
    steps[JobStep.SEGMENTS] = false;
    steps[JobStep.COMPOSE] = false;
    artifacts.keyframeUrls = [];
    artifacts.keyframePaths = [];
    artifacts.segmentUrls = [];
    artifacts.segmentPaths = [];
    artifacts.finalVideoPath = '';
  }

  artifacts.modelSelections = nextModels;

  return {
    status: runState.status,
    error: runState.error || null,
    steps,
    artifacts,
    updatedAt: new Date().toISOString()
  };
}

function applyRunStateInvalidationForContentChange({ runState, updates }) {
  if (!runState || typeof runState !== 'object') {
    return null;
  }

  if (updates.script === undefined) {
    return null;
  }

  const steps = {
    ...emptyStepState(),
    ...(runState.steps || {})
  };
  const artifacts = cloneRunStateArtifacts(runState);

  artifacts.script = updates.script;
  artifacts.scriptHash = '';
  artifacts.scriptWordCount = null;
  artifacts.targetWordCount = null;
  artifacts.shots = [];
  artifacts.shotHashes = [];
  artifacts.timeline = [];
  artifacts.voiceoverUrl = '';
  artifacts.voiceoverPath = '';
  artifacts.keyframeUrls = [];
  artifacts.keyframePaths = [];
  artifacts.segmentUrls = [];
  artifacts.segmentPaths = [];
  artifacts.finalVideoPath = '';

  steps[JobStep.SCRIPT] = true;
  steps[JobStep.VOICE] = false;
  steps[JobStep.KEYFRAMES] = false;
  steps[JobStep.SEGMENTS] = false;
  steps[JobStep.COMPOSE] = false;

  return {
    status: runState.status,
    error: runState.error || null,
    steps,
    artifacts,
    updatedAt: new Date().toISOString()
  };
}

export function createProjectsRouter(deps = {}) {
  const router = express.Router();
  const syncProjectSnapshotFn = deps.syncProjectSnapshotFn || syncProjectSnapshot;
  const findActiveJobByProjectFn = deps.findActiveJobByProjectFn || findActiveJobByProject;
  const createJobFn = deps.createJobFn || createJob;
  const runPipelineFn = deps.runPipelineFn || runPipeline;
  const regenerateProjectAssetFn = deps.regenerateProjectAssetFn || regenerateProjectAsset;

  router.get('/', async (_req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const projects = await backend.listProjects();
      res.json({ projects });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { project, story, config, metadata } = req.body || {};
      if (!project) {
        res.status(400).json({ error: 'project is required' });
        return;
      }

      if (story !== undefined && typeof story !== 'string') {
        res.status(400).json({ error: 'story must be a string when provided' });
        return;
      }

      if (config !== undefined && !isPlainObject(config)) {
        res.status(400).json({ error: 'config must be an object when provided' });
        return;
      }

      if (metadata !== undefined && !isPlainObject(metadata)) {
        res.status(400).json({ error: 'metadata must be an object when provided' });
        return;
      }

      const backend = getProjectMetadataBackend();
      const created = await backend.createProject({ project, story, config, metadata });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const details = await backend.getProject(req.params.project);
      res.json(details);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/:project/logs', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const includeEntries = parseBoolean(req.query.includeEntries, false);
      const limit = parseBoundedLimit(req.query.limit, {
        defaultValue: env.apiDefaultLogsLimit,
        maxValue: env.apiMaxLogsLimit
      });
      const details = await backend.getRequestLogs(req.params.project, { limit, includeEntries });
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/prompts', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const limit = parseBoundedLimit(req.query.limit, {
        defaultValue: env.apiDefaultLogsLimit,
        maxValue: env.apiMaxLogsLimit
      });
      const details = await backend.getPromptData(req.params.project, { limit });
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/artifacts', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const details = await backend.getArtifacts(req.params.project);
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/sync', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const details = await backend.getSyncStatus(req.params.project);
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/snapshots', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const details = await backend.getSnapshots(req.params.project);
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/analytics', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const details = await backend.getAnalyticsSummary(req.params.project);
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/analytics/runs', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const limit = parseBoundedLimit(req.query.limit, {
        defaultValue: env.apiDefaultLogsLimit,
        maxValue: env.apiMaxLogsLimit
      });
      const details = await backend.getAnalyticsRuns(req.params.project, { limit });
      res.json(details);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:project/analytics/runs/:runId', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      const details = await backend.getAnalyticsRun(req.params.project, req.params.runId);
      res.json(details);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.patch('/:project/config', async (req, res) => {
    try {
      const project = resolveProjectName(req.params.project);
      const { config } = req.body || {};
      if (!config || typeof config !== 'object') {
        res.status(400).json({ error: 'config object is required' });
        return;
      }

      await ensureProject(project);
      const previousConfig = await readProjectConfig(project);
      const normalized = await writeProjectConfig(project, config);
      const runState = await readProjectRunState(project);
      const nextRunState = applyRunStateInvalidationForConfigChange({
        runState,
        previousConfig,
        nextConfig: normalized
      });
      if (nextRunState) {
        await writeProjectRunState(project, nextRunState);
        await writeProjectArtifacts(project, nextRunState.artifacts || {});
      }

      await syncProjectSnapshotFn({
        project,
        projectDir: getProjectDir(project)
      });

      const backend = getProjectMetadataBackend();
      const details = await backend.getProject(project);
      res.json({ project, config: normalized, details });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/:project/metadata', async (req, res) => {
    try {
      const { metadata } = req.body || {};
      if (!metadata || typeof metadata !== 'object') {
        res.status(400).json({ error: 'metadata object is required' });
        return;
      }

      const backend = getProjectMetadataBackend();
      const updated = await backend.updateMetadata(req.params.project, metadata);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.patch('/:project/content', async (req, res) => {
    try {
      const project = resolveProjectName(req.params.project);
      await ensureProject(project);
      const updates = parseContentUpdatePayload(req.body);

      if (updates.story !== undefined) {
        await writeProjectStory(project, updates.story);
      }

      if (updates.script !== undefined || updates.shots !== undefined || updates.tone !== undefined) {
        const currentScriptAsset = await readProjectScriptAsset(project);
        const nextScriptAsset = {
          ...(currentScriptAsset || {}),
          ...(updates.script !== undefined ? { script: updates.script } : {}),
          ...(updates.shots !== undefined ? { shots: updates.shots } : {}),
          ...(updates.tone !== undefined ? { tone: updates.tone } : {})
        };
        await writeProjectScriptAsset(project, nextScriptAsset);
      }

      const runState = await readProjectRunState(project);
      const nextRunState = applyRunStateInvalidationForContentChange({ runState, updates });
      if (nextRunState) {
        await writeProjectRunState(project, nextRunState);
        await writeProjectArtifacts(project, nextRunState.artifacts || {});
      }

      await syncProjectSnapshotFn({
        project,
        projectDir: getProjectDir(project)
      });

      const backend = getProjectMetadataBackend();
      const details = await backend.getProject(project);
      res.json({
        project,
        updated: {
          story: updates.story !== undefined,
          script: updates.script !== undefined,
          shots: updates.shots !== undefined,
          tone: updates.tone !== undefined
        },
        details
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/:project/regenerate', async (req, res) => {
    try {
      const project = resolveProjectName(req.params.project);
      const existingActiveJob = findActiveJobByProjectFn(project);
      if (existingActiveJob) {
        res.status(409).json({
          error: `project already has an active job (${existingActiveJob.id})`,
          jobId: existingActiveJob.id,
          status: existingActiveJob.status
        });
        return;
      }

      const {
        forceRestart,
        targetType,
        index
      } = req.body || {};

      const hasTargetType = targetType !== undefined;
      const hasIndex = index !== undefined;
      const normalizedTargetType = String(targetType || '').trim().toLowerCase();

      if (!hasTargetType && hasIndex) {
        res.status(400).json({ error: 'targetType is required when index is provided' });
        return;
      }

      if (hasTargetType) {
        if (forceRestart !== undefined) {
          res.status(400).json({ error: 'forceRestart is not supported for targeted regeneration' });
          return;
        }

        const targetRequiresIndex = normalizedTargetType === 'keyframe' || normalizedTargetType === 'segment';
        if (targetRequiresIndex && !hasIndex) {
          res.status(400).json({ error: 'index is required for keyframe/segment targeted regeneration' });
          return;
        }

        if ((normalizedTargetType === 'voiceover' || normalizedTargetType === 'script') && hasIndex) {
          res.status(400).json({ error: 'index is not supported for script/voiceover targeted regeneration' });
          return;
        }

        const targeted = await regenerateProjectAssetFn(project, {
          targetType: normalizedTargetType,
          ...(hasIndex ? { index } : {})
        });

        res.json({
          project,
          targetType: targeted.targetType,
          ...(targeted.index !== undefined ? { index: targeted.index } : {}),
          updatedAt: targeted.updatedAt,
          steps: targeted.steps
        });
        return;
      }

      if (forceRestart !== undefined && typeof forceRestart !== 'boolean') {
        res.status(400).json({ error: 'forceRestart must be a boolean when provided' });
        return;
      }

      const story = await readProjectStory(project);
      const job = createJobFn({ story, project });
      setImmediate(() => runPipelineFn(job.id, { forceRestart: Boolean(forceRestart) }));

      res.status(202).json({
        jobId: job.id,
        status: job.status,
        project,
        forceRestart: Boolean(forceRestart)
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
