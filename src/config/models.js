import fs from 'node:fs';
import path from 'node:path';

export const MODELS = {
  deepseek: 'deepseek-ai/deepseek-v3',
  keyframe: 'prunaai/z-image-turbo',
  video: 'wan-video/wan-2.2-i2v-fast',
  tts: 'minimax/speech-02-turbo'
};

const MODEL_METADATA_FILES = {
  [MODELS.deepseek]: 'deepseek-ai__deepseek-v3.json',
  [MODELS.keyframe]: 'prunaai__z-image-turbo.json',
  [MODELS.video]: 'wan-video__wan-2.2-i2v-fast.json',
  [MODELS.tts]: 'minimax__speech-02-turbo.json'
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

  const filePath = path.join(process.cwd(), 'models', fileName);
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

export const MODEL_PRICING = Object.fromEntries(
  Object.entries(MODEL_METADATA).map(([modelId, metadata]) => [modelId, normalizePricing(metadata.pricing || {})])
);

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
