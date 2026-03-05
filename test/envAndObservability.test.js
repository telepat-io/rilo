import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';

import { appendApiTrace } from '../src/observability/apiTrace.js';
import {
  hasEnvValue,
  parseAllowedHosts,
  parseEnvBoolean,
  parseEnvNumber,
  parseEnvString
} from '../src/config/env.js';
import { normalizePricing, toNullableNumber } from '../src/config/models.js';
import { readModelMetadata } from '../src/config/models.js';

const envModulePath = pathToFileURL(path.resolve('src/config/env.js')).href;

async function importEnvFresh(tag) {
  return import(`${envModulePath}?t=${Date.now()}-${tag}`);
}

test('env parses booleans/numbers/hosts and assertRequiredEnv behavior', async () => {
  const originalEnv = { ...process.env };

  try {
    process.env.REPLICATE_API_TOKEN = '';
    process.env.API_PORT = '';
    process.env.PORT = '';
    process.env.WEBHOOK_SECRET = '';
    process.env.OUTPUT_DIR = '';
    process.env.PROJECTS_DIR = '';
    process.env.OUTPUT_BACKEND = '';
    process.env.VIDEOGEN_FIREBASE_PROJECT_ID = '';
    process.env.VIDEOGEN_FIREBASE_STORAGE_BUCKET = '';
    process.env.VIDEOGEN_FIREBASE_CLIENT_EMAIL = '';
    process.env.VIDEOGEN_FIREBASE_PRIVATE_KEY = '';
    process.env.FIREBASE_PROJECT_ID = '';
    process.env.FIREBASE_STORAGE_BUCKET = '';
    process.env.FIREBASE_CLIENT_EMAIL = '';
    process.env.FIREBASE_PRIVATE_KEY = '';
    process.env.USE_WEBHOOKS = 'TRUE';
    process.env.MAX_RETRIES = '7';
    process.env.RETRY_DELAY_MS = '15';
    process.env.PREDICTION_POLL_INTERVAL_MS = '12';
     process.env.API_BEARER_TOKEN = '';
    process.env.PREDICTION_MAX_WAIT_MS = '34';
    process.env.DOWNLOAD_TIMEOUT_MS = '56';
    process.env.DOWNLOAD_MAX_BYTES = '78';
    process.env.DOWNLOAD_ALLOWED_HOSTS = 'Example.com, replicate.delivery ,';
    process.env.API_DEFAULT_LOGS_LIMIT = '90';
    process.env.API_MAX_LOGS_LIMIT = '91';
    process.env.FFMPEG_BIN = '/tmp/custom-ffmpeg';
    process.env.FFPROBE_BIN = '/tmp/custom-ffprobe';

    const modA = await importEnvFresh('a');
    assert.equal(modA.env.useWebhooks, true);
    assert.equal(modA.env.port, 3000);
    assert.equal(modA.env.outputDir, './output');
    assert.equal(modA.env.projectsDir, './projects');
    assert.equal(modA.env.maxRetries, 7);
    assert.equal(modA.env.retryDelayMs, 15);
    assert.equal(modA.env.predictionPollIntervalMs, 12);
    assert.equal(modA.env.predictionMaxWaitMs, 34);
    assert.equal(modA.env.downloadTimeoutMs, 56);
    assert.equal(modA.env.downloadMaxBytes, 78);
    assert.equal(modA.env.apiDefaultLogsLimit, 90);
    assert.equal(modA.env.apiMaxLogsLimit, 91);
    assert.equal(modA.env.ffmpegBin, '/tmp/custom-ffmpeg');
    assert.equal(modA.env.ffprobeBin, '/tmp/custom-ffprobe');
    assert.deepEqual(modA.env.downloadAllowedHosts, ['example.com', 'replicate.delivery']);
    assert.throws(() => modA.assertRequiredEnv(), /Missing REPLICATE_API_TOKEN/);
    assert.throws(() => modA.assertRequiredApiEnv(), /Missing API_BEARER_TOKEN/);

    process.env.REPLICATE_API_TOKEN = 'token-present';
    process.env.API_BEARER_TOKEN = 'api-token-present';
    process.env.API_PORT = '4567';
    process.env.PORT = '4999';
    process.env.OUTPUT_DIR = '/tmp/out';
    process.env.PROJECTS_DIR = '/tmp/projects';
    process.env.OUTPUT_BACKEND = 'firebase';
    process.env.USE_WEBHOOKS = 'false';
    process.env.VIDEOGEN_FIREBASE_PROJECT_ID = 'project-1';
    process.env.VIDEOGEN_FIREBASE_STORAGE_BUCKET = 'bucket-1';
    process.env.VIDEOGEN_FIREBASE_CLIENT_EMAIL = 'user@example.com';
    process.env.VIDEOGEN_FIREBASE_PRIVATE_KEY = 'line1\\nline2';

    const modB = await importEnvFresh('b');
    assert.equal(modB.env.useWebhooks, false);
    assert.equal(modB.env.port, 4567);
    assert.equal(modB.env.outputDir, '/tmp/out');
    assert.equal(modB.env.projectsDir, '/tmp/projects');
    assert.equal(modB.env.outputBackend, 'firebase');
    assert.equal(modB.env.firebaseProjectId, 'project-1');
    assert.equal(modB.env.firebaseStorageBucket, 'bucket-1');
    assert.equal(modB.env.firebaseClientEmail, 'user@example.com');
    assert.equal(modB.env.firebasePrivateKey, 'line1\\nline2');
    assert.doesNotThrow(() => modB.assertRequiredEnv());
    assert.doesNotThrow(() => modB.assertRequiredApiEnv());
  } finally {
    process.env = originalEnv;
  }
});

