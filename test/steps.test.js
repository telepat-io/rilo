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
import { alignSubtitlesToVideo } from '../src/steps/alignSubtitles.js';
import { burnInSubtitles } from '../src/steps/burnInSubtitles.js';
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

test('alignSubtitlesToVideo creates seed srt, runs ffsubsync, and writes ass', async () => {
  const calls = {
    seed: 0,
    run: 0,
    ass: 0
  };

  const result = await alignSubtitlesToVideo({
    projectDir: '/tmp/project',
    videoPath: '/tmp/project/final.mp4',
    script: 'One two three four five six seven eight',
    totalDurationSec: 12,
    subtitleOptions: {
      maxWordsPerLine: 4
    },
    deps: {
      ensureDir: async () => {},
      writeSeedSrtFromScript: async ({ outputPath }) => {
        calls.seed += 1;
        assert.match(outputPath, /seed\.srt$/);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, [
          '1',
          '00:00:00,000 --> 00:00:02,400',
          'One two three four',
          ''
        ].join('\n'), 'utf8');
      },
      runCommand: async (command, args) => {
        calls.run += 1;
        assert.equal(command, env.ffsubsyncBin);
        assert.ok(args.includes('-i'));
        assert.ok(args.includes('-o'));

        const outputIndex = args.indexOf('-o');
        const alignedPath = args[outputIndex + 1];
        await fs.mkdir(path.dirname(alignedPath), { recursive: true });
        await fs.writeFile(alignedPath, [
          '1',
          '00:00:00,100 --> 00:00:02,500',
          'One two three four',
          ''
        ].join('\n'), 'utf8');
      },
      writeAssFromSrt: async ({ sourceSrtPath, outputAssPath }) => {
        calls.ass += 1;
        assert.match(sourceSrtPath, /aligned\.srt$/);
        assert.match(outputAssPath, /aligned\.ass$/);
      }
    }
  });

  assert.equal(calls.seed, 1);
  assert.equal(calls.run, 1);
  assert.equal(calls.ass, 1);
  assert.match(result.subtitleSeedPath, /seed\.srt$/);
  assert.match(result.subtitleAlignedSrtPath, /aligned\.srt$/);
  assert.match(result.subtitleAssPath, /aligned\.ass$/);
});

test('alignSubtitlesToVideo restores leading cue when ffsubsync drops first line', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-align-'));
  const projectDir = path.join(tempDir, 'project');
  await fs.mkdir(path.join(projectDir, 'assets', 'subtitles'), { recursive: true });

  const seedSrt = [
    '1',
    '00:00:00,000 --> 00:00:02,000',
    'First sentence',
    '',
    '2',
    '00:00:02,000 --> 00:00:04,000',
    'Second sentence',
    ''
  ].join('\n');

  let capturedAlignedSrt = '';

  await alignSubtitlesToVideo({
    projectDir,
    videoPath: '/tmp/project/final.mp4',
    script: 'First sentence Second sentence',
    totalDurationSec: 4,
    subtitleOptions: {
      maxWordsPerLine: 4
    },
    deps: {
      ensureDir: async () => {},
      writeSeedSrtFromScript: async ({ outputPath }) => {
        await fs.writeFile(outputPath, seedSrt, 'utf8');
      },
      runCommand: async (command, args) => {
        assert.equal(command, env.ffsubsyncBin);
        const outputIndex = args.indexOf('-o');
        assert.ok(outputIndex >= 0);
        const alignedPath = args[outputIndex + 1];
        await fs.writeFile(alignedPath, [
          '1',
          '00:00:02,500 --> 00:00:04,500',
          'Second sentence',
          ''
        ].join('\n'), 'utf8');
      },
      writeAssFromSrt: async ({ sourceSrtPath }) => {
        capturedAlignedSrt = await fs.readFile(sourceSrtPath, 'utf8');
      }
    }
  });

  assert.match(capturedAlignedSrt, /First sentence/);
  assert.match(capturedAlignedSrt, /Second sentence/);
});

