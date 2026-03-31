import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// We import the internals directly for unit testing.
// The module under test uses Node's built-in `crypto`, so no mocking needed for that.
import {
  encrypt,
  decrypt,
  getMachineKey,
  readFallbackSecrets,
  writeFallbackSecrets
} from '../src/config/keystore.js';

// ── Crypto helpers ─────────────────────────────────────────────────────────────

test('getMachineKey returns a 32-byte Buffer', () => {
  const key = getMachineKey();
  assert.ok(Buffer.isBuffer(key));
  assert.equal(key.length, 32);
});

test('encrypt produces an iv:ciphertext string', () => {
  const result = encrypt('hello');
  assert.ok(typeof result === 'string');
  const parts = result.split(':');
  assert.equal(parts.length, 2);
  assert.ok(parts[0].length > 0, 'iv hex should not be empty');
  assert.ok(parts[1].length > 0, 'ciphertext hex should not be empty');
});

test('decrypt round-trips values encrypted by encrypt()', () => {
  const original = 'my-secret-token-abc123';
  const ciphertext = encrypt(original);
  const decoded = decrypt(ciphertext);
  assert.equal(decoded, original);
});

test('encrypt produces different ciphertext each time (random IV)', () => {
  const a = encrypt('same');
  const b = encrypt('same');
  assert.notEqual(a, b, 'successive encryptions should differ due to random IV');
});

test('decrypt throws on invalid payload', () => {
  assert.throws(() => decrypt('no-colon-here-at-all-abcd'), /Invalid encrypted payload/);
  assert.throws(() => decrypt(':'), /Invalid encrypted payload/);
});

// ── Fallback file helpers (using a temp dir to avoid touching ~/.rilo) ─────────

const originalHomedir = os.homedir;

function withTempHome(fn) {
  return async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rilo-test-'));
    // readFallbackSecrets / writeFallbackSecrets derive path from os.homedir() at call time
    // We patch the process.env.HOME to redirect
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
    // Also patch os.homedir temporarily
    os.homedir = () => tmpDir;
    try {
      await fn(tmpDir);
    } finally {
      os.homedir = originalHomedir;
      process.env.HOME = originalHome;
      process.env.USERPROFILE = originalUserProfile;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };
}

test('readFallbackSecrets returns {} when file does not exist', withTempHome(async () => {
  const result = readFallbackSecrets();
  assert.deepEqual(result, {});
}));

test('writeFallbackSecrets + readFallbackSecrets round-trips multiple secrets', withTempHome(async (tmpDir) => {
  const riloDir = path.join(tmpDir, '.rilo');
  fs.mkdirSync(riloDir, { recursive: true });

  const secrets = { replicateApiToken: 'tok123', apiBearerToken: 'bearer-abc' };
  writeFallbackSecrets(secrets);

  const secretsFile = path.join(riloDir, '.secrets');
  assert.ok(fs.existsSync(secretsFile), 'secrets file should be written');

  // Verify file permissions: owner-read-write only (0o600)
  const stat = fs.statSync(secretsFile);
  // On Windows file permissions work differently; skip the mode check
  if (process.platform !== 'win32') {
    assert.equal(stat.mode & 0o777, 0o600, 'file should have mode 0600');
  }

  const loaded = readFallbackSecrets();
  assert.equal(loaded.replicateApiToken, 'tok123');
  assert.equal(loaded.apiBearerToken, 'bearer-abc');
}));

test('writeFallbackSecrets deletes file when all secrets cleared', withTempHome(async (tmpDir) => {
  const riloDir = path.join(tmpDir, '.rilo');
  fs.mkdirSync(riloDir, { recursive: true });

  writeFallbackSecrets({ replicateApiToken: 'tok' });
  const secretsFile = path.join(riloDir, '.secrets');
  assert.ok(fs.existsSync(secretsFile));

  writeFallbackSecrets({}); // clear everything
  assert.ok(!fs.existsSync(secretsFile), 'file should be deleted when all secrets are empty');
}));

test('writeFallbackSecrets ignores blank string values', withTempHome(async (tmpDir) => {
  const riloDir = path.join(tmpDir, '.rilo');
  fs.mkdirSync(riloDir, { recursive: true });

  writeFallbackSecrets({ replicateApiToken: '   ', apiBearerToken: '' });
  const secretsFile = path.join(riloDir, '.secrets');
  // Both blank → file should not be created
  assert.ok(!fs.existsSync(secretsFile), 'file should not be created for blank secrets');
}));

test('readFallbackSecrets returns {} on corrupt file', withTempHome(async (tmpDir) => {
  const riloDir = path.join(tmpDir, '.rilo');
  fs.mkdirSync(riloDir, { recursive: true });
  const secretsFile = path.join(riloDir, '.secrets');
  fs.writeFileSync(secretsFile, 'not-valid-hex-payload', 'utf8');

  const result = readFallbackSecrets();
  assert.deepEqual(result, {});
}));
