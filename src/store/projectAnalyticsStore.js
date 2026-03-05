import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir, writeJson } from '../media/files.js';
import { getProjectDir } from './projectStore.js';
import { MODEL_METADATA, MODEL_PRICING } from '../config/models.js';

const RUNS_DIR = 'analytics/runs';

const STAGE_ORDER = [
  'script',
  'voiceover',
  'keyframes',
  'segments',
  'compose'
];

function stageSkeleton() {
  return {
    status: 'pending',
    executed: false,
    reused: false,
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    predictionCount: 0,
    tokenUsage: {
      input: null,
      output: null,
      total: null
    },
    costUsd: null,
    details: null,
    error: null,
    predictions: []
  };
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function resolveAnalyticsStageName(stage) {
  if (stage === 'shots') {
    return 'script';
  }
  if (stage === 'keyframe') {
    return 'keyframes';
  }
  if (stage === 'segment') {
    return 'segments';
  }
  return stage;
}

function estimateCostFromPricingRules(modelId, input = {}, entry = {}) {
  const metadata = MODEL_METADATA[modelId] || {};
  const pricingRules = metadata.pricingRules || {};
  const tiers = Array.isArray(pricingRules.tiers) ? pricingRules.tiers : [];
  if (tiers.length === 0) {
    return null;
  }

  if (pricingRules.basis === 'output_video') {
    const resolution = String(input.resolution || '').toLowerCase();
    const variant = input.interpolate_output ? 'interpolate' : 'base';

    let tier = tiers.find(
      (candidate) =>
        String(candidate.resolution || '').toLowerCase() === resolution &&
        String(candidate.variant || '').toLowerCase() === variant
    );

    if (!tier) {
      tier = tiers.find((candidate) => String(candidate.resolution || '').toLowerCase() === resolution);
    }

    if (!tier) {
      tier = tiers.find((candidate) => String(candidate.variant || '').toLowerCase() === variant);
    }

    /* c8 ignore next 3 */
    if (!tier) {
      return null;
    }

    const usdPerVideo = Number.parseFloat(tier.usdPerVideo);
    return Number.isFinite(usdPerVideo) ? usdPerVideo : null;
  }

  if (pricingRules.basis === 'output_image_megapixels') {
    const width = Number.parseFloat(input.width);
    const height = Number.parseFloat(input.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    const megapixels = (width * height) / 1_000_000;
    const sortedTiers = [...tiers].sort((a, b) => Number.parseFloat(a.maxMegapixels) - Number.parseFloat(b.maxMegapixels));
    let tier = sortedTiers.find((candidate) => {
      const maxMegapixels = Number.parseFloat(candidate.maxMegapixels);
      return Number.isFinite(maxMegapixels) && megapixels <= maxMegapixels;
    });

    if (!tier) {
      tier = sortedTiers[sortedTiers.length - 1] || null;
    }

    if (!tier) {
      return null;
    }

    const usdPerImage = Number.parseFloat(tier.usdPerImage);
    if (!Number.isFinite(usdPerImage)) {
      return null;
    }

    const outputCount = Array.isArray(entry.output) && entry.output.length > 0 ? entry.output.length : 1;
    return usdPerImage * outputCount;
  }

  return null;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getRunsDir(project) {
  return path.join(getProjectDir(project), RUNS_DIR);
}

function getRunFilePath(project, runId) {
  return path.join(getRunsDir(project), `${runId}.json`);
}

export function createRunId() {
  return crypto.randomUUID();
}

export function createRunRecord({ runId, project, jobId, forceRestart }) {
  const now = new Date().toISOString();
  const stages = {};
  for (const stage of STAGE_ORDER) {
    stages[stage] = stageSkeleton();
  }

  return {
    runId,
    project,
    jobId,
    forceRestart,
    status: 'running',
    error: null,
    invokedAt: now,
    completedAt: null,
    totalDurationMs: 0,
    stageOrder: STAGE_ORDER,
    stages,
    totals: {
      predictionCount: 0,
      tokenUsage: {
        input: null,
        output: null,
        total: null
      },
      costUsd: null
    }
  };
}

export function markStageStarted(runRecord, stage, details = null) {
  const next = structuredClone(runRecord);
  const current = next.stages[stage] || stageSkeleton();
  if (!current.startedAt) {
    current.startedAt = new Date().toISOString();
  }
  current.status = 'running';
  current.details = details || current.details;
  next.stages[stage] = current;
  return next;
}

export function markStageFinished(runRecord, stage, payload = {}) {
  const next = structuredClone(runRecord);
  const current = next.stages[stage] || stageSkeleton();
  const completedAt = new Date().toISOString();
  const startedMs = current.startedAt ? Date.parse(current.startedAt) : NaN;
  const completedMs = Date.parse(completedAt);

  current.completedAt = completedAt;
  current.durationMs = Number.isFinite(startedMs) ? Math.max(0, completedMs - startedMs) : 0;
  current.status = payload.status || 'succeeded';
  current.executed = Boolean(payload.executed);
  current.reused = Boolean(payload.reused);
  current.error = payload.error || null;
  current.details = payload.details || current.details;
  next.stages[stage] = current;
  return next;
}

export function markStageReused(runRecord, stage, details = null) {
  const next = structuredClone(runRecord);
  const current = next.stages[stage] || stageSkeleton();
  const now = new Date().toISOString();
  current.status = 'reused';
  current.executed = false;
  current.reused = true;
  current.startedAt = current.startedAt || now;
  current.completedAt = now;
  current.durationMs = current.durationMs || 0;
  current.details = details || current.details;
  next.stages[stage] = current;
  return next;
}

function normalizePrediction(entry) {
  const prediction = entry.prediction || {};
  const metrics = prediction.metrics || {};
  const trace = entry.trace || {};
  const input = entry.input || {};

  const inputTokens = numberOrNull(
    metrics.input_token_count ?? metrics.input_tokens ?? metrics.prompt_tokens
  );
  const outputTokens = numberOrNull(
    metrics.output_token_count ?? metrics.output_tokens ?? metrics.completion_tokens
  );
  const totalTokens = numberOrNull(
    metrics.total_tokens ?? metrics.token_count ?? (Number.isFinite(inputTokens) && Number.isFinite(outputTokens) ? inputTokens + outputTokens : NaN)
  );

  const predictTimeSec = numberOrNull(metrics.predict_time ?? metrics.predict_time_seconds);
  const totalTimeSec = numberOrNull(metrics.total_time ?? metrics.total_time_seconds);

  const modelPricing = MODEL_PRICING[entry.model] || {};
  const rulesCost = estimateCostFromPricingRules(entry.model, input, entry);
  const runtimeCost = Number.isFinite(modelPricing.usdPerSecond) && Number.isFinite(predictTimeSec)
    ? modelPricing.usdPerSecond * predictTimeSec
    : null;

  const tokenInputCost = Number.isFinite(modelPricing.usdPer1kInputTokens) && Number.isFinite(inputTokens)
    ? (inputTokens / 1000) * modelPricing.usdPer1kInputTokens
    : null;

  const tokenOutputCost = Number.isFinite(modelPricing.usdPer1kOutputTokens) && Number.isFinite(outputTokens)
    ? (outputTokens / 1000) * modelPricing.usdPer1kOutputTokens
    : null;

  let tokenCost = null;
  if (Number.isFinite(tokenInputCost) || Number.isFinite(tokenOutputCost)) {
    tokenCost = (Number.isFinite(tokenInputCost) ? tokenInputCost : 0)
      + (Number.isFinite(tokenOutputCost) ? tokenOutputCost : 0);
  }

  const costUsd = Number.isFinite(rulesCost)
    ? rulesCost
    : Number.isFinite(runtimeCost)
      ? runtimeCost
      : tokenCost;

  let costSource = 'unavailable';
  if (Number.isFinite(rulesCost)) {
    costSource = 'pricing_rules';
  } else if (Number.isFinite(runtimeCost) || Number.isFinite(tokenCost)) {
    costSource = 'model_pricing_table';
  }

  return {
    predictionId: entry.predictionId || prediction.id || null,
    model: entry.model || null,
    status: entry.status || prediction.status || null,
    stage: resolveAnalyticsStageName(trace.step || 'unknown'),
    index: Number.isInteger(trace.index) ? trace.index : null,
    createdAt: prediction.createdAt || null,
    startedAt: prediction.startedAt || null,
    completedAt: prediction.completedAt || null,
    predictTimeSec,
    totalTimeSec,
    tokenUsage: {
      input: inputTokens,
      output: outputTokens,
      total: totalTokens
    },
    costUsd,
    costSource
  };
}

function aggregateStagePredictions(stageRecord, predictions) {
  const next = structuredClone(stageRecord);
  next.predictions = predictions;
  next.predictionCount = predictions.length;

  let stageInput = 0;
  let stageOutput = 0;
  let stageTotal = 0;
  let hasInput = false;
  let hasOutput = false;
  let hasTotal = false;
  let stageCost = 0;
  let hasCost = false;

  for (const prediction of predictions) {
    if (Number.isFinite(prediction.tokenUsage.input)) {
      hasInput = true;
      stageInput += prediction.tokenUsage.input;
    }
    if (Number.isFinite(prediction.tokenUsage.output)) {
      hasOutput = true;
      stageOutput += prediction.tokenUsage.output;
    }
    if (Number.isFinite(prediction.tokenUsage.total)) {
      hasTotal = true;
      stageTotal += prediction.tokenUsage.total;
    }
    if (Number.isFinite(prediction.costUsd)) {
      hasCost = true;
      stageCost += prediction.costUsd;
    }
  }

  next.tokenUsage = {
    input: hasInput ? stageInput : null,
    output: hasOutput ? stageOutput : null,
    total: hasTotal ? stageTotal : null
  };
  next.costUsd = hasCost ? stageCost : null;

  return next;
}

async function readJsonLines(filePath) {
  if (!(await pathExists(filePath))) {
    return [];
  }

  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
          /* c8 ignore next */
        return null;
      }
    })
    .filter(Boolean);
}

