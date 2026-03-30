import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  ensureProject,
  ensureProjectConfig,
  getProjectConfigPath,
  getProjectDir,
  normalizeAndValidateProjectConfig,
  readProjectConfig,
  resolveProjectName,
  writeProjectConfig
} from '../src/store/projectStore.js';
import { DEFAULT_MODEL_SELECTIONS } from '../src/config/models.js';

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

test('resolveProjectName normalizes valid names and rejects invalid names', () => {
  assert.equal(resolveProjectName('  MY_Project-01 '), 'my_project-01');

  assert.throws(() => resolveProjectName(''), /Project name is required/);
  assert.throws(() => resolveProjectName('bad project!'), /Invalid project name/);
  assert.throws(() => resolveProjectName('_badstart'), /Invalid project name/);
});

test('normalizeAndValidateProjectConfig applies defaults and validates fields', () => {
  const normalized = normalizeAndValidateProjectConfig({ targetDurationSec: 30 });
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.aspectRatio, '9:16');
  assert.equal(normalized.targetDurationSec, 30);
  assert.equal(normalized.finalDurationMode, 'match_audio');
  assert.equal(normalized.subtitleOptions.enabled, false);
  assert.equal(normalized.subtitleOptions.templateId, 'custom');
  assert.equal(normalized.subtitleOptions.position, 'center');
  assert.equal(normalized.subtitleOptions.fontSize, 100);
  assert.equal(normalized.subtitleOptions.bold, true);
  assert.equal(normalized.subtitleOptions.italic, false);
  assert.equal(normalized.subtitleOptions.makeUppercase, false);
  assert.equal(normalized.subtitleOptions.backgroundEnabled, false);
  assert.equal(normalized.subtitleOptions.maxLines, 2);
  assert.equal(normalized.subtitleOptions.highlightMode, 'spoken_upcoming');
  assert.deepEqual(normalized.models, DEFAULT_MODEL_SELECTIONS);

  assert.throws(
    () => normalizeAndValidateProjectConfig({ schemaVersion: '1' }),
    /schemaVersion must be a positive integer/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ schemaVersion: 999 }),
    /schemaVersion 999 is newer than supported version 1/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ targetDurationSec: '30' }),
    /targetDurationSec must be an integer/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ finalDurationMode: 'other' }),
    /finalDurationMode must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ keyframeWidth: 512 }),
    /keyframeWidth and keyframeHeight must be set together/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ models: { unknownCategory: 'deepseek-ai/deepseek-v3' } }),
    /not a supported model category/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ models: { textToText: 'unknown/model' } }),
    /must reference a supported model id/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { enabled: true, primaryColor: 'yellow' } }),
    /must be a hex color/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { highlightMode: 'blink' } }),
    /subtitleOptions\.highlightMode must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { templateId: 'invalid_template' } }),
    /subtitleOptions\.templateId must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { backgroundOpacity: 0.95 } }),
    /subtitleOptions\.backgroundOpacity must be between 0 and 0\.85/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { outlineColor: 'orange' } }),
    /must be a hex color/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { makeUppercase: 'yes' } }),
    /subtitleOptions\.makeUppercase must be a boolean/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { enabled: 'yes' } }),
    /subtitleOptions\.enabled must be a boolean/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { position: 'left' } }),
    /subtitleOptions\.position must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { fontName: '' } }),
    /subtitleOptions\.fontName must be a non-empty string/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { bold: 'true' } }),
    /subtitleOptions\.bold must be a boolean/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { italic: 'true' } }),
    /subtitleOptions\.italic must be a boolean/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { fontSize: 12 } }),
    /subtitleOptions\.fontSize must be an integer between 16 and 120/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { backgroundEnabled: 'yes' } }),
    /subtitleOptions\.backgroundEnabled must be a boolean/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { outline: 20 } }),
    /subtitleOptions\.outline must be an integer between 0 and 12/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { shadow: 20 } }),
    /subtitleOptions\.shadow must be an integer between 0 and 12/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { marginV: 401 } }),
    /subtitleOptions\.marginV must be an integer between 0 and 400/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { maxWordsPerLine: 0 } }),
    /subtitleOptions\.maxWordsPerLine must be an integer between 1 and 20/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { maxLines: 4 } }),
    /subtitleOptions\.maxLines must be an integer between 1 and 3/
  );
});

