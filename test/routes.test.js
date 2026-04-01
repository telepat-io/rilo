import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createJobsRouter } from '../src/api/routes/jobs.js';
import { createProjectsRouter } from '../src/api/routes/projects.js';
import { createJob } from '../src/store/jobStore.js';
import { env } from '../src/config/env.js';
import {
  getProjectDir,
  getProjectScriptAssetPath,
  writeProjectArtifacts,
  writeProjectRunState,
  writeProjectStory,
  writeProjectSync
} from '../src/store/projectStore.js';
import { ensureDir } from '../src/media/files.js';
import { writeRunRecord, createRunRecord } from '../src/store/projectAnalyticsStore.js';

function uniqueProject(prefix) {
  const project = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  createdProjects.add(project);
  return project;
}

function trackProject(project) {
  if (typeof project === 'string' && project.trim()) {
    createdProjects.add(project);
  }
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

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test('POST /jobs returns 409 when project already has active job', async () => {
  const app = express();
  app.use(express.json());
  app.use('/jobs', createJobsRouter());

  const project = trackProject(`ut-route-job-${Date.now()}`);
  const existing = createJob({ project, story: 'already active' });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, story: 'new story' })
    });

    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.jobId, existing.id);
  });
});

test('jobs routes handle missing story, accepted creation, and missing job lookup', async () => {
  const app = express();
  app.use(express.json());
  app.use('/jobs', createJobsRouter());

  await withServer(app, async (baseUrl) => {
    const missingStory = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: trackProject(`ut-route-job-missing-${Date.now()}`) })
    });
    assert.equal(missingStory.status, 400);

    const nonStringStory = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: trackProject(`ut-route-job-story-type-${Date.now()}`),
        story: 123
      })
    });
    assert.equal(nonStringStory.status, 400);

    const invalidForceRestart = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: trackProject(`ut-route-job-invalid-force-${Date.now()}`),
        story: 'short',
        forceRestart: 'yes'
      })
    });
    assert.equal(invalidForceRestart.status, 400);

    const invalidPauseAfterKeyframes = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: trackProject(`ut-route-job-invalid-pause-${Date.now()}`),
        story: 'short',
        pauseAfterKeyframes: 'false'
      })
    });
    assert.equal(invalidPauseAfterKeyframes.status, 400);

    const accepted = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: trackProject(`ut-route-job-ok-${Date.now()}`),
        story: 'short'
      })
    });

    assert.equal(accepted.status, 202);
    const acceptedBody = await accepted.json();
    assert.ok(acceptedBody.jobId);
    assert.equal(acceptedBody.status, 'pending');

    const createdJob = await fetch(`${baseUrl}/jobs/${acceptedBody.jobId}`);
    assert.equal(createdJob.status, 200);

    const acceptedWithBooleanPause = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: trackProject(`ut-route-job-bool-pause-${Date.now()}`),
        story: 'short',
        pauseAfterKeyframes: false
      })
    });
    assert.equal(acceptedWithBooleanPause.status, 202);

    const projectsRoot = env.projectsDir;
    const listApiProjects = async () => {
      try {
        const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory() && entry.name.startsWith('api-'))
          .map((entry) => entry.name);
      } catch {
        return [];
      }
    };

    const apiProjectsBefore = new Set(await listApiProjects());

    const generatedProject = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        story: 'short-generated-project',
        forceRestart: true
      })
    });
    assert.equal(generatedProject.status, 202);
    const generatedBody = await generatedProject.json();
    assert.ok(generatedBody.jobId);

    const apiProjectsAfter = await listApiProjects();
    const generatedProjectName = apiProjectsAfter.find((projectName) => !apiProjectsBefore.has(projectName));
    assert.ok(generatedProjectName);
    trackProject(generatedProjectName);
    assert.match(generatedProjectName, /^api-\d+$/);

    const missingJob = await fetch(`${baseUrl}/jobs/not-found`);
    assert.equal(missingJob.status, 404);
  });
});

