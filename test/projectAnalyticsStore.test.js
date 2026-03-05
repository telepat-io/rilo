import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectRunPredictions,
  createRunRecord,
  finalizeRunRecord,
  listRunRecords,
  markStageFinished,
  markStageReused,
  markStageStarted,
  readRunRecord,
  summarizeProjectAnalytics,
  summarizeRun,
  writeRunRecord
} from '../src/store/projectAnalyticsStore.js';
import { ensureDir, writeJson } from '../src/media/files.js';
import { getProjectDir } from '../src/store/projectStore.js';
import { MODEL_METADATA } from '../src/config/models.js';

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

test('run record lifecycle helpers update stage metadata as expected', () => {
  const run = createRunRecord({
    runId: 'run-1',
    project: 'p',
    jobId: 'j',
    forceRestart: false
  });

  const started = markStageStarted(run, 'script', { mode: 'execute' });
  assert.equal(started.stages.script.status, 'running');
  assert.equal(started.stages.script.details.mode, 'execute');

  const finished = markStageFinished(started, 'script', {
    status: 'succeeded',
    executed: true
  });
  assert.equal(finished.stages.script.status, 'succeeded');
  assert.equal(finished.stages.script.executed, true);

  const reused = markStageReused(finished, 'voiceover', { mode: 'reused' });
  assert.equal(reused.stages.voiceover.status, 'reused');
  assert.equal(reused.stages.voiceover.reused, true);
});

test('collectRunPredictions normalizes entries and finalizeRunRecord aggregates totals', async () => {
  const project = uniqueProject('ut-analytics-collect');
  const projectDir = getProjectDir(project);
  const runId = 'run-collect-1';
  const traceDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(traceDir);

  const entries = [
    {
      type: 'request_succeeded',
      model: 'deepseek-ai/deepseek-v3',
      status: 'succeeded',
      predictionId: 'pred-1',
      trace: { runId, step: 'script', index: 0 },
      prediction: {
        id: 'pred-1',
        status: 'succeeded',
        createdAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:01.000Z',
        completedAt: '2026-01-01T00:00:02.000Z',
        metrics: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      },
      input: {
        prompt: 'hello'
      }
    },
    {
      type: 'request_succeeded',
      model: 'prunaai/z-image-turbo',
      status: 'succeeded',
      predictionId: 'pred-2',
      trace: { runId, step: 'keyframe', index: 0 },
      prediction: {
        id: 'pred-2',
        status: 'succeeded',
        metrics: {}
      },
      input: {
        width: 1024,
        height: 1024
      },
      output: ['https://example.com/image.png']
    },
    {
      type: 'request_succeeded',
      model: 'wan-video/wan-2.2-i2v-fast',
      status: 'succeeded',
      predictionId: 'pred-3',
      trace: { runId, step: 'segment', index: 0 },
      prediction: {
        id: 'pred-3',
        status: 'succeeded',
        metrics: {}
      },
      input: {
        resolution: '720p',
        interpolate_output: true
      }
    },
    {
      type: 'request_failed',
      model: 'deepseek-ai/deepseek-v3',
      status: 'failed',
      predictionId: 'pred-ignored-other-run',
      trace: { runId: 'other-run', step: 'script', index: 1 },
      prediction: {
        id: 'pred-ignored-other-run',
        status: 'failed',
        metrics: {}
      }
    }
  ];

  const tracePath = path.join(traceDir, 'api-requests.jsonl');
  await fs.writeFile(tracePath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');

  const predictions = await collectRunPredictions(projectDir, runId);
  assert.equal(predictions.length, 3);

  const run = createRunRecord({ runId, project, jobId: 'job-1', forceRestart: false });
  const finalized = finalizeRunRecord(run, predictions, { status: 'completed' });

  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.totals.predictionCount, 3);
  assert.equal(finalized.stages.script.predictionCount, 1);
  assert.equal(finalized.stages.keyframes.predictionCount, 1);
  assert.equal(finalized.stages.segments.predictionCount, 1);
  assert.equal(finalized.totals.tokenUsage.total, 1500);
  assert.equal(Number(finalized.stages.keyframes.costUsd.toFixed(3)), 0.01);
  assert.equal(Number(finalized.stages.segments.costUsd.toFixed(3)), 0.145);
  assert.ok(finalized.totals.costUsd > 0);

  await cleanupProject(project);
});

