import { MODELS, DEFAULT_VIDEO_CONFIG } from '../config/models.js';
import { runModel, extractOutputText } from '../providers/predictions.js';

const SCRIPT_WORDS_PER_SECOND = 2.6;
const SCRIPT_RETRY_LIMIT = 3;
const SHOTS_RETRY_LIMIT = 3;

function extractJsonBlock(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response did not include JSON payload');
  }
  return text.slice(start, end + 1);
}

function countWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildWordBudget(targetDurationSec) {
  const targetWords = Math.max(20, Math.round(targetDurationSec * SCRIPT_WORDS_PER_SECOND));
  return {
    targetWords,
    minWords: Math.max(20, Math.floor(targetWords * 0.9)),
    maxWords: Math.max(30, Math.ceil(targetWords * 1.1))
  };
}

function buildScriptPrompt(story, targetDurationSec, wordBudget, attempt) {
  const retryInstruction =
    attempt > 1
      ? `\nIMPORTANT: previous attempt missed the narration length target. Keep script length strictly between ${wordBudget.minWords} and ${wordBudget.maxWords} words.`
      : '';

  return `You are writing narration for a short video. Return ONLY JSON with keys: script, tone.\nRequirements:\n- script: narration text matching roughly ${targetDurationSec} seconds of voiceover\n- script length: strictly between ${wordBudget.minWords} and ${wordBudget.maxWords} words (target ${wordBudget.targetWords})\n- tone: concise tone label${retryInstruction}\nStory source:\n${story}`;
}

function buildShotsPrompt(script, shotCount, tone, attempt) {
  const retryInstruction =
    attempt > 1
      ? `\nIMPORTANT: previous attempt failed shape checks. Return exactly ${shotCount} shots.`
      : '';

  const toneHint = typeof tone === 'string' && tone.trim() ? tone.trim() : 'neutral';
  return `You are writing visual keyframe prompts for a short video narration. Return ONLY JSON with key: shots.\nRequirements:\n- shots: array of exactly ${shotCount} short visual descriptions\n- each shot: exactly one sentence, concrete and visually descriptive\n- each shot must be fully self-contained because prompts are generated independently (do not rely on context from other shots)\n- in every shot, restate essential visual context like characters, setting, era/time-of-day, and key scene details when relevant\n- keep continuity of characters/setting across shots while still repeating critical details per shot\n- align with narration pacing and tone: ${toneHint}${retryInstruction}\nNarration:\n${script}`;
}

export async function generateScript(story, options = {}, trace = null) {
  const deps = options.deps || {};
  const runModelFn = deps.runModel || runModel;
  const extractOutputTextFn = deps.extractOutputText || extractOutputText;

  const targetDurationSec = Number.isInteger(options.targetDurationSec) && options.targetDurationSec > 0
    ? options.targetDurationSec
    : DEFAULT_VIDEO_CONFIG.durationSec;
  const wordBudget = buildWordBudget(targetDurationSec);

  let bestCandidate = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let attempt = 1; attempt <= SCRIPT_RETRY_LIMIT; attempt += 1) {
    const prompt = buildScriptPrompt(story, targetDurationSec, wordBudget, attempt);
    const prediction = await runModelFn({
      model: MODELS.deepseek,
      input: {
        prompt,
        max_tokens: 1800,
        temperature: 0.6
      },
      trace: trace ? { ...trace, step: 'script', attempt } : null
    });

    const text = extractOutputTextFn(prediction.output);
    const parsed = JSON.parse(extractJsonBlock(text));

    if (!parsed.script || typeof parsed.script !== 'string') {
      continue;
    }

    const words = countWords(parsed.script);
    const distance = Math.abs(words - wordBudget.targetWords);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = {
        script: parsed.script,
        tone: parsed.tone || 'neutral',
        scriptWordCount: words,
        targetWordCount: wordBudget.targetWords
      };
    }

    if (words >= wordBudget.minWords && words <= wordBudget.maxWords) {
      return bestCandidate;
    }
  }

  if (!bestCandidate) {
    throw new Error('Invalid script output shape');
  }

  return bestCandidate;
}

export async function generateShots(script, options = {}, trace = null) {
  const deps = options.deps || {};
  const runModelFn = deps.runModel || runModel;
  const extractOutputTextFn = deps.extractOutputText || extractOutputText;

  const shotCount = Number.isInteger(options.shotCount) && options.shotCount > 0
    ? options.shotCount
    : DEFAULT_VIDEO_CONFIG.shots;
  const tone = typeof options.tone === 'string' ? options.tone : 'neutral';

  for (let attempt = 1; attempt <= SHOTS_RETRY_LIMIT; attempt += 1) {
    const prompt = buildShotsPrompt(script, shotCount, tone, attempt);
    const prediction = await runModelFn({
      model: MODELS.deepseek,
      input: {
        prompt,
        max_tokens: 1800,
        temperature: 0.5
      },
      trace: trace ? { ...trace, step: 'shots', attempt } : null
    });

    const text = extractOutputTextFn(prediction.output);
    const parsed = JSON.parse(extractJsonBlock(text));
    const candidateShots = parsed?.shots;
    const hasValidShape =
      Array.isArray(candidateShots) &&
      candidateShots.length === shotCount &&
      candidateShots.every((shot) => typeof shot === 'string' && shot.trim().length > 0);

    if (hasValidShape) {
      return {
        shots: candidateShots.map((shot) => shot.trim())
      };
    }
  }

  throw new Error('Invalid shots output shape');
}
