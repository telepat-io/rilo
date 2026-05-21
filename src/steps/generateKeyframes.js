import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ensureDir } from '../media/files.js';

export async function generateKeyframe(
  promptText,
  tone,
  aspectRatio = '9:16',
  index = 0,
  _trace,
  options = {}
) {
  const deps = options.deps || {};
  const limn = options.limn || deps.limn || null;
  const family = options.family;
  const replicateModel = options.replicateModel;
  const modelOptions = options.modelOptions ?? {};

  if (!family) {
    throw new Error('Limn model family is required for keyframe generation');
  }

  if (!limn) {
    throw new Error('Limn instance is required for keyframe generation');
  }

  const result = await limn.generate(promptText, family, {
    aspectRatio,
    ...(replicateModel ? { replicateModel } : {}),
    options: modelOptions
  });

  if (!result || !result.image) {
    throw new Error(`Missing keyframe output for shot ${index + 1}`);
  }

  return {
    buffer: result.image,
    outputUrl: result.outputUrl || '',
    mimeType: result.mimeType || 'image/png',
    modelSlug: result.modelSlug || family
  };
}

export async function generateKeyframes(shots, tone, aspectRatio = '9:16', _trace, options = {}) {
  const results = [];
  for (let i = 0; i < shots.length; i += 1) {
    const result = await generateKeyframe(shots[i], tone, aspectRatio, i, _trace, options);
    results.push(result);
  }
  return results;
}

function mimeTypeToExtension(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

export async function persistKeyframe(projectDir, keyframeResult, index, options = {}) {
  const deps = options.deps || {};
  const ensureDirFn = deps.ensureDir || ensureDir;
  const writeFileFn = deps.writeFile || writeFile;

  const keyframesDir = path.join(projectDir, 'assets', 'keyframes');
  await ensureDirFn(keyframesDir);

  // Handle Limn buffer result
  if (keyframeResult && typeof keyframeResult === 'object' && keyframeResult.buffer) {
    const ext = mimeTypeToExtension(keyframeResult.mimeType || 'image/png');
    const keyframePath = path.join(keyframesDir, `keyframe_${String(index + 1).padStart(2, '0')}.${ext}`);
    await writeFileFn(keyframePath, keyframeResult.buffer);
    return keyframePath;
  }

  // Handle legacy URL string
  if (typeof keyframeResult === 'string') {
    const depsDownload = deps.downloadToFile;
    const downloadToFileFn = depsDownload || (await import('../media/files.js')).downloadToFile;
    const keyframePath = path.join(keyframesDir, `keyframe_${String(index + 1).padStart(2, '0')}.png`);
    await downloadToFileFn(keyframeResult, keyframePath);
    return keyframePath;
  }

  throw new Error('Invalid keyframe result: expected buffer object or URL string');
}

export async function persistKeyframes(projectDir, keyframeResults, options = {}) {
  const keyframePaths = [];
  for (let i = 0; i < keyframeResults.length; i += 1) {
    const keyframePath = await persistKeyframe(projectDir, keyframeResults[i], i, options);
    keyframePaths.push(keyframePath);
  }

  return keyframePaths;
}