export async function collectRunPredictions(projectDir, runId) {
  const tracePath = path.join(projectDir, 'assets', 'debug', 'api-requests.jsonl');
  const entries = await readJsonLines(tracePath);
  return entries
    .filter(
      (entry) =>
        (entry.type === 'request_succeeded' || entry.type === 'request_failed') &&
        entry.trace?.runId === runId
    )
    .map((entry) => normalizePrediction(entry));
}

export function finalizeRunRecord(runRecord, predictions, outcome = {}) {
  const next = structuredClone(runRecord);
  const byStage = new Map();

  for (const prediction of predictions) {
    const stage = prediction.stage || 'unknown';
    const stagePredictions = byStage.get(stage) || [];
    stagePredictions.push(prediction);
    byStage.set(stage, stagePredictions);
  }

  for (const stage of STAGE_ORDER) {
    const existing = next.stages[stage] || stageSkeleton();
    next.stages[stage] = aggregateStagePredictions(existing, byStage.get(stage) || []);
  }

  const invokedMs = Date.parse(next.invokedAt);
  const completedAt = new Date().toISOString();
  const completedMs = Date.parse(completedAt);

  let totalPredictionCount = 0;
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let hasCost = false;
  let hasInput = false;
  let hasOutput = false;
  let hasTotal = false;

  for (const stage of STAGE_ORDER) {
    const stageEntry = next.stages[stage];
    totalPredictionCount += stageEntry.predictionCount || 0;
    if (Number.isFinite(stageEntry.costUsd)) {
      hasCost = true;
      totalCost += stageEntry.costUsd;
    }
    if (Number.isFinite(stageEntry.tokenUsage.input)) {
      hasInput = true;
      totalInputTokens += stageEntry.tokenUsage.input;
    }
    if (Number.isFinite(stageEntry.tokenUsage.output)) {
      hasOutput = true;
      totalOutputTokens += stageEntry.tokenUsage.output;
    }
    if (Number.isFinite(stageEntry.tokenUsage.total)) {
      hasTotal = true;
      totalTokens += stageEntry.tokenUsage.total;
    }
  }

  next.status = outcome.status || 'completed';
  next.error = outcome.error || null;
  next.completedAt = completedAt;
  next.totalDurationMs = Number.isFinite(invokedMs) ? Math.max(0, completedMs - invokedMs) : 0;
  next.totals = {
    predictionCount: totalPredictionCount,
    tokenUsage: {
      input: hasInput ? totalInputTokens : null,
      output: hasOutput ? totalOutputTokens : null,
      total: hasTotal ? totalTokens : null
    },
    costUsd: hasCost ? totalCost : null
  };

  return next;
}

