import { onRequest } from 'firebase-functions/v2/https';
import { createApiApp } from './server.js';

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const minInstances = parseOptionalNumber(process.env.FUNCTION_MIN_INSTANCES);
const timeoutSeconds = parseOptionalNumber(process.env.FUNCTION_TIMEOUT_SECONDS) || 120;
const concurrency = parseOptionalNumber(process.env.FUNCTION_CONCURRENCY) || 80;

const runtimeOptions = {
  region: process.env.FUNCTION_REGION || 'us-central1',
  timeoutSeconds,
  concurrency,
  invoker: 'public',
  secrets: [
    'SECRET_API_BEARER_TOKEN',
    'SECRET_REPLICATE_API_TOKEN',
    'SECRET_OUTPUT_BACKEND',
    'SECRET_FIREBASE_PROJECT_ID',
    'SECRET_FIREBASE_STORAGE_BUCKET'
  ]
};

if (minInstances !== undefined) {
  runtimeOptions.minInstances = minInstances;
}

let app;

function getApiApp() {
  if (!app) {
    app = createApiApp();
  }
  return app;
}

export const api = onRequest(runtimeOptions, (req, res) => {
  getApiApp()(req, res);
});