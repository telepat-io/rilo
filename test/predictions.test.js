import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { env } from '../src/config/env.js';
import { extractOutputText, extractOutputUri, runModel } from '../src/providers/predictions.js';

const execFileAsync = promisify(execFile);

test('extractOutputText normalizes array, string, and object outputs', () => {
  assert.equal(extractOutputText([' hello', ' world ']), 'hello world');
  assert.equal(extractOutputText('  hi  '), 'hi');
  assert.equal(extractOutputText({ ok: true }), JSON.stringify({ ok: true }));
});

test('extractOutputUri handles string, array, object, and fallback cases', () => {
  assert.equal(extractOutputUri('https://example.com/a.mp4'), 'https://example.com/a.mp4');
  assert.equal(extractOutputUri(['https://example.com/b.mp4']), 'https://example.com/b.mp4');
  assert.equal(extractOutputUri({ url: 'https://example.com/c.mp4' }), 'https://example.com/c.mp4');
  assert.equal(extractOutputUri([{}]), '');
  assert.equal(extractOutputUri(null), '');
});

test('runModel exits early with explicit error when USE_WEBHOOKS=true', async () => {
  const script = `
    import { runModel } from './src/providers/predictions.js';
    try {
      await runModel({ model: 'any/model', input: { prompt: 'x' } });
      console.log('UNEXPECTED_SUCCESS');
      process.exit(1);
    } catch (error) {
      console.log(error.message);
      process.exit(0);
    }
  `;

  const { stdout } = await execFileAsync('node', ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      REPLICATE_API_TOKEN: 'test-token',
      USE_WEBHOOKS: 'true'
    }
  });

  assert.match(stdout, /USE_WEBHOOKS=true is currently disabled/);
});

test('runModel logs structured retry details for retryable prediction errors', async () => {
  let createCalls = 0;
  const sleepDelays = [];
  const logs = [];
  const retryableError = Object.assign(new Error('rate limited'), { code: 'RATE_LIMIT', status: 429 });
  const replicate = {
    predictions: {
      create: async () => {
        createCalls += 1;
        if (createCalls === 1) {
          throw retryableError;
        }
        return {
          id: 'pred-1',
          status: 'succeeded',
          output: 'ok'
        };
      },
      get: async () => {
        throw new Error('should not poll when create is already succeeded');
      }
    }
  };

  const result = await runModel({
    model: 'owner/model',
    input: { prompt: 'hello' },
    deps: {
      getReplicateClient: () => replicate,
      appendApiTrace: async () => {},
      logInfo: () => {},
      logError: (message, data) => logs.push({ message, data }),
      sleep: async (delay) => {
        sleepDelays.push(delay);
      }
    }
  });

  assert.equal(result.id, 'pred-1');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].message, 'prediction_attempt_failed');
  assert.equal(logs[0].data.label, 'owner/model');
  assert.equal(logs[0].data.attempt, 1);
  assert.equal(logs[0].data.maxAttempts, env.maxRetries + 1);
  assert.equal(logs[0].data.willRetry, true);
  assert.equal(logs[0].data.retryDelayMs, env.retryDelayMs);
  assert.deepEqual(logs[0].data.error, {
    name: 'Error',
    message: 'rate limited',
    code: 'RATE_LIMIT',
    status: 429,
    nonRetryable: false
  });
  assert.deepEqual(sleepDelays, [env.retryDelayMs]);
});

test('runModel logs structured retry details and stops on non-retryable errors', async () => {
  const logs = [];
  const fatalError = Object.assign(new Error('invalid input'), {
    name: 'ValidationError',
    code: 'BAD_INPUT',
    status: 400,
    nonRetryable: true
  });

  await assert.rejects(
    runModel({
      model: 'owner/model',
      input: { prompt: 'hello' },
      deps: {
        getReplicateClient: () => ({
          predictions: {
            create: async () => {
              throw fatalError;
            },
            get: async () => {
              throw new Error('should not poll for failed create');
            }
          }
        }),
        appendApiTrace: async () => {},
        logInfo: () => {},
        logError: (message, data) => logs.push({ message, data }),
        sleep: async () => {
          throw new Error('sleep should not be called for non-retryable errors');
        }
      }
    }),
    /invalid input/
  );

  assert.equal(logs.length, 1);
  assert.equal(logs[0].message, 'prediction_attempt_failed');
  assert.equal(logs[0].data.attempt, 1);
  assert.equal(logs[0].data.maxAttempts, env.maxRetries + 1);
  assert.equal(logs[0].data.willRetry, false);
  assert.equal(logs[0].data.retryDelayMs, 0);
  assert.deepEqual(logs[0].data.error, {
    name: 'ValidationError',
    message: 'invalid input',
    code: 'BAD_INPUT',
    status: 400,
    nonRetryable: true
  });
});
