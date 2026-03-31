import test from 'node:test';
import assert from 'node:assert/strict';

import { formatCurrentValue } from '../src/cli/commands/settingsFlow.js';
import { getSettingById, SECURE_SETTINGS, PUBLIC_SETTINGS } from '../src/config/settingsSchema.js';

// ── formatCurrentValue (pure display helper) ───────────────────────────────────

const replicateSetting = getSettingById('replicateApiToken');
const maxRetriesSetting = getSettingById('maxRetries');
const ffmpegSetting = getSettingById('ffmpegBin');

test('formatCurrentValue: secure + source=env shows env indicator', () => {
  const out = formatCurrentValue(replicateSetting, null, 'env');
  assert.ok(out.includes('environment variable'), `expected env indicator, got: ${out}`);
});

test('formatCurrentValue: secure + source=keystore shows "stored securely"', () => {
  const out = formatCurrentValue(replicateSetting, null, 'keystore');
  assert.ok(out.includes('stored securely'), `expected keystore indicator, got: ${out}`);
});

test('formatCurrentValue: secure + source=none shows "not set"', () => {
  const out = formatCurrentValue(replicateSetting, null, 'none');
  assert.ok(out.includes('not set'), `expected not-set indicator, got: ${out}`);
});

test('formatCurrentValue: public + source=env shows value and env indicator', () => {
  const out = formatCurrentValue(maxRetriesSetting, '5', 'env');
  assert.ok(out.includes('5'), `expected value to appear, got: ${out}`);
  assert.ok(out.includes('environment variable'), `expected env indicator, got: ${out}`);
});

test('formatCurrentValue: public + source=config shows value only', () => {
  const out = formatCurrentValue(maxRetriesSetting, 7, 'config');
  assert.equal(out, '7', `expected plain value string, got: ${out}`);
});

test('formatCurrentValue: public + source=default shows value and default indicator', () => {
  const out = formatCurrentValue(maxRetriesSetting, 2, 'default');
  assert.ok(out.includes('2'), `expected default value, got: ${out}`);
  assert.ok(out.includes('default'), `expected default indicator, got: ${out}`);
});

test('formatCurrentValue: public + null value falls back to schema default string', () => {
  const out = formatCurrentValue(ffmpegSetting, null, 'default');
  assert.ok(out.includes(ffmpegSetting.default), `expected default '${ffmpegSetting.default}', got: ${out}`);
});

// ── Schema coverage: Firebase + webhook settings must NOT be in SETTINGS lists ──

test('Firebase settings are not present in PUBLIC_SETTINGS or SECURE_SETTINGS', () => {
  const allIds = [...PUBLIC_SETTINGS, ...SECURE_SETTINGS].map((s) => s.id);
  const firebaseIds = allIds.filter((id) => id.toLowerCase().includes('firebase'));
  assert.deepEqual(firebaseIds, [], `Firebase settings should not appear in settings UI: ${firebaseIds}`);
});

test('Webhook settings are not present in PUBLIC_SETTINGS or SECURE_SETTINGS', () => {
  const allIds = [...PUBLIC_SETTINGS, ...SECURE_SETTINGS].map((s) => s.id);
  const webhookIds = allIds.filter((id) => id.toLowerCase().includes('webhook'));
  assert.deepEqual(webhookIds, [], `Webhook settings should not appear in settings UI: ${webhookIds}`);
});

test('API_PORT is not present in settings UI', () => {
  const allEnvNames = [...PUBLIC_SETTINGS, ...SECURE_SETTINGS].flatMap((s) => s.envNames);
  assert.ok(!allEnvNames.includes('API_PORT'), 'API_PORT should not be in settings UI');
});
