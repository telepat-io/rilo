import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { env } from '../src/config/env.js';
import { burnInAssSubtitles, concatSegments, muxVoiceover, probeMediaDurationSeconds } from '../src/media/ffmpeg.js';
import { runModel } from '../src/providers/predictions.js';

test('concatSegments writes list and invokes ffmpeg with expected args', async () => {
  let ensured = null;
  let written = null;
  let argsSeen = null;

  await concatSegments(['./a.mp4', './b.mp4'], '/tmp/out.mp4', {
    ensureDir: async (dir) => {
      ensured = dir;
    },
    writeFile: async (filePath, content) => {
      written = [filePath, content];
    },
    runFfmpeg: async (args) => {
      argsSeen = args;
    }
  });

  assert.equal(ensured, '/tmp');
  assert.match(written[0], /segments\.txt$/);
  assert.match(written[1], /file '/);
  assert.ok(argsSeen.includes('-f'));
  assert.ok(argsSeen.includes('concat'));
});

test('muxVoiceover toggles shortest flag based on trim option', async () => {
  let argsTrim = null;
  let argsNoTrim = null;

  await muxVoiceover('v.mp4', 'a.mp3', 'o1.mp4', {
    runFfmpeg: async (args) => {
      argsTrim = args;
    }
  });

  await muxVoiceover('v.mp4', 'a.mp3', 'o2.mp4', {
    trimToAudio: false,
    runFfmpeg: async (args) => {
      argsNoTrim = args;
    }
  });

  assert.ok(argsTrim.includes('-shortest'));
  assert.equal(argsNoTrim.includes('-shortest'), false);
});

test('burnInAssSubtitles configures libass filter and quality-focused encode defaults', async () => {
  let argsSeen = null;

  await burnInAssSubtitles('/tmp/in.mp4', '/tmp/captions/aligned.ass', '/tmp/out.mp4', {
    runFfmpeg: async (args) => {
      argsSeen = args;
    }
  });

  assert.ok(argsSeen.includes('-vf'));
  const vfIndex = argsSeen.indexOf('-vf');
  assert.match(argsSeen[vfIndex + 1], /^ass='/);
  assert.ok(argsSeen.includes('-c:v'));
  assert.ok(argsSeen.includes('libx264'));
  assert.ok(argsSeen.includes('-crf'));
  assert.ok(argsSeen.includes('18'));
});

test('probeMediaDurationSeconds parses valid output and rejects invalid output', async () => {
  const duration = await probeMediaDurationSeconds('/tmp/media.mp4', {
    runCapture: async () => '12.34'
  });
  assert.equal(duration, 12.34);

  await assert.rejects(
    probeMediaDurationSeconds('/tmp/media.mp4', {
      runCapture: async () => 'NaN'
    }),
    /Unable to determine media duration/
  );
});

test('runModel succeeds with polling and writes traces', async () => {
  const originalPoll = env.predictionPollIntervalMs;
  const originalMaxWait = env.predictionMaxWaitMs;
  env.predictionPollIntervalMs = 0;
  env.predictionMaxWaitMs = 1000;

  const traces = [];
  const predictionsGet = [{ id: 'p1', status: 'processing' }, { id: 'p1', status: 'succeeded', output: 'done' }];
  let getIdx = 0;

  try {
    const result = await runModel({
      model: 'model/a',
      input: { prompt: 'x' },
      trace: { projectDir: '/tmp', step: 's' },
      deps: {
        getReplicateClient: () => ({
          predictions: {
            create: async () => ({ id: 'p1', status: 'starting' }),
            get: async () => predictionsGet[getIdx++]
          }
        }),
        appendApiTrace: async (_dir, record) => traces.push(record),
        sleep: async () => {},
        now: (() => {
          let n = 0;
          return () => {
            n += 1;
            return n;
          };
        })()
      }
    });

    assert.equal(result.status, 'succeeded');
    assert.deepEqual(
      traces.map((entry) => entry.type),
      ['request_start', 'request_created', 'request_succeeded']
    );
  } finally {
    env.predictionPollIntervalMs = originalPoll;
    env.predictionMaxWaitMs = originalMaxWait;
  }
});

test('runModel retries transient errors and throws on timeout/failed status', async () => {
  const originalPoll = env.predictionPollIntervalMs;
  const originalMaxWait = env.predictionMaxWaitMs;
  env.predictionPollIntervalMs = 0;
  env.predictionMaxWaitMs = 2;

  let createAttempts = 0;
  const traces = [];

  try {
    const retried = await runModel({
      model: 'model/retry',
      input: { prompt: 'x' },
      deps: {
        getReplicateClient: () => ({
          predictions: {
            create: async () => {
              createAttempts += 1;
              if (createAttempts === 1) {
                throw new Error('transient');
              }
              return { id: 'p2', status: 'succeeded', output: 'ok' };
            },
            get: async () => ({ id: 'p2', status: 'succeeded', output: 'ok' })
          }
        }),
        appendApiTrace: async () => {},
        sleep: async () => {}
      }
    });

    assert.equal(retried.status, 'succeeded');
    assert.equal(createAttempts, 2);

    await assert.rejects(
      runModel({
        model: 'model/timeout',
        input: { prompt: 'x' },
        trace: { projectDir: '/tmp' },
        deps: {
          getReplicateClient: () => ({
            predictions: {
              create: async () => ({ id: 'p3', status: 'starting' }),
              get: async () => ({ id: 'p3', status: 'processing' })
            }
          }),
          appendApiTrace: async (_dir, record) => traces.push(record),
          sleep: async () => {},
          now: (() => {
            const values = [0, 10, 20, 30];
            let idx = 0;
            return () => values[idx++] ?? 30;
          })()
        }
      }),
      /timed out/
    );

    await assert.rejects(
      runModel({
        model: 'model/failed',
        input: { prompt: 'x' },
        deps: {
          getReplicateClient: () => ({
            predictions: {
              create: async () => ({ id: 'p4', status: 'failed' }),
              get: async () => ({ id: 'p4', status: 'failed' })
            }
          }),
          appendApiTrace: async () => {},
          sleep: async () => {}
        }
      }),
      /Prediction failed with status failed/
    );

    assert.ok(traces.some((entry) => entry.type === 'request_timeout'));
  } finally {
    env.predictionPollIntervalMs = originalPoll;
    env.predictionMaxWaitMs = originalMaxWait;
  }
});

test('ffmpeg wrappers use default binaries and surface process failures', async () => {
  const originalFfmpegBin = env.ffmpegBin;
  const originalFfprobeBin = env.ffprobeBin;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-ffmpeg-bin-'));

  const ffmpegOk = path.join(tmpDir, 'fake-ffmpeg-ok.sh');
  const ffmpegFail = path.join(tmpDir, 'fake-ffmpeg-fail.sh');
  const ffprobeOk = path.join(tmpDir, 'fake-ffprobe-ok.sh');
  const ffprobeFail = path.join(tmpDir, 'fake-ffprobe-fail.sh');

  await fs.writeFile(ffmpegOk, '#!/bin/sh\nexit 0\n', 'utf8');
  await fs.writeFile(ffmpegFail, '#!/bin/sh\nexit 1\n', 'utf8');
  await fs.writeFile(ffprobeOk, '#!/bin/sh\necho 3.5\nexit 0\n', 'utf8');
  await fs.writeFile(ffprobeFail, '#!/bin/sh\necho boom 1>&2\nexit 2\n', 'utf8');

  await fs.chmod(ffmpegOk, 0o755);
  await fs.chmod(ffmpegFail, 0o755);
  await fs.chmod(ffprobeOk, 0o755);
  await fs.chmod(ffprobeFail, 0o755);

  try {
    env.ffmpegBin = ffmpegOk;
    await concatSegments(['/tmp/a.mp4'], path.join(tmpDir, 'out.mp4'));
    await muxVoiceover('/tmp/v.mp4', '/tmp/a.mp3', path.join(tmpDir, 'muxed.mp4'));

    env.ffprobeBin = ffprobeOk;
    const duration = await probeMediaDurationSeconds('/tmp/media.mp4');
    assert.equal(duration, 3.5);

    env.ffmpegBin = ffmpegFail;
    await assert.rejects(
      concatSegments(['/tmp/a.mp4'], path.join(tmpDir, 'out-fail.mp4')),
      /ffmpeg exited with code 1/
    );

    env.ffprobeBin = ffprobeFail;
    await assert.rejects(
      probeMediaDurationSeconds('/tmp/media.mp4'),
      /boom/
    );
  } finally {
    env.ffmpegBin = originalFfmpegBin;
    env.ffprobeBin = originalFfprobeBin;
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
