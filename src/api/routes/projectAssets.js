import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectMetadataBackend } from '../../backends/projectMetadataBackend.js';
import { getProjectDir, resolveProjectName } from '../../store/projectStore.js';

function isPathWithinBase(baseDir, candidatePath) {
  const normalizedBase = path.resolve(baseDir);
  const normalizedCandidate = path.resolve(candidatePath);
  const baseWithSeparator = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : `${normalizedBase}${path.sep}`;

  return normalizedCandidate === normalizedBase || normalizedCandidate.startsWith(baseWithSeparator);
}

export function createProjectAssetsRouter() {
  const router = express.Router();

  router.get('/:project/assets/*', async (req, res) => {
    try {
      const backend = getProjectMetadataBackend();
      if (backend.constructor?.name !== 'LocalProjectMetadataBackend') {
        res.status(400).json({
          error: 'asset file serving is available only for local backend; use assets[].value URLs for firebase backend'
        });
        return;
      }

      const project = resolveProjectName(req.params.project);
      const assetPath = String(req.params[0] || '').trim();
      if (!assetPath) {
        res.status(400).json({ error: 'asset path is required' });
        return;
      }

      const projectDir = getProjectDir(project);
      const filePath = path.resolve(projectDir, assetPath);

      if (!isPathWithinBase(projectDir, filePath)) {
        res.status(400).json({ error: 'invalid asset path' });
        return;
      }

      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        res.status(404).json({ error: 'asset not found' });
        return;
      }

      res.sendFile(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        res.status(404).json({ error: 'asset not found' });
        return;
      }

      res.status(400).json({ error: error.message });
    }
  });

  return router;
}