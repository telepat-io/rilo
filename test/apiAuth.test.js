import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { env } from '../src/config/env.js';
import { createJobsRouter } from '../src/api/routes/jobs.js';
import { createProjectsRouter } from '../src/api/routes/projects.js';
import { createWebhookRouter } from '../src/api/routes/webhooks.js';
import { createAuthGuards, requireBearerToken } from '../src/api/middleware/auth.js';

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'videogen' });
  });

  app.use('/webhooks', createWebhookRouter());
  app.use(requireBearerToken);
  app.use('/jobs', createJobsRouter());
  app.use('/projects', createProjectsRouter());

  return app;
}

test('auth middleware returns 401 for missing, malformed, and invalid bearer token', async () => {
  const previousToken = env.apiBearerToken;
  env.apiBearerToken = 'test-api-token';

  try {
    await withServer(createApp(), async (baseUrl) => {
      const missing = await fetch(`${baseUrl}/projects`);
      assert.equal(missing.status, 401);
      assert.deepEqual(await missing.json(), { error: 'Unauthorized' });

      const malformed = await fetch(`${baseUrl}/projects`, {
        headers: { authorization: 'Basic abc123' }
      });
      assert.equal(malformed.status, 401);

      const invalid = await fetch(`${baseUrl}/projects`, {
        headers: { authorization: 'Bearer wrong-token' }
      });
      assert.equal(invalid.status, 401);
    });
  } finally {
    env.apiBearerToken = previousToken;
  }
});

test('auth middleware allows access with valid bearer token', async () => {
  const previousToken = env.apiBearerToken;
  env.apiBearerToken = 'test-api-token';

  try {
    await withServer(createApp(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects`, {
        headers: { authorization: 'Bearer test-api-token' }
      });
      assert.equal(response.status, 200);
    });
  } finally {
    env.apiBearerToken = previousToken;
  }
});

test('health and webhook routes remain unauthenticated', async () => {
  const previousToken = env.apiBearerToken;
  env.apiBearerToken = 'test-api-token';

  try {
    await withServer(createApp(), async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);
      const healthBody = await health.json();
      assert.equal(healthBody.ok, true);

      const webhook = await fetch(`${baseUrl}/webhooks/replicate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'test' })
      });
      assert.equal(webhook.status, 501);
    });
  } finally {
    env.apiBearerToken = previousToken;
  }
});

test('preview loopback bypass allows unauthenticated localhost request', async () => {
  const previousToken = env.apiBearerToken;
  env.apiBearerToken = '';

  const { requireBearerToken: previewAuth } = createAuthGuards({
    previewMode: true,
    allowUnauthenticatedExposedPreview: false
  });

  const app = express();
  app.use(previewAuth);
  app.get('/projects', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  try {
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/projects`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    });
  } finally {
    env.apiBearerToken = previousToken;
  }
});

test('preview loopback bypass still blocks remote addresses without token', () => {
  const { requireBearerToken: previewAuth } = createAuthGuards({
    previewMode: true,
    allowUnauthenticatedExposedPreview: false
  });

  let statusCode = 0;
  let payload;
  let nextCalled = false;

  const req = {
    socket: { remoteAddress: '10.0.0.2' },
    get() {
      return undefined;
    },
    query: {}
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
    }
  };

  previewAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);
  assert.deepEqual(payload, { error: 'Unauthorized' });
});

test('exposed unsafe preview bypass allows unauthenticated non-loopback request', () => {
  const { requireBearerToken: previewAuth } = createAuthGuards({
    previewMode: true,
    allowUnauthenticatedExposedPreview: true
  });

  let nextCalled = false;

  const req = {
    socket: { remoteAddress: '10.0.0.2' },
    get() {
      return undefined;
    },
    query: {}
  };
  const res = {
    status() {
      return this;
    },
    json() {}
  };

  previewAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});
