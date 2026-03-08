import { ASPECT_RATIO_PRESETS, MODEL_CATEGORIES, resolveModelForCategory } from '../config/models.js';
import { runModel, extractOutputUri } from '../providers/predictions.js';
import path from 'node:path';
import { downloadToFile, ensureDir } from '../media/files.js';
import { resolveTextToImageAdapter } from './textToImageAdapters.js';

export async function generateKeyframe(
  promptText,
  tone,
  aspectRatio = '9:16',
  index = 0,
  trace = null,
  sizeOverride = null,
  options = {}
) {
  const deps = options.deps || {};
  const runModelFn = deps.runModel || runModel;
  const extractOutputUriFn = deps.extractOutputUri || extractOutputUri;

  const preset = ASPECT_RATIO_PRESETS[aspectRatio] || ASPECT_RATIO_PRESETS['9:16'];
  const width = sizeOverride?.width || preset.keyframeWidth || ASPECT_RATIO_PRESETS['9:16'].keyframeWidth;
  const height = sizeOverride?.height || preset.keyframeHeight || ASPECT_RATIO_PRESETS['9:16'].keyframeHeight;
  const modelId = options.modelId || resolveModelForCategory(MODEL_CATEGORIES.textToImage);
  const modelOptions = options.modelOptions;
  const adapter = resolveTextToImageAdapter(modelId);

  const prediction = await runModelFn({
    model: modelId,
    input: adapter.buildInput({ promptText, tone, index, aspectRatio, width, height, modelOptions }),
    trace: trace ? { ...trace, step: 'keyframe', index } : null
  });

  const imageUrl = extractOutputUriFn(prediction.output);
  if (!imageUrl) {
    throw new Error(`Missing keyframe output for shot ${index + 1}`);
  }

  return imageUrl;
}

export async function generateKeyframes(shots, tone, aspectRatio = '9:16', trace = null, options = {}) {
  const urls = [];
  for (let i = 0; i < shots.length; i += 1) {
    const imageUrl = await generateKeyframe(shots[i], tone, aspectRatio, i, trace, null, options);
    urls.push(imageUrl);
  }
  return urls;
}

export async function persistKeyframe(projectDir, keyframeUrl, index, options = {}) {
  const deps = options.deps || {};
  const ensureDirFn = deps.ensureDir || ensureDir;
  const downloadToFileFn = deps.downloadToFile || downloadToFile;

  const keyframesDir = path.join(projectDir, 'assets', 'keyframes');
  await ensureDirFn(keyframesDir);
  const keyframePath = path.join(keyframesDir, `keyframe_${String(index + 1).padStart(2, '0')}.png`);
  await downloadToFileFn(keyframeUrl, keyframePath);
  return keyframePath;
}

export async function persistKeyframes(projectDir, keyframeUrls, options = {}) {
  const keyframePaths = [];
  for (let i = 0; i < keyframeUrls.length; i += 1) {
    const keyframePath = await persistKeyframe(projectDir, keyframeUrls[i], i, options);
    keyframePaths.push(keyframePath);
  }

  return keyframePaths;
}
