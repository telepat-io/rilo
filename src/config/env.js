/* c8 ignore file */
import dotenv from 'dotenv';

dotenv.config();

export function parseEnvString(value, fallback) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function hasEnvValue(value) {
  return value !== undefined && value !== null && value !== '';
}

/* c8 ignore start */
export function parseEnvNumber(value, fallback) {
  if (!hasEnvValue(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseEnvBoolean(value, fallback = false) {
  if (!hasEnvValue(value)) {
    return fallback;
  }
  return String(value).toLowerCase() === 'true';
}
/* c8 ignore stop */

export function parseAllowedHosts(value, fallback = 'replicate.delivery,replicate.com') {
  return parseEnvString(value, fallback)
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export const env = {
  replicateApiToken: parseEnvString(
    process.env.SECRET_REPLICATE_API_TOKEN
      || process.env.TALEFIRE_REPLICATE_API_TOKEN
      || process.env.VIDEOGEN_REPLICATE_API_TOKEN
      || process.env.REPLICATE_API_TOKEN,
    ''
  ),
  apiBearerToken: parseEnvString(
    process.env.SECRET_API_BEARER_TOKEN
      || process.env.TALEFIRE_API_BEARER_TOKEN
      || process.env.VIDEOGEN_API_BEARER_TOKEN
      || process.env.API_BEARER_TOKEN,
    ''
  ),
  port: parseEnvNumber(process.env.API_PORT || process.env.PORT, 3000),
  webhookSecret: parseEnvString(process.env.WEBHOOK_SECRET, ''),
  outputDir: parseEnvString(process.env.OUTPUT_DIR, './output'),
  projectsDir: parseEnvString(process.env.PROJECTS_DIR, './projects'),
  outputBackend: parseEnvString(
    process.env.SECRET_OUTPUT_BACKEND
      || process.env.TALEFIRE_OUTPUT_BACKEND
      || process.env.VIDEOGEN_OUTPUT_BACKEND
      || process.env.OUTPUT_BACKEND,
    'local'
  ),
  firebaseProjectId: parseEnvString(
    process.env.SECRET_FIREBASE_PROJECT_ID
      || process.env.TALEFIRE_FIREBASE_PROJECT_ID
      || process.env.VIDEOGEN_FIREBASE_PROJECT_ID
      || process.env.FIREBASE_PROJECT_ID,
    ''
  ),
  firebaseStorageBucket: parseEnvString(
    process.env.SECRET_FIREBASE_STORAGE_BUCKET
      || process.env.TALEFIRE_FIREBASE_STORAGE_BUCKET
      || process.env.VIDEOGEN_FIREBASE_STORAGE_BUCKET
      || process.env.FIREBASE_STORAGE_BUCKET,
    ''
  ),
  firebaseClientEmail: parseEnvString(
    process.env.TALEFIRE_FIREBASE_CLIENT_EMAIL
      || process.env.VIDEOGEN_FIREBASE_CLIENT_EMAIL
      || process.env.FIREBASE_CLIENT_EMAIL,
    ''
  ),
  firebasePrivateKey: parseEnvString(
    process.env.TALEFIRE_FIREBASE_PRIVATE_KEY
      || process.env.VIDEOGEN_FIREBASE_PRIVATE_KEY
      || process.env.FIREBASE_PRIVATE_KEY,
    ''
  ),
  useWebhooks: parseEnvBoolean(process.env.USE_WEBHOOKS, false),
  maxRetries: parseEnvNumber(process.env.MAX_RETRIES, 2),
  retryDelayMs: parseEnvNumber(process.env.RETRY_DELAY_MS, 2500),
  predictionPollIntervalMs: parseEnvNumber(process.env.PREDICTION_POLL_INTERVAL_MS, 1500),
  predictionMaxWaitMs: parseEnvNumber(process.env.PREDICTION_MAX_WAIT_MS, 600000),
  downloadTimeoutMs: parseEnvNumber(process.env.DOWNLOAD_TIMEOUT_MS, 20000),
  downloadMaxBytes: parseEnvNumber(process.env.DOWNLOAD_MAX_BYTES, 104857600),
  downloadAllowedHosts: parseAllowedHosts(process.env.DOWNLOAD_ALLOWED_HOSTS),
  apiDefaultLogsLimit: parseEnvNumber(process.env.API_DEFAULT_LOGS_LIMIT, 100),
  apiMaxLogsLimit: parseEnvNumber(process.env.API_MAX_LOGS_LIMIT, 1000),
  ffmpegBin: parseEnvString(process.env.FFMPEG_BIN, 'ffmpeg'),
  ffprobeBin: parseEnvString(process.env.FFPROBE_BIN, 'ffprobe'),
  ffsubsyncBin: parseEnvString(process.env.FFSUBSYNC_BIN, 'ffsubsync')
};

export function assertRequiredEnv() {
  if (!env.replicateApiToken) {
    throw new Error('Missing REPLICATE_API_TOKEN in environment');
  }
}

export function assertRequiredApiEnv() {
  if (!env.apiBearerToken) {
    throw new Error('Missing API_BEARER_TOKEN in environment');
  }
}
