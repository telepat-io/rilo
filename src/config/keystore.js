import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SERVICE_NAME = 'rilo';
const SECRETS_FILE = '.secrets';

let keytarClientPromise;

async function getKeytarClient() {
  if (keytarClientPromise !== undefined) {
    return keytarClientPromise;
  }

  keytarClientPromise = (async () => {
    try {
      const imported = await import('keytar');
      const candidate = imported.default ?? imported;
      if (
        candidate &&
        typeof candidate === 'object' &&
        typeof candidate.setPassword === 'function' &&
        typeof candidate.getPassword === 'function' &&
        typeof candidate.deletePassword === 'function'
      ) {
        return candidate;
      }
    } catch {
      // keytar is optional; fall through to encrypted file storage
    }
    return null;
  })();

  return keytarClientPromise;
}

function getRiloDir() {
  return path.join(os.homedir(), '.rilo');
}

function getFallbackPath() {
  return path.join(getRiloDir(), SECRETS_FILE);
}

function getMachineKey() {
  const username = process.env.USER ?? process.env.USERNAME ?? 'user';
  return crypto
    .createHash('sha256')
    .update(`${process.platform}:${process.arch}:${username}`)
    .digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(16);
  const key = getMachineKey();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(value) {
  const colonIdx = value.indexOf(':');
  if (colonIdx === -1) throw new Error('Invalid encrypted payload');
  const ivHex = value.slice(0, colonIdx);
  const contentHex = value.slice(colonIdx + 1);
  if (!ivHex || !contentHex) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivHex, 'hex');
  const content = Buffer.from(contentHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getMachineKey(), iv);
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
  return decrypted.toString('utf8');
}

function readFallbackSecrets() {
  const filePath = getFallbackPath();
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const decrypted = decrypt(raw);
    const parsed = JSON.parse(decrypted);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // corrupt or from old format; treat as empty
  }
  return {};
}

let _warnedFallback = false;

function writeFallbackSecrets(secrets) {
  const filtered = Object.fromEntries(
    Object.entries(secrets).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
  );

  const filePath = getFallbackPath();
  if (Object.keys(filtered).length === 0) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }

  const dir = getRiloDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!_warnedFallback) {
    _warnedFallback = true;
    console.warn(
      '[rilo] Native OS keystore unavailable. ' +
      'Secrets are stored in an AES-256 encrypted file (~/.rilo/.secrets). ' +
      'For stronger security, install a keytar-compatible libsecret on your system.'
    );
  }

  fs.writeFileSync(filePath, encrypt(JSON.stringify(filtered)), { encoding: 'utf8', mode: 0o600 });
}

/**
 * Store a secret. Tries the OS native keystore first; falls back to
 * an AES-256 encrypted file under ~/.rilo/.secrets.
 * @param {string} key   - account/key name (e.g. 'replicateApiToken')
 * @param {string} value - secret value
 */
export async function setSecret(key, value) {
  const client = await getKeytarClient();
  if (client) {
    try {
      await client.setPassword(SERVICE_NAME, key, value);
      return;
    } catch {
      // fall through
    }
  }
  const current = readFallbackSecrets();
  current[key] = value;
  writeFallbackSecrets(current);
}

/**
 * Retrieve a secret. Returns null if not stored.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getSecret(key) {
  const client = await getKeytarClient();
  if (client) {
    try {
      const value = await client.getPassword(SERVICE_NAME, key);
      if (value != null) return value;
    } catch {
      // fall through
    }
  }
  return readFallbackSecrets()[key] ?? null;
}

/**
 * Delete a stored secret.
 * @param {string} key
 */
export async function deleteSecret(key) {
  const client = await getKeytarClient();
  if (client) {
    try {
      await client.deletePassword(SERVICE_NAME, key);
    } catch {
      // ignore keychain errors; continue to clean up file fallback
    }
  }
  const current = readFallbackSecrets();
  delete current[key];
  writeFallbackSecrets(current);
}

// Exported for testing
export { readFallbackSecrets, writeFallbackSecrets, encrypt, decrypt, getMachineKey };