test('appendApiTrace no-ops when projectDir is missing', async () => {
  await appendApiTrace('', { type: 'request_start' });
  await appendApiTrace(null, { type: 'request_start' });
});

test('appendApiTrace appends records to expected file path', async () => {
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-api-trace-'));
  try {
    await appendApiTrace(projectDir, { type: 'request_start', model: 'm1' });
    await appendApiTrace(projectDir, { type: 'request_succeeded', model: 'm1' });

    const traceFile = path.join(projectDir, 'assets', 'debug', 'api-requests.jsonl');
    const text = await fs.readFile(traceFile, 'utf8');
    const lines = text.trim().split('\n');
    assert.equal(lines.length, 2);
  } finally {
    await fs.rm(projectDir, { recursive: true, force: true });
  }
});

test('env parser helpers cover fallback and coercion branches', () => {
  assert.equal(hasEnvValue('x'), true);
  assert.equal(hasEnvValue(''), false);
  assert.equal(hasEnvValue(undefined), false);

  assert.equal(parseEnvString('x', 'fallback'), 'x');
  assert.equal(parseEnvString('', 'fallback'), 'fallback');
  assert.equal(parseEnvString(undefined, 'fallback'), 'fallback');

  assert.equal(parseEnvNumber('12', 99), 12);
  assert.equal(parseEnvNumber(undefined, 99), 99);
  assert.equal(parseEnvNumber('', 99), 99);
  assert.equal(parseEnvNumber('NaN', 99), 99);

  assert.equal(parseEnvBoolean('TRUE', false), true);
  assert.equal(parseEnvBoolean('false', true), false);
  assert.equal(parseEnvBoolean(null, true), true);
  assert.equal(parseEnvBoolean(undefined, true), true);
  assert.equal(parseEnvBoolean('', true), true);

  assert.deepEqual(parseAllowedHosts('A.com, B.com ,'), ['a.com', 'b.com']);
  assert.deepEqual(parseAllowedHosts('', 'x.com'), ['x.com']);
});

test('model pricing helpers cover nullable and normalization branches', () => {
  assert.equal(toNullableNumber(null), null);
  assert.equal(toNullableNumber(undefined), null);
  assert.equal(toNullableNumber(''), null);
  assert.equal(toNullableNumber('bad'), null);
  assert.equal(toNullableNumber('1.25'), 1.25);

  assert.deepEqual(
    normalizePricing({ usdPerSecond: '0.2', usdPer1kInputTokens: 'bad', usdPer1kOutputTokens: '' }),
    {
      usdPerSecond: 0.2,
      usdPer1kInputTokens: null,
      usdPer1kOutputTokens: null
    }
  );

  const unknown = readModelMetadata('unknown/model');
  assert.equal(unknown.modelId, 'unknown/model');
  assert.equal(unknown.pricing.usdPerSecond, null);
});
