import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertRequiredApiEnv, env } from '../config/env.js';
import { createJobsRouter } from './routes/jobs.js';
import { createProjectAssetsRouter } from './routes/projectAssets.js';
import { createProjectsRouter } from './routes/projects.js';
import { createWebhookRouter } from './routes/webhooks.js';
import { createAuthGuards } from './middleware/auth.js';
import { buildOpenApiSpec } from './openapi/spec.js';

const swaggerUiHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rilo API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui'
      });
    </script>
  </body>
</html>`;

function getRequestBaseUrl(req, { fallbackPort = 3000 } = {}) {
  const forwardedProtoHeader = req.get('x-forwarded-proto');
  const hostHeader = req.get('x-forwarded-host') || req.get('host');
  const protocol = forwardedProtoHeader
    ? forwardedProtoHeader.split(',')[0].trim()
    : req.protocol || 'http';

  if (hostHeader) {
    return `${protocol}://${hostHeader}`;
  }

  return `http://localhost:${fallbackPort}`;
}

function hasDashboardBundle(dashboardDir) {
  if (!dashboardDir || typeof dashboardDir !== 'string') {
    return false;
  }

  return fs.existsSync(path.join(dashboardDir, 'index.html'));
}

export function createApiApp({ baseUrl, dashboardDir, auth } = {}) {
  const authOptions = {
    previewMode: Boolean(auth?.previewMode),
    allowUnauthenticatedExposedPreview: Boolean(auth?.allowUnauthenticatedExposedPreview)
  };
  const shouldRequireApiToken = !authOptions.previewMode;
  if (shouldRequireApiToken) {
    assertRequiredApiEnv();
  }

  const guards = createAuthGuards(authOptions);
  const dashboardEnabled = hasDashboardBundle(dashboardDir);

  const app = express();
  app.set('trust proxy', !authOptions.previewMode);
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'rilo' });
  });

  app.get('/openapi.json', (req, res) => {
    const resolvedBaseUrl =
      typeof baseUrl === 'string' && baseUrl.trim().length > 0
        ? baseUrl
        : getRequestBaseUrl(req, { fallbackPort: env.port });
    const openApiSpec = buildOpenApiSpec({ baseUrl: resolvedBaseUrl });
    res.json(openApiSpec);
  });

  app.get('/docs', (_req, res) => {
    res.type('html').send(swaggerUiHtml);
  });

  app.use('/webhooks', createWebhookRouter());
  app.use('/projects', guards.requireBearerTokenOrAccessToken, createProjectAssetsRouter());
  app.use(guards.requireBearerToken);
  app.use('/jobs', createJobsRouter());
  app.use('/projects', createProjectsRouter());

  if (dashboardEnabled) {
    app.use(express.static(dashboardDir));
    app.get('/', (_req, res) => {
      res.sendFile(path.join(dashboardDir, 'index.html'));
    });
  }

  return app;
}

export function startApiServer({ port = env.port, host, baseUrl, dashboardDir, auth } = {}) {
  const app = createApiApp({ baseUrl, dashboardDir, auth });

  if (host) {
    return app.listen(port, host, () => {
      console.log(`rilo api listening on ${host}:${port}`);
    });
  }

  return app.listen(port, () => {
    console.log(`rilo api listening on :${port}`);
  });
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entryPoint) {
  startApiServer();
}
