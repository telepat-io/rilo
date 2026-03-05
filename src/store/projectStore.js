import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { ensureDir, writeJson } from '../media/files.js';
import {
  DEFAULT_MODEL_SELECTIONS,
  DEFAULT_VIDEO_CONFIG,
  MODEL_SELECTION_KEYS,
  SUPPORTED_MODEL_IDS
} from '../config/models.js';

export const SUPPORTED_ASPECT_RATIOS = ['1:1', '16:9', '9:16'];
export const SUPPORTED_FINAL_DURATION_MODES = ['match_audio', 'match_visual'];
const PROJECT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export const DEFAULT_PROJECT_CONFIG = {
  aspectRatio: '9:16',
  targetDurationSec: DEFAULT_VIDEO_CONFIG.durationSec,
  finalDurationMode: 'match_audio',
  models: {
    ...DEFAULT_MODEL_SELECTIONS
  }
};

export function normalizeProjectConfig(config) {
  const nextConfig = config || {};
  const mergedModels = nextConfig.models === undefined
    ? { ...DEFAULT_MODEL_SELECTIONS }
    : {
        ...DEFAULT_MODEL_SELECTIONS,
        ...(nextConfig.models || {})
      };

  return {
    ...DEFAULT_PROJECT_CONFIG,
    ...nextConfig,
    models: mergedModels
  };
}

function validateProjectModels(modelSelections) {
  if (!modelSelections || typeof modelSelections !== 'object' || Array.isArray(modelSelections)) {
    throw new Error('Invalid project config: models must be an object');
  }

  for (const key of Object.keys(modelSelections)) {
    if (!MODEL_SELECTION_KEYS.includes(key)) {
      throw new Error(`Invalid project config: models.${key} is not a supported model category`);
    }
  }

  for (const key of MODEL_SELECTION_KEYS) {
    const modelId = modelSelections[key];
    if (typeof modelId !== 'string' || !modelId.trim()) {
      throw new Error(`Invalid project config: models.${key} must be a non-empty model id string`);
    }
    if (!SUPPORTED_MODEL_IDS.includes(modelId.trim())) {
      throw new Error(`Invalid project config: models.${key} must reference a supported model id`);
    }
  }
}

export function resolveProjectName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('Project name is required');
  }
  if (!PROJECT_NAME_PATTERN.test(normalized)) {
    throw new Error(
      'Invalid project name: use 1-64 characters of lowercase letters, numbers, hyphen (-), or underscore (_), starting and ending with a letter or number'
    );
  }
  return normalized;
}

export function getProjectDir(projectName) {
  return path.join(env.projectsDir, resolveProjectName(projectName));
}

export function getProjectStoryPath(projectName) {
  return path.join(getProjectDir(projectName), 'story.md');
}

export function getProjectStatePath(projectName) {
  return path.join(getProjectDir(projectName), 'run-state.json');
}

export function getProjectArtifactsPath(projectName) {
  return path.join(getProjectDir(projectName), 'artifacts.json');
}

export function getProjectConfigPath(projectName) {
  return path.join(getProjectDir(projectName), 'config.json');
}

export function getProjectMetadataPath(projectName) {
  return path.join(getProjectDir(projectName), 'metadata.json');
}

export function getProjectSyncPath(projectName) {
  return path.join(getProjectDir(projectName), 'sync.json');
}

export function getProjectScriptAssetPath(projectName) {
  return path.join(getProjectDir(projectName), 'assets', 'text', 'script.json');
}

export function validateProjectConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid project config: expected object');
  }

  if (!SUPPORTED_ASPECT_RATIOS.includes(config.aspectRatio)) {
    throw new Error(`Invalid project config: aspectRatio must be one of ${SUPPORTED_ASPECT_RATIOS.join(', ')}`);
  }

  if (!Number.isInteger(config.targetDurationSec)) {
    throw new Error('Invalid project config: targetDurationSec must be an integer number of seconds');
  }

  if (config.targetDurationSec < 5 || config.targetDurationSec > 600) {
    throw new Error('Invalid project config: targetDurationSec must be between 5 and 600');
  }

  if (!SUPPORTED_FINAL_DURATION_MODES.includes(config.finalDurationMode)) {
    throw new Error(
      `Invalid project config: finalDurationMode must be one of ${SUPPORTED_FINAL_DURATION_MODES.join(', ')}`
    );
  }

  const hasWidth = config.keyframeWidth !== undefined;
  const hasHeight = config.keyframeHeight !== undefined;
  if (hasWidth !== hasHeight) {
    throw new Error('Invalid project config: keyframeWidth and keyframeHeight must be set together');
  }

  if (hasWidth && hasHeight) {
    if (!Number.isInteger(config.keyframeWidth) || !Number.isInteger(config.keyframeHeight)) {
      throw new Error('Invalid project config: keyframeWidth/keyframeHeight must be integers');
    }
    if (config.keyframeWidth < 64 || config.keyframeWidth > 2048) {
      throw new Error('Invalid project config: keyframeWidth must be between 64 and 2048');
    }
    if (config.keyframeHeight < 64 || config.keyframeHeight > 2048) {
      throw new Error('Invalid project config: keyframeHeight must be between 64 and 2048');
    }
  }

  validateProjectModels(config.models);
}

export function normalizeAndValidateProjectConfig(config) {
  const normalized = normalizeProjectConfig(config);
  validateProjectConfig(normalized);
  return normalized;
}

export async function ensureProject(projectName) {
  await ensureDir(getProjectDir(projectName));
}

export async function ensureProjectConfig(projectName) {
  const configPath = getProjectConfigPath(projectName);
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return normalizeAndValidateProjectConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      await writeJson(configPath, DEFAULT_PROJECT_CONFIG);
      return DEFAULT_PROJECT_CONFIG;
    }
    throw error;
  }
}

export async function readProjectConfig(projectName) {
  return normalizeAndValidateProjectConfig(await ensureProjectConfig(projectName));
}

export async function writeProjectConfig(projectName, config) {
  const normalized = normalizeAndValidateProjectConfig(config);
  await writeJson(getProjectConfigPath(projectName), normalized);
  return normalized;
}

export async function readProjectStory(projectName) {
  const storyPath = getProjectStoryPath(projectName);
  return fs.readFile(storyPath, 'utf8');
}

export async function writeProjectStory(projectName, story) {
  const storyPath = getProjectStoryPath(projectName);
  await ensureDir(path.dirname(storyPath));
  await fs.writeFile(storyPath, story, 'utf8');
  return storyPath;
}

export async function readProjectScriptAsset(projectName) {
  try {
    const raw = await fs.readFile(getProjectScriptAssetPath(projectName), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeProjectScriptAsset(projectName, scriptAsset) {
  const scriptAssetPath = getProjectScriptAssetPath(projectName);
  await ensureDir(path.dirname(scriptAssetPath));
  await writeJson(scriptAssetPath, scriptAsset || {});
  return scriptAssetPath;
}

export async function projectStoryExists(projectName) {
  try {
    await fs.access(getProjectStoryPath(projectName));
    return true;
  } catch {
    return false;
  }
}

export async function readProjectRunState(projectName) {
  try {
    const raw = await fs.readFile(getProjectStatePath(projectName), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeProjectRunState(projectName, state) {
  await writeJson(getProjectStatePath(projectName), state);
}

export async function writeProjectArtifacts(projectName, artifacts) {
  await writeJson(getProjectArtifactsPath(projectName), artifacts);
}

export async function readProjectArtifacts(projectName) {
  try {
    const raw = await fs.readFile(getProjectArtifactsPath(projectName), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function readProjectMetadata(projectName) {
  try {
    const raw = await fs.readFile(getProjectMetadataPath(projectName), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function writeProjectMetadata(projectName, metadata) {
  await writeJson(getProjectMetadataPath(projectName), metadata || {});
}

export async function readProjectSync(projectName) {
  try {
    const raw = await fs.readFile(getProjectSyncPath(projectName), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeProjectSync(projectName, syncInfo) {
  await writeJson(getProjectSyncPath(projectName), syncInfo || {});
}

export async function listLocalProjects() {
  await ensureDir(env.projectsDir);
  const entries = await fs.readdir(env.projectsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}
