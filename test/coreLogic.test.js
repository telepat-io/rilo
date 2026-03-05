import test from 'node:test';
import assert from 'node:assert/strict';

import { preprocessStory } from '../src/pipeline/inputSanitizer.js';
import { assertSafeStory, sanitizeStoryInput } from '../src/policy/contentGuardrails.js';
import {
  DEFAULT_MODEL_SELECTIONS,
  MODEL_CATEGORIES,
  DEFAULT_VIDEO_CONFIG,
  isKnownModelId,
  resolveKeyframeSize,
  resolveModelForCategory,
  resolveProjectModelSelections,
  resolveShotCount,
  resolveTargetDurationSec
} from '../src/config/models.js';

test('assertSafeStory enforces minimum length and preprocessStory sanitizes', () => {
  assert.throws(() => assertSafeStory('too short'), /at least 50 characters/);

  const story = 'Judge Anderson met John Smith at 123 Main Street and SSN 123-45-6789 for testimony.';
  const paddedStory = `${story} Additional context to satisfy minimum length requirements.`;
  const processed = preprocessStory(paddedStory);

  assert.match(processed, /a person/);
  assert.match(processed, /\[redacted\]/);
  assert.equal(processed.includes('123-45-6789'), false);
});

test('sanitizeStoryInput handles name and sensitive pattern replacements', () => {
  const input = 'Mr. Adams saw Alice Cooper on 55 Broadway Street and phone 1234567890.';
  const sanitized = sanitizeStoryInput(input);

  assert.equal(sanitized.includes('Mr. Adams'), false);
  assert.equal(sanitized.includes('Alice Cooper'), false);
  assert.equal(sanitized.includes('1234567890'), false);
  assert.match(sanitized, /\[redacted\]/);
});

test('duration and shot resolvers enforce defaults and minimums', () => {
  assert.equal(resolveTargetDurationSec({ targetDurationSec: 30 }), 30);
  assert.equal(resolveTargetDurationSec({ targetDurationSec: 4 }), DEFAULT_VIDEO_CONFIG.durationSec);
  assert.equal(resolveTargetDurationSec({ targetDurationSec: '60' }), DEFAULT_VIDEO_CONFIG.durationSec);

  assert.equal(resolveShotCount({ targetDurationSec: 5 }), 1);
  assert.equal(resolveShotCount({ targetDurationSec: 22 }), 5);
});

test('resolveKeyframeSize prefers explicit dimensions then aspect preset fallback', () => {
  const explicit = resolveKeyframeSize({ keyframeWidth: 800, keyframeHeight: 1200, aspectRatio: '1:1' });
  assert.deepEqual(explicit, { width: 800, height: 1200, key: '800x1200' });

  const preset = resolveKeyframeSize({ aspectRatio: '16:9' });
  assert.equal(preset.width, 1024);
  assert.equal(preset.height, 576);

  const unknownAspectFallback = resolveKeyframeSize({ aspectRatio: 'unknown' });
  assert.equal(unknownAspectFallback.width, 576);
  assert.equal(unknownAspectFallback.height, 1024);
});

test('model selection helpers normalize defaults and validate category resolution', () => {
  const resolvedFromNull = resolveProjectModelSelections(null);
  assert.deepEqual(resolvedFromNull, DEFAULT_MODEL_SELECTIONS);

  const resolvedFromPartial = resolveProjectModelSelections({
    textToText: ' deepseek-ai/deepseek-v3 '
  });
  assert.equal(resolvedFromPartial.textToText, 'deepseek-ai/deepseek-v3');
  assert.equal(resolvedFromPartial.textToSpeech, DEFAULT_MODEL_SELECTIONS.textToSpeech);

  assert.equal(
    resolveModelForCategory(MODEL_CATEGORIES.textToImage, { textToImage: 'prunaai/z-image-turbo' }),
    'prunaai/z-image-turbo'
  );

  assert.throws(
    () => resolveModelForCategory('unknown-category', {}),
    /Unknown model category/
  );
});

test('isKnownModelId accepts supported ids and rejects invalid inputs', () => {
  assert.equal(isKnownModelId('deepseek-ai/deepseek-v3'), true);
  assert.equal(isKnownModelId('unknown/model'), false);
  assert.equal(isKnownModelId(''), false);
  assert.equal(isKnownModelId(null), false);
});