test('POST /projects rejects invalid payload types with 400', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter());

  await withServer(app, async (baseUrl) => {
    const badStory = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: `ut-route-proj-${Date.now()}`, story: 123 })
    });

    assert.equal(badStory.status, 400);
    const badStoryBody = await badStory.json();
    assert.match(badStoryBody.error, /story must be a string/);

    const badConfig = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: `ut-route-proj-${Date.now()}-b`, story: 'ok', config: [] })
    });

    assert.equal(badConfig.status, 400);
    const badConfigBody = await badConfig.json();
    assert.match(badConfigBody.error, /config must be an object/);

    const badMetadata = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: `ut-route-proj-${Date.now()}-c`, story: 'ok', metadata: [] })
    });
    assert.equal(badMetadata.status, 400);

    const missingProject = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ story: 'ok' })
    });
    assert.equal(missingProject.status, 400);
  });
});

test('projects routes return expected local backend payloads and error codes', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter());

  const project = uniqueProject('ut-route-projects');
  const projectDir = getProjectDir(project);

  await withServer(app, async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        story: 'This is a valid long-form story payload for route coverage tests.',
        metadata: { title: 'Route Coverage' }
      })
    });
    assert.equal(createdResponse.status, 201);

    // no run-state present yet: config patch should still succeed
    const noRunStatePatch = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '9:16',
          targetDurationSec: 20,
          finalDurationMode: 'match_audio'
        }
      })
    });
    assert.equal(noRunStatePatch.status, 200);

    await writeProjectStory(project, 'Story text for prompts extraction and local project retrieval.');
    await writeProjectRunState(project, {
      status: 'completed',
      steps: {},
      artifacts: {
        script: 'Script body',
        shots: ['Shot A']
      },
      updatedAt: new Date().toISOString()
    });
    await writeProjectArtifacts(project, { finalVideoPath: 'final.mp4' });
    await writeProjectSync(project, { backend: 'local', syncedAt: new Date().toISOString() });

    const logsDir = path.join(projectDir, 'assets', 'debug');
    await ensureDir(logsDir);
    await fs.writeFile(
      path.join(logsDir, 'api-requests.jsonl'),
      `${JSON.stringify({ type: 'request_start', model: 'm', input: { prompt: 'p1' }, trace: { step: 'script' } })}\n`
      + `${JSON.stringify({ type: 'request_start', model: 'm', input: { prompt: 'p2' }, trace: { step: 'script' } })}\n`,
      'utf8'
    );

    await ensureDir(path.join(projectDir, 'snapshots', '2026-01-01T00-00-00-000Z-abc123'));

    const run = createRunRecord({
      runId: 'route-run-1',
      project,
      jobId: 'job-1',
      forceRestart: false
    });
    run.status = 'completed';
    run.invokedAt = '2026-01-01T00:00:00.000Z';
    run.completedAt = '2026-01-01T00:00:02.000Z';
    run.totalDurationMs = 2000;
    await writeRunRecord(project, run);

    const listResponse = await fetch(`${baseUrl}/projects`);
    assert.equal(listResponse.status, 200);
    const listBody = await listResponse.json();
    assert.ok(Array.isArray(listBody.projects));
    assert.ok(listBody.projects.includes(project));

    const projectResponse = await fetch(`${baseUrl}/projects/${project}`);
    assert.equal(projectResponse.status, 200);
    const projectBody = await projectResponse.json();
    assert.equal(projectBody.project, project);

    const logsResponse = await fetch(`${baseUrl}/projects/${project}/logs?includeEntries=true&limit=1`);
    assert.equal(logsResponse.status, 200);
    const logsBody = await logsResponse.json();
    assert.equal(logsBody.entries.length, 1);

    const logsDefaultLimitResponse = await fetch(`${baseUrl}/projects/${project}/logs?includeEntries=maybe&limit=-1`);
    assert.equal(logsDefaultLimitResponse.status, 200);
    const logsDefaultLimitBody = await logsDefaultLimitResponse.json();
    assert.equal(logsDefaultLimitBody.entries.length, 2);

    const logsMaxClampResponse = await fetch(`${baseUrl}/projects/${project}/logs?includeEntries=TRUE&limit=999999`);
    assert.equal(logsMaxClampResponse.status, 200);
    const logsMaxClampBody = await logsMaxClampResponse.json();
    assert.equal(logsMaxClampBody.entries.length, 2);

    const promptsResponse = await fetch(`${baseUrl}/projects/${project}/prompts?limit=1`);
    assert.equal(promptsResponse.status, 200);
    const promptsBody = await promptsResponse.json();
    assert.equal(promptsBody.prompts.length, 1);

    const artifactsResponse = await fetch(`${baseUrl}/projects/${project}/artifacts`);
    assert.equal(artifactsResponse.status, 200);

    const syncResponse = await fetch(`${baseUrl}/projects/${project}/sync`);
    assert.equal(syncResponse.status, 200);

    const snapshotsResponse = await fetch(`${baseUrl}/projects/${project}/snapshots`);
    assert.equal(snapshotsResponse.status, 200);
    const snapshotsBody = await snapshotsResponse.json();
    assert.ok(snapshotsBody.snapshots.length >= 1);

    const analyticsResponse = await fetch(`${baseUrl}/projects/${project}/analytics`);
    assert.equal(analyticsResponse.status, 200);

    const analyticsRunsResponse = await fetch(`${baseUrl}/projects/${project}/analytics/runs?limit=1`);
    assert.equal(analyticsRunsResponse.status, 200);
    const analyticsRunsBody = await analyticsRunsResponse.json();
    assert.equal(analyticsRunsBody.runs.length, 1);

    const analyticsRunResponse = await fetch(`${baseUrl}/projects/${project}/analytics/runs/route-run-1`);
    assert.equal(analyticsRunResponse.status, 200);

    const analyticsMissingResponse = await fetch(`${baseUrl}/projects/${project}/analytics/runs/not-found`);
    assert.equal(analyticsMissingResponse.status, 404);

    const badMetadataPatch = await fetch(`${baseUrl}/projects/${project}/metadata`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ metadata: 'bad' })
    });
    assert.equal(badMetadataPatch.status, 400);

    const okMetadataPatch = await fetch(`${baseUrl}/projects/${project}/metadata`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ metadata: { title: 'Updated' } })
    });
    assert.equal(okMetadataPatch.status, 200);

    const missingProjectResponse = await fetch(`${baseUrl}/projects/not_real_project___`);
    assert.equal(missingProjectResponse.status, 404);
  });

  await cleanupProject(project);
});

