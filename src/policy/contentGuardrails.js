const NAME_PATTERNS = [
  /\bMr\.\s+[A-Z][a-z]+\b/g,
  /\bMrs\.\s+[A-Z][a-z]+\b/g,
  /\bMs\.\s+[A-Z][a-z]+\b/g,
  /\bJudge\s+[A-Z][a-z]+\b/g,
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g
];

const SENSITIVE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{10,}\b/g,
  /\b\d{1,5}\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi
];

export function sanitizeStoryInput(story) {
  let sanitized = story;
  for (const pattern of NAME_PATTERNS) {
    sanitized = sanitized.replace(pattern, 'a person');
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[redacted]');
  }
  return sanitized;
}

export function assertSafeStory(story) {
  if (!story || story.trim().length < 50) {
    throw new Error('Story input must be at least 50 characters');
  }
}