test('burnInSubtitles builds captioned output path and delegates ffmpeg burn-in', async () => {
  let called = false;
  const result = await burnInSubtitles({
    projectDir: '/tmp/project',
    videoPath: '/tmp/project/final.mp4',
    subtitleAssPath: '/tmp/project/assets/subtitles/aligned.ass',
    deps: {
      burnInAssSubtitles: async (videoPath, assPath, outputPath) => {
        called = true;
        assert.equal(videoPath, '/tmp/project/final.mp4');
        assert.equal(assPath, '/tmp/project/assets/subtitles/aligned.ass');
        assert.match(outputPath, /final_captioned\.mp4$/);
      }
    }
  });

  assert.equal(called, true);
  assert.match(result.finalCaptionedVideoPath, /final_captioned\.mp4$/);
});

test('alignSubtitlesToVideo rejects empty script input', async () => {
  await assert.rejects(
    () => alignSubtitlesToVideo({
      projectDir: '/tmp/project',
      videoPath: '/tmp/project/final.mp4',
      script: '   ',
      totalDurationSec: 12,
      subtitleOptions: {},
      deps: {
        ensureDir: async () => {}
      }
    }),
    /script is empty/
  );
});

test('burnInSubtitles rejects missing ASS path', async () => {
  await assert.rejects(
    () => burnInSubtitles({
      projectDir: '/tmp/project',
      videoPath: '/tmp/project/final.mp4',
      subtitleAssPath: '',
      deps: {
        burnInAssSubtitles: async () => {}
      }
    }),
    /subtitle ASS path is missing/
  );
});