test('normalizeAndValidateProjectConfig supports partial model overrides', () => {
  const normalized = normalizeAndValidateProjectConfig({
    models: {
      textToText: 'deepseek-ai/deepseek-v3'
    }
  });

  assert.equal(normalized.models.textToText, 'deepseek-ai/deepseek-v3');
  assert.equal(normalized.models.textToSpeech, DEFAULT_MODEL_SELECTIONS.textToSpeech);
  assert.equal(normalized.models.textToImage, DEFAULT_MODEL_SELECTIONS.textToImage);
  assert.equal(normalized.models.imageTextToVideo, DEFAULT_MODEL_SELECTIONS.imageTextToVideo);
});

test('normalizeAndValidateProjectConfig migrates legacy configs without schemaVersion', () => {
  const normalized = normalizeAndValidateProjectConfig({
    aspectRatio: '9:16',
    targetDurationSec: 45,
    finalDurationMode: 'match_audio'
  });

  assert.equal(normalized.schemaVersion, 1);
});

test('normalizeAndValidateProjectConfig remaps legacy subtitle template ids', () => {
  const topLegacy = normalizeAndValidateProjectConfig({ subtitleOptions: { templateId: 'social_top_minimal' } });
  const bottomLegacy = normalizeAndValidateProjectConfig({ subtitleOptions: { templateId: 'social_bottom_classic' } });

  assert.equal(topLegacy.subtitleOptions.templateId, 'social_center_clean');
  assert.equal(bottomLegacy.subtitleOptions.templateId, 'social_center_story');
});