test('write/read/list/summarize helpers persist and aggregate runs', async () => {
  const project = uniqueProject('ut-analytics-store');

  const runA = createRunRecord({
    runId: 'run-a',
    project,
    jobId: 'job-a',
    forceRestart: false
  });
  runA.status = 'completed';
  runA.invokedAt = '2026-01-01T00:00:00.000Z';
  runA.totals.predictionCount = 2;
  runA.totals.costUsd = 0.2;

  const runB = createRunRecord({
    runId: 'run-b',
    project,
    jobId: 'job-b',
    forceRestart: true
  });
  runB.status = 'failed';
  runB.error = 'boom';
  runB.invokedAt = '2026-01-02T00:00:00.000Z';
  runB.totals.predictionCount = 1;
  runB.totals.costUsd = 0.1;

  await writeRunRecord(project, runA);
  await writeRunRecord(project, runB);

  const malformedPath = path.join(getProjectDir(project), 'analytics', 'runs', 'malformed.json');
  await writeJson(malformedPath, { invalid: true });
  await fs.writeFile(malformedPath, '{broken-json', 'utf8');

  const readA = await readRunRecord(project, 'run-a');
  assert.equal(readA.runId, 'run-a');

  const listed = await listRunRecords(project);
  assert.equal(listed.length, 2);
  assert.equal(listed[0].runId, 'run-b');
  assert.equal(listed[1].runId, 'run-a');

  const summary = summarizeRun(runB);
  assert.equal(summary.runId, 'run-b');
  assert.equal(summary.status, 'failed');

  const projectSummary = summarizeProjectAnalytics(listed);
  assert.equal(projectSummary.totalRuns, 2);
  assert.equal(projectSummary.completedRuns, 1);
  assert.equal(projectSummary.failedRuns, 1);
  assert.equal(projectSummary.totalPredictions, 3);
  assert.equal(Number(projectSummary.totalCostUsd.toFixed(2)), 0.3);
  assert.equal(projectSummary.lastRun.runId, 'run-b');

  await cleanupProject(project);
});

