import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { generateScript, generateShots } from '../src/steps/script.js';
import {
  buildFixedTimeline,
  generateVoiceover,
  persistVoiceover,
  resolveSegmentCountFromAudioDuration,
  resolveTtsSpeed
} from '../src/steps/generateVoiceover.js';
import {
  generateKeyframe,
  generateKeyframes,
  persistKeyframe,
  persistKeyframes
} from '../src/steps/generateKeyframes.js';
import {
  generateVideoSegmentAtIndex,
  generateVideoSegments,
  persistSegment,
  persistSegments
} from '../src/steps/generateVideoSegments.js';
import { composeFinalVideo } from '../src/steps/composeFinalVideo.js';
import { env } from '../src/config/env.js';

test('generateScript parses JSON payload and returns in-range candidate', async () => {
  const result = await generateScript(
    'Long source story for script generation tests.',
    {
      targetDurationSec: 10,
      deps: {
        runModel: async () => ({
          output: `noise {"script":"${'word '.repeat(26).trim()}","tone":"neutral"} trailing`
        })
      }
    }
  );

  assert.equal(result.scriptWordCount, 26);
  assert.equal(result.tone, 'neutral');
});

test('step generators forward explicit modelId overrides to runModel', async () => {
  const scriptModels = [];
  await generateScript('Long source story for script model override checks.', {
    targetDurationSec: 10,
    modelId: 'custom/text-model',
    deps: {
      runModel: async ({ model }) => {
        scriptModels.push(model);
        return {
          output: JSON.stringify({ script: 'w '.repeat(26).trim(), tone: 'neutral' })
        };
      }
    }
  });
  assert.equal(scriptModels[0], 'custom/text-model');

  const voiceModels = [];
  await generateVoiceover('hello world narration body', {
    shotsCount: 2,
    modelId: 'custom/tts-model',
    deps: {
      runModel: async ({ model }) => {
        voiceModels.push(model);
        return { output: 'https://replicate.delivery/audio.mp3' };
      }
    }
  });
  assert.equal(voiceModels[0], 'custom/tts-model');

  const keyframeModels = [];
  await generateKeyframe('prompt', 'neutral', '9:16', 0, null, null, {
    modelId: 'custom/image-model',
    deps: {
      runModel: async ({ model }) => {
        keyframeModels.push(model);
        return { output: 'https://replicate.delivery/kf.png' };
      }
    }
  });
  assert.equal(keyframeModels[0], 'custom/image-model');

  const segmentModels = [];
  await generateVideoSegmentAtIndex(0, ['k1', 'k2'], [{ durationSec: 5 }, { durationSec: 5 }], ['s1', 's2'], '9:16', null, {
    modelId: 'custom/video-model',
    deps: {
      runModel: async ({ model }) => {
        segmentModels.push(model);
        return { output: 'https://replicate.delivery/seg.mp4' };
      }
    }
  });
  assert.equal(segmentModels[0], 'custom/video-model');
});

test('generateScript returns best fallback candidate across retries', async () => {
  let attempt = 0;
  const outputs = [40, 31, 30];

  const result = await generateScript(
    'Another long story input for retry behavior.',
    {
      targetDurationSec: 10,
      deps: {
        runModel: async () => {
          const words = outputs[attempt] || 30;
          attempt += 1;
          return {
            output: JSON.stringify({
              script: 'w '.repeat(words).trim(),
              tone: 'calm'
            })
          };
        }
      }
    }
  );

  assert.equal(result.scriptWordCount, 30);
  assert.equal(result.tone, 'calm');
});

test('generateScript throws on invalid output shape after retries', async () => {
  await assert.rejects(
    generateScript('A sufficiently long story for invalid-shape test.', {
      deps: {
        runModel: async () => ({
          output: JSON.stringify({ tone: 'calm' })
        })
      }
    }),
    /Invalid script output shape/
  );
});

test('generateScript throws when model response has no JSON block', async () => {
  await assert.rejects(
    generateScript('A sufficiently long story for no-json error test.', {
      deps: {
        runModel: async () => ({ output: 'plain text without braces' })
      }
    }),
    /did not include JSON payload/
  );
});

test('generateScript applies retry prompt instruction and default tone fallback', async () => {
  const prompts = [];

  const result = await generateScript(
    'Story input long enough to exercise retry prompt and default tone fallback behavior.',
    {
      targetDurationSec: 10,
      deps: {
        runModel: async ({ input }) => {
          prompts.push(input.prompt);

          if (prompts.length < 3) {
            return {
              output: JSON.stringify({ tone: 'steady' })
            };
          }

          return {
            output: JSON.stringify({
              script: 'w '.repeat(26).trim(),
              shots: ['s1', 's2']
            })
          };
        }
      }
    }
  );

  assert.equal(result.tone, 'neutral');
  assert.equal(prompts.length, 3);
  assert.equal(prompts[0].includes('IMPORTANT: previous attempt missed the narration length target'), false);
  assert.equal(prompts[1].includes('IMPORTANT: previous attempt missed the narration length target'), true);
});

test('generateScript returns best candidate after retries when all attempts miss word range', async () => {
  let callCount = 0;
  const result = await generateScript(
    'Long story input to force out-of-range narration lengths across all retries.',
    {
      targetDurationSec: 10,
      deps: {
        runModel: async () => {
          callCount += 1;
          return {
            output: JSON.stringify({
              script: 'w '.repeat(31).trim(),
              tone: 'steady'
            })
          };
        }
      }
    }
  );

  assert.equal(callCount, 3);
  assert.equal(result.scriptWordCount, 31);
  assert.equal(result.targetWordCount, 26);
  assert.equal(result.tone, 'steady');
});

test('generateShots returns valid shot prompts for exact count', async () => {
  let capturedPrompt = '';
  const result = await generateShots('Narration body', {
    shotCount: 2,
    tone: 'calm',
    deps: {
      runModel: async ({ input }) => {
        capturedPrompt = input.prompt;
        return ({
        output: JSON.stringify({
          shots: ['Shot one.', ' Shot two. ']
        })
        });
      }
    }
  });

  assert.deepEqual(result.shots, ['Shot one.', 'Shot two.']);
  assert.match(capturedPrompt, /fully self-contained/i);
  assert.match(capturedPrompt, /do not rely on context from other shots/i);
});

test('generateShots retries and throws when shape is invalid', async () => {
  await assert.rejects(
    generateShots('Narration body', {
      shotCount: 2,
      deps: {
        runModel: async () => ({
          output: JSON.stringify({
            shots: ['Only one']
          })
        })
      }
    }),
    /Invalid shots output shape/
  );
});

test('voiceover helpers resolve speed, timeline, and segment count', () => {
  const plan = resolveTtsSpeed('word '.repeat(260), 60);
  assert.ok(plan.speed >= 0.75 && plan.speed <= 1.25);

  const clampedMin = resolveTtsSpeed('word', 600);
  assert.equal(clampedMin.speed, 0.75);

  const clampedMax = resolveTtsSpeed('word '.repeat(600), 5);
  assert.equal(clampedMax.speed, 1.25);

  const timeline = buildFixedTimeline(3, 4);
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0].durationSec, 4);

  assert.equal(resolveSegmentCountFromAudioDuration(9.9, 5), 2);
  assert.equal(resolveSegmentCountFromAudioDuration(NaN, 5), 1);
});

test('generateVoiceover and persistVoiceover use injected dependencies', async () => {
  const generated = await generateVoiceover('hello world script', {
    shotsCount: 2,
    deps: {
      runModel: async () => ({ output: 'https://replicate.delivery/audio.mp3' })
    }
  });

  assert.equal(generated.voiceoverUrl, 'https://replicate.delivery/audio.mp3');
  assert.equal(generated.timeline.length, 2);

  const calls = [];
  const voicePath = await persistVoiceover('/tmp/project', 'https://replicate.delivery/audio.mp3', {
    deps: {
      ensureDir: async (dir) => calls.push(['dir', dir]),
      downloadToFile: async (url, outputPath) => {
        calls.push(['download', url, outputPath]);
      }
    }
  });

  assert.match(voicePath, /voiceover\.mp3$/);
  assert.equal(calls[0][0], 'dir');
  assert.equal(calls[1][0], 'download');
});

test('keyframe and segment helpers cover success and missing-output branches', async () => {
  await assert.rejects(
    generateKeyframe('prompt', 'tone', '9:16', 0, null, null, {
      deps: {
        runModel: async () => ({ output: '' })
      }
    }),
    /Missing keyframe output/
  );

  const keyframeUrl = await generateKeyframe('prompt', 'tone', '9:16', 1, null, null, {
    deps: {
      runModel: async () => ({ output: 'https://replicate.delivery/k2.png' })
    }
  });
  assert.equal(keyframeUrl, 'https://replicate.delivery/k2.png');

  const keyframes = await generateKeyframes(['a', 'b'], 'tone', '9:16', null, {
    deps: {
      runModel: (() => {
        let idx = 0;
        return async () => ({ output: `https://replicate.delivery/key-${idx++}.png` });
      })()
    }
  });
  assert.equal(keyframes.length, 2);

  const segmentA = await generateVideoSegmentAtIndex(
    0,
    ['k1', 'k2'],
    [{ durationSec: 5 }, { durationSec: 5 }],
    ['shot1', 'shot2'],
    '9:16',
    null,
    {
      deps: {
        runModel: async ({ input }) => ({ output: `url:${Boolean(input.last_image)}` })
      }
    }
  );
  assert.equal(segmentA, 'url:true');

  await assert.rejects(
    generateVideoSegmentAtIndex(
      1,
      ['k1', 'k2'],
      [{ durationSec: 5 }, { durationSec: 5 }],
      ['shot1', 'shot2'],
      '9:16',
      null,
      {
        deps: {
          runModel: async ({ input }) => ({ output: `url:${Boolean(input.last_image)}` })
        }
      }
    ),
    /out of range/
  );

  const allSegments = await generateVideoSegments(['k1', 'k2'], [{ durationSec: 5 }, { durationSec: 5 }], ['s1', 's2'], '9:16', null, {
    deps: {
      runModel: (() => {
        let idx = 0;
        return async () => ({ output: `https://replicate.delivery/seg-${idx++}.mp4` });
      })()
    }
  });
  assert.equal(allSegments.length, 1);

  await assert.rejects(
    generateVideoSegmentAtIndex(
      0,
      ['k1', 'k2'],
      [{ durationSec: 5 }, { durationSec: 5 }],
      ['shot1', 'shot2'],
      '9:16',
      null,
      {
        deps: {
          runModel: async () => ({ output: '' })
        }
      }
    ),
    /Missing segment output/
  );

  await assert.rejects(
    generateVideoSegmentAtIndex(
      1,
      ['k1', 'k2'],
      [{ durationSec: 5 }, { durationSec: 5 }],
      ['shot1', 'shot2'],
      '9:16',
      null,
      {
        deps: {
          runModel: async () => ({ output: '' })
        }
      }
    ),
    /out of range/
  );
});