test('normalizeAndValidateProjectConfig validates modelOptions per selected model', () => {
  const normalized = normalizeAndValidateProjectConfig({
    modelOptions: {
      textToText: {
        temperature: 0.7,
        top_p: 0.9
      },
      textToSpeech: {
        voice_id: 'Deep_Voice_Man',
        speed: 1.1
      },
      textToImage: {
        num_inference_steps: 10,
        output_format: 'png'
      },
      imageTextToVideo: {
        interpolate_output: true,
        sample_shift: 14
      }
    }
  });

  assert.equal(normalized.modelOptions.textToText.temperature, 0.7);
  assert.equal(normalized.modelOptions.textToSpeech.voice_id, 'Deep_Voice_Man');
  assert.equal(normalized.modelOptions.textToImage.output_format, 'png');
  assert.equal(normalized.modelOptions.imageTextToVideo.interpolate_output, true);

  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { unknownCategory: {} } }),
    /modelOptions\.unknownCategory is not a supported model category/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToText: { unknown_key: true } } }),
    /is not supported for selected model/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToText: { temperature: 'hot' } } }),
    /must be a number/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToImage: { num_inference_steps: 99 } } }),
    /must be <= 50/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToImage: { output_format: 'gif' } } }),
    /must be one of/
  );

  const fluxConfig = normalizeAndValidateProjectConfig({
    models: {
      textToImage: 'black-forest-labs/flux-2-pro'
    },
    modelOptions: {
      textToImage: {
        safety_tolerance: 3,
        output_format: 'webp'
      }
    }
  });

  assert.equal(fluxConfig.models.textToImage, 'black-forest-labs/flux-2-pro');
  assert.equal(fluxConfig.modelOptions.textToImage.safety_tolerance, 3);
  assert.equal(fluxConfig.modelOptions.textToImage.output_format, 'webp');

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        textToImage: 'black-forest-labs/flux-2-pro'
      },
      modelOptions: {
        textToImage: {
          go_fast: true
        }
      }
    }),
    /is not supported for selected model/
  );

  const fluxSchnellConfig = normalizeAndValidateProjectConfig({
    models: {
      textToImage: 'black-forest-labs/flux-schnell'
    },
    modelOptions: {
      textToImage: {
        num_outputs: 2,
        num_inference_steps: 3,
        output_format: 'webp',
        go_fast: true
      }
    }
  });

  assert.equal(fluxSchnellConfig.models.textToImage, 'black-forest-labs/flux-schnell');
  assert.equal(fluxSchnellConfig.modelOptions.textToImage.num_outputs, 2);
  assert.equal(fluxSchnellConfig.modelOptions.textToImage.num_inference_steps, 3);

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        textToImage: 'black-forest-labs/flux-schnell'
      },
      modelOptions: {
        textToImage: {
          safety_tolerance: 3
        }
      }
    }),
    /is not supported for selected model/
  );

  const nanoConfig = normalizeAndValidateProjectConfig({
    models: {
      textToImage: 'google/nano-banana-pro'
    },
    modelOptions: {
      textToImage: {
        resolution: '4K',
        output_format: 'png',
        safety_filter_level: 'block_only_high',
        allow_fallback_model: true
      }
    }
  });

  assert.equal(nanoConfig.models.textToImage, 'google/nano-banana-pro');
  assert.equal(nanoConfig.modelOptions.textToImage.resolution, '4K');
  assert.equal(nanoConfig.modelOptions.textToImage.output_format, 'png');

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        textToImage: 'google/nano-banana-pro'
      },
      modelOptions: {
        textToImage: {
          num_outputs: 2
        }
      }
    }),
    /is not supported for selected model/
  );

  const seedreamConfig = normalizeAndValidateProjectConfig({
    models: {
      textToImage: 'bytedance/seedream-4'
    },
    modelOptions: {
      textToImage: {
        size: '4K',
        sequential_image_generation: 'auto',
        max_images: 3,
        enhance_prompt: true
      }
    }
  });

  assert.equal(seedreamConfig.models.textToImage, 'bytedance/seedream-4');
  assert.equal(seedreamConfig.modelOptions.textToImage.size, '4K');
  assert.equal(seedreamConfig.modelOptions.textToImage.max_images, 3);

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        textToImage: 'bytedance/seedream-4'
      },
      modelOptions: {
        textToImage: {
          output_quality: 90
        }
      }
    }),
    /is not supported for selected model/
  );

  const klingConfig = normalizeAndValidateProjectConfig({
    models: {
      imageTextToVideo: 'kwaivgi/kling-v3-video'
    },
    modelOptions: {
      imageTextToVideo: {
        negative_prompt: 'blurry, watermark',
        mode: 'pro',
        generate_audio: false
      }
    }
  });

  assert.equal(klingConfig.models.imageTextToVideo, 'kwaivgi/kling-v3-video');
  assert.equal(klingConfig.modelOptions.imageTextToVideo.mode, 'pro');
  assert.equal(klingConfig.modelOptions.imageTextToVideo.generate_audio, false);

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        imageTextToVideo: 'kwaivgi/kling-v3-video'
      },
      modelOptions: {
        imageTextToVideo: {
          sample_shift: 12
        }
      }
    }),
    /is not supported for selected model/
  );

  const pixverseConfig = normalizeAndValidateProjectConfig({
    models: {
      imageTextToVideo: 'pixverse/pixverse-v5.6'
    },
    modelOptions: {
      imageTextToVideo: {
        quality: '1080p',
        negative_prompt: 'blur, low quality',
        seed: 42,
        generate_audio_switch: true,
        thinking_type: 'auto'
      }
    }
  });

  assert.equal(pixverseConfig.models.imageTextToVideo, 'pixverse/pixverse-v5.6');
  assert.equal(pixverseConfig.modelOptions.imageTextToVideo.quality, '1080p');
  assert.equal(pixverseConfig.modelOptions.imageTextToVideo.generate_audio_switch, true);

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        imageTextToVideo: 'pixverse/pixverse-v5.6'
      },
      modelOptions: {
        imageTextToVideo: {
          interpolate_output: true
        }
      }
    }),
    /is not supported for selected model/
  );

  const veoConfig = normalizeAndValidateProjectConfig({
    models: {
      imageTextToVideo: 'google/veo-3.1-fast'
    },
    modelOptions: {
      imageTextToVideo: {
        resolution: '720p',
        negative_prompt: 'flicker, watermark',
        seed: 11
      }
    }
  });

  assert.equal(veoConfig.models.imageTextToVideo, 'google/veo-3.1-fast');
  assert.equal(veoConfig.modelOptions.imageTextToVideo.resolution, '720p');

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        imageTextToVideo: 'google/veo-3.1-fast'
      },
      modelOptions: {
        imageTextToVideo: {
          mode: 'pro'
        }
      }
    }),
    /is not supported for selected model/
  );

  const veo31Config = normalizeAndValidateProjectConfig({
    models: {
      imageTextToVideo: 'google/veo-3.1'
    },
    modelOptions: {
      imageTextToVideo: {
        resolution: '1080p',
        negative_prompt: 'noise, blur',
        seed: 17
      }
    }
  });

  assert.equal(veo31Config.models.imageTextToVideo, 'google/veo-3.1');
  assert.equal(veo31Config.modelOptions.imageTextToVideo.resolution, '1080p');

  const chatterboxConfig = normalizeAndValidateProjectConfig({
    models: {
      textToSpeech: 'resemble-ai/chatterbox-turbo'
    },
    modelOptions: {
      textToSpeech: {
        voice: 'Andy',
        temperature: 0.9,
        top_p: 0.95,
        top_k: 1000,
        repetition_penalty: 1.2,
        seed: null
      }
    }
  });

  assert.equal(chatterboxConfig.models.textToSpeech, 'resemble-ai/chatterbox-turbo');
  assert.equal(chatterboxConfig.modelOptions.textToSpeech.voice, 'Andy');

  const kokoroConfig = normalizeAndValidateProjectConfig({
    models: {
      textToSpeech: 'jaaari/kokoro-82m'
    },
    modelOptions: {
      textToSpeech: {
        voice: 'af_bella',
        speed: 1.2
      }
    }
  });

  assert.equal(kokoroConfig.models.textToSpeech, 'jaaari/kokoro-82m');
  assert.equal(kokoroConfig.modelOptions.textToSpeech.voice, 'af_bella');
  assert.equal(kokoroConfig.modelOptions.textToSpeech.speed, 1.2);

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        textToSpeech: 'jaaari/kokoro-82m'
      },
      modelOptions: {
        textToSpeech: {
          voice_id: 'Wise_Woman'
        }
      }
    }),
    /is not supported for selected model/
  );

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        textToSpeech: 'resemble-ai/chatterbox-turbo'
      },
      modelOptions: {
        textToSpeech: {
          reference_audio: 'https://example.com/reference.wav'
        }
      }
    }),
    /is not supported for selected model/
  );

  assert.throws(
    () => normalizeAndValidateProjectConfig({
      models: {
        imageTextToVideo: 'google/veo-3.1'
      },
      modelOptions: {
        imageTextToVideo: {
          quality: '720p'
        }
      }
    }),
    /is not supported for selected model/
  );
});