test('projects content update persists story/script asset and regenerate respects active jobs', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter({ runPipelineFn: async () => {} }));

  const project = uniqueProject('ut-route-project-content');

  await withServer(app, async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        story: 'Base story used for project content update and regeneration route tests.'
      })
    });
    assert.equal(createdResponse.status, 201);

    const activeJob = createJob({
      project,
      story: 'active job story'
    });

    const updateResponse = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        story: 'Updated story for API content patch route.',
        script: 'Updated script body.',
        prompts: ['Prompt A', 'Prompt B'],
        tone: 'cinematic'
      })
    });
    assert.equal(updateResponse.status, 200);
    const updateBody = await updateResponse.json();
    assert.equal(updateBody.updated.story, true);
    assert.equal(updateBody.updated.script, true);
    assert.equal(updateBody.updated.shots, true);
    assert.equal(updateBody.updated.tone, true);

    const storyText = await fs.readFile(path.join(getProjectDir(project), 'story.md'), 'utf8');
    assert.equal(storyText, 'Updated story for API content patch route.');

    const scriptAssetRaw = await fs.readFile(getProjectScriptAssetPath(project), 'utf8');
    const scriptAsset = JSON.parse(scriptAssetRaw);
    assert.equal(scriptAsset.script, 'Updated script body.');
    assert.deepEqual(scriptAsset.shots, ['Prompt A', 'Prompt B']);
    assert.equal(scriptAsset.tone, 'cinematic');

    const regenerateConflict = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ forceRestart: false })
    });
    assert.equal(regenerateConflict.status, 409);

    activeJob.status = 'completed';

    const regenerateAccepted = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ forceRestart: true })
    });
    assert.equal(regenerateAccepted.status, 202);
    const regenerateBody = await regenerateAccepted.json();
    assert.equal(regenerateBody.project, project);
    assert.equal(regenerateBody.forceRestart, true);
    assert.ok(regenerateBody.jobId);
  });

  await cleanupProject(project);
});

