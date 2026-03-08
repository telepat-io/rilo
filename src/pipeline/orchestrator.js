import { preprocessStory } from './inputSanitizer.js';
import { generateScript, generateShots } from '../steps/script.js';
import {
  buildFixedTimeline,
  generateVoiceover,
  persistVoiceover,
  resolveSegmentCountFromAudioDuration
} from '../steps/generateVoiceover.js';
import { generateKeyframe, persistKeyframe, persistKeyframes } from '../steps/generateKeyframes.js';
import {
  generateVideoSegmentAtIndex,
  persistSegment,
  persistSegments
} from '../steps/generateVideoSegments.js';
import { composeFinalVideo } from '../steps/composeFinalVideo.js';
import { alignSubtitlesToVideo } from '../steps/alignSubtitles.js';
import { burnInSubtitles } from '../steps/burnInSubtitles.js';
import { JobStatus, JobStep, emptyStepState } from '../types/job.js';
import { logError, logInfo } from '../observability/logger.js';
import { persistArtifacts } from '../store/assetStore.js';
import {
  acquireProjectRunLock,
  getJob,
  getProjectRunLockOwner,
  releaseProjectRunLock,
  updateJob
} from '../store/jobStore.js';
import {
  DEFAULT_VIDEO_CONFIG,
  MODEL_CATEGORIES,
  resolveKeyframeSize,
  resolveProjectModelOptions,
  resolveProjectModelSelections,
  resolveShotCount,
  resolveTargetDurationSec
} from '../config/models.js';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { ensureDir, writeJson } from '../media/files.js';
import { probeMediaDurationSeconds } from '../media/ffmpeg.js';
import {
  ensureProject,
  readProjectConfig,
  getProjectDir,
  readProjectRunState,
  resolveProjectName,
  writeProjectRunState
} from '../store/projectStore.js';
import { archiveProjectAssets } from '../store/staleAssetStore.js';
import { syncProjectSnapshot } from '../backends/outputBackend.js';
import {
  collectRunPredictions,
  createRunId,
  createRunRecord,
  finalizeRunRecord,
  markStageFinished,
  markStageReused,
  markStageStarted,
  writeRunRecord
} from '../store/projectAnalyticsStore.js';

const DEFAULT_ORCHESTRATOR_DEPS = {
  preprocessStory,
  generateScript,
  generateShots,
  buildFixedTimeline,
  generateVoiceover,
  persistVoiceover,
  resolveSegmentCountFromAudioDuration,
  generateKeyframe,
  persistKeyframe,
  persistKeyframes,
  generateVideoSegmentAtIndex,
  persistSegment,
  persistSegments,
  composeFinalVideo,
  alignSubtitlesToVideo,
  burnInSubtitles,
  persistArtifacts,
  probeMediaDurationSeconds,
  ensureProject,
  readProjectConfig,
  getProjectDir,
  readProjectRunState,
  resolveProjectName,
  writeProjectRunState,
  archiveProjectAssets,
  syncProjectSnapshot,
  collectRunPredictions,
  createRunId,
  createRunRecord,
  finalizeRunRecord,
  markStageFinished,
  markStageReused,
  markStageStarted,
  writeRunRecord
};

async function persistCheckpoint(job, projectDir = null, deps = DEFAULT_ORCHESTRATOR_DEPS) {
  const resolvedProjectDir = projectDir || getProjectDir(job.payload.project);

  await deps.persistArtifacts(job.payload.project, job.artifacts);
  await deps.writeProjectRunState(job.payload.project, {
    status: job.status,
    error: job.error,
    steps: job.steps,
    artifacts: job.artifacts,
    updatedAt: job.updatedAt
  });

  await deps.syncProjectSnapshot({
    project: job.payload.project,
    projectDir: resolvedProjectDir
  });
}

