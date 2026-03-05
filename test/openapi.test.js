import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { buildOpenApiSpec } from '../src/api/openapi/spec.js';
import { generateOpenApiFile } from '../src/api/openapi/generateOpenApi.js';

test('buildOpenApiSpec includes auth, public endpoints, and core paths', () => {
  const spec = buildOpenApiSpec();

  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.components.securitySchemes.bearerAuth);
  assert.deepEqual(spec.security, [{ bearerAuth: [] }]);

  assert.ok(spec.paths['/jobs']);
  assert.ok(spec.paths['/projects']);
  assert.ok(spec.paths['/projects/{project}/content']);
  assert.ok(spec.paths['/projects/{project}/assets/{assetPath}']);
  assert.ok(spec.paths['/projects/{project}/regenerate']);
  assert.ok(spec.paths['/health']);
  assert.ok(spec.paths['/openapi.json']);
  assert.ok(spec.paths['/docs']);

  assert.deepEqual(spec.paths['/health'].get.security, []);
  assert.deepEqual(spec.paths['/webhooks/replicate'].post.security, []);

  const regenerateRequest = spec.components.schemas.ProjectRegenerateRequest;
  assert.ok(regenerateRequest.properties.targetType);
  assert.ok(regenerateRequest.properties.index);
  assert.ok(regenerateRequest.properties.targetType.enum.includes('script'));
});

test('generateOpenApiFile writes a valid JSON spec to target path', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-openapi-'));
  try {
    const outputPath = path.join(tempDir, 'openapi.json');
    const writtenPath = await generateOpenApiFile({
      outputPath,
      baseUrl: 'http://127.0.0.1:3100'
    });

    assert.equal(writtenPath, outputPath);

    const raw = await fs.readFile(outputPath, 'utf8');
    const parsed = JSON.parse(raw);

    assert.equal(parsed.openapi, '3.1.0');
    assert.equal(parsed.servers[0].url, 'http://127.0.0.1:3100');
    assert.ok(parsed.paths['/jobs']);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