test('writeProjectConfig and readProjectConfig enforce canonical validated config', async () => {
  const project = uniqueProject('ut-project-config');
  await ensureProject(project);

  const written = await writeProjectConfig(project, {
    aspectRatio: '1:1',
    targetDurationSec: 45,
    finalDurationMode: 'match_visual',
    keyframeWidth: 512,
    keyframeHeight: 512,
    models: {
      textToText: 'deepseek-ai/deepseek-v3',
      textToSpeech: 'minimax/speech-02-turbo',
      textToImage: 'prunaai/z-image-turbo',
      imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
    }
  });

  assert.equal(written.aspectRatio, '1:1');
  assert.equal(written.targetDurationSec, 45);
  assert.equal(written.finalDurationMode, 'match_visual');
  assert.equal(written.models.textToImage, 'prunaai/z-image-turbo');

  const readBack = await readProjectConfig(project);
  assert.deepEqual(readBack, written);

  await cleanupProject(project);
});

test('ensureProjectConfig writes default config when missing', async () => {
  const project = uniqueProject('ut-project-default');
  await ensureProject(project);
  const configPath = getProjectConfigPath(project);
  await fs.rm(configPath, { force: true });

  const config = await ensureProjectConfig(project);
  assert.equal(config.aspectRatio, '9:16');
  assert.equal(config.finalDurationMode, 'match_audio');
  assert.deepEqual(config.models, DEFAULT_MODEL_SELECTIONS);

  const persistedRaw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(persistedRaw.aspectRatio, '9:16');

  await cleanupProject(project);
});
