import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePublicValue } from '../src/store/settingsStore.js';
import { PUBLIC_SETTINGS, SECURE_SETTINGS, SETTINGS, getSettingById } from '../src/config/settingsSchema.js';

// ── Schema structure ───────────────────────────────────────────────────────────

test('all SETTINGS have required fields', () => {
  for (const s of SETTINGS) {
    assert.ok(s.id, `${s.id}: missing id`);
    assert.ok(s.label, `${s.id}: missing label`);
    assert.ok(s.description, `${s.id}: missing description`);
    assert.ok(['number', 'string', 'secure'].includes(s.type), `${s.id}: invalid type ${s.type}`);
    assert.ok(Array.isArray(s.envNames) && s.envNames.length > 0, `${s.id}: missing envNames`);
    assert.ok(s.default !== undefined, `${s.id}: missing default`);
  }
});

test('secure settings have keystoreKey and no configKey', () => {
  for (const s of SECURE_SETTINGS) {
    assert.ok(s.keystoreKey, `${s.id}: missing keystoreKey`);
    assert.ok(!s.configKey, `${s.id}: should not have configKey`);
  }
});

test('public settings have configKey and no keystoreKey', () => {
  for (const s of PUBLIC_SETTINGS) {
    assert.ok(s.configKey, `${s.id}: missing configKey`);
    assert.ok(!s.keystoreKey, `${s.id}: should not have keystoreKey`);
  }
});

test('getSettingById returns correct setting', () => {
  const s = getSettingById('maxRetries');
  assert.equal(s.id, 'maxRetries');
  assert.equal(s.type, 'number');
});

test('getSettingById returns null for unknown id', () => {
  assert.equal(getSettingById('nonExistent'), null);
});

test('replicateApiToken is in SECURE_SETTINGS', () => {
  const s = SECURE_SETTINGS.find((x) => x.id === 'replicateApiToken');
  assert.ok(s);
  assert.ok(s.envNames.includes('RILO_REPLICATE_API_TOKEN'));
  assert.ok(s.envNames.includes('REPLICATE_API_TOKEN'));
});

test('apiBearerToken is in SECURE_SETTINGS', () => {
  const s = SECURE_SETTINGS.find((x) => x.id === 'apiBearerToken');
  assert.ok(s);
  assert.ok(s.envNames.includes('RILO_API_BEARER_TOKEN'));
  assert.ok(s.envNames.includes('API_BEARER_TOKEN'));
});

// ── validate() functions ───────────────────────────────────────────────────────

test('maxRetries validate rejects negative numbers', () => {
  const s = getSettingById('maxRetries');
  assert.notEqual(s.validate('-1'), true);
  assert.notEqual(s.validate('abc'), true);
});

test('maxRetries validate accepts 0 and positive integers', () => {
  const s = getSettingById('maxRetries');
  assert.equal(s.validate('0'), true);
  assert.equal(s.validate('5'), true);
});

test('downloadAllowedHosts validate rejects empty string', () => {
  const s = getSettingById('downloadAllowedHosts');
  assert.notEqual(s.validate(''), true);
  assert.notEqual(s.validate('  '), true);
  assert.equal(s.validate('replicate.delivery'), true);
});

test('ffmpegBin validate rejects empty string', () => {
  const s = getSettingById('ffmpegBin');
  assert.notEqual(s.validate(''), true);
  assert.equal(s.validate('/usr/local/bin/ffmpeg'), true);
});

// ── resolvePublicValue ─────────────────────────────────────────────────────────

const maxRetriesSetting = getSettingById('maxRetries');

test('resolvePublicValue: env var takes precedence', () => {
  const original = process.env.MAX_RETRIES;
  process.env.MAX_RETRIES = '99';
  try {
    const result = resolvePublicValue(maxRetriesSetting, {});
    assert.equal(result.source, 'env');
    assert.equal(result.value, '99');
  } finally {
    if (original === undefined) {
      delete process.env.MAX_RETRIES;
    } else {
      process.env.MAX_RETRIES = original;
    }
  }
});

test('resolvePublicValue: stored config used when no env var', () => {
  const original = process.env.MAX_RETRIES;
  delete process.env.MAX_RETRIES;
  try {
    const result = resolvePublicValue(maxRetriesSetting, { maxRetries: 7 });
    assert.equal(result.source, 'config');
    assert.equal(result.value, 7);
  } finally {
    if (original !== undefined) process.env.MAX_RETRIES = original;
  }
});

test('resolvePublicValue: falls back to schema default', () => {
  const original = process.env.MAX_RETRIES;
  delete process.env.MAX_RETRIES;
  try {
    const result = resolvePublicValue(maxRetriesSetting, {});
    assert.equal(result.source, 'default');
    assert.equal(result.value, maxRetriesSetting.default);
  } finally {
    if (original !== undefined) process.env.MAX_RETRIES = original;
  }
});
