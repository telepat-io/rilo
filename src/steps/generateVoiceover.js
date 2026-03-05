import { DEFAULT_VIDEO_CONFIG, MODEL_CATEGORIES, resolveModelForCategory } from '../config/models.js';
import { runModel, extractOutputUri } from '../providers/predictions.js';
import path from 'node:path';
import { downloadToFile, ensureDir } from '../media/files.js';

const TTS_WORDS_PER_SECOND = 2.6;
const MIN_TTS_SPEED = 0.75;
const MAX_TTS_SPEED = 1.25;

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function asModelOptions(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {};
  }
  return candidate;
}

export function resolveTtsSpeed(script, targetDurationSec) {
  const words = countWords(script);
  const safeTarget = Number.isInteger(targetDurationSec) && targetDurationSec > 0
    ? targetDurationSec
    : DEFAULT_VIDEO_CONFIG.durationSec;

  const estimatedAtSpeedOne = words / TTS_WORDS_PER_SECOND;
  const rawSpeed = estimatedAtSpeedOne / safeTarget;
  const speed = clamp(rawSpeed || 1, MIN_TTS_SPEED, MAX_TTS_SPEED);

  return {
    speed,
    words,
    estimatedAtSpeedOneSec: Math.round(estimatedAtSpeedOne * 1000) / 1000
  };
}

export function buildFixedTimeline(shotsCount, segmentDurationSec = DEFAULT_VIDEO_CONFIG.segmentDurationSec) {
  const normalizedShotCount = Number.isInteger(shotsCount) && shotsCount > 0 ? shotsCount : DEFAULT_VIDEO_CONFIG.shots;
  const normalizedSegmentDuration = Number.isInteger(segmentDurationSec) && segmentDurationSec > 0
    ? segmentDurationSec
    : DEFAULT_VIDEO_CONFIG.segmentDurationSec;

  return Array.from({ length: normalizedShotCount }, (_, idx) => ({
    shot: idx + 1,
    durationSec: normalizedSegmentDuration
  }));
}

export function resolveSegmentCountFromAudioDuration(audioDurationSec, segmentDurationSec = DEFAULT_VIDEO_CONFIG.segmentDurationSec) {
  const normalizedSegmentDuration = Number.isInteger(segmentDurationSec) && segmentDurationSec > 0
    ? segmentDurationSec
    : DEFAULT_VIDEO_CONFIG.segmentDurationSec;

  if (!Number.isFinite(audioDurationSec) || audioDurationSec <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(audioDurationSec / normalizedSegmentDuration));
}

export async function generateVoiceover(script, options = {}, trace = null) {
  const deps = options.deps || {};
  const runModelFn = deps.runModel || runModel;
  const extractOutputUriFn = deps.extractOutputUri || extractOutputUri;

  const shotsCount = Number.isInteger(options.shotsCount) && options.shotsCount > 0
    ? options.shotsCount
    : DEFAULT_VIDEO_CONFIG.shots;
  const segmentDurationSec = Number.isInteger(options.segmentDurationSec) && options.segmentDurationSec > 0
    ? options.segmentDurationSec
    : DEFAULT_VIDEO_CONFIG.segmentDurationSec;
  const targetDurationSec = Number.isInteger(options.targetDurationSec) && options.targetDurationSec > 0
    ? options.targetDurationSec
    : shotsCount * segmentDurationSec;
  const ttsPlan = resolveTtsSpeed(script, targetDurationSec);
  const modelId = options.modelId || resolveModelForCategory(MODEL_CATEGORIES.textToSpeech);
  const modelOptions = asModelOptions(options.modelOptions);

  const prediction = await runModelFn({
    model: modelId,
    input: {
      speed: ttsPlan.speed,
      subtitle_enable: false,
      ...modelOptions,
      text: script
    },
    trace: trace ? { ...trace, step: 'voiceover' } : null
  });

  return {
    voiceoverUrl: extractOutputUriFn(prediction.output),
    timeline: buildFixedTimeline(shotsCount, segmentDurationSec),
    ttsPlan: {
      ...ttsPlan,
      targetDurationSec
    }
  };
}

export async function persistVoiceover(projectDir, voiceoverUrl, options = {}) {
  const deps = options.deps || {};
  const ensureDirFn = deps.ensureDir || ensureDir;
  const downloadToFileFn = deps.downloadToFile || downloadToFile;

  const audioDir = path.join(projectDir, 'assets', 'audio');
  await ensureDirFn(audioDir);
  const voicePath = path.join(audioDir, 'voiceover.mp3');
  await downloadToFileFn(voiceoverUrl, voicePath);
  return voicePath;
}