async function persistTextAssets(projectDir, script, shots, tone) {
  const textDir = path.join(projectDir, 'assets', 'text');
  await ensureDir(textDir);
  await writeJson(path.join(textDir, 'script.json'), {
    script,
    shots,
    tone
  });
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function hashShots(shots) {
  return (shots || []).map((shot) => hashText(shot));
}

function findChangedShotIndexes(previousHashes, nextHashes) {
  const changed = [];
  const maxLength = Math.max(previousHashes.length, nextHashes.length);
  for (let i = 0; i < maxLength; i += 1) {
    if ((previousHashes[i] || '') !== (nextHashes[i] || '')) {
      changed.push(i);
    }
  }
  return changed;
}

function collectAffectedSegmentIndexes(changedShotIndexes, totalKeyframes) {
  const affected = new Set();
  for (const shotIndex of changedShotIndexes) {
    if (shotIndex > 0) {
      affected.add(shotIndex - 1);
    }
    if (shotIndex < totalKeyframes - 1) {
      affected.add(shotIndex);
    }
  }
  return affected;
}

function clearSubtitleArtifacts(artifacts) {
  return {
    ...artifacts,
    subtitleSeedPath: '',
    subtitleAlignedSrtPath: '',
    subtitleAssPath: '',
    finalCaptionedVideoPath: '',
    subtitlesUrl: ''
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readScriptAsset(projectDir) {
  try {
    const filePath = path.join(projectDir, 'assets', 'text', 'script.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (!parsed.script || typeof parsed.script !== 'string') {
      return null;
    }
    return {
      ...parsed,
      shots: Array.isArray(parsed.shots) ? parsed.shots : []
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function regenerateProjectAsset(projectName, target, options = {}) {
  const deps = {
    ...DEFAULT_ORCHESTRATOR_DEPS,
    ...(options.deps || {})
  };

  const project = deps.resolveProjectName(projectName);
  const targetType = String(target?.targetType || '').trim().toLowerCase();
  const hasIndex = target?.index !== undefined;
  const index = hasIndex ? Number(target?.index) : null;

  if (!['script', 'voiceover', 'keyframe', 'segment', 'align', 'burnin'].includes(targetType)) {
    throw new Error('targetType must be one of script, voiceover, keyframe, segment, align, burnin');
  }

  if (['script', 'voiceover', 'align', 'burnin'].includes(targetType) && hasIndex) {
    throw new Error('index is not supported for script/voiceover/align/burnin regeneration');
  }

  if (['keyframe', 'segment'].includes(targetType) && (!Number.isInteger(index) || index < 0)) {
    throw new Error('index must be a non-negative integer');
  }

  await deps.ensureProject(project);
  const projectConfig = await deps.readProjectConfig(project);
  const modelSelections = resolveProjectModelSelections(projectConfig.models);
  const modelOptions = resolveProjectModelOptions(projectConfig.modelOptions, modelSelections);
  const projectDir = deps.getProjectDir(project);
  const runState = await deps.readProjectRunState(project);

  if (!runState?.artifacts) {
    throw new Error('project has no prior artifacts to regenerate from');
  }

  const artifacts = {
    ...runState.artifacts,
    modelSelections,
    modelOptions,
    subtitleOptions: projectConfig.subtitleOptions,
    keyframeUrls: [...(runState.artifacts.keyframeUrls || [])],
    keyframePaths: [...(runState.artifacts.keyframePaths || [])],
    segmentUrls: [...(runState.artifacts.segmentUrls || [])],
    segmentPaths: [...(runState.artifacts.segmentPaths || [])]
  };
  const steps = {
    ...emptyStepState(),
    ...(runState.steps || {})
  };
  const keyframeCount = Array.isArray(artifacts.shots) ? artifacts.shots.length : 0;
  const segmentCount = Math.max(0, keyframeCount - 1);

  if (['voiceover', 'keyframe', 'segment'].includes(targetType)) {
    if (!Array.isArray(artifacts.shots) || artifacts.shots.length === 0) {
      throw new Error('project has no shots to regenerate');
    }

    if (targetType === 'keyframe' && index >= keyframeCount) {
      throw new Error(`index out of range for project keyframes (${keyframeCount})`);
    }

    if (targetType === 'segment' && index >= segmentCount) {
      throw new Error(`index out of range for project segments (${segmentCount})`);
    }
  }

  const traceBase = {
    project,
    projectDir,
    reason: 'targeted_asset_regeneration',
    targetType,
    ...((targetType === 'keyframe' || targetType === 'segment') ? { index } : {})
  };

  if (targetType === 'script') {
    const story = await deps.readProjectStory(project);
    const safeStory = deps.preprocessStory(story);
    const scriptResult = await deps.generateScript(
      safeStory,
      {
        targetDurationSec: resolveTargetDurationSec(projectConfig),
        modelId: modelSelections[MODEL_CATEGORIES.textToText],
        modelOptions: modelOptions[MODEL_CATEGORIES.textToText]
      },
      traceBase
    );

    artifacts.script = scriptResult.script;
    artifacts.tone = scriptResult.tone || artifacts.tone || 'neutral';
    artifacts.scriptWordCount = scriptResult.scriptWordCount || null;
    artifacts.targetWordCount = scriptResult.targetWordCount || null;
    artifacts.scriptHash = hashText(scriptResult.script);
    artifacts.scriptSourceStoryHash = hashText(safeStory);
    artifacts.shots = [];
    artifacts.shotHashes = [];
    artifacts.timeline = [];
    artifacts.voiceoverUrl = '';
    artifacts.voiceoverPath = '';
    artifacts.keyframeUrls = [];
    artifacts.keyframePaths = [];
    artifacts.segmentUrls = [];
    artifacts.segmentPaths = [];
    artifacts.finalBaseVideoPath = '';
    artifacts.finalVideoPath = '';
    Object.assign(artifacts, clearSubtitleArtifacts(artifacts));

    steps[JobStep.SCRIPT] = true;
    steps[JobStep.VOICE] = false;
    steps[JobStep.KEYFRAMES] = false;
    steps[JobStep.SEGMENTS] = false;
    steps[JobStep.COMPOSE] = false;
    steps[JobStep.ALIGN] = false;
    steps[JobStep.BURNIN] = false;

    await persistTextAssets(projectDir, artifacts.script, artifacts.shots, artifacts.tone || 'neutral');
  }

  if (targetType === 'voiceover') {
    if (!artifacts.script) {
      throw new Error('project has no script to regenerate voiceover from');
    }

    const previousAudioDurationSec = Number.isFinite(artifacts.audioDurationSec)
      ? artifacts.audioDurationSec
      : null;
    const previousSegmentCount = Array.isArray(artifacts.timeline)
      ? artifacts.timeline.length
      : Math.max(0, artifacts.shots.length - 1);

    const voiceResult = await deps.generateVoiceover(
      artifacts.script,
      {
        shotsCount: Math.max(1, artifacts.shots.length - 1),
        segmentDurationSec: DEFAULT_VIDEO_CONFIG.segmentDurationSec,
        targetDurationSec: resolveTargetDurationSec(projectConfig),
        modelId: modelSelections[MODEL_CATEGORIES.textToSpeech],
        modelOptions: modelOptions[MODEL_CATEGORIES.textToSpeech]
      },
      traceBase
    );

    artifacts.voiceoverUrl = voiceResult.voiceoverUrl;
    artifacts.voiceoverPath = await deps.persistVoiceover(projectDir, voiceResult.voiceoverUrl);
    artifacts.ttsPlan = voiceResult.ttsPlan;

    const audioDurationSec = await deps.probeMediaDurationSeconds(artifacts.voiceoverPath);
    const requiredSegments = deps.resolveSegmentCountFromAudioDuration(
      audioDurationSec,
      DEFAULT_VIDEO_CONFIG.segmentDurationSec
    );
    const requiredKeyframes = Math.max(2, requiredSegments + 1);
    const timeline = deps.buildFixedTimeline(requiredSegments, DEFAULT_VIDEO_CONFIG.segmentDurationSec);
    artifacts.audioDurationSec = audioDurationSec;
    artifacts.plannedShots = requiredSegments;
    artifacts.segmentDurationSec = DEFAULT_VIDEO_CONFIG.segmentDurationSec;
    artifacts.timeline = timeline;

    const sameAudioDuration =
      previousAudioDurationSec !== null
      && Math.abs(previousAudioDurationSec - audioDurationSec) <= 0.05;
    const sameVisualLength = requiredSegments === previousSegmentCount;

    if (!Array.isArray(artifacts.shots) || artifacts.shots.length !== requiredKeyframes) {
      const shotsResult = await deps.generateShots(
        artifacts.script,
        {
          shotCount: requiredKeyframes,
          tone: artifacts.tone || 'neutral',
          modelId: modelSelections[MODEL_CATEGORIES.textToText],
          modelOptions: modelOptions[MODEL_CATEGORIES.textToText]
        },
        traceBase
      );
      artifacts.shots = shotsResult.shots;
      artifacts.shotHashes = hashShots(shotsResult.shots);
      artifacts.keyframeUrls = [];
      artifacts.keyframePaths = [];
      artifacts.segmentUrls = [];
      artifacts.segmentPaths = [];
      await persistTextAssets(projectDir, artifacts.script, artifacts.shots, artifacts.tone || 'neutral');
      steps[JobStep.KEYFRAMES] = false;
      steps[JobStep.SEGMENTS] = false;
      steps[JobStep.COMPOSE] = false;
      steps[JobStep.ALIGN] = false;
      steps[JobStep.BURNIN] = false;
      artifacts.finalBaseVideoPath = '';
      artifacts.finalVideoPath = '';
      Object.assign(artifacts, clearSubtitleArtifacts(artifacts));
    }

    steps[JobStep.VOICE] = true;

    const canComposeWithExistingVisuals =
      Array.isArray(artifacts.segmentUrls)
      && artifacts.segmentUrls.length === requiredSegments
      && artifacts.segmentUrls.every((url) => Boolean(url));

    if (sameAudioDuration && sameVisualLength && canComposeWithExistingVisuals) {
      const composed = await deps.composeFinalVideo({
        projectDir,
        segmentUrls: artifacts.segmentUrls,
        segmentPaths: artifacts.segmentPaths,
        voiceoverPath: artifacts.voiceoverPath,
        voiceoverUrl: artifacts.voiceoverUrl,
        keyframePaths: artifacts.keyframePaths,
        finalDurationMode: projectConfig.finalDurationMode
      });

      artifacts.finalVideoPath = composed.finalVideoPath;
      artifacts.finalBaseVideoPath = composed.finalVideoPath;
      artifacts.voiceoverPath = composed.voiceoverPath;
      artifacts.keyframePaths = composed.keyframePaths;
      artifacts.segmentPaths = composed.segmentPaths;
      steps[JobStep.COMPOSE] = true;
      steps[JobStep.ALIGN] = false;
      steps[JobStep.BURNIN] = false;
      Object.assign(artifacts, clearSubtitleArtifacts(artifacts));
    } else {
      steps[JobStep.COMPOSE] = false;
      steps[JobStep.ALIGN] = false;
      steps[JobStep.BURNIN] = false;
      artifacts.finalBaseVideoPath = '';
      artifacts.finalVideoPath = '';
      Object.assign(artifacts, clearSubtitleArtifacts(artifacts));
    }
  }

  if (targetType === 'keyframe') {
    const keyframeSize = resolveKeyframeSize(projectConfig);
    const keyframeUrl = await deps.generateKeyframe(
      artifacts.shots[index],
      artifacts.tone || 'neutral',
      projectConfig.aspectRatio,
      index,
      traceBase,
      keyframeSize,
      {
        modelId: modelSelections[MODEL_CATEGORIES.textToImage],
        modelOptions: modelOptions[MODEL_CATEGORIES.textToImage]
      }
    );
    artifacts.keyframeUrls[index] = keyframeUrl;
    artifacts.keyframePaths[index] = await deps.persistKeyframe(projectDir, keyframeUrl, index);

    const affectedSegmentIndexes = collectAffectedSegmentIndexes([index], artifacts.shots.length);
    const maxSegmentIndex = Math.max(0, artifacts.shots.length - 1);
    for (const segmentIndex of affectedSegmentIndexes) {
      if (segmentIndex < 0 || segmentIndex >= maxSegmentIndex) {
        continue;
      }
      artifacts.segmentUrls[segmentIndex] = '';
      artifacts.segmentPaths[segmentIndex] = '';
    }

    steps[JobStep.SEGMENTS] = false;
    steps[JobStep.COMPOSE] = false;
    steps[JobStep.ALIGN] = false;
    steps[JobStep.BURNIN] = false;
    artifacts.finalBaseVideoPath = '';
    artifacts.finalVideoPath = '';
    Object.assign(artifacts, clearSubtitleArtifacts(artifacts));
  }

  if (targetType === 'segment') {
    if (!Array.isArray(artifacts.timeline) || artifacts.timeline.length === 0) {
      throw new Error('project has no timeline to regenerate segment from');
    }

    if (!artifacts.keyframeUrls[index]) {
      throw new Error('missing keyframe URL required for segment regeneration');
    }

    const segmentUrl = await deps.generateVideoSegmentAtIndex(
      index,
      artifacts.keyframeUrls,
      artifacts.timeline,
      artifacts.shots,
      projectConfig.aspectRatio,
      traceBase,
      {
        modelId: modelSelections[MODEL_CATEGORIES.imageTextToVideo],
        modelOptions: modelOptions[MODEL_CATEGORIES.imageTextToVideo]
      }
    );
    artifacts.segmentUrls[index] = segmentUrl;
    artifacts.segmentPaths[index] = await deps.persistSegment(projectDir, segmentUrl, index);

    steps[JobStep.COMPOSE] = false;
    steps[JobStep.ALIGN] = false;
    steps[JobStep.BURNIN] = false;
    artifacts.finalBaseVideoPath = '';
    artifacts.finalVideoPath = '';
    Object.assign(artifacts, clearSubtitleArtifacts(artifacts));
  }

  if (targetType === 'align') {
    const baseVideoPath = artifacts.finalBaseVideoPath || artifacts.finalVideoPath;
    if (!baseVideoPath) {
      throw new Error('project has no composed video to align subtitles against');
    }

    if (!artifacts.script || !String(artifacts.script).trim()) {
      throw new Error('project has no script to align subtitles from');
    }

    const aligned = await deps.alignSubtitlesToVideo({
      projectDir,
      videoPath: baseVideoPath,
      script: artifacts.script,
      totalDurationSec: artifacts.audioDurationSec || resolveTargetDurationSec(projectConfig),
      subtitleOptions: projectConfig.subtitleOptions
    });

    artifacts.subtitleSeedPath = aligned.subtitleSeedPath;
    artifacts.subtitleAlignedSrtPath = aligned.subtitleAlignedSrtPath;
    artifacts.subtitleAssPath = aligned.subtitleAssPath;
    artifacts.finalBaseVideoPath = baseVideoPath;
    artifacts.finalCaptionedVideoPath = '';
    artifacts.finalVideoPath = baseVideoPath;
    steps[JobStep.ALIGN] = true;
    steps[JobStep.BURNIN] = false;
  }

  if (targetType === 'burnin') {
    const baseVideoPath = artifacts.finalBaseVideoPath || artifacts.finalVideoPath;
    if (!baseVideoPath) {
      throw new Error('project has no composed video to burn subtitles into');
    }

    if (!artifacts.subtitleAssPath) {
      throw new Error('project has no aligned subtitle file; run align first');
    }

    const burned = await deps.burnInSubtitles({
      projectDir,
      videoPath: baseVideoPath,
      subtitleAssPath: artifacts.subtitleAssPath
    });

    artifacts.finalBaseVideoPath = baseVideoPath;
    artifacts.finalCaptionedVideoPath = burned.finalCaptionedVideoPath;
    artifacts.finalVideoPath = burned.finalCaptionedVideoPath;
    steps[JobStep.BURNIN] = true;
    steps[JobStep.ALIGN] = true;
  }

  const updatedAt = new Date().toISOString();
  await deps.persistArtifacts(project, artifacts);
  await deps.writeProjectRunState(project, {
    status: runState.status || JobStatus.COMPLETED,
    error: runState.error || null,
    steps,
    artifacts,
    updatedAt
  });

  await deps.syncProjectSnapshot({ project, projectDir });

  return {
    project,
    targetType,
    ...((targetType === 'keyframe' || targetType === 'segment') ? { index } : {}),
    artifacts,
    steps,
    updatedAt
  };
}

export async function runPipeline(jobId, options = {}) {
  const deps = {
    ...DEFAULT_ORCHESTRATOR_DEPS,
    ...(options.deps || {})
  };

  const forceRestart = Boolean(options.forceRestart);
  const job = getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  let analyticsProject = null;
  let analyticsProjectDir = null;
  let analyticsRun = null;
  let lockedProject = null;

  try {
    const project = deps.resolveProjectName(job.payload.project || `job-${jobId}`);
    const lockAcquired = acquireProjectRunLock(project, jobId);
    if (!lockAcquired) {
      const ownerJobId = getProjectRunLockOwner(project);
      const ownerSuffix = ownerJobId ? ` (owner job: ${ownerJobId})` : '';
      const lockError = new Error(`Project ${project} is already running${ownerSuffix}`);
      lockError.nonRetryable = true;
      throw lockError;
    }

    lockedProject = project;
    analyticsProject = project;
    await deps.ensureProject(project);
    const projectConfig = await deps.readProjectConfig(project);
    const modelSelections = resolveProjectModelSelections(projectConfig.models);
    const modelOptions = resolveProjectModelOptions(projectConfig.modelOptions, modelSelections);
    const projectDir = deps.getProjectDir(project);
    const targetDurationSec = resolveTargetDurationSec(projectConfig);
    const plannedShots = resolveShotCount(projectConfig);
    const safeStory = deps.preprocessStory(job.payload.story);
    analyticsProjectDir = projectDir;
    const analyticsRunId = deps.createRunId();
    analyticsRun = deps.createRunRecord({
      runId: analyticsRunId,
      project,
      jobId,
      forceRestart
    });
    await deps.writeRunRecord(project, analyticsRun);

    const saveAnalytics = async () => {
      /* c8 ignore next 3 */
      if (!analyticsRun || !analyticsProject) {
        return;
      }
      await deps.writeRunRecord(analyticsProject, analyticsRun);
    };

    const startStageAnalytics = async (stage, details = null) => {
      analyticsRun = deps.markStageStarted(analyticsRun, stage, details);
      await saveAnalytics();
    };

    const finishStageAnalytics = async (stage, payload = {}) => {
      analyticsRun = deps.markStageFinished(analyticsRun, stage, payload);
      await saveAnalytics();
    };

    const reuseStageAnalytics = async (stage, details = null) => {
      if (analyticsRun?.stages?.[stage]?.executed) {
        return;
      }
      analyticsRun = deps.markStageReused(analyticsRun, stage, details);
      await saveAnalytics();
    };

    const keyframeSize = resolveKeyframeSize(projectConfig);

    const previous = forceRestart ? null : await deps.readProjectRunState(project);
    const resumeState = previous || null;

    const seedArtifacts = resumeState?.artifacts || job.artifacts;
    const seedSteps = resumeState?.steps || emptyStepState();
    const traceBase = {
      project,
      projectDir,
      jobId,
      runId: analyticsRunId
    };

    const alignVisualPlanToAudioDuration = async () => {
      let alignedJob = getJob(jobId);
      const segmentDurationSec = DEFAULT_VIDEO_CONFIG.segmentDurationSec;

      if (!alignedJob?.artifacts?.voiceoverPath) {
        return alignedJob;
      }

      let audioDurationSec;
      try {
        audioDurationSec = await deps.probeMediaDurationSeconds(alignedJob.artifacts.voiceoverPath);
      } catch (error) {
        logInfo('voiceover_duration_probe_failed', {
          jobId,
          project,
          voiceoverPath: alignedJob.artifacts.voiceoverPath,
          error: error.message
        });
        return alignedJob;
      }

      const requiredSegments = deps.resolveSegmentCountFromAudioDuration(audioDurationSec, segmentDurationSec);
      const requiredKeyframes = Math.max(2, requiredSegments + 1);
      let alignedShots = Array.isArray(alignedJob.artifacts.shots) ? alignedJob.artifacts.shots : [];
      const alignedTimeline = deps.buildFixedTimeline(requiredSegments, segmentDurationSec);

      if (alignedShots.length !== requiredKeyframes) {
        const shotsResult = await deps.generateShots(
          alignedJob.artifacts.script,
          {
            shotCount: requiredKeyframes,
            tone: alignedJob.artifacts.tone || 'neutral',
            modelId: modelSelections[MODEL_CATEGORIES.textToText],
            modelOptions: modelOptions[MODEL_CATEGORIES.textToText]
          },
          traceBase
        );
        alignedShots = shotsResult.shots;
      }

      const shotsChanged = JSON.stringify(alignedShots) !== JSON.stringify(alignedJob.artifacts.shots || []);
      const timelineChanged = JSON.stringify(alignedTimeline) !== JSON.stringify(alignedJob.artifacts.timeline || []);
      const durationChanged =
        !Number.isFinite(alignedJob.artifacts.audioDurationSec) ||
        Math.abs(alignedJob.artifacts.audioDurationSec - audioDurationSec) > 0.01;

      if (!shotsChanged && !timelineChanged && !durationChanged) {
        return alignedJob;
      }

      const nextArtifacts = {
        ...alignedJob.artifacts,
        audioDurationSec,
        plannedShots: requiredSegments,
        segmentDurationSec,
        shots: alignedShots,
        shotHashes: hashShots(alignedShots),
        timeline: alignedTimeline
      };

      const nextSteps = {
        ...alignedJob.steps
      };

      if (shotsChanged) {
        nextSteps[JobStep.KEYFRAMES] = false;
        nextSteps[JobStep.SEGMENTS] = false;
        nextSteps[JobStep.COMPOSE] = false;
        nextSteps[JobStep.ALIGN] = false;
        nextSteps[JobStep.BURNIN] = false;
        nextArtifacts.keyframeUrls = [];
        nextArtifacts.keyframePaths = [];
        nextArtifacts.segmentUrls = [];
        nextArtifacts.segmentPaths = [];
        nextArtifacts.finalBaseVideoPath = '';
        nextArtifacts.finalVideoPath = '';
        Object.assign(nextArtifacts, clearSubtitleArtifacts(nextArtifacts));
      } else if (timelineChanged) {
        nextSteps[JobStep.SEGMENTS] = false;
        nextSteps[JobStep.COMPOSE] = false;
        nextSteps[JobStep.ALIGN] = false;
        nextSteps[JobStep.BURNIN] = false;
        nextArtifacts.segmentUrls = [];
        nextArtifacts.segmentPaths = [];
        nextArtifacts.finalBaseVideoPath = '';
        nextArtifacts.finalVideoPath = '';
        Object.assign(nextArtifacts, clearSubtitleArtifacts(nextArtifacts));
      }

      if (shotsChanged) {
        await persistTextAssets(
          projectDir,
          nextArtifacts.script || '',
          alignedShots,
          nextArtifacts.tone || 'neutral'
        );
      }

      updateJob(jobId, {
        artifacts: nextArtifacts,
        steps: nextSteps
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      alignedJob = getJob(jobId);
      return alignedJob;
    };

    const storyHash = hashText(safeStory);
    const scriptAsset = await readScriptAsset(projectDir);
    const scriptSourceStoryHash = seedArtifacts.scriptSourceStoryHash || '';
    const hasLegacyState = !seedArtifacts.scriptSourceStoryHash && !!seedArtifacts.script;

    if (hasLegacyState || (scriptSourceStoryHash && scriptSourceStoryHash !== storyHash)) {
      seedSteps[JobStep.SCRIPT] = false;
      seedSteps[JobStep.VOICE] = false;
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.script = '';
      seedArtifacts.tone = '';
      seedArtifacts.shots = [];
      seedArtifacts.timeline = [];
      seedArtifacts.voiceoverUrl = '';
      seedArtifacts.voiceoverPath = '';
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
      seedArtifacts.scriptHash = '';
      seedArtifacts.shotHashes = [];
      seedArtifacts.scriptSourceStoryHash = '';
    }

    if (
      scriptAsset &&
      seedArtifacts.scriptHash &&
      hashText(scriptAsset.script) !== seedArtifacts.scriptHash
    ) {
      seedArtifacts.script = scriptAsset.script;
      seedArtifacts.scriptHash = hashText(scriptAsset.script);
      seedSteps[JobStep.VOICE] = false;
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.shots = [];
      seedArtifacts.shotHashes = [];
      seedArtifacts.timeline = [];
      seedArtifacts.voiceoverUrl = '';
      seedArtifacts.voiceoverPath = '';
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    const shotHashesFromAsset = scriptAsset ? hashShots(scriptAsset.shots) : [];
    const changedShotIndexes =
      scriptAsset && seedArtifacts.shotHashes?.length
        ? findChangedShotIndexes(seedArtifacts.shotHashes, shotHashesFromAsset)
        : [];

    if (scriptAsset && changedShotIndexes.length > 0) {
      seedArtifacts.shots = scriptAsset.shots;
      seedArtifacts.shotHashes = shotHashesFromAsset;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    if (seedArtifacts.aspectRatio && seedArtifacts.aspectRatio !== projectConfig.aspectRatio) {
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    if ((seedArtifacts.finalDurationMode || 'match_audio') !== projectConfig.finalDurationMode) {
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    const previousTargetDuration = Number.isInteger(seedArtifacts.targetDurationSec)
      ? seedArtifacts.targetDurationSec
      : DEFAULT_VIDEO_CONFIG.durationSec;
    const previousModelSelections = resolveProjectModelSelections(seedArtifacts.modelSelections);
    const previousModelOptions = resolveProjectModelOptions(seedArtifacts.modelOptions, previousModelSelections);
    const changedModelOptionCategories = Object.values(MODEL_CATEGORIES).filter(
      (category) => JSON.stringify(previousModelOptions[category]) !== JSON.stringify(modelOptions[category])
    );

    const resetFromScript = () => {
      seedSteps[JobStep.SCRIPT] = false;
      seedSteps[JobStep.VOICE] = false;
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.script = '';
      seedArtifacts.tone = '';
      seedArtifacts.shots = [];
      seedArtifacts.timeline = [];
      seedArtifacts.voiceoverUrl = '';
      seedArtifacts.voiceoverPath = '';
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
      seedArtifacts.scriptHash = '';
      seedArtifacts.shotHashes = [];
      seedArtifacts.scriptSourceStoryHash = '';
    };

    const resetFromVoice = () => {
      seedSteps[JobStep.VOICE] = false;
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.timeline = [];
      seedArtifacts.voiceoverUrl = '';
      seedArtifacts.voiceoverPath = '';
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    };

    const resetFromKeyframes = () => {
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    };

    const resetFromSegments = () => {
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    };

    if (previousTargetDuration !== targetDurationSec) {
      resetFromScript();
    }

    if (JSON.stringify(previousModelSelections) !== JSON.stringify(modelSelections)) {
      resetFromScript();
    }

    if (changedModelOptionCategories.length > 1) {
      resetFromScript();
    } else if (changedModelOptionCategories[0] === MODEL_CATEGORIES.textToText) {
      resetFromScript();
    } else if (changedModelOptionCategories[0] === MODEL_CATEGORIES.textToSpeech) {
      resetFromVoice();
    } else if (changedModelOptionCategories[0] === MODEL_CATEGORIES.textToImage) {
      resetFromKeyframes();
    } else if (changedModelOptionCategories[0] === MODEL_CATEGORIES.imageTextToVideo) {
      resetFromSegments();
    }

    if (
      (seedArtifacts.keyframeSizeKey && seedArtifacts.keyframeSizeKey !== keyframeSize.key) ||
      (!seedArtifacts.keyframeSizeKey && Number.isInteger(projectConfig.keyframeWidth) && Number.isInteger(projectConfig.keyframeHeight))
    ) {
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    if ((seedArtifacts.renderSpecVersion || 0) !== DEFAULT_VIDEO_CONFIG.renderSpecVersion) {
      seedSteps[JobStep.KEYFRAMES] = false;
      seedSteps[JobStep.SEGMENTS] = false;
      seedSteps[JobStep.COMPOSE] = false;
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      seedArtifacts.keyframeUrls = [];
      seedArtifacts.keyframePaths = [];
      seedArtifacts.segmentUrls = [];
      seedArtifacts.segmentPaths = [];
      seedArtifacts.finalBaseVideoPath = '';
      seedArtifacts.finalVideoPath = '';
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    if (JSON.stringify(seedArtifacts.subtitleOptions || {}) !== JSON.stringify(projectConfig.subtitleOptions || {})) {
      seedSteps[JobStep.ALIGN] = false;
      seedSteps[JobStep.BURNIN] = false;
      Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
    }

    const shouldArchiveCurrentAssets =
      forceRestart ||
      !seedSteps[JobStep.SCRIPT] ||
      !seedSteps[JobStep.VOICE] ||
      !seedSteps[JobStep.KEYFRAMES] ||
      !seedSteps[JobStep.SEGMENTS];

    if (shouldArchiveCurrentAssets) {
      const archivedSnapshot = await deps.archiveProjectAssets(projectDir);
      if (archivedSnapshot) {
        seedArtifacts.voiceoverPath = '';
        seedArtifacts.keyframePaths = [];
        seedArtifacts.segmentPaths = [];
        seedArtifacts.finalBaseVideoPath = '';
        seedArtifacts.finalVideoPath = '';
        Object.assign(seedArtifacts, clearSubtitleArtifacts(seedArtifacts));
        logInfo('assets_archived_to_snapshots', { project, archivedSnapshot });
      }
    }

    updateJob(jobId, {
      payload: {
        ...job.payload,
        project,
        projectConfig,
        changedShotIndexes,
        activeSegmentIndex: null
      },
      status: JobStatus.RUNNING,
      error: null,
      artifacts: {
        ...seedArtifacts,
        modelSelections,
        modelOptions,
        renderSpecVersion: DEFAULT_VIDEO_CONFIG.renderSpecVersion,
        keyframeSizeKey: keyframeSize.key,
        aspectRatio: projectConfig.aspectRatio,
        finalDurationMode: projectConfig.finalDurationMode,
        subtitleOptions: projectConfig.subtitleOptions,
        targetDurationSec,
        segmentDurationSec: DEFAULT_VIDEO_CONFIG.segmentDurationSec,
        plannedShots
      },
      steps: seedSteps
    });

    await persistCheckpoint(getJob(jobId), null, deps);

    if (resumeState) {
      logInfo('job_resumed', { jobId, project, steps: resumeState.steps });
    }

    let currentJob = getJob(jobId);

    if (!currentJob.steps[JobStep.SCRIPT]) {
      await startStageAnalytics(JobStep.SCRIPT, { mode: 'execute' });
      const scriptResult = await deps.generateScript(
        safeStory,
        {
          targetDurationSec,
          modelId: modelSelections[MODEL_CATEGORIES.textToText],
          modelOptions: modelOptions[MODEL_CATEGORIES.textToText]
        },
        traceBase
      );
      await persistTextAssets(projectDir, scriptResult.script, [], scriptResult.tone);
      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          script: scriptResult.script,
          shots: [],
          tone: scriptResult.tone,
          scriptWordCount: scriptResult.scriptWordCount || null,
          targetWordCount: scriptResult.targetWordCount || null,
          storyHash,
          scriptSourceStoryHash: storyHash,
          targetDurationSec,
          segmentDurationSec: DEFAULT_VIDEO_CONFIG.segmentDurationSec,
          finalDurationMode: projectConfig.finalDurationMode,
          plannedShots,
          scriptHash: hashText(scriptResult.script),
          shotHashes: []
        },
        steps: {
          ...currentJob.steps,
          [JobStep.SCRIPT]: true
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await finishStageAnalytics(JobStep.SCRIPT, { executed: true, status: 'succeeded' });
      currentJob = getJob(jobId);
    } else if (currentJob.artifacts.script) {
      await persistTextAssets(
        projectDir,
        currentJob.artifacts.script,
        currentJob.artifacts.shots,
        currentJob.artifacts.tone || 'neutral'
      );

      const scriptHash = hashText(currentJob.artifacts.script);
      const shotHashes = hashShots(currentJob.artifacts.shots);
      if (scriptHash !== currentJob.artifacts.scriptHash || JSON.stringify(shotHashes) !== JSON.stringify(currentJob.artifacts.shotHashes || [])) {
        updateJob(jobId, {
          artifacts: {
            ...currentJob.artifacts,
            scriptHash,
            shotHashes
          }
        });
        await persistCheckpoint(getJob(jobId), null, deps);
        currentJob = getJob(jobId);
      }
      await reuseStageAnalytics(JobStep.SCRIPT, { mode: 'reused' });
    } else {
      await reuseStageAnalytics(JobStep.SCRIPT, { mode: 'reused' });
    }

    if (!currentJob.steps[JobStep.VOICE]) {
      await startStageAnalytics(JobStep.VOICE, { mode: 'execute' });
      const voiceResult = await deps.generateVoiceover(
        currentJob.artifacts.script,
        {
          shotsCount: Math.max(1, (currentJob.artifacts.shots.length || plannedShots) - 1),
          segmentDurationSec: DEFAULT_VIDEO_CONFIG.segmentDurationSec,
          targetDurationSec,
          modelId: modelSelections[MODEL_CATEGORIES.textToSpeech],
          modelOptions: modelOptions[MODEL_CATEGORIES.textToSpeech]
        },
        traceBase
      );
      const voiceoverPath = await deps.persistVoiceover(projectDir, voiceResult.voiceoverUrl);
      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          timeline: voiceResult.timeline,
          voiceoverUrl: voiceResult.voiceoverUrl,
          voiceoverPath,
          ttsPlan: voiceResult.ttsPlan || null
        },
        steps: {
          ...currentJob.steps,
          [JobStep.VOICE]: true
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await finishStageAnalytics(JobStep.VOICE, { executed: true, status: 'succeeded' });
      currentJob = getJob(jobId);
    } else if (currentJob.artifacts.voiceoverUrl && !currentJob.artifacts.voiceoverPath) {
      const voiceoverPath = await deps.persistVoiceover(projectDir, currentJob.artifacts.voiceoverUrl);
      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          voiceoverPath
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      currentJob = getJob(jobId);
      await reuseStageAnalytics(JobStep.VOICE, { mode: 'reused_with_repair' });
    } else {
      await reuseStageAnalytics(JobStep.VOICE, { mode: 'reused' });
    }

    currentJob = await alignVisualPlanToAudioDuration();

    if (currentJob.payload.changedShotIndexes?.length > 0 && currentJob.artifacts.keyframeUrls.length > 0) {
      await startStageAnalytics(JobStep.KEYFRAMES, { mode: 'partial_regen' });
      await startStageAnalytics(JobStep.SEGMENTS, { mode: 'partial_regen' });
      const changed = currentJob.payload.changedShotIndexes;
      const keyframeUrls = [...currentJob.artifacts.keyframeUrls];
      const keyframePaths = [...(currentJob.artifacts.keyframePaths || [])];

      updateJob(jobId, {
        payload: {
          ...currentJob.payload,
          activeStep: JobStep.KEYFRAMES,
          activeSegmentIndex: null
        }
      });
      currentJob = getJob(jobId);

      for (const shotIndex of changed) {
        if (shotIndex < 0 || shotIndex >= currentJob.artifacts.shots.length) {
          continue;
        }
        const keyframeUrl = await deps.generateKeyframe(
          currentJob.artifacts.shots[shotIndex],
          currentJob.artifacts.tone || 'neutral',
          projectConfig.aspectRatio,
          shotIndex,
          traceBase,
          keyframeSize,
          {
            modelId: modelSelections[MODEL_CATEGORIES.textToImage],
            modelOptions: modelOptions[MODEL_CATEGORIES.textToImage]
          }
        );
        keyframeUrls[shotIndex] = keyframeUrl;
        keyframePaths[shotIndex] = await deps.persistKeyframe(projectDir, keyframeUrl, shotIndex);
      }

      const totalShots = currentJob.artifacts.shots.length;
      const totalSegments = Math.max(0, totalShots - 1);
      const affectedSegmentIndexes = collectAffectedSegmentIndexes(changed, totalShots);

      // If assets were archived before this run, unchanged slots may still have URLs but no local files.
      for (let shotIndex = 0; shotIndex < totalShots; shotIndex += 1) {
        if (!keyframeUrls[shotIndex]) {
          continue;
        }

        const hasPath = Boolean(keyframePaths[shotIndex]);
        if (!hasPath) {
          keyframePaths[shotIndex] = await deps.persistKeyframe(projectDir, keyframeUrls[shotIndex], shotIndex);
        }
      }

      const segmentUrls = [...(currentJob.artifacts.segmentUrls || [])];
      const segmentPaths = [...(currentJob.artifacts.segmentPaths || [])];

      updateJob(jobId, {
        payload: {
          ...currentJob.payload,
          activeStep: JobStep.SEGMENTS,
          activeSegmentIndex: null
        }
      });
      currentJob = getJob(jobId);

      for (const segmentIndex of affectedSegmentIndexes) {
        if (segmentIndex < 0 || segmentIndex >= totalSegments) {
          continue;
        }
        updateJob(jobId, {
          payload: {
            ...getJob(jobId).payload,
            activeStep: JobStep.SEGMENTS,
            activeSegmentIndex: segmentIndex
          }
        });
        currentJob = getJob(jobId);
        const segmentUrl = await deps.generateVideoSegmentAtIndex(
          segmentIndex,
          keyframeUrls,
          currentJob.artifacts.timeline,
          currentJob.artifacts.shots,
          projectConfig.aspectRatio,
          traceBase,
          {
            modelId: modelSelections[MODEL_CATEGORIES.imageTextToVideo],
            modelOptions: modelOptions[MODEL_CATEGORIES.imageTextToVideo]
          }
        );
        segmentUrls[segmentIndex] = segmentUrl;
        segmentPaths[segmentIndex] = await deps.persistSegment(projectDir, segmentUrl, segmentIndex);
      }

      for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex += 1) {
        if (!segmentUrls[segmentIndex]) {
          continue;
        }

        const hasPath = Boolean(segmentPaths[segmentIndex]);
        if (!hasPath) {
          segmentPaths[segmentIndex] = await deps.persistSegment(projectDir, segmentUrls[segmentIndex], segmentIndex);
        }
      }

      updateJob(jobId, {
        payload: {
          ...currentJob.payload,
          changedShotIndexes: [],
          activeStep: null,
          activeSegmentIndex: null
        },
        artifacts: {
          ...currentJob.artifacts,
          keyframeUrls,
          keyframePaths,
          segmentUrls,
          segmentPaths,
          shotHashes: hashShots(currentJob.artifacts.shots),
          finalBaseVideoPath: '',
          finalVideoPath: ''
        },
        steps: {
          ...currentJob.steps,
          [JobStep.KEYFRAMES]: true,
          [JobStep.SEGMENTS]: true,
          [JobStep.COMPOSE]: false,
          [JobStep.ALIGN]: false,
          [JobStep.BURNIN]: false
        }
      });
      updateJob(jobId, {
        artifacts: clearSubtitleArtifacts(getJob(jobId).artifacts)
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await finishStageAnalytics(JobStep.KEYFRAMES, { executed: true, status: 'succeeded', details: { mode: 'partial_regen', changedShots: changed } });
      await finishStageAnalytics(JobStep.SEGMENTS, { executed: true, status: 'succeeded', details: { mode: 'partial_regen' } });
      currentJob = getJob(jobId);
    }

    if (!currentJob.steps[JobStep.KEYFRAMES]) {
      await startStageAnalytics(JobStep.KEYFRAMES, { mode: 'execute' });
      const keyframeUrls = [...(currentJob.artifacts.keyframeUrls || [])];
      const keyframePaths = [...(currentJob.artifacts.keyframePaths || [])];
      for (let shotIndex = 0; shotIndex < currentJob.artifacts.shots.length; shotIndex += 1) {
        const hasUrl = Boolean(keyframeUrls[shotIndex]);
        let hasPath = Boolean(keyframePaths[shotIndex]);

        if (hasPath && !(await fileExists(keyframePaths[shotIndex]))) {
          keyframePaths[shotIndex] = '';
          hasPath = false;
        }

        if (hasUrl && hasPath) {
          continue;
        }

        if (!hasUrl) {
          keyframeUrls[shotIndex] = await deps.generateKeyframe(
            currentJob.artifacts.shots[shotIndex],
            currentJob.artifacts.tone || 'neutral',
            projectConfig.aspectRatio,
            shotIndex,
            traceBase,
            keyframeSize,
            {
              modelId: modelSelections[MODEL_CATEGORIES.textToImage],
              modelOptions: modelOptions[MODEL_CATEGORIES.textToImage]
            }
          );
        }

        keyframePaths[shotIndex] = await deps.persistKeyframe(projectDir, keyframeUrls[shotIndex], shotIndex);

        updateJob(jobId, {
          artifacts: {
            ...currentJob.artifacts,
            keyframeUrls,
            keyframePaths
          }
        });
        await persistCheckpoint(getJob(jobId), null, deps);
        currentJob = getJob(jobId);
      }

      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          keyframeUrls,
          keyframePaths
        },
        steps: {
          ...currentJob.steps,
          [JobStep.KEYFRAMES]: true
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await finishStageAnalytics(JobStep.KEYFRAMES, { executed: true, status: 'succeeded' });
      currentJob = getJob(jobId);
    } else if (
      currentJob.artifacts.keyframeUrls.length > 0 &&
      (!currentJob.artifacts.keyframePaths || currentJob.artifacts.keyframePaths.length === 0)
    ) {
      const keyframePaths = await deps.persistKeyframes(projectDir, currentJob.artifacts.keyframeUrls);
      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          keyframePaths
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      currentJob = getJob(jobId);
      await reuseStageAnalytics(JobStep.KEYFRAMES, { mode: 'reused_with_repair' });
    } else {
      await reuseStageAnalytics(JobStep.KEYFRAMES, { mode: 'reused' });
    }

    if (!currentJob.steps[JobStep.SEGMENTS]) {
      await startStageAnalytics(JobStep.SEGMENTS, { mode: 'execute' });
      const segmentUrls = [...(currentJob.artifacts.segmentUrls || [])];
      const segmentPaths = [...(currentJob.artifacts.segmentPaths || [])];
      updateJob(jobId, {
        payload: {
          ...currentJob.payload,
          activeStep: JobStep.SEGMENTS,
          activeSegmentIndex: null
        }
      });
      currentJob = getJob(jobId);
      for (let segmentIndex = 0; segmentIndex < Math.max(0, currentJob.artifacts.shots.length - 1); segmentIndex += 1) {
        const hasUrl = Boolean(segmentUrls[segmentIndex]);
        let hasPath = Boolean(segmentPaths[segmentIndex]);

        if (hasPath && !(await fileExists(segmentPaths[segmentIndex]))) {
          segmentPaths[segmentIndex] = '';
          hasPath = false;
        }

        if (hasUrl && hasPath) {
          continue;
        }

        if (!hasUrl) {
          updateJob(jobId, {
            payload: {
              ...getJob(jobId).payload,
              activeStep: JobStep.SEGMENTS,
              activeSegmentIndex: segmentIndex
            }
          });
          currentJob = getJob(jobId);
          segmentUrls[segmentIndex] = await deps.generateVideoSegmentAtIndex(
            segmentIndex,
            currentJob.artifacts.keyframeUrls,
            currentJob.artifacts.timeline,
            currentJob.artifacts.shots,
            projectConfig.aspectRatio,
            traceBase,
            {
              modelId: modelSelections[MODEL_CATEGORIES.imageTextToVideo],
              modelOptions: modelOptions[MODEL_CATEGORIES.imageTextToVideo]
            }
          );
        }

        segmentPaths[segmentIndex] = await deps.persistSegment(projectDir, segmentUrls[segmentIndex], segmentIndex);

        updateJob(jobId, {
          artifacts: {
            ...currentJob.artifacts,
            segmentUrls,
            segmentPaths
          }
        });
        await persistCheckpoint(getJob(jobId), null, deps);
        currentJob = getJob(jobId);
      }

      updateJob(jobId, {
        payload: {
          ...currentJob.payload,
          activeStep: null,
          activeSegmentIndex: null
        },
        artifacts: {
          ...currentJob.artifacts,
          segmentUrls,
          segmentPaths
        },
        steps: {
          ...currentJob.steps,
          [JobStep.SEGMENTS]: true
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await finishStageAnalytics(JobStep.SEGMENTS, { executed: true, status: 'succeeded' });
      currentJob = getJob(jobId);
    } else if (
      currentJob.artifacts.segmentUrls.length > 0 &&
      (!currentJob.artifacts.segmentPaths || currentJob.artifacts.segmentPaths.length === 0)
    ) {
      const segmentPaths = await deps.persistSegments(projectDir, currentJob.artifacts.segmentUrls);
      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          segmentPaths
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      currentJob = getJob(jobId);
      await reuseStageAnalytics(JobStep.SEGMENTS, { mode: 'reused_with_repair' });
    } else {
      await reuseStageAnalytics(JobStep.SEGMENTS, { mode: 'reused' });
    }

    if (!currentJob.steps[JobStep.COMPOSE]) {
      await startStageAnalytics(JobStep.COMPOSE, { mode: 'execute' });
      const composed = await deps.composeFinalVideo({
        projectDir,
        segmentUrls: currentJob.artifacts.segmentUrls,
        segmentPaths: currentJob.artifacts.segmentPaths,
        voiceoverPath: currentJob.artifacts.voiceoverPath,
        voiceoverUrl: currentJob.artifacts.voiceoverUrl,
        keyframePaths: currentJob.artifacts.keyframePaths,
        finalDurationMode: projectConfig.finalDurationMode
      });

      updateJob(jobId, {
        artifacts: {
          ...currentJob.artifacts,
          finalBaseVideoPath: composed.finalVideoPath,
          finalVideoPath: composed.finalVideoPath,
          voiceoverPath: composed.voiceoverPath,
          keyframePaths: composed.keyframePaths,
          segmentPaths: composed.segmentPaths,
          scriptHash: hashText(currentJob.artifacts.script),
          shotHashes: hashShots(currentJob.artifacts.shots)
        },
        steps: {
          ...currentJob.steps,
          [JobStep.COMPOSE]: true,
          [JobStep.ALIGN]: false,
          [JobStep.BURNIN]: false
        }
      });
      updateJob(jobId, {
        artifacts: clearSubtitleArtifacts(getJob(jobId).artifacts)
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await finishStageAnalytics(JobStep.COMPOSE, { executed: true, status: 'succeeded' });
      currentJob = getJob(jobId);
    } else {
      if (!currentJob.artifacts.finalBaseVideoPath && currentJob.artifacts.finalVideoPath) {
        updateJob(jobId, {
          artifacts: {
            ...currentJob.artifacts,
            finalBaseVideoPath: currentJob.artifacts.finalVideoPath
          }
        });
        await persistCheckpoint(getJob(jobId), null, deps);
        currentJob = getJob(jobId);
      }
      await reuseStageAnalytics(JobStep.COMPOSE, { mode: 'reused' });
    }

    if (projectConfig.subtitleOptions?.enabled) {
      if (!currentJob.steps[JobStep.ALIGN]) {
        await startStageAnalytics(JobStep.ALIGN, { mode: 'execute' });
        const subtitleSourceVideo = currentJob.artifacts.finalBaseVideoPath || currentJob.artifacts.finalVideoPath;
        const durationForSubtitles = Number.isFinite(currentJob.artifacts.audioDurationSec)
          ? currentJob.artifacts.audioDurationSec
          : await deps.probeMediaDurationSeconds(subtitleSourceVideo);

        const aligned = await deps.alignSubtitlesToVideo({
          projectDir,
          videoPath: subtitleSourceVideo,
          script: currentJob.artifacts.script,
          totalDurationSec: durationForSubtitles,
          subtitleOptions: projectConfig.subtitleOptions
        });

        updateJob(jobId, {
          artifacts: {
            ...currentJob.artifacts,
            ...aligned
          },
          steps: {
            ...currentJob.steps,
            [JobStep.ALIGN]: true
          }
        });
        await persistCheckpoint(getJob(jobId), null, deps);
        await finishStageAnalytics(JobStep.ALIGN, { executed: true, status: 'succeeded' });
        currentJob = getJob(jobId);
      } else {
        await reuseStageAnalytics(JobStep.ALIGN, { mode: 'reused' });
      }

      if (!currentJob.steps[JobStep.BURNIN]) {
        await startStageAnalytics(JobStep.BURNIN, { mode: 'execute' });
        const burned = await deps.burnInSubtitles({
          projectDir,
          videoPath: currentJob.artifacts.finalBaseVideoPath || currentJob.artifacts.finalVideoPath,
          subtitleAssPath: currentJob.artifacts.subtitleAssPath
        });

        updateJob(jobId, {
          artifacts: {
            ...currentJob.artifacts,
            ...burned,
            finalVideoPath: burned.finalCaptionedVideoPath
          },
          steps: {
            ...currentJob.steps,
            [JobStep.BURNIN]: true
          }
        });
        await persistCheckpoint(getJob(jobId), null, deps);
        await finishStageAnalytics(JobStep.BURNIN, { executed: true, status: 'succeeded' });
        currentJob = getJob(jobId);
      } else {
        await reuseStageAnalytics(JobStep.BURNIN, { mode: 'reused' });
      }
    } else {
      updateJob(jobId, {
        artifacts: {
          ...clearSubtitleArtifacts(currentJob.artifacts),
          finalVideoPath: currentJob.artifacts.finalBaseVideoPath || currentJob.artifacts.finalVideoPath
        },
        steps: {
          ...currentJob.steps,
          [JobStep.ALIGN]: true,
          [JobStep.BURNIN]: true
        }
      });
      await persistCheckpoint(getJob(jobId), null, deps);
      await reuseStageAnalytics(JobStep.ALIGN, { mode: 'disabled' });
      await reuseStageAnalytics(JobStep.BURNIN, { mode: 'disabled' });
      currentJob = getJob(jobId);
    }

    const completed = updateJob(jobId, {
      status: JobStatus.COMPLETED,
      artifacts: getJob(jobId).artifacts
    });

    await persistCheckpoint(completed, null, deps);
    const completedPredictions = await deps.collectRunPredictions(projectDir, analyticsRunId);
    analyticsRun = deps.finalizeRunRecord(analyticsRun, completedPredictions, { status: 'completed' });
    await saveAnalytics();
    logInfo('job_completed', { jobId, finalVideoPath: completed.artifacts.finalVideoPath });

    return completed;
  } catch (error) {
    logError('job_failed', { jobId, error: error.message });
    const failed = updateJob(jobId, {
      status: JobStatus.FAILED,
      error: error.message
    });
    await persistCheckpoint(failed, null, deps);

    if (analyticsRun && analyticsProject) {
      const failedPredictions = analyticsProjectDir
        ? await deps.collectRunPredictions(analyticsProjectDir, analyticsRun.runId)
        : [];
      analyticsRun = deps.finalizeRunRecord(analyticsRun, failedPredictions, {
        status: 'failed',
        error: error.message
      });
      await deps.writeRunRecord(analyticsProject, analyticsRun);
    }

    return failed;
  } finally {
    if (lockedProject) {
      releaseProjectRunLock(lockedProject, jobId);
    }
  }
}
