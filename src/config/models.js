import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(CONFIG_DIR, '../../models');

export const MODELS = {
  deepseek: 'deepseek-ai/deepseek-v3',
  keyframe: 'prunaai/z-image-turbo',
  flux: 'black-forest-labs/flux-2-pro',
  fluxSchnell: 'black-forest-labs/flux-schnell',
  nanoBananaPro: 'google/nano-banana-pro',
  seedream4: 'bytedance/seedream-4',
  video: 'wan-video/wan-2.2-i2v-fast',
  klingVideo3: 'kwaivgi/kling-v3-video',
  pixverseV56: 'pixverse/pixverse-v5.6',
  veo31: 'google/veo-3.1',
  veo31Fast: 'google/veo-3.1-fast',
  tts: 'minimax/speech-02-turbo',
  chatterboxTurbo: 'resemble-ai/chatterbox-turbo',
  kokoro82m: 'jaaari/kokoro-82m'
};

export const MODEL_CATEGORIES = {
  textToText: 'textToText',
  textToSpeech: 'textToSpeech',
  textToImage: 'textToImage',
  imageTextToVideo: 'imageTextToVideo'
};

export const DEFAULT_MODEL_SELECTIONS = {
  [MODEL_CATEGORIES.textToText]: MODELS.deepseek,
  [MODEL_CATEGORIES.textToSpeech]: MODELS.tts,
  [MODEL_CATEGORIES.textToImage]: MODELS.keyframe,
  [MODEL_CATEGORIES.imageTextToVideo]: MODELS.video
};

export const MODEL_SELECTION_KEYS = Object.keys(DEFAULT_MODEL_SELECTIONS);
export const MODEL_OPTION_KEYS = [...MODEL_SELECTION_KEYS];

const MODEL_METADATA_FILES = {
  [MODELS.deepseek]: 'deepseek-ai__deepseek-v3.json',
  [MODELS.keyframe]: 'prunaai__z-image-turbo.json',
  [MODELS.flux]: 'black-forest-labs__flux-2-pro.json',
  [MODELS.fluxSchnell]: 'black-forest-labs__flux-schnell.json',
  [MODELS.nanoBananaPro]: 'google__nano-banana-pro.json',
  [MODELS.seedream4]: 'bytedance__seedream-4.json',
  [MODELS.video]: 'wan-video__wan-2.2-i2v-fast.json',
  [MODELS.klingVideo3]: 'kwaivgi__kling-v3-video.json',
  [MODELS.pixverseV56]: 'pixverse__pixverse-v5.6.json',
  [MODELS.veo31]: 'google__veo-3.1.json',
  [MODELS.veo31Fast]: 'google__veo-3.1-fast.json',
  [MODELS.tts]: 'minimax__speech-02-turbo.json',
  [MODELS.chatterboxTurbo]: 'resemble-ai__chatterbox-turbo.json',
  [MODELS.kokoro82m]: 'jaaari__kokoro-82m.json'
};

export const MODEL_IDS_BY_CATEGORY = {
  [MODEL_CATEGORIES.textToText]: [MODELS.deepseek],
  [MODEL_CATEGORIES.textToSpeech]: [MODELS.tts, MODELS.chatterboxTurbo, MODELS.kokoro82m],
  [MODEL_CATEGORIES.textToImage]: [MODELS.keyframe, MODELS.flux, MODELS.fluxSchnell, MODELS.nanoBananaPro, MODELS.seedream4],
  [MODEL_CATEGORIES.imageTextToVideo]: [MODELS.video, MODELS.klingVideo3, MODELS.pixverseV56, MODELS.veo31, MODELS.veo31Fast]
};

export function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePricing(pricing = {}) {
  return {
    usdPerSecond: toNullableNumber(pricing.usdPerSecond),
    usdPer1kInputTokens: toNullableNumber(pricing.usdPer1kInputTokens),
    usdPer1kOutputTokens: toNullableNumber(pricing.usdPer1kOutputTokens)
  };
}

export function readModelMetadata(modelId) {
  const fileName = MODEL_METADATA_FILES[modelId];
  if (!fileName) {
    return {
      modelId,
      pricing: normalizePricing({})
    };
  }

  const filePath = path.join(MODELS_DIR, fileName);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      modelId: parsed.modelId || modelId,
      pricing: normalizePricing(parsed.pricing || {})
    };
  } catch {
    return {
      modelId,
      pricing: normalizePricing({})
    };
  }
}

export const MODEL_METADATA = Object.fromEntries(
  Object.values(MODELS).map((modelId) => [modelId, readModelMetadata(modelId)])
);

export const SUPPORTED_MODEL_IDS = Object.keys(MODEL_METADATA);

