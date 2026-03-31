/**
 * Describes every setting that can be managed via `rilo settings`.
 *
 * type: 'number' | 'string' | 'secure'
 *   - 'secure'  => stored in the OS keystore / encrypted file (never in config.json)
 *   - 'number'  => parsed as an integer
 *   - 'string'  => stored as-is
 *
 * envNames: the env var names that map to this setting (first has priority).
 *           The env.js module already resolves these in order, so we only list
 *           them here for display and documentation purposes.
 *
 * configKey: the camelCase key written to ~/.rilo/config.json (public settings only).
 *
 * keystoreKey: the account name used with keytar / encrypted file (secure settings only).
 */
export const SETTINGS = [
  // ── Secure settings (stored in keystore) ──────────────────────────────────
  {
    id: 'replicateApiToken',
    label: 'Replicate API Token',
    description: 'Your Replicate API key (replicate.com/account/api-tokens).',
    type: 'secure',
    keystoreKey: 'replicateApiToken',
    envNames: ['RILO_REPLICATE_API_TOKEN', 'REPLICATE_API_TOKEN'],
    default: ''
  },
  {
    id: 'apiBearerToken',
    label: 'API Bearer Token',
    description: 'Bearer token for authenticating requests to the rilo HTTP API.',
    type: 'secure',
    keystoreKey: 'apiBearerToken',
    envNames: ['RILO_API_BEARER_TOKEN', 'API_BEARER_TOKEN'],
    default: ''
  },

  // ── Public settings (stored in ~/.rilo/config.json) ───────────────────────
  {
    id: 'maxRetries',
    label: 'Max Retries',
    description: 'Number of times to retry a failed prediction before giving up.',
    type: 'number',
    configKey: 'maxRetries',
    envNames: ['MAX_RETRIES'],
    default: 2,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) return 'Must be a non-negative integer.';
      return true;
    }
  },
  {
    id: 'retryDelayMs',
    label: 'Retry Delay (ms)',
    description: 'Milliseconds to wait between retries.',
    type: 'number',
    configKey: 'retryDelayMs',
    envNames: ['RETRY_DELAY_MS'],
    default: 2500,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) return 'Must be a non-negative integer.';
      return true;
    }
  },
  {
    id: 'predictionPollIntervalMs',
    label: 'Poll Interval (ms)',
    description: 'How often (ms) to poll Replicate for prediction status.',
    type: 'number',
    configKey: 'predictionPollIntervalMs',
    envNames: ['PREDICTION_POLL_INTERVAL_MS'],
    default: 1500,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 100) return 'Must be an integer ≥ 100.';
      return true;
    }
  },
  {
    id: 'predictionMaxWaitMs',
    label: 'Max Prediction Wait (ms)',
    description: 'Maximum time (ms) to wait for a single prediction to complete.',
    type: 'number',
    configKey: 'predictionMaxWaitMs',
    envNames: ['PREDICTION_MAX_WAIT_MS'],
    default: 600000,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1000) return 'Must be an integer ≥ 1000.';
      return true;
    }
  },
  {
    id: 'downloadTimeoutMs',
    label: 'Download Timeout (ms)',
    description: 'Timeout (ms) for downloading generated media files.',
    type: 'number',
    configKey: 'downloadTimeoutMs',
    envNames: ['DOWNLOAD_TIMEOUT_MS'],
    default: 20000,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1000) return 'Must be an integer ≥ 1000.';
      return true;
    }
  },
  {
    id: 'downloadMaxBytes',
    label: 'Download Max Size (bytes)',
    description: 'Maximum allowed size in bytes for a downloaded file.',
    type: 'number',
    configKey: 'downloadMaxBytes',
    envNames: ['DOWNLOAD_MAX_BYTES'],
    default: 104857600,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer.';
      return true;
    }
  },
  {
    id: 'downloadAllowedHosts',
    label: 'Download Allowed Hosts',
    description: 'Comma-separated list of hostnames allowed for media downloads.',
    type: 'string',
    configKey: 'downloadAllowedHosts',
    envNames: ['DOWNLOAD_ALLOWED_HOSTS'],
    default: 'replicate.delivery,replicate.com',
    validate(v) {
      if (!v || !v.trim()) return 'Must not be empty.';
      return true;
    }
  },
  {
    id: 'apiDefaultLogsLimit',
    label: 'Default Logs Limit',
    description: 'Default number of log entries returned by the API.',
    type: 'number',
    configKey: 'apiDefaultLogsLimit',
    envNames: ['API_DEFAULT_LOGS_LIMIT'],
    default: 100,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer.';
      return true;
    }
  },
  {
    id: 'apiMaxLogsLimit',
    label: 'Max Logs Limit',
    description: 'Hard cap on log entries returned by the API.',
    type: 'number',
    configKey: 'apiMaxLogsLimit',
    envNames: ['API_MAX_LOGS_LIMIT'],
    default: 1000,
    validate(v) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) return 'Must be a positive integer.';
      return true;
    }
  },
  {
    id: 'ffmpegBin',
    label: 'ffmpeg Binary',
    description: 'Path or command name for the ffmpeg binary.',
    type: 'string',
    configKey: 'ffmpegBin',
    envNames: ['FFMPEG_BIN'],
    default: 'ffmpeg',
    validate(v) {
      if (!v || !v.trim()) return 'Must not be empty.';
      return true;
    }
  },
  {
    id: 'ffprobeBin',
    label: 'ffprobe Binary',
    description: 'Path or command name for the ffprobe binary.',
    type: 'string',
    configKey: 'ffprobeBin',
    envNames: ['FFPROBE_BIN'],
    default: 'ffprobe',
    validate(v) {
      if (!v || !v.trim()) return 'Must not be empty.';
      return true;
    }
  },
  {
    id: 'ffsubsyncBin',
    label: 'ffsubsync Binary',
    description: 'Path or command name for the ffsubsync binary (optional subtitle tool).',
    type: 'string',
    configKey: 'ffsubsyncBin',
    envNames: ['FFSUBSYNC_BIN'],
    default: 'ffsubsync',
    validate(v) {
      if (!v || !v.trim()) return 'Must not be empty.';
      return true;
    }
  }
];

/** Lookup by id */
export function getSettingById(id) {
  return SETTINGS.find((s) => s.id === id) ?? null;
}

/** Settings stored in keystore */
export const SECURE_SETTINGS = SETTINGS.filter((s) => s.type === 'secure');

/** Settings stored in ~/.rilo/config.json */
export const PUBLIC_SETTINGS = SETTINGS.filter((s) => s.type !== 'secure');
