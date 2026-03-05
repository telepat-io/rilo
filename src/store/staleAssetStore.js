import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir } from '../media/files.js';

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createSnapshotId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${stamp}-${suffix}`;
}

async function listDirectories(rootPath) {
  if (!(await pathExists(rootPath))) {
    return [];
  }
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

export async function listProjectSnapshots(projectDir) {
  const snapshotsRoot = path.join(projectDir, 'snapshots');
  const legacyStaleRoot = path.join(projectDir, 'stale');

  const snapshots = await listDirectories(snapshotsRoot);
  const legacy = await listDirectories(legacyStaleRoot);

  return [...snapshots.map((name) => ({ root: 'snapshots', name })), ...legacy.map((name) => ({ root: 'stale', name }))]
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function archiveProjectAssets(projectDir) {
  const assetsPath = path.join(projectDir, 'assets');
  const finalVideoPath = path.join(projectDir, 'final.mp4');

  const hasAssets = await pathExists(assetsPath);
  const hasFinalVideo = await pathExists(finalVideoPath);
  if (!hasAssets && !hasFinalVideo) {
    return null;
  }

  const snapshotsRoot = path.join(projectDir, 'snapshots');
  const snapshotDir = path.join(snapshotsRoot, createSnapshotId());
  await ensureDir(snapshotDir);

  if (hasAssets) {
    await fs.rename(assetsPath, path.join(snapshotDir, 'assets'));
  }

  if (hasFinalVideo) {
    await fs.rename(finalVideoPath, path.join(snapshotDir, 'final.mp4'));
  }

  return snapshotDir;
}