test('projects regenerate supports targeted script, voiceover, keyframe, segment, align, and burnin requests', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter({
    regenerateProjectAssetFn: async (_project, target) => ({
      project: _project,
      targetType: String(target.targetType),
      ...(target.index !== undefined ? { index: Number(target.index) } : {}),
      updatedAt: '2026-02-28T00:00:00.000Z',
      steps: {
        script: true,
        voiceover: true,
        keyframes: true,
        segments: false,
        compose: false
      }
    })
  }));

  const project = uniqueProject('ut-route-project-targeted-regen');

  await withServer(app, async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        story: 'Base story used for targeted regeneration route validation testing path.'
      })
    });
    assert.equal(createdResponse.status, 201);

    const voiceTarget = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'voiceover' })
    });
    assert.equal(voiceTarget.status, 200);
    const voiceBody = await voiceTarget.json();
    assert.equal(voiceBody.targetType, 'voiceover');
    assert.equal(voiceBody.index, undefined);

    const keyframeTarget = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'keyframe', index: 1 })
    });
    assert.equal(keyframeTarget.status, 200);
    const keyframeBody = await keyframeTarget.json();
    assert.equal(keyframeBody.targetType, 'keyframe');
    assert.equal(keyframeBody.index, 1);

    const segmentTarget = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'segment', index: 0 })
    });
    assert.equal(segmentTarget.status, 200);

    const scriptTarget = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'script' })
    });
    assert.equal(scriptTarget.status, 200);
    const scriptBody = await scriptTarget.json();
    assert.equal(scriptBody.targetType, 'script');
    assert.equal(scriptBody.index, undefined);

    const alignTarget = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'align' })
    });
    assert.equal(alignTarget.status, 200);
    const alignBody = await alignTarget.json();
    assert.equal(alignBody.targetType, 'align');
    assert.equal(alignBody.index, undefined);

    const burninTarget = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'burnin' })
    });
    assert.equal(burninTarget.status, 200);
    const burninBody = await burninTarget.json();
    assert.equal(burninBody.targetType, 'burnin');
    assert.equal(burninBody.index, undefined);

    const missingIndex = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'keyframe' })
    });
    assert.equal(missingIndex.status, 400);

    const unsupportedForceRestart = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'segment', index: 1, forceRestart: true })
    });
    assert.equal(unsupportedForceRestart.status, 400);

    const unsupportedVoiceIndex = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'voiceover', index: 0 })
    });
    assert.equal(unsupportedVoiceIndex.status, 400);

    const unsupportedScriptIndex = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'script', index: 0 })
    });
    assert.equal(unsupportedScriptIndex.status, 400);

    const unsupportedAlignIndex = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'align', index: 0 })
    });
    assert.equal(unsupportedAlignIndex.status, 400);
  });

  await cleanupProject(project);
});

