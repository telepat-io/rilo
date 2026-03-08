import { DEFAULT_VIDEO_CONFIG, MODELS } from '../config/models.js';

function normalizeModelOptions(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {};
  }
  return candidate;
}

function secondsToFrames(seconds, fps) {
  return Math.max(81, Math.round(seconds * fps));
}

function buildWanInput({ prompt, startImage, endImage, durationSec, videoResolution, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt,
    image: startImage,
    last_image: endImage,
    num_frames: secondsToFrames(durationSec, DEFAULT_VIDEO_CONFIG.fps),
    frames_per_second: DEFAULT_VIDEO_CONFIG.fps,
    resolution: videoResolution
  };
}

function buildKlingInput({ prompt, startImage, endImage, aspectRatio, modelOptions }) {
  const normalizedOptions = {
    ...normalizeModelOptions(modelOptions),
    generate_audio: false
  };

  return {
    ...normalizedOptions,
    prompt,
    start_image: startImage,
    end_image: endImage,
    aspect_ratio: aspectRatio,
    duration: 5
  };
}

function buildPixverseInput({ prompt, startImage, endImage, aspectRatio, modelOptions }) {
  const normalizedOptions = {
    ...normalizeModelOptions(modelOptions),
    generate_audio_switch: false
  };

  return {
    ...normalizedOptions,
    prompt,
    image: startImage,
    last_frame_image: endImage,
    aspect_ratio: aspectRatio,
    duration: 5
  };
}

function buildVeoInput({ prompt, startImage, endImage, aspectRatio, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt,
    image: startImage,
    last_frame: endImage,
    aspect_ratio: aspectRatio,
    duration: 5,
    generate_audio: false
  };
}

const IMAGE_TO_VIDEO_ADAPTERS = {
  [MODELS.video]: {
    modelId: MODELS.video,
    buildInput: buildWanInput
  },
  [MODELS.klingVideo3]: {
    modelId: MODELS.klingVideo3,
    buildInput: buildKlingInput
  },
  [MODELS.pixverseV56]: {
    modelId: MODELS.pixverseV56,
    buildInput: buildPixverseInput
  },
  [MODELS.veo31]: {
    modelId: MODELS.veo31,
    buildInput: buildVeoInput
  },
  [MODELS.veo31Fast]: {
    modelId: MODELS.veo31Fast,
    buildInput: buildVeoInput
  }
};

const DEFAULT_IMAGE_TO_VIDEO_ADAPTER = {
  modelId: null,
  buildInput: buildWanInput
};

export function resolveImageToVideoAdapter(modelId) {
  return IMAGE_TO_VIDEO_ADAPTERS[modelId] || DEFAULT_IMAGE_TO_VIDEO_ADAPTER;
}
