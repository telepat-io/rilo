import { assertSafeStory, sanitizeStoryInput } from '../policy/contentGuardrails.js';

export function preprocessStory(story) {
  assertSafeStory(story);
  return sanitizeStoryInput(story);
}