test('analytics helpers handle unknown models, unknown stages, and empty summaries', async () => {
  const project = uniqueProject('ut-analytics-edge');
  const projectDir = getProjectDir(project);
  const runId = 'run-edge-1';
  const traceDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(traceDir);

  const entries = [
    {
      type: 'request_succeeded',
      model: 'unknown/model',
      status: 'succeeded',
      predictionId: 'u-1',
      trace: { runId, step: 'mystery_step' },
      prediction: {
        id: 'u-1',
        status: 'succeeded',
        metrics: {
          prompt_tokens: 10,
          completion_tokens: 5
        }
      },
      input: {}
    },
    {
      type: 'request_succeeded',
      model: 'prunaai/z-image-turbo',
      status: 'succeeded',
      predictionId: 'u-2',
      trace: { runId, step: 'keyframe' },
      prediction: {
        id: 'u-2',
        status: 'succeeded',
        metrics: {}
      },
      input: {
        width: 'bad',
        height: 1024
      },
      output: []
    }
  ];

  const tracePath = path.join(traceDir, 'api-requests.jsonl');
  await fs.writeFile(tracePath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');

  const predictions = await collectRunPredictions(projectDir, runId);
  assert.equal(predictions.length, 2);

  const run = createRunRecord({ runId, project, jobId: 'job-edge', forceRestart: false });
  const finalized = finalizeRunRecord(run, predictions, { status: 'failed', error: 'edge failure' });
  assert.equal(finalized.status, 'failed');
  assert.equal(finalized.error, 'edge failure');
  assert.equal(finalized.stages.keyframes.predictionCount, 1);
  assert.equal(finalized.totals.predictionCount, 1);

  const emptySummary = summarizeProjectAnalytics([]);
  assert.equal(emptySummary.totalRuns, 0);
  assert.equal(emptySummary.lastRun, null);

  await cleanupProject(project);
});

test('finalizeRunRecord covers pricing-rule fallback branches for analytics', async () => {
  const run = createRunRecord({
    runId: 'run-pricing-fallbacks',
    project: 'pricing-project',
    jobId: 'job-pricing',
    forceRestart: false
  });

  const predictions = [
    {
      stage: 'segments',
      tokenUsage: { input: null, output: null, total: null },
      costUsd: null,
      model: 'wan-video/wan-2.2-i2v-fast'
    },
    {
      stage: 'keyframes',
      tokenUsage: { input: null, output: null, total: null },
      costUsd: 0.01,
      model: 'prunaai/z-image-turbo'
    }
  ];

  const finalized = finalizeRunRecord(run, predictions, { status: 'completed' });
  assert.equal(finalized.status, 'completed');
  assert.equal(finalized.stages.segments.predictionCount, 1);
  assert.equal(finalized.stages.keyframes.predictionCount, 1);
  assert.equal(finalized.totals.predictionCount, 2);
});

test('analytics pricing rules fall back by resolution and variant when exact tier is missing', async () => {
  const modelId = 'test/fallback-video-model';
  const original = MODEL_METADATA[modelId];

  MODEL_METADATA[modelId] = {
    pricingRules: {
      basis: 'output_video',
      tiers: [
        { resolution: '720p', variant: 'interpolate', usdPerVideo: 0.2 },
        { resolution: '480p', variant: 'base', usdPerVideo: 0.1 }
      ]
    }
  };

  try {
    const project = uniqueProject('ut-analytics-fallback-rules');
    const projectDir = getProjectDir(project);
    const runId = 'run-fallback-video';
    const traceDir = path.join(projectDir, 'assets', 'debug');
    await ensureDir(traceDir);

    const entries = [
      {
        type: 'request_succeeded',
        model: modelId,
        status: 'succeeded',
        predictionId: 'a',
        trace: { runId, step: 'segment', index: 0 },
        prediction: { id: 'a', status: 'succeeded', metrics: {} },
        input: { resolution: '720p', interpolate_output: false }
      },
      {
        type: 'request_succeeded',
        model: modelId,
        status: 'succeeded',
        predictionId: 'b',
        trace: { runId, step: 'segment', index: 1 },
        prediction: { id: 'b', status: 'succeeded', metrics: {} },
        input: { resolution: '999p', interpolate_output: false }
      }
    ];
    const tracePath = path.join(traceDir, 'api-requests.jsonl');
    await fs.writeFile(tracePath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');

    const normalized = await collectRunPredictions(projectDir, runId);

    const run = createRunRecord({
      runId,
      project,
      jobId: 'j-fallback',
      forceRestart: false
    });

    const finalized = finalizeRunRecord(run, normalized, { status: 'completed' });
    assert.equal(finalized.stages.segments.predictionCount, 2);
    assert.ok(Number.isFinite(finalized.stages.segments.costUsd));
    await cleanupProject(project);
  } finally {
    if (original === undefined) {
      delete MODEL_METADATA[modelId];
    } else {
      MODEL_METADATA[modelId] = original;
    }
  }
});

test('analytics pricing rules return null cost when tiers are missing or invalid', async () => {
  const videoModel = 'test/no-tier-video-model';
  const imageModel = 'test/invalid-image-tier-model';
  const originalVideo = MODEL_METADATA[videoModel];
  const originalImage = MODEL_METADATA[imageModel];

  MODEL_METADATA[videoModel] = {
    pricingRules: {
      basis: 'output_video',
      tiers: [{ resolution: '480p', variant: 'interpolate', usdPerVideo: 0.2 }]
    }
  };
  MODEL_METADATA[imageModel] = {
    pricingRules: {
      basis: 'output_image_megapixels',
      tiers: [{ maxMegapixels: 'bad', usdPerImage: 'bad' }]
    }
  };

  const project = uniqueProject('ut-analytics-null-cost');
  const projectDir = getProjectDir(project);
  const runId = 'run-null-cost';
  const traceDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(traceDir);

  const entries = [
    {
      type: 'request_succeeded',
      model: videoModel,
      status: 'succeeded',
      predictionId: 'x1',
      trace: { runId, step: 'segment', index: 0 },
      prediction: { id: 'x1', status: 'succeeded', metrics: {} },
      input: { resolution: '999p', interpolate_output: false }
    },
    {
      type: 'request_succeeded',
      model: imageModel,
      status: 'succeeded',
      predictionId: 'x2',
      trace: { runId, step: 'keyframe', index: 0 },
      prediction: { id: 'x2', status: 'succeeded', metrics: {} },
      input: { width: 9999, height: 9999 },
      output: ['a', 'b']
    }
  ];
  await fs.writeFile(
    path.join(traceDir, 'api-requests.jsonl'),
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8'
  );

  try {
    const normalized = await collectRunPredictions(projectDir, runId);
    const run = createRunRecord({ runId, project, jobId: 'job-null-cost', forceRestart: false });
    const finalized = finalizeRunRecord(run, normalized, { status: 'completed' });
    assert.equal(finalized.stages.segments.predictionCount, 1);
    assert.equal(finalized.stages.keyframes.predictionCount, 1);
    assert.equal(finalized.stages.segments.costUsd, null);
    assert.equal(finalized.stages.keyframes.costUsd, null);
  } finally {
    await cleanupProject(project);
    if (originalVideo === undefined) delete MODEL_METADATA[videoModel];
    else MODEL_METADATA[videoModel] = originalVideo;
    if (originalImage === undefined) delete MODEL_METADATA[imageModel];
    else MODEL_METADATA[imageModel] = originalImage;
  }
});

test('analytics pricing returns null for unknown basis and empty image tiers', async () => {
  const unknownBasisModel = 'test/unknown-basis-model';
  const emptyImageModel = 'test/empty-image-tiers-model';
  const originalUnknown = MODEL_METADATA[unknownBasisModel];
  const originalImage = MODEL_METADATA[emptyImageModel];

  MODEL_METADATA[unknownBasisModel] = {
    pricingRules: {
      basis: 'something_else',
      tiers: [{ usdPerVideo: 0.5 }]
    }
  };
  MODEL_METADATA[emptyImageModel] = {
    pricingRules: {
      basis: 'output_image_megapixels',
      tiers: []
    }
  };

  const project = uniqueProject('ut-analytics-unknown-basis');
  const projectDir = getProjectDir(project);
  const runId = 'run-unknown-basis';
  const traceDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(traceDir);

  const entries = [
    {
      type: 'request_succeeded',
      model: unknownBasisModel,
      status: 'succeeded',
      predictionId: 'u1',
      trace: { runId, step: 'segment', index: 0 },
      prediction: { id: 'u1', status: 'succeeded', metrics: {} },
      input: { resolution: '720p' }
    },
    {
      type: 'request_succeeded',
      model: emptyImageModel,
      status: 'succeeded',
      predictionId: 'u2',
      trace: { runId, step: 'keyframe', index: 0 },
      prediction: { id: 'u2', status: 'succeeded', metrics: {} },
      input: { width: 1000, height: 1000 },
      output: ['x']
    }
  ];
  await fs.writeFile(
    path.join(traceDir, 'api-requests.jsonl'),
    `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
    'utf8'
  );

  try {
    const normalized = await collectRunPredictions(projectDir, runId);
    const run = createRunRecord({ runId, project, jobId: 'job-unknown-basis', forceRestart: false });
    const finalized = finalizeRunRecord(run, normalized, { status: 'completed' });
    assert.equal(finalized.stages.segments.costUsd, null);
    assert.equal(finalized.stages.keyframes.costUsd, null);
  } finally {
    await cleanupProject(project);
    if (originalUnknown === undefined) delete MODEL_METADATA[unknownBasisModel];
    else MODEL_METADATA[unknownBasisModel] = originalUnknown;
    if (originalImage === undefined) delete MODEL_METADATA[emptyImageModel];
    else MODEL_METADATA[emptyImageModel] = originalImage;
  }
});

test('collectRunPredictions skips malformed JSON lines', async () => {
  const project = uniqueProject('ut-analytics-bad-jsonl');
  const projectDir = getProjectDir(project);
  const runId = 'run-bad-jsonl';
  const traceDir = path.join(projectDir, 'assets', 'debug');
  await ensureDir(traceDir);

  await fs.writeFile(
    path.join(traceDir, 'api-requests.jsonl'),
    `${JSON.stringify({ type: 'request_succeeded', model: 'x', trace: { runId } })}\n{broken-json\n`,
    'utf8'
  );

  const predictions = await collectRunPredictions(projectDir, runId);
  assert.equal(predictions.length, 1);

  await cleanupProject(project);
});