test('burnInSubtitles validates missing ASS path without injected deps', async () => {
  await assert.rejects(
    () => burnInSubtitles({
      projectDir: '/tmp/project',
      videoPath: '/tmp/project/final.mp4',
      subtitleAssPath: ''
    }),
    /subtitle ASS path is missing/
  );
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

test('step generators merge modelOptions and preserve runtime-managed fields', async () => {
  let scriptInput;
  await generateScript('Long source story for option merge checks.', {
    targetDurationSec: 10,
    modelOptions: {
      temperature: 0.3,
      top_p: 0.95,
      prompt: 'should be ignored'
    },
    deps: {
      runModel: async ({ input }) => {
        scriptInput = input;
        return {
          output: JSON.stringify({ script: 'w '.repeat(26).trim(), tone: 'neutral' })
        };
      }
    }
  });
  assert.equal(scriptInput.temperature, 0.3);
  assert.equal(scriptInput.top_p, 0.95);
  assert.match(scriptInput.prompt, /Story source:/);

  let voiceInput;
  await generateVoiceover('hello world narration body', {
    shotsCount: 2,
    modelOptions: {
      voice_id: 'Deep_Voice_Man',
      speed: 1.4,
      text: 'override should not apply'
    },
    deps: {
      runModel: async ({ input }) => {
        voiceInput = input;
        return { output: 'https://replicate.delivery/audio.mp3' };
      }
    }
  });
  assert.equal(voiceInput.voice_id, 'Deep_Voice_Man');
  assert.equal(voiceInput.speed, 1.4);
  assert.equal(voiceInput.text, 'hello world narration body');

  let chatterboxInput;
  await generateVoiceover('hello world narration body', {
    modelId: 'resemble-ai/chatterbox-turbo',
    modelOptions: {
      voice: 'Andy',
      top_k: 1000
    },
    deps: {
      runModel: async ({ input }) => {
        chatterboxInput = input;
        return { output: 'https://replicate.delivery/chatterbox.mp3' };
      }
    }
  });
  assert.equal(chatterboxInput.voice, 'Andy');
  assert.equal(chatterboxInput.top_k, 1000);
  assert.equal(chatterboxInput.text, 'hello world narration body');
  assert.equal(Object.prototype.hasOwnProperty.call(chatterboxInput, 'speed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(chatterboxInput, 'subtitle_enable'), false);

  let kokoroInput;
  await generateVoiceover('hello world narration body', {
    modelId: 'jaaari/kokoro-82m',
    modelOptions: {
      voice: 'af_bella'
    },
    deps: {
      runModel: async ({ input }) => {
        kokoroInput = input;
        return { output: 'https://replicate.delivery/kokoro.mp3' };
      }
    }
  });
  assert.equal(kokoroInput.voice, 'af_bella');
  assert.equal(typeof kokoroInput.speed, 'number');
  assert.equal(kokoroInput.text, 'hello world narration body');
  assert.equal(Object.prototype.hasOwnProperty.call(kokoroInput, 'subtitle_enable'), false);

  let keyframeInput;
  await generateKeyframe('prompt body', 'neutral', '9:16', 0, null, { width: 700, height: 1200 }, {
    modelOptions: {
      width: 1,
      height: 1,
      num_inference_steps: 12
    },
    deps: {
      runModel: async ({ input }) => {
        keyframeInput = input;
        return { output: 'https://replicate.delivery/kf.png' };
      }
    }
  });
  assert.equal(keyframeInput.num_inference_steps, 12);
  assert.equal(keyframeInput.width, 700);
  assert.equal(keyframeInput.height, 1200);

  let segmentInput;
  await generateVideoSegmentAtIndex(0, ['k1', 'k2'], [{ durationSec: 5 }, { durationSec: 5 }], ['shot 1', 'shot 2'], '9:16', null, {
    modelOptions: {
      resolution: '480p',
      sample_shift: 14
    },
    deps: {
      runModel: async ({ input }) => {
        segmentInput = input;
        return { output: 'https://replicate.delivery/seg.mp4' };
      }
    }
  });
  assert.equal(segmentInput.sample_shift, 14);
  assert.equal(segmentInput.resolution, '720p');
});

test('generateKeyframe uses Flux adapter mapping for custom-size keyframes', async () => {
  let fluxInput;
  await generateKeyframe('modern courtroom interior', 'cinematic', '9:16', 1, null, { width: 768, height: 1344 }, {
    modelId: 'black-forest-labs/flux-2-pro',
    modelOptions: {
      aspect_ratio: '16:9',
      safety_tolerance: 4,
      output_format: 'png'
    },
    deps: {
      runModel: async ({ model, input }) => {
        assert.equal(model, 'black-forest-labs/flux-2-pro');
        fluxInput = input;
        return { output: 'https://replicate.delivery/flux-kf.png' };
      }
    }
  });

  assert.equal(fluxInput.safety_tolerance, 4);
  assert.equal(fluxInput.output_format, 'png');
  assert.equal(fluxInput.aspect_ratio, 'custom');
  assert.equal(fluxInput.width, 768);
  assert.equal(fluxInput.height, 1344);
  assert.match(fluxInput.prompt, /shot 2/);
});

test('generateKeyframe uses Flux Schnell adapter mapping with aspect ratio', async () => {
  let schnellInput;
  await generateKeyframe('speed-focused image generation', 'neutral', '16:9', 0, null, { width: 1024, height: 576 }, {
    modelId: 'black-forest-labs/flux-schnell',
    modelOptions: {
      num_outputs: 2,
      go_fast: false
    },
    deps: {
      runModel: async ({ model, input }) => {
        assert.equal(model, 'black-forest-labs/flux-schnell');
        schnellInput = input;
        return { output: ['https://replicate.delivery/schnell-1.webp', 'https://replicate.delivery/schnell-2.webp'] };
      }
    }
  });

  assert.equal(schnellInput.num_outputs, 2);
  assert.equal(schnellInput.go_fast, false);
  assert.equal(schnellInput.aspect_ratio, '16:9');
  assert.equal(schnellInput.width, undefined);
  assert.equal(schnellInput.height, undefined);
  assert.match(schnellInput.prompt, /shot 1/);
});

test('generateKeyframe uses Nano Banana Pro adapter mapping with aspect ratio and options', async () => {
  let nanoInput;
  await generateKeyframe('high fidelity infographic style', 'neutral', '1:1', 2, null, { width: 1024, height: 1024 }, {
    modelId: 'google/nano-banana-pro',
    modelOptions: {
      resolution: '4K',
      output_format: 'png',
      safety_filter_level: 'block_only_high',
      allow_fallback_model: true
    },
    deps: {
      runModel: async ({ model, input }) => {
        assert.equal(model, 'google/nano-banana-pro');
        nanoInput = input;
        return { output: 'https://replicate.delivery/nano.webp' };
      }
    }
  });

  assert.equal(nanoInput.resolution, '4K');
  assert.equal(nanoInput.output_format, 'png');
  assert.equal(nanoInput.safety_filter_level, 'block_only_high');
  assert.equal(nanoInput.allow_fallback_model, true);
  assert.equal(nanoInput.aspect_ratio, '1:1');
  assert.equal(nanoInput.width, undefined);
  assert.equal(nanoInput.height, undefined);
  assert.match(nanoInput.prompt, /shot 3/);
});

test('generateKeyframe uses Seedream 4 adapter mapping with aspect ratio and options', async () => {
  let seedreamInput;
  await generateKeyframe('dynamic storyboard panel', 'neutral', '16:9', 3, null, { width: 1024, height: 576 }, {
    modelId: 'bytedance/seedream-4',
    modelOptions: {
      size: '4K',
      sequential_image_generation: 'auto',
      max_images: 2,
      enhance_prompt: true
    },
    deps: {
      runModel: async ({ model, input }) => {
        assert.equal(model, 'bytedance/seedream-4');
        seedreamInput = input;
        return { output: ['https://replicate.delivery/seedream-1.jpg', 'https://replicate.delivery/seedream-2.jpg'] };
      }
    }
  });

  assert.equal(seedreamInput.size, '4K');
  assert.equal(seedreamInput.sequential_image_generation, 'auto');
  assert.equal(seedreamInput.max_images, 2);
  assert.equal(seedreamInput.enhance_prompt, true);
  assert.equal(seedreamInput.aspect_ratio, '16:9');
  assert.equal(seedreamInput.width, undefined);
  assert.equal(seedreamInput.height, undefined);
  assert.match(seedreamInput.prompt, /shot 4/);
});

test('generateVideoSegmentAtIndex uses Kling v3 adapter mapping with start/end images and fixed 5s duration', async () => {
  let klingInput;
  const segmentUrl = await generateVideoSegmentAtIndex(
    0,
    ['https://example.com/start.png', 'https://example.com/end.png'],
    [{ durationSec: 9 }, { durationSec: 9 }],
    ['A smooth dolly shot through fog'],
    '9:16',
    null,
    {
      modelId: 'kwaivgi/kling-v3-video',
      modelOptions: {
        negative_prompt: 'text artifacts',
        mode: 'standard',
        generate_audio: true
      },
      deps: {
        runModel: async ({ model, input }) => {
          assert.equal(model, 'kwaivgi/kling-v3-video');
          klingInput = input;
          return { output: 'https://replicate.delivery/kling-segment.mp4' };
        }
      }
    }
  );

  assert.equal(segmentUrl, 'https://replicate.delivery/kling-segment.mp4');
  assert.equal(klingInput.start_image, 'https://example.com/start.png');
  assert.equal(klingInput.end_image, 'https://example.com/end.png');
  assert.equal(klingInput.aspect_ratio, '9:16');
  assert.equal(klingInput.duration, 5);
  assert.equal(klingInput.mode, 'standard');
  assert.equal(klingInput.generate_audio, false);
  assert.equal(klingInput.num_frames, undefined);
  assert.equal(klingInput.frames_per_second, undefined);
  assert.equal(klingInput.resolution, undefined);
});

test('generateVideoSegmentAtIndex uses PixVerse adapter mapping with start/end images and fixed 5s duration', async () => {
  let pixverseInput;
  const segmentUrl = await generateVideoSegmentAtIndex(
    0,
    ['https://example.com/start.png', 'https://example.com/end.png'],
    [{ durationSec: 8 }, { durationSec: 8 }],
    ['A dramatic reveal shot'],
    '16:9',
    null,
    {
      modelId: 'pixverse/pixverse-v5.6',
      modelOptions: {
        quality: '720p',
        negative_prompt: 'artifacts',
        seed: 7,
        generate_audio_switch: true,
        thinking_type: 'auto'
      },
      deps: {
        runModel: async ({ model, input }) => {
          assert.equal(model, 'pixverse/pixverse-v5.6');
          pixverseInput = input;
          return { output: 'https://replicate.delivery/pixverse-segment.mp4' };
        }
      }
    }
  );

  assert.equal(segmentUrl, 'https://replicate.delivery/pixverse-segment.mp4');
  assert.equal(pixverseInput.image, 'https://example.com/start.png');
  assert.equal(pixverseInput.last_frame_image, 'https://example.com/end.png');
  assert.equal(pixverseInput.aspect_ratio, '16:9');
  assert.equal(pixverseInput.duration, 5);
  assert.equal(pixverseInput.quality, '720p');
  assert.equal(pixverseInput.generate_audio_switch, false);
  assert.equal(pixverseInput.num_frames, undefined);
  assert.equal(pixverseInput.frames_per_second, undefined);
  assert.equal(pixverseInput.resolution, undefined);
});

test('generateVideoSegmentAtIndex uses Veo 3.1 Fast adapter mapping with start/end images and fixed 5s duration', async () => {
  let veoInput;
  const segmentUrl = await generateVideoSegmentAtIndex(
    0,
    ['https://example.com/start.png', 'https://example.com/end.png'],
    [{ durationSec: 8 }, { durationSec: 8 }],
    ['A cinematic crane shot over a city'],
    '16:9',
    null,
    {
      modelId: 'google/veo-3.1-fast',
      modelOptions: {
        resolution: '720p',
        negative_prompt: 'low detail',
        seed: 23,
        generate_audio: true
      },
      deps: {
        runModel: async ({ model, input }) => {
          assert.equal(model, 'google/veo-3.1-fast');
          veoInput = input;
          return { output: 'https://replicate.delivery/veo-segment.mp4' };
        }
      }
    }
  );

  assert.equal(segmentUrl, 'https://replicate.delivery/veo-segment.mp4');
  assert.equal(veoInput.image, 'https://example.com/start.png');
  assert.equal(veoInput.last_frame, 'https://example.com/end.png');
  assert.equal(veoInput.aspect_ratio, '16:9');
  assert.equal(veoInput.duration, 5);
  assert.equal(veoInput.resolution, '720p');
  assert.equal(veoInput.generate_audio, false);
  assert.equal(veoInput.num_frames, undefined);
  assert.equal(veoInput.frames_per_second, undefined);
});

test('generateVideoSegmentAtIndex uses Veo 3.1 adapter mapping with start/end images and fixed 5s duration', async () => {
  let veoInput;
  const segmentUrl = await generateVideoSegmentAtIndex(
    0,
    ['https://example.com/start.png', 'https://example.com/end.png'],
    [{ durationSec: 8 }, { durationSec: 8 }],
    ['A cinematic dialogue shot with dynamic lighting'],
    '9:16',
    null,
    {
      modelId: 'google/veo-3.1',
      modelOptions: {
        resolution: '1080p',
        negative_prompt: 'artifacts',
        seed: 31,
        generate_audio: true
      },
      deps: {
        runModel: async ({ model, input }) => {
          assert.equal(model, 'google/veo-3.1');
          veoInput = input;
          return { output: 'https://replicate.delivery/veo31-segment.mp4' };
        }
      }
    }
  );

  assert.equal(segmentUrl, 'https://replicate.delivery/veo31-segment.mp4');
  assert.equal(veoInput.image, 'https://example.com/start.png');
  assert.equal(veoInput.last_frame, 'https://example.com/end.png');
  assert.equal(veoInput.aspect_ratio, '9:16');
  assert.equal(veoInput.duration, 5);
  assert.equal(veoInput.resolution, '1080p');
  assert.equal(veoInput.generate_audio, false);
  assert.equal(veoInput.num_frames, undefined);
  assert.equal(veoInput.frames_per_second, undefined);
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

test('generateShots accepts shot objects with description', async () => {
  const result = await generateShots('Narration body', {
    shotCount: 2,
    deps: {
      runModel: async () => ({
        output: JSON.stringify({
          shots: [
            { description: 'First described shot.' },
            { description: ' Second described shot. ' }
          ]
        })
      })
    }
  });

  assert.deepEqual(result.shots, ['First described shot.', 'Second described shot.']);
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