test('GET /projects returns 500 when backend list operation fails', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter());

  const originalBackend = env.outputBackend;
  env.outputBackend = 'firebase';

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects`);
      assert.equal(response.status, 500);
    });
  } finally {
    env.outputBackend = originalBackend;
  }
});

test('PATCH /projects/:project/config updates and validates project config', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter({ syncProjectSnapshotFn: async () => {} }));

  const project = uniqueProject('ut-route-project-config');

  await withServer(app, async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        story: 'Base story used for project config patch route tests.',
        config: {
          aspectRatio: '9:16',
          targetDurationSec: 20,
          finalDurationMode: 'match_audio'
        }
      })
    });
    assert.equal(createdResponse.status, 201);

    const seededState = {
      status: 'completed',
      error: null,
      steps: {
        script: true,
        voiceover: true,
        keyframes: true,
        segments: true,
        compose: true
      },
      artifacts: {
        script: 'seed script',
        tone: 'neutral',
        shots: ['shot a', 'shot b'],
        timeline: [{ startSec: 0, endSec: 4 }, { startSec: 4, endSec: 8 }],
        voiceoverUrl: 'https://example.com/voice.mp3',
        voiceoverPath: 'assets/audio/voiceover.mp3',
        keyframeUrls: ['https://example.com/kf-0.jpg', 'https://example.com/kf-1.jpg'],
        keyframePaths: ['assets/keyframes/0000.jpg', 'assets/keyframes/0001.jpg'],
        segmentUrls: ['https://example.com/seg-0.mp4', 'https://example.com/seg-1.mp4'],
        segmentPaths: ['assets/segments/0000.mp4', 'assets/segments/0001.mp4'],
        finalVideoPath: 'final.mp4',
        scriptHash: 'abc123',
        shotHashes: ['s1', 's2'],
        scriptSourceStoryHash: 'storyhash',
        aspectRatio: '9:16',
        targetDurationSec: 20,
        finalDurationMode: 'match_audio',
        keyframeSizeKey: '576x1024',
        modelSelections: {
          textToText: 'deepseek-ai/deepseek-v3',
          textToSpeech: 'minimax/speech-02-turbo',
          textToImage: 'prunaai/z-image-turbo',
          imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
        }
      },
      updatedAt: new Date().toISOString()
    };

    await writeProjectRunState(project, seededState);
    await writeProjectArtifacts(project, seededState.artifacts);

    // target duration change should invalidate all stages
    const patchResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: { aspectRatio: '9:16', targetDurationSec: 30, finalDurationMode: 'match_audio' }
      })
    });
    assert.equal(patchResponse.status, 200);
    const patchBody = await patchResponse.json();
    assert.equal(patchBody.project, project);
    assert.equal(patchBody.config.aspectRatio, '9:16');
    assert.equal(patchBody.config.targetDurationSec, 30);
    assert.equal(patchBody.config.finalDurationMode, 'match_audio');
    assert.ok(patchBody.details);
    assert.equal(patchBody.details.runState.steps.script, false);
    assert.equal(patchBody.details.runState.steps.voiceover, false);
    assert.equal(patchBody.details.runState.steps.keyframes, false);
    assert.equal(patchBody.details.runState.steps.segments, false);
    assert.equal(patchBody.details.runState.steps.compose, false);
    assert.equal(patchBody.details.runState.artifacts.script, '');
    assert.equal(patchBody.details.runState.artifacts.voiceoverPath, '');
    assert.deepEqual(patchBody.details.runState.artifacts.keyframePaths, []);
    assert.deepEqual(patchBody.details.runState.artifacts.segmentPaths, []);
    assert.equal(patchBody.details.runState.artifacts.finalVideoPath, '');

    // reset run-state to validate selective size invalidation behavior
    const reseededState = {
      ...seededState,
      artifacts: {
        ...seededState.artifacts,
        aspectRatio: '9:16',
        targetDurationSec: 30,
        finalDurationMode: 'match_audio',
        keyframeSizeKey: '576x1024'
      },
      updatedAt: new Date().toISOString()
    };
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);

    // size change (aspect + resolved size) should invalidate keyframes/segments/compose only
    const sizePatchResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          keyframeWidth: 1200,
          keyframeHeight: 700
        }
      })
    });
    assert.equal(sizePatchResponse.status, 200);
    const sizePatchBody = await sizePatchResponse.json();
    assert.equal(sizePatchBody.details.runState.steps.script, true);
    assert.equal(sizePatchBody.details.runState.steps.voiceover, true);
    assert.equal(sizePatchBody.details.runState.steps.keyframes, false);
    assert.equal(sizePatchBody.details.runState.steps.segments, false);
    assert.equal(sizePatchBody.details.runState.steps.compose, false);
    assert.equal(sizePatchBody.details.runState.artifacts.script, 'seed script');
    assert.equal(sizePatchBody.details.runState.artifacts.voiceoverPath, 'assets/audio/voiceover.mp3');
    assert.deepEqual(sizePatchBody.details.runState.artifacts.keyframePaths, []);
    assert.deepEqual(sizePatchBody.details.runState.artifacts.segmentPaths, []);
    assert.equal(sizePatchBody.details.runState.artifacts.finalVideoPath, '');

    // model selection payload should be accepted and persisted in normalized config
    const modelPatchResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          models: {
            textToText: 'deepseek-ai/deepseek-v3',
            textToSpeech: 'minimax/speech-02-turbo',
            textToImage: 'prunaai/z-image-turbo',
            imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
          }
        }
      })
    });
    assert.equal(modelPatchResponse.status, 200);
    const modelPatchBody = await modelPatchResponse.json();
    assert.equal(modelPatchBody.config.models.textToText, 'deepseek-ai/deepseek-v3');

    // model option change on textToSpeech should invalidate voice + downstream only
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);
    const modelOptionsPatchResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          modelOptions: {
            textToSpeech: {
              speed: 1.2,
              voice_id: 'Deep_Voice_Man'
            }
          }
        }
      })
    });
    assert.equal(modelOptionsPatchResponse.status, 200);
    const modelOptionsPatchBody = await modelOptionsPatchResponse.json();
    assert.equal(modelOptionsPatchBody.details.runState.steps.script, true);
    assert.equal(modelOptionsPatchBody.details.runState.steps.voiceover, false);
    assert.equal(modelOptionsPatchBody.details.runState.steps.keyframes, false);
    assert.equal(modelOptionsPatchBody.details.runState.steps.segments, false);
    assert.equal(modelOptionsPatchBody.details.runState.steps.compose, false);
    assert.equal(modelOptionsPatchBody.details.runState.artifacts.script, 'seed script');
    assert.equal(modelOptionsPatchBody.details.runState.artifacts.voiceoverPath, '');
    assert.equal(modelOptionsPatchBody.details.runState.artifacts.modelOptions.textToSpeech.speed, 1.2);

    // textToText option change should invalidate from script
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);
    const textToTextOptionsPatch = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          modelOptions: {
            textToText: {
              temperature: 0.7
            }
          }
        }
      })
    });
    assert.equal(textToTextOptionsPatch.status, 200);
    const textToTextBody = await textToTextOptionsPatch.json();
    assert.equal(textToTextBody.details.runState.steps.script, false);

    // textToImage option change should invalidate from keyframes
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);
    const textToImageOptionsPatch = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          modelOptions: {
            textToImage: {
              output_quality: 75
            }
          }
        }
      })
    });
    assert.equal(textToImageOptionsPatch.status, 200);
    const textToImageBody = await textToImageOptionsPatch.json();
    assert.equal(textToImageBody.details.runState.steps.keyframes, false);

    // imageTextToVideo option change should invalidate from segments
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);
    const i2vOptionsPatch = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          modelOptions: {
            imageTextToVideo: {
              sample_shift: 13
            }
          }
        }
      })
    });
    assert.equal(i2vOptionsPatch.status, 200);
    const i2vBody = await i2vOptionsPatch.json();
    assert.equal(i2vBody.details.runState.steps.segments, false);

    // changes in multiple model-option categories should invalidate from script
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);
    const multiCategoryOptionsPatch = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          modelOptions: {
            textToText: {
              temperature: 0.8
            },
            textToSpeech: {
              speed: 1.1
            }
          }
        }
      })
    });
    assert.equal(multiCategoryOptionsPatch.status, 200);
    const multiCategoryBody = await multiCategoryOptionsPatch.json();
    assert.equal(multiCategoryBody.details.runState.steps.script, false);

    // subtitle options change should invalidate subtitle artifacts and preserve base video fallback
    await writeProjectRunState(project, {
      ...reseededState,
      artifacts: {
        ...reseededState.artifacts,
        finalBaseVideoPath: 'assets/final_base.mp4',
        finalVideoPath: 'assets/final_captioned.mp4',
        subtitleSeedPath: 'assets/subtitles/seed.srt',
        subtitleAlignedSrtPath: 'assets/subtitles/aligned.srt',
        subtitleAssPath: 'assets/subtitles/aligned.ass',
        subtitleOptions: {
          ...modelPatchBody.config.subtitleOptions,
          highlightMode: 'spoken_upcoming'
        }
      }
    });
    const subtitlePatch = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          subtitleOptions: {
            ...modelPatchBody.config.subtitleOptions,
            highlightMode: 'current_only'
          }
        }
      })
    });
    assert.equal(subtitlePatch.status, 200);
    const subtitlePatchBody = await subtitlePatch.json();
    assert.equal(subtitlePatchBody.details.runState.steps.align, false);
    assert.equal(subtitlePatchBody.details.runState.steps.burnin, false);
    assert.equal(subtitlePatchBody.details.runState.artifacts.subtitleAssPath, '');

    const invalidModelOptionsResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          modelOptions: {
            textToSpeech: {
              unknownKey: true
            }
          }
        }
      })
    });
    assert.equal(invalidModelOptionsResponse.status, 400);

    // model change should invalidate all stages and reset downstream artifacts
    await writeProjectRunState(project, reseededState);
    await writeProjectArtifacts(project, reseededState.artifacts);
    const modelChangeResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          models: {
            textToText: 'minimax/speech-02-turbo',
            textToSpeech: 'minimax/speech-02-turbo',
            textToImage: 'prunaai/z-image-turbo',
            imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
          }
        }
      })
    });
    assert.equal(modelChangeResponse.status, 200);
    const modelChangeBody = await modelChangeResponse.json();
    assert.equal(modelChangeBody.details.runState.steps.script, false);
    assert.equal(modelChangeBody.details.runState.steps.voiceover, false);
    assert.equal(modelChangeBody.details.runState.steps.keyframes, false);
    assert.equal(modelChangeBody.details.runState.steps.segments, false);
    assert.equal(modelChangeBody.details.runState.steps.compose, false);
    assert.equal(modelChangeBody.details.runState.artifacts.script, '');
    assert.equal(modelChangeBody.details.runState.artifacts.voiceoverPath, '');
    assert.deepEqual(modelChangeBody.details.runState.artifacts.keyframePaths, []);
    assert.deepEqual(modelChangeBody.details.runState.artifacts.segmentPaths, []);
    assert.equal(modelChangeBody.details.runState.artifacts.modelSelections.textToText, 'minimax/speech-02-turbo');

    const invalidModelResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          models: {
            textToText: 'unknown/model'
          }
        }
      })
    });
    assert.equal(invalidModelResponse.status, 400);

    // invalid config rejected
    const invalidResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: { aspectRatio: 'bad', targetDurationSec: 30, finalDurationMode: 'match_audio' }
      })
    });
    assert.equal(invalidResponse.status, 400);

    const invalidSubtitleTemplateResponse = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          aspectRatio: '16:9',
          targetDurationSec: 30,
          finalDurationMode: 'match_audio',
          subtitleOptions: {
            ...modelPatchBody.config.subtitleOptions,
            templateId: 'not_real_template'
          }
        }
      })
    });
    assert.equal(invalidSubtitleTemplateResponse.status, 400);

    // missing config field rejected
    const missingConfig = await fetch(`${baseUrl}/projects/${project}/config`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ notConfig: true })
    });
    assert.equal(missingConfig.status, 400);
  });

  await cleanupProject(project);
});

test('projects routes hit default query parsing and post catch path', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter());

  const project = uniqueProject('ut-route-project-defaults');
  await withServer(app, async (baseUrl) => {
    const created = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        story: 'A sufficiently long story for default query parsing route checks.'
      })
    });
    assert.equal(created.status, 201);

    const logsDefault = await fetch(`${baseUrl}/projects/${project}/logs`);
    assert.equal(logsDefault.status, 200);

    const invalidName = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project: 'INVALID PROJECT NAME!',
        story: 'A sufficiently long story for invalid project create catch path.'
      })
    });
    assert.equal(invalidName.status, 400);
  });

  await cleanupProject(project);
});

test('projects routes return 400 for invalid project names across metadata endpoints', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter());

  await withServer(app, async (baseUrl) => {
    const invalid = encodeURIComponent('INVALID PROJECT NAME!');

    const endpoints = [
      `/projects/${invalid}/logs`,
      `/projects/${invalid}/prompts`,
      `/projects/${invalid}/artifacts`,
      `/projects/${invalid}/sync`,
      `/projects/${invalid}/snapshots`,
      `/projects/${invalid}/analytics`,
      `/projects/${invalid}/analytics/runs`
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(response.status, 400);
    }
  });
});

test('projects content and regenerate validation branches return 400 for malformed payloads', async () => {
  const app = express();
  app.use(express.json());
  app.use('/projects', createProjectsRouter());

  const project = uniqueProject('ut-route-project-validate-branches');

  await withServer(app, async (baseUrl) => {
    const createdResponse = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        project,
        story: 'Base story used for validation-branch route tests in content and regenerate handlers.'
      })
    });
    assert.equal(createdResponse.status, 201);

    const storyOnlyPatch = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ story: 'Updated story only for branch coverage checks.' })
    });
    assert.equal(storyOnlyPatch.status, 200);

    const badStory = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ story: 123 })
    });
    assert.equal(badStory.status, 400);

    const badScript = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ script: 42 })
    });
    assert.equal(badScript.status, 400);

    const badTone = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tone: { value: 'cinematic' } })
    });
    assert.equal(badTone.status, 400);

    const shotsAndPrompts = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shots: ['a'], prompts: ['b'] })
    });
    assert.equal(shotsAndPrompts.status, 400);

    const badShotsShape = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ shots: ['a', 2] })
    });
    assert.equal(badShotsShape.status, 400);

    const emptyContentPatch = await fetch(`${baseUrl}/projects/${project}/content`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(emptyContentPatch.status, 400);

    const indexWithoutTargetType = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ index: 0 })
    });
    assert.equal(indexWithoutTargetType.status, 400);

    const nonBooleanForceRestart = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ forceRestart: 'yes' })
    });
    assert.equal(nonBooleanForceRestart.status, 400);

    const nonBooleanPauseAfterKeyframes = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pauseAfterKeyframes: 'yes' })
    });
    assert.equal(nonBooleanPauseAfterKeyframes.status, 400);

    const pauseAfterKeyframesOnTargeted = await fetch(`${baseUrl}/projects/${project}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'script', pauseAfterKeyframes: false })
    });
    assert.equal(pauseAfterKeyframesOnTargeted.status, 400);

    const invalidProjectRegenerate = await fetch(`${baseUrl}/projects/${encodeURIComponent('INVALID PROJECT NAME!')}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ forceRestart: false })
    });
    assert.equal(invalidProjectRegenerate.status, 400);
  });

  await cleanupProject(project);
});
