import { MODELS } from '../config/models.js';

function normalizeModelOptions(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {};
  }
  return candidate;
}

function buildCommonPrompt(promptText, tone, index) {
  return `Cinematic documentary style, coherent character continuity, shot ${index + 1}, tone ${tone}. ${promptText}`;
}

function buildPrunaInput({ promptText, tone, index, width, height, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt: buildCommonPrompt(promptText, tone, index),
    width,
    height
  };
}

function buildFluxInput({ promptText, tone, index, width, height, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt: buildCommonPrompt(promptText, tone, index),
    aspect_ratio: 'custom',
    width,
    height
  };
}

function buildFluxSchnellInput({ promptText, tone, index, aspectRatio, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt: buildCommonPrompt(promptText, tone, index),
    aspect_ratio: aspectRatio
  };
}

function buildNanoBananaProInput({ promptText, tone, index, aspectRatio, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt: buildCommonPrompt(promptText, tone, index),
    aspect_ratio: aspectRatio
  };
}

function buildSeedream4Input({ promptText, tone, index, aspectRatio, modelOptions }) {
  return {
    ...normalizeModelOptions(modelOptions),
    prompt: buildCommonPrompt(promptText, tone, index),
    aspect_ratio: aspectRatio
  };
}

const TEXT_TO_IMAGE_ADAPTERS = {
  [MODELS.keyframe]: {
    modelId: MODELS.keyframe,
    buildInput: buildPrunaInput
  },
  [MODELS.flux]: {
    modelId: MODELS.flux,
    buildInput: buildFluxInput
  },
  [MODELS.fluxSchnell]: {
    modelId: MODELS.fluxSchnell,
    buildInput: buildFluxSchnellInput
  },
  [MODELS.nanoBananaPro]: {
    modelId: MODELS.nanoBananaPro,
    buildInput: buildNanoBananaProInput
  },
  [MODELS.seedream4]: {
    modelId: MODELS.seedream4,
    buildInput: buildSeedream4Input
  }
};

const DEFAULT_TEXT_TO_IMAGE_ADAPTER = {
  modelId: null,
  buildInput: buildPrunaInput
};

export function resolveTextToImageAdapter(modelId) {
  return TEXT_TO_IMAGE_ADAPTERS[modelId] || DEFAULT_TEXT_TO_IMAGE_ADAPTER;
}
