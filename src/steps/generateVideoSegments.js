import {
  DEFAULT_VIDEO_CONFIG,
  ASPECT_RATIO_PRESETS,
  MODEL_CATEGORIES,
  resolveModelForCategory
} from '../config/models.js';
import { runModel, extractOutputUri } from '../providers/predictions.js';
import path from 'node:path';
import { downloadToFile, ensureDir } from '../media/files.js';

function secondsToFrames(seconds, fps) {
  return Math.max(81, Math.round(seconds * fps));
}

function asModelOptions(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {};
  }
  return candidate;
}

export async function generateVideoSegmentAtIndex(
  segmentIndex,
  keyframeUrls,
  timeline,
  shots = [],
  aspectRatio = '9:16',
  trace = null,
  options = {}
) {
  const deps = options.deps || {};
  const runModelFn = deps.runModel || runModel;
  const extractOutputUriFn = deps.extractOutputUri || extractOutputUri;

  const preset = ASPECT_RATIO_PRESETS[aspectRatio] || ASPECT_RATIO_PRESETS['9:16'];
  const totalKeyframes = keyframeUrls.length;
  const durationSec = timeline[segmentIndex]?.durationSec || 5;
  const modelId = options.modelId || resolveModelForCategory(MODEL_CATEGORIES.imageTextToVideo);
  const modelOptions = asModelOptions(options.modelOptions);

  if (segmentIndex < 0 || segmentIndex >= totalKeyframes - 1) {
    throw new Error(`segment index ${segmentIndex} out of range for ${Math.max(0, totalKeyframes - 1)} segments`);
  }

  const prompt = shots[segmentIndex] || `Cinematic continuity shot ${segmentIndex + 1}`;
  const prediction = await runModelFn({
    model: modelId,
    input: {
      ...modelOptions,
      prompt,
      image: keyframeUrls[segmentIndex],
      last_image: keyframeUrls[segmentIndex + 1],
      num_frames: secondsToFrames(durationSec, DEFAULT_VIDEO_CONFIG.fps),
      frames_per_second: DEFAULT_VIDEO_CONFIG.fps,
      resolution: preset.videoResolution
    },
    trace: trace ? { ...trace, step: 'segment', index: segmentIndex } : null
  });

  const url = extractOutputUriFn(prediction.output);
  if (!url) {
    throw new Error(`Missing segment output for segment ${segmentIndex + 1}`);
  }
  return url;
}

export async function generateVideoSegments(keyframeUrls, timeline, shots = [], aspectRatio = '9:16', trace = null, options = {}) {
  const segmentUrls = [];

  for (let i = 0; i < Math.max(0, keyframeUrls.length - 1); i += 1) {
    const url = await generateVideoSegmentAtIndex(i, keyframeUrls, timeline, shots, aspectRatio, trace, options);
    segmentUrls.push(url);
  }

  return segmentUrls;
}

export async function persistSegment(projectDir, segmentUrl, index, options = {}) {
  const deps = options.deps || {};
  const ensureDirFn = deps.ensureDir || ensureDir;
  const downloadToFileFn = deps.downloadToFile || downloadToFile;

  const segmentsDir = path.join(projectDir, 'assets', 'segments');
  await ensureDirFn(segmentsDir);
  const segmentPath = path.join(segmentsDir, `segment_${String(index + 1).padStart(2, '0')}.mp4`);
  await downloadToFileFn(segmentUrl, segmentPath);
  return segmentPath;
}

export async function persistSegments(projectDir, segmentUrls, options = {}) {
  const segmentPaths = [];
  for (let i = 0; i < segmentUrls.length; i += 1) {
    const segmentPath = await persistSegment(projectDir, segmentUrls[i], i, options);
    segmentPaths.push(segmentPath);
  }

  return segmentPaths;
}
