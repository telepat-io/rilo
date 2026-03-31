import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PUBLIC_SETTINGS, SECURE_SETTINGS } from '../config/settingsSchema.js';
import { getSecret, setSecret } from '../config/keystore.js';

const CONFIG_FILE = 'config.json';

function getRiloDir() {
  return path.join(os.homedir(), '.rilo');
}

export function getConfigFilePath() {
  return path.join(getRiloDir(), CONFIG_FILE);
}

/**
 * Read the public config file (~/.rilo/config.json).
 * Returns an empty object if the file does not exist.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function readPublicConfig() {
  const filePath = getConfigFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // File exists but is malformed; surface the error
      throw err;
    }
  }
  return {};
}

/**
 * Write the public config file (~/.rilo/config.json).
 * @param {Record<string, unknown>} data
 */
async function writePublicConfig(data) {
  const filePath = getConfigFilePath();
  const dir = getRiloDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

/**
 * Resolve the current effective value for a public setting.
 * Precedence: env var > config.json > schema default.
 *
 * @param {import('../config/settingsSchema.js').SETTINGS[0]} setting
 * @param {Record<string, unknown>} storedConfig
 * @returns {{ value: unknown, source: 'env'|'config'|'default' }}
 */
export function resolvePublicValue(setting, storedConfig) {
  // Check env vars in priority order
  for (const envName of setting.envNames) {
    const raw = process.env[envName];
    if (raw !== undefined && raw !== '') {
      return { value: raw, source: 'env' };
    }
  }
  // Check stored config
  if (Object.prototype.hasOwnProperty.call(storedConfig, setting.configKey)) {
    return { value: storedConfig[setting.configKey], source: 'config' };
  }
  return { value: setting.default, source: 'default' };
}

/**
 * Resolve the current effective status for a secure setting.
 * Returns whether a value is present and where it came from.
 *
 * @param {import('../config/settingsSchema.js').SETTINGS[0]} setting
 * @returns {Promise<{ hasValue: boolean, source: 'env'|'keystore'|'none' }>}
 */
export async function resolveSecureStatus(setting) {
  for (const envName of setting.envNames) {
    const raw = process.env[envName];
    if (raw !== undefined && raw !== '') {
      return { hasValue: true, source: 'env' };
    }
  }
  const stored = await getSecret(setting.keystoreKey);
  if (stored) return { hasValue: true, source: 'keystore' };
  return { hasValue: false, source: 'none' };
}

/**
 * Save a single public setting to ~/.rilo/config.json.
 * Merges with existing contents.
 *
 * @param {string} configKey  - camelCase key from the schema
 * @param {unknown} value
 */
export async function savePublicSetting(configKey, value) {
  const current = await readPublicConfig();
  current[configKey] = value;
  await writePublicConfig(current);
}

/**
 * Save a secure token to the OS keystore (or encrypted fallback).
 *
 * @param {string} keystoreKey
 * @param {string} value
 */
export async function saveSecureToken(keystoreKey, value) {
  await setSecret(keystoreKey, value);
}

/**
 * Load a secure token from the keystore.
 * Respects env-var priority just like the rest of the system.
 *
 * @param {import('../config/settingsSchema.js').SETTINGS[0]} setting
 * @returns {Promise<string|null>}
 */
export async function loadSecureToken(setting) {
  for (const envName of setting.envNames) {
    const raw = process.env[envName];
    if (raw !== undefined && raw !== '') return raw;
  }
  return getSecret(setting.keystoreKey);
}

/**
 * Build a full snapshot of current settings (for display or env-merging).
 * Secure tokens are returned as their actual value (caller must handle masking).
 *
 * @returns {Promise<{ public: Record<string, { value: unknown, source: string }>, secure: Record<string, { value: string|null, source: string }> }>}
 */
export async function loadAllSettings() {
  const storedConfig = await readPublicConfig();
  const publicResult = {};
  for (const s of PUBLIC_SETTINGS) {
    publicResult[s.id] = resolvePublicValue(s, storedConfig);
  }

  const secureResult = {};
  for (const s of SECURE_SETTINGS) {
    const status = await resolveSecureStatus(s);
    const value = status.hasValue
      ? (status.source === 'env'
        ? (process.env[s.envNames[0]] || process.env[s.envNames[1]] || '')
        : await getSecret(s.keystoreKey))
      : null;
    secureResult[s.id] = { value, source: status.source };
  }

  return { public: publicResult, secure: secureResult };
}
