import { env } from '../config/env.js';
import { getReplicateClient } from './replicateClient.js';
import { logError, logInfo } from '../observability/logger.js';
import { appendApiTrace } from '../observability/apiTrace.js';

function pickPredictionFields(prediction) {
  if (!prediction || typeof prediction !== 'object') {
    return null;
  }

  return {
    id: prediction.id || null,
    status: prediction.status || null,
    createdAt: prediction.created_at || null,
    startedAt: prediction.started_at || null,
    completedAt: prediction.completed_at || null,
    error: prediction.error || null,
    metrics: prediction.metrics || null
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickErrorFields(error) {
  if (!error || typeof error !== 'object') {
    return {
      name: 'Error',
      message: String(error || ''),
      nonRetryable: false
    };
  }

  return {
    name: error.name || 'Error',
    message: error.message || '',
    code: error.code || null,
    status: error.status || error.statusCode || null,
    nonRetryable: Boolean(error.nonRetryable)
  };
}

async function withRetries(fn, label, { logErrorFn = logError, sleepFn = sleep } = {}) {
  let lastError;
  const maxAttempts = env.maxRetries + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const shouldRetry = !error?.nonRetryable && attempt < maxAttempts;
      const retryDelayMs = shouldRetry ? env.retryDelayMs * attempt : 0;
      logErrorFn('prediction_attempt_failed', {
        label,
        attempt,
        maxAttempts,
        willRetry: shouldRetry,
        retryDelayMs,
        error: pickErrorFields(error)
      });
      if (error?.nonRetryable) {
        throw error;
      }
      if (shouldRetry) {
        await sleepFn(retryDelayMs);
      }
    }
  }
  throw lastError;
}

export async function runModel({ model, input, trace = null, deps = {} }) {
  const getReplicateClientFn = deps.getReplicateClient || getReplicateClient;
  const appendApiTraceFn = deps.appendApiTrace || appendApiTrace;
  const logInfoFn = deps.logInfo || logInfo;
  const sleepFn = deps.sleep || sleep;
  const nowFn = deps.now || (() => Date.now());
  const logErrorFn = deps.logError || logError;

  if (env.useWebhooks) {
    const error = new Error('USE_WEBHOOKS=true is currently disabled until webhook verification and queue reconciliation are implemented');
    error.nonRetryable = true;
    throw error;
  }

  const replicate = getReplicateClientFn();

  return withRetries(async () => {
    const startedAt = new Date().toISOString();
    logInfoFn('prediction_start', { model });
    await appendApiTraceFn(trace?.projectDir, {
      type: 'request_start',
      ts: startedAt,
      model,
      input,
      trace
    });

    const prediction = await replicate.predictions.create({
      model,
      input,
    });

    await appendApiTraceFn(trace?.projectDir, {
      type: 'request_created',
      ts: new Date().toISOString(),
      model,
      predictionId: prediction.id,
      status: prediction.status,
      prediction: pickPredictionFields(prediction),
      trace
    });

    let current = prediction;
    const pollStartedAt = nowFn();
    while (current.status !== 'succeeded' && current.status !== 'failed' && current.status !== 'canceled') {
      if (nowFn() - pollStartedAt > env.predictionMaxWaitMs) {
        await appendApiTraceFn(trace?.projectDir, {
          type: 'request_timeout',
          ts: new Date().toISOString(),
          model,
          predictionId: current.id,
          status: current.status,
          prediction: pickPredictionFields(current),
          trace
        });
        const timeoutError = new Error(`Prediction timed out after ${env.predictionMaxWaitMs}ms`);
        timeoutError.nonRetryable = true;
        throw timeoutError;
      }

      await sleepFn(env.predictionPollIntervalMs);
      current = await replicate.predictions.get(current.id);
    }

    if (current.status !== 'succeeded') {
      await appendApiTraceFn(trace?.projectDir, {
        type: 'request_failed',
        ts: new Date().toISOString(),
        model,
        input,
        predictionId: current.id,
        status: current.status,
        prediction: pickPredictionFields(current),
        trace
      });
      const statusError = new Error(`Prediction failed with status ${current.status}`);
      statusError.nonRetryable = true;
      throw statusError;
    }

    logInfoFn('prediction_succeeded', { model, predictionId: current.id });
    await appendApiTraceFn(trace?.projectDir, {
      type: 'request_succeeded',
      ts: new Date().toISOString(),
      model,
      input,
      predictionId: current.id,
      status: current.status,
      prediction: pickPredictionFields(current),
      output: current.output,
      trace
    });
    return current;
  }, model, { logErrorFn, sleepFn });
}

export function extractOutputText(output) {
  if (Array.isArray(output)) {
    return output.join('').trim();
  }
  if (typeof output === 'string') {
    return output.trim();
  }
  return JSON.stringify(output || '');
}

export function extractOutputUri(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output.length > 0) {
    return typeof output[0] === 'string' ? output[0] : '';
  }
  if (output && typeof output === 'object' && output.url) {
    return output.url;
  }
  return '';
}