test('persist keyframe/segment helpers and composeFinalVideo run with injected IO', async () => {
  const actions = [];
  const keyPath = await persistKeyframe('/tmp/project', 'https://replicate.delivery/k.png', 0, {
    deps: {
      ensureDir: async () => actions.push('kdir'),
      downloadToFile: async () => actions.push('kdownload')
    }
  });
  assert.match(keyPath, /keyframe_01\.png$/);

  const keyPaths = await persistKeyframes('/tmp/project', ['u1', 'u2'], {
    deps: {
      ensureDir: async () => {},
      downloadToFile: async () => {}
    }
  });
  assert.equal(keyPaths.length, 2);

  const segPath = await persistSegment('/tmp/project', 'https://replicate.delivery/s.mp4', 0, {
    deps: {
      ensureDir: async () => actions.push('sdir'),
      downloadToFile: async () => actions.push('sdownload')
    }
  });
  assert.match(segPath, /segment_01\.mp4$/);

  const segPaths = await persistSegments('/tmp/project', ['s1', 's2'], {
    deps: {
      ensureDir: async () => {},
      downloadToFile: async () => {}
    }
  });
  assert.equal(segPaths.length, 2);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-compose-'));
  const downloads = [];
  let concatArgs = null;
  let muxArgs = null;

  const composed = await composeFinalVideo({
    projectDir: tmpDir,
    segmentUrls: ['seg-1', 'seg-2'],
    segmentPaths: ['/tmp/seg-1.mp4', '/tmp/seg-2.mp4'],
    voiceoverUrl: 'voice-url',
    keyframePaths: ['/tmp/kf-1.png', '/tmp/kf-2.png'],
    finalDurationMode: 'match_visual',
    deps: {
      ensureDir: async () => {},
      downloadToFile: async (url, outputPath) => {
        downloads.push([url, outputPath]);
      },
      concatSegments: async (segments, outputPath) => {
        concatArgs = [segments, outputPath];
      },
      muxVoiceover: async (videoPath, audioPath, outputPath, options) => {
        muxArgs = [videoPath, audioPath, outputPath, options];
      }
    }
  });

  assert.equal(composed.segmentPaths.length, 2);
  assert.equal(composed.keyframePaths.length, 2);
  assert.deepEqual(composed.keyframePaths, ['/tmp/kf-1.png', '/tmp/kf-2.png']);
  assert.ok(concatArgs);
  assert.ok(muxArgs);
  assert.equal(muxArgs[3].trimToAudio, false);
  assert.equal(downloads.length, 1);

  const downloadsNoVoice = [];
  const composedNoDownloads = await composeFinalVideo({
    projectDir: tmpDir,
    segmentUrls: ['seg-1', 'seg-2'],
    segmentPaths: [],
    voiceoverPath: '/tmp/already-have-voice.mp3',
    voiceoverUrl: 'unused-voice-url',
    keyframePaths: [],
    finalDurationMode: 'match_audio',
    deps: {
      ensureDir: async () => {},
      downloadToFile: async (url, outputPath) => {
        downloadsNoVoice.push([url, outputPath]);
      },
      concatSegments: async () => {},
      muxVoiceover: async () => {}
    }
  });

  assert.equal(composedNoDownloads.voiceoverPath, '/tmp/already-have-voice.mp3');
  assert.equal(downloadsNoVoice.length, 2);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('step helpers hit fallback/default branches for aspect ratio, duration, and prompts', async () => {
  const voiceDefault = await generateVoiceover('fallback defaults voiceover script', {
    shotsCount: 0,
    segmentDurationSec: 0,
    targetDurationSec: 0,
    deps: {
      runModel: async ({ input }) => ({ output: `https://replicate.delivery/audio-${input.speed}.mp3` })
    }
  });
  assert.equal(voiceDefault.timeline.length, 12);

  const timelineDefaultCount = buildFixedTimeline(0, 0);
  assert.equal(timelineDefaultCount.length, 12);
  assert.equal(timelineDefaultCount[0].durationSec, 5);

  assert.equal(resolveSegmentCountFromAudioDuration(8, 0), 2);

  const keyframeWithFallbackPreset = await generateKeyframe('prompt fallback', 'neutral', 'bad-ratio', 0, null, null, {
    deps: {
      runModel: async ({ input }) => ({ output: `${input.width}x${input.height}` })
    }
  });
  assert.equal(keyframeWithFallbackPreset, '576x1024');

  const keyframeWithPartialSizeOverride = await generateKeyframe(
    'prompt size override',
    'neutral',
    '9:16',
    0,
    null,
    { width: 640 },
    {
      deps: {
        runModel: async ({ input }) => ({ output: `${input.width}x${input.height}` })
      }
    }
  );
  assert.equal(keyframeWithPartialSizeOverride, '640x1024');

  const unknownAspectSegment = await generateVideoSegmentAtIndex(
    0,
    ['k1', 'k2'],
    [],
    [],
    'bad-ratio',
    null,
    {
      deps: {
        runModel: async ({ input }) => ({ output: `${input.prompt}|${input.num_frames}|${input.resolution}` })
      }
    }
  );
  assert.ok(unknownAspectSegment.startsWith('Cinematic continuity shot 1|'));
  assert.ok(unknownAspectSegment.endsWith('|720p'));

  await assert.rejects(
    () =>
      generateVideoSegmentAtIndex(
        0,
        ['k1'],
        [],
        [],
        '9:16',
        null,
        {
          deps: {
            runModel: async ({ input }) => ({ output: input.prompt })
          }
        }
      ),
    /out of range/
  );
});

test('composeFinalVideo supports fully local inputs without downloads', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-compose-local-'));
  let downloadCount = 0;

  const composed = await composeFinalVideo({
    projectDir: tmpDir,
    segmentUrls: [],
    segmentPaths: [],
    voiceoverPath: '/tmp/local-voice.mp3',
    keyframePaths: [],
    finalDurationMode: 'match_audio',
    deps: {
      ensureDir: async () => {},
      downloadToFile: async () => {
        downloadCount += 1;
      },
      concatSegments: async () => {},
      muxVoiceover: async () => {}
    }
  });

  assert.equal(downloadCount, 0);
  assert.equal(composed.voiceoverPath, '/tmp/local-voice.mp3');
  assert.deepEqual(composed.keyframePaths, []);
  assert.deepEqual(composed.segmentPaths, []);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('step modules cover default dependency branches safely', async () => {
  const originalUseWebhooks = env.useWebhooks;
  const originalFfmpegBin = env.ffmpegBin;
  const originalFetch = global.fetch;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-steps-default-'));

  const fakeFfmpeg = path.join(tmpDir, 'fake-ffmpeg.sh');
  await fs.writeFile(fakeFfmpeg, '#!/bin/sh\nexit 0\n', 'utf8');
  await fs.chmod(fakeFfmpeg, 0o755);

  try {
    env.useWebhooks = true;
    env.ffmpegBin = fakeFfmpeg;

    await assert.rejects(
      generateVoiceover('default deps should fail fast via webhook guard'),
      /webhook/i
    );

    await assert.rejects(
      generateKeyframe('prompt', 'tone', '9:16', 0),
      /webhook/i
    );

    await assert.rejects(
      generateVideoSegmentAtIndex(0, ['k1', 'k2'], [{ durationSec: 5 }, { durationSec: 5 }], ['s1', 's2']),
      /webhook/i
    );

    global.fetch = async () => ({
      ok: true,
      status: 200,
      headers: {
        get() {
          return '1';
        }
      },
      body: {
        getReader() {
          let done = false;
          return {
            async read() {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: new Uint8Array([1]) };
            }
          };
        }
      }
    });

    const persistedVoicePath = await persistVoiceover(tmpDir, 'https://replicate.delivery/voice-default.mp3');
    assert.match(persistedVoicePath, /voiceover\.mp3$/);

    const composed = await composeFinalVideo({
      projectDir: tmpDir,
      segmentUrls: [],
      segmentPaths: [],
      voiceoverPath: '/tmp/local-voice.mp3',
      keyframePaths: [],
      finalDurationMode: 'match_audio'
    });
    assert.equal(composed.voiceoverPath, '/tmp/local-voice.mp3');
  } finally {
    env.useWebhooks = originalUseWebhooks;
    env.ffmpegBin = originalFfmpegBin;
    global.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('generateKeyframes handles empty inputs and persistKeyframe default path', async () => {
  const empty = await generateKeyframes([], 'neutral');
  assert.deepEqual(empty, []);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-keyframe-default-'));
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get() {
        return '1';
      }
    },
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new Uint8Array([7]) };
          }
        };
      }
    }
  });

  try {
    const keyframePath = await persistKeyframe(tmpDir, 'https://replicate.delivery/default-k.png', 0);
    assert.match(keyframePath, /keyframe_01\.png$/);
  } finally {
    global.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