export const MODEL_PRICING = Object.fromEntries(
  Object.entries(MODEL_METADATA).map(([modelId, metadata]) => [modelId, normalizePricing(metadata.pricing || {})])
);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getSafeInputOptions(metadata = {}) {
  const inputOptions = isPlainObject(metadata.inputOptions) ? metadata.inputOptions : {};
  const userConfigurable = Array.isArray(inputOptions.userConfigurable)
    ? inputOptions.userConfigurable.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const pipelineManaged = Array.isArray(inputOptions.pipelineManaged)
    ? inputOptions.pipelineManaged.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const fields = isPlainObject(inputOptions.fields) ? inputOptions.fields : {};

  return {
    userConfigurable,
    pipelineManaged,
    fields
  };
}

export function getModelInputOptions(modelId) {
  return getSafeInputOptions(MODEL_METADATA[modelId]);
}

export function resolveModelInputOptionsForCategory(category, modelSelections = {}) {
  const modelId = resolveModelForCategory(category, modelSelections);
  return getModelInputOptions(modelId);
}

export function resolveDefaultModelOptionsForCategory(category, modelSelections = {}) {
  const inputOptions = resolveModelInputOptionsForCategory(category, modelSelections);
  const defaults = {};

  for (const optionKey of inputOptions.userConfigurable) {
    const field = inputOptions.fields[optionKey];
    if (field && Object.prototype.hasOwnProperty.call(field, 'default')) {
      defaults[optionKey] = field.default;
    }
  }

  return defaults;
}

export function getDefaultProjectModelOptions(modelSelections = {}) {
  return Object.fromEntries(
    MODEL_OPTION_KEYS.map((category) => [category, resolveDefaultModelOptionsForCategory(category, modelSelections)])
  );
}

export function resolveProjectModelOptions(modelOptions = {}, modelSelections = {}) {
  const defaults = getDefaultProjectModelOptions(modelSelections);
  const normalizedInput = isPlainObject(modelOptions) ? modelOptions : {};

  return Object.fromEntries(
    MODEL_OPTION_KEYS.map((category) => {
      const candidate = normalizedInput[category];
      if (!isPlainObject(candidate)) {
        return [category, defaults[category]];
      }
      return [category, { ...defaults[category], ...candidate }];
    })
  );
}

export function isKnownModelId(modelId) {
  return typeof modelId === 'string' && SUPPORTED_MODEL_IDS.includes(modelId);
}

export function resolveProjectModelSelections(modelSelections = {}) {
  if (!modelSelections || typeof modelSelections !== 'object' || Array.isArray(modelSelections)) {
    return {
      ...DEFAULT_MODEL_SELECTIONS
    };
  }

  const resolved = {
    ...DEFAULT_MODEL_SELECTIONS
  };

  for (const key of MODEL_SELECTION_KEYS) {
    const candidate = modelSelections[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      resolved[key] = candidate.trim();
    }
  }

  return resolved;
}

export function resolveModelForCategory(category, modelSelections = {}) {
  if (!MODEL_SELECTION_KEYS.includes(category)) {
    throw new Error(`Unknown model category: ${category}`);
  }
  return resolveProjectModelSelections(modelSelections)[category];
}

export function getSupportedModelIdsForCategory(category) {
  if (!MODEL_SELECTION_KEYS.includes(category)) {
    throw new Error(`Unknown model category: ${category}`);
  }

  return [...(MODEL_IDS_BY_CATEGORY[category] || [])];
}

export const DEFAULT_VIDEO_CONFIG = {
  width: 720,
  height: 1280,
  fps: 16,
  durationSec: 60,
  shots: 12,
  segmentDurationSec: 5,
  renderSpecVersion: 2
};

export function resolveTargetDurationSec(config = {}) {
  const value = config.targetDurationSec;
  if (Number.isInteger(value) && value >= 5) {
    return value;
  }
  return DEFAULT_VIDEO_CONFIG.durationSec;
}

export function resolveShotCount(config = {}) {
  const targetDurationSec = resolveTargetDurationSec(config);
  return Math.max(1, Math.ceil(targetDurationSec / DEFAULT_VIDEO_CONFIG.segmentDurationSec));
}

export const ASPECT_RATIO_PRESETS = {
  '1:1': {
    keyframeWidth: 1024,
    keyframeHeight: 1024,
    videoResolution: '720p'
  },
  '16:9': {
    keyframeWidth: 1024,
    keyframeHeight: 576,
    videoResolution: '720p'
  },
  '9:16': {
    keyframeWidth: 576,
    keyframeHeight: 1024,
    videoResolution: '720p'
  }
};

export function resolveKeyframeSize(config = {}) {
  const aspectRatio = config.aspectRatio || '9:16';
  const preset = ASPECT_RATIO_PRESETS[aspectRatio] || ASPECT_RATIO_PRESETS['9:16'];

  if (Number.isInteger(config.keyframeWidth) && Number.isInteger(config.keyframeHeight)) {
    return {
      width: config.keyframeWidth,
      height: config.keyframeHeight,
      key: `${config.keyframeWidth}x${config.keyframeHeight}`
    };
  }

  return {
    width: preset.keyframeWidth,
    height: preset.keyframeHeight,
    key: `${preset.keyframeWidth}x${preset.keyframeHeight}`
  };
}