export async function writeRunRecord(project, runRecord) {
  const runsDir = getRunsDir(project);
  await ensureDir(runsDir);
  await writeJson(getRunFilePath(project, runRecord.runId), runRecord);
}

export async function readRunRecord(project, runId) {
  const filePath = getRunFilePath(project, runId);
  if (!(await pathExists(filePath))) {
    return null;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function listRunRecords(project) {
  const runsDir = getRunsDir(project);
  if (!(await pathExists(runsDir))) {
    return [];
  }

  const entries = await fs.readdir(runsDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

  const runs = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(runsDir, file.name), 'utf8');
      runs.push(JSON.parse(raw));
    } catch {
      continue;
    }
  }

  return runs.sort((a, b) => String(b.invokedAt || '').localeCompare(String(a.invokedAt || '')));
}

export function summarizeRun(runRecord) {
  const stages = {};
  for (const stage of STAGE_ORDER) {
    const source = runRecord.stages?.[stage] || stageSkeleton();
    stages[stage] = {
      status: source.status,
      executed: source.executed,
      reused: source.reused,
      durationMs: source.durationMs,
      predictionCount: source.predictionCount,
      tokenUsage: source.tokenUsage,
      costUsd: source.costUsd
    };
  }

  return {
    runId: runRecord.runId,
    jobId: runRecord.jobId,
    project: runRecord.project,
    status: runRecord.status,
    error: runRecord.error,
    invokedAt: runRecord.invokedAt,
    completedAt: runRecord.completedAt,
    totalDurationMs: runRecord.totalDurationMs,
    forceRestart: runRecord.forceRestart,
    totals: runRecord.totals,
    stages
  };
}

export function summarizeProjectAnalytics(runs) {
  const summaries = runs.map((run) => summarizeRun(run));

  let completedRuns = 0;
  let failedRuns = 0;
  let totalDurationMs = 0;
  let totalPredictions = 0;
  let totalCostUsd = 0;
  let hasCost = false;

  for (const run of summaries) {
    if (run.status === 'completed') {
      completedRuns += 1;
    }
    if (run.status === 'failed') {
      failedRuns += 1;
    }

    if (Number.isFinite(run.totalDurationMs)) {
      totalDurationMs += run.totalDurationMs;
    }

    totalPredictions += run.totals?.predictionCount || 0;
    if (Number.isFinite(run.totals?.costUsd)) {
      hasCost = true;
      totalCostUsd += run.totals.costUsd;
    }
  }

  const averageDurationMs = summaries.length > 0 ? Math.round(totalDurationMs / summaries.length) : 0;

  return {
    totalRuns: summaries.length,
    completedRuns,
    failedRuns,
    totalDurationMs,
    averageDurationMs,
    totalPredictions,
    totalCostUsd: hasCost ? totalCostUsd : null,
    lastRun: summaries[0] || null
  };
}
