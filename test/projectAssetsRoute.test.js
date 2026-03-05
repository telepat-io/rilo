import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../src/config/env.js';
import { requireBearerTokenOrAccessToken } from '../src/api/middleware/auth.js';
import { createProjectAssetsRouter } from '../src/api/routes/projectAssets.js';
import { ensureProject, getProjectDir } from '../src/store/projectStore.js';
import { ensureDir } from '../src/media/files.js';

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

test('project asset route serves local files and rejects traversal', async () => {
  const app = express();
  app.use('/projects', requireBearerTokenOrAccessToken, createProjectAssetsRouter());

  const previousToken = env.apiBearerToken;
  env.apiBearerToken = 'asset-token';

  const project = `ut-asset-route-${Date.now()}`;
  const projectDir = getProjectDir(project);

  try {
    await ensureProject(project);
    const keyframeDir = path.join(projectDir, 'assets', 'keyframes');
    await ensureDir(keyframeDir);
    await fs.writeFile(path.join(keyframeDir, 'keyframe_01.png'), 'not-a-real-image', 'utf8');

    await withServer(app, async (baseUrl) => {
      const missingToken = await fetch(`${baseUrl}/projects/${project}/assets/assets/keyframes/keyframe_01.png`);
      assert.equal(missingToken.status, 401);

      const withHeader = await fetch(`${baseUrl}/projects/${project}/assets/assets/keyframes/keyframe_01.png`, {
        headers: { authorization: 'Bearer asset-token' }
      });
      assert.equal(withHeader.status, 200);
      assert.equal(await withHeader.text(), 'not-a-real-image');

      const withQueryToken = await fetch(
        `${baseUrl}/projects/${project}/assets/assets/keyframes/keyframe_01.png?access_token=asset-token`
      );
      assert.equal(withQueryToken.status, 200);

      const invalidTraversal = await fetch(
        `${baseUrl}/projects/${project}/assets/../story.md?access_token=asset-token`
      );
      assert.equal(invalidTraversal.status, 404);
    });
  } finally {
    env.apiBearerToken = previousToken;
    await fs.rm(projectDir, { recursive: true, force: true });
  }
});

test('project asset route handles backend/file edge cases', async () => {
  const app = express();
  app.use('/projects', requireBearerTokenOrAccessToken, createProjectAssetsRouter());

  const previousToken = env.apiBearerToken;
  const previousOutputBackend = env.outputBackend;
  env.apiBearerToken = 'asset-token';

  const project = `ut-asset-route-edge-${Date.now()}`;
  const projectDir = getProjectDir(project);

  try {
    await ensureProject(project);
    const keyframeDir = path.join(projectDir, 'assets', 'keyframes');
    await ensureDir(keyframeDir);
    await fs.mkdir(path.join(keyframeDir, 'nested-dir'), { recursive: true });

    await withServer(app, async (baseUrl) => {
      env.outputBackend = 'firebase';
      const firebaseBackendResponse = await fetch(
        `${baseUrl}/projects/${project}/assets/assets/keyframes/missing.png?access_token=asset-token`
      );
      assert.equal(firebaseBackendResponse.status, 400);

      env.outputBackend = 'local';

      const missingFile = await fetch(
        `${baseUrl}/projects/${project}/assets/assets/keyframes/missing.png?access_token=asset-token`
      );
      assert.equal(missingFile.status, 404);

      const emptyAssetPath = await fetch(
        `${baseUrl}/projects/${project}/assets/%20?access_token=asset-token`
      );
      assert.equal(emptyAssetPath.status, 400);

      const directoryPath = await fetch(
        `${baseUrl}/projects/${project}/assets/assets/keyframes/nested-dir?access_token=asset-token`
      );
      assert.equal(directoryPath.status, 404);

      const encodedAbsolutePath = await fetch(
        `${baseUrl}/projects/${project}/assets/%2Ftmp%2Fnot-inside-project.png?access_token=asset-token`
      );
      assert.equal(encodedAbsolutePath.status, 400);

      const invalidProjectName = await fetch(
        `${baseUrl}/projects/INVALID%20PROJECT%20NAME!/assets/assets/keyframes/keyframe_01.png?access_token=asset-token`
      );
      assert.equal(invalidProjectName.status, 400);
    });
  } finally {
    env.apiBearerToken = previousToken;
    env.outputBackend = previousOutputBackend;
    await fs.rm(projectDir, { recursive: true, force: true });
  }
});
