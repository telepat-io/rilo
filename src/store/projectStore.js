import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { ensureDir, writeJson } from '../media/files.js';
import {
  DEFAULT_MODEL_SELECTIONS,
  DEFAULT_VIDEO_CONFIG,
  MODEL_OPTION_KEYS,
  MODEL_SELECTION_KEYS,
  SUPPORTED_MODEL_IDS,
  resolveModelInputOptionsForCategory,
  resolveProjectModelOptions
} from '../config/models.js';

export const SUPPORTED_ASPECT_RATIOS = ['1:1', '16:9', '9:16'];
export const SUPPORTED_FINAL_DURATION_MODES = ['match_audio', 'match_visual'];
export const SUPPORTED_SUBTITLE_POSITIONS = ['top', 'center', 'bottom'];
export const SUPPORTED_SUBTITLE_HIGHLIGHT_MODES = ['spoken_upcoming', 'current_only'];
export const SUPPORTED_SUBTITLE_TEMPLATE_IDS = [
  'custom',
  'social_center_punch',
  'social_center_clean',
  'social_center_story'
];
const PROJECT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
export const PROJECT_CONFIG_SCHEMA_VERSION = 1;

export const DEFAULT_SUBTITLE_OPTIONS = {
  enabled: false,
  templateId: 'custom',
  position: 'center',
  fontName: 'Poppins',
  fontSize: 100,
  bold: true,
  italic: false,
  makeUppercase: false,
  primaryColor: '#ffffff',
  activeColor: '#ffe066',
  outlineColor: '#111111',
  backgroundEnabled: false,
  backgroundColor: '#000000',
  backgroundOpacity: 0.45,
  outline: 3,
  shadow: 0,
  marginV: 70,
  maxWordsPerLine: 7,
  maxLines: 2,
  highlightMode: 'spoken_upcoming'
};

export const DEFAULT_PROJECT_CONFIG = {
  schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION,
  aspectRatio: '9:16',
  targetDurationSec: DEFAULT_VIDEO_CONFIG.durationSec,
  finalDurationMode: 'match_audio',
  pauseAfterKeyframes: true,
  subtitleOptions: {
    ...DEFAULT_SUBTITLE_OPTIONS
  },
  models: {
    ...DEFAULT_MODEL_SELECTIONS
  },
  modelOptions: resolveProjectModelOptions({}, DEFAULT_MODEL_SELECTIONS)
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOptionValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value;
}

function normalizeSubtitleOptions(candidate) {
  if (!isPlainObject(candidate)) {
    return {
      ...DEFAULT_SUBTITLE_OPTIONS
    };
  }

  const normalized = {
    ...DEFAULT_SUBTITLE_OPTIONS,
    ...candidate
  };

  // Preserve compatibility with older saved configs that used removed template ids.
  if (normalized.templateId === 'social_top_minimal') {
    normalized.templateId = 'social_center_clean';
  } else if (normalized.templateId === 'social_bottom_classic') {
    normalized.templateId = 'social_center_story';
  }

  for (const key of ['templateId', 'fontName', 'primaryColor', 'activeColor', 'outlineColor', 'backgroundColor']) {
    if (typeof normalized[key] === 'string') {
      normalized[key] = normalized[key].trim();
    }
  }

  return normalized;
}

function validateHexColor(value, fieldPath) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.trim())) {
    throw new Error(`Invalid project config: ${fieldPath} must be a hex color like #RRGGBB`);
  }
}

function validateSubtitleOptions(subtitleOptions) {
  if (!isPlainObject(subtitleOptions)) {
    throw new Error('Invalid project config: subtitleOptions must be an object');
  }

  if (typeof subtitleOptions.enabled !== 'boolean') {
    throw new Error('Invalid project config: subtitleOptions.enabled must be a boolean');
  }

  if (!SUPPORTED_SUBTITLE_TEMPLATE_IDS.includes(subtitleOptions.templateId)) {
    throw new Error(
      `Invalid project config: subtitleOptions.templateId must be one of ${SUPPORTED_SUBTITLE_TEMPLATE_IDS.join(', ')}`
    );
  }

  if (!SUPPORTED_SUBTITLE_POSITIONS.includes(subtitleOptions.position)) {
    throw new Error(
      `Invalid project config: subtitleOptions.position must be one of ${SUPPORTED_SUBTITLE_POSITIONS.join(', ')}`
    );
  }

  if (!SUPPORTED_SUBTITLE_HIGHLIGHT_MODES.includes(subtitleOptions.highlightMode)) {
    throw new Error(
      `Invalid project config: subtitleOptions.highlightMode must be one of ${SUPPORTED_SUBTITLE_HIGHLIGHT_MODES.join(', ')}`
    );
  }

  if (typeof subtitleOptions.fontName !== 'string' || !subtitleOptions.fontName.trim()) {
    throw new Error('Invalid project config: subtitleOptions.fontName must be a non-empty string');
  }

  if (typeof subtitleOptions.bold !== 'boolean') {
    throw new Error('Invalid project config: subtitleOptions.bold must be a boolean');
  }

  if (typeof subtitleOptions.italic !== 'boolean') {
    throw new Error('Invalid project config: subtitleOptions.italic must be a boolean');
  }

  if (typeof subtitleOptions.makeUppercase !== 'boolean') {
    throw new Error('Invalid project config: subtitleOptions.makeUppercase must be a boolean');
  }

  if (!Number.isInteger(subtitleOptions.fontSize) || subtitleOptions.fontSize < 16 || subtitleOptions.fontSize > 120) {
    throw new Error('Invalid project config: subtitleOptions.fontSize must be an integer between 16 and 120');
  }

  validateHexColor(subtitleOptions.primaryColor, 'subtitleOptions.primaryColor');
  validateHexColor(subtitleOptions.activeColor, 'subtitleOptions.activeColor');
  validateHexColor(subtitleOptions.outlineColor, 'subtitleOptions.outlineColor');

  if (typeof subtitleOptions.backgroundEnabled !== 'boolean') {
    throw new Error('Invalid project config: subtitleOptions.backgroundEnabled must be a boolean');
  }

  validateHexColor(subtitleOptions.backgroundColor, 'subtitleOptions.backgroundColor');

  if (typeof subtitleOptions.backgroundOpacity !== 'number' || !Number.isFinite(subtitleOptions.backgroundOpacity)) {
    throw new Error('Invalid project config: subtitleOptions.backgroundOpacity must be a number between 0 and 0.85');
  }

  if (subtitleOptions.backgroundOpacity < 0 || subtitleOptions.backgroundOpacity > 0.85) {
    throw new Error('Invalid project config: subtitleOptions.backgroundOpacity must be between 0 and 0.85');
  }

  if (!Number.isInteger(subtitleOptions.outline) || subtitleOptions.outline < 0 || subtitleOptions.outline > 12) {
    throw new Error('Invalid project config: subtitleOptions.outline must be an integer between 0 and 12');
  }

  if (!Number.isInteger(subtitleOptions.shadow) || subtitleOptions.shadow < 0 || subtitleOptions.shadow > 12) {
    throw new Error('Invalid project config: subtitleOptions.shadow must be an integer between 0 and 12');
  }

  if (!Number.isInteger(subtitleOptions.marginV) || subtitleOptions.marginV < 0 || subtitleOptions.marginV > 400) {
    throw new Error('Invalid project config: subtitleOptions.marginV must be an integer between 0 and 400');
  }

  if (
    !Number.isInteger(subtitleOptions.maxWordsPerLine)
    || subtitleOptions.maxWordsPerLine < 1
    || subtitleOptions.maxWordsPerLine > 20
  ) {
    throw new Error('Invalid project config: subtitleOptions.maxWordsPerLine must be an integer between 1 and 20');
  }

  if (!Number.isInteger(subtitleOptions.maxLines) || subtitleOptions.maxLines < 1 || subtitleOptions.maxLines > 3) {
    throw new Error('Invalid project config: subtitleOptions.maxLines must be an integer between 1 and 3');
  }
}

function normalizeCategoryModelOptions(category, categoryOptions, modelSelections) {
  if (!isPlainObject(categoryOptions)) {
    return categoryOptions;
  }

  const normalized = {};
  const inputOptions = resolveModelInputOptionsForCategory(category, modelSelections);
  const allowedOptions = new Set(inputOptions.userConfigurable);

  for (const [optionKey, optionValue] of Object.entries(categoryOptions)) {
    if (!allowedOptions.has(optionKey)) {
      normalized[optionKey] = normalizeOptionValue(optionValue);
      continue;
    }

    normalized[optionKey] = normalizeOptionValue(optionValue);
  }

  return normalized;
}

function mergeProjectModelOptions(rawModelOptions, modelSelections) {
  const defaults = resolveProjectModelOptions({}, modelSelections);

  if (rawModelOptions === undefined) {
    return defaults;
  }

  if (!isPlainObject(rawModelOptions)) {
    return rawModelOptions;
  }

  const merged = {
    ...defaults
  };

  for (const category of MODEL_OPTION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rawModelOptions, category)) {
      continue;
    }

    const candidate = rawModelOptions[category];
    if (!isPlainObject(candidate)) {
      merged[category] = candidate;
      continue;
    }

    merged[category] = normalizeCategoryModelOptions(
      category,
      {
        ...defaults[category],
        ...candidate
      },
      modelSelections
    );
  }

  for (const key of Object.keys(rawModelOptions)) {
    if (!MODEL_OPTION_KEYS.includes(key)) {
      merged[key] = rawModelOptions[key];
    }
  }

  return merged;
}

function validateFieldConstraints({ category, optionKey, optionValue, field }) {
  if (optionValue === null) {
    if (field.nullable) {
      return;
    }
    throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} cannot be null`);
  }

  if (field.type === 'boolean') {
    if (typeof optionValue !== 'boolean') {
      throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} must be a boolean`);
    }
    return;
  }

  if (field.type === 'integer') {
    if (!Number.isInteger(optionValue)) {
      throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} must be an integer`);
    }
    if (Number.isFinite(field.minimum) && optionValue < field.minimum) {
      throw new Error(
        `Invalid project config: modelOptions.${category}.${optionKey} must be >= ${field.minimum}`
      );
    }
    if (Number.isFinite(field.maximum) && optionValue > field.maximum) {
      throw new Error(
        `Invalid project config: modelOptions.${category}.${optionKey} must be <= ${field.maximum}`
      );
    }
    return;
  }

  if (field.type === 'number') {
    if (typeof optionValue !== 'number' || !Number.isFinite(optionValue)) {
      throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} must be a number`);
    }
    if (Number.isFinite(field.minimum) && optionValue < field.minimum) {
      throw new Error(
        `Invalid project config: modelOptions.${category}.${optionKey} must be >= ${field.minimum}`
      );
    }
    if (Number.isFinite(field.maximum) && optionValue > field.maximum) {
      throw new Error(
        `Invalid project config: modelOptions.${category}.${optionKey} must be <= ${field.maximum}`
      );
    }
    return;
  }

  if (field.type === 'string') {
    if (typeof optionValue !== 'string') {
      throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} must be a string`);
    }

    const trimmed = optionValue.trim();
    if (!trimmed) {
      throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} must be a non-empty string`);
    }

    if (Number.isInteger(field.maxLength) && trimmed.length > field.maxLength) {
      throw new Error(
        `Invalid project config: modelOptions.${category}.${optionKey} length must be <= ${field.maxLength}`
      );
    }

    if (Array.isArray(field.enum) && field.enum.length > 0 && !field.allowAnyString && !field.enum.includes(trimmed)) {
      throw new Error(
        `Invalid project config: modelOptions.${category}.${optionKey} must be one of ${field.enum.join(', ')}`
      );
    }

    return;
  }

  throw new Error(`Invalid project config: modelOptions.${category}.${optionKey} has unsupported type`);
}

function validateProjectModelOptions(modelOptions, modelSelections) {
  if (!isPlainObject(modelOptions)) {
    throw new Error('Invalid project config: modelOptions must be an object');
  }

  for (const key of Object.keys(modelOptions)) {
    if (!MODEL_OPTION_KEYS.includes(key)) {
      throw new Error(`Invalid project config: modelOptions.${key} is not a supported model category`);
    }
  }

  for (const category of MODEL_OPTION_KEYS) {
    const categoryOptions = modelOptions[category];
    if (!isPlainObject(categoryOptions)) {
      throw new Error(`Invalid project config: modelOptions.${category} must be an object`);
    }

    const inputOptions = resolveModelInputOptionsForCategory(category, modelSelections);
    const allowedOptions = new Set(inputOptions.userConfigurable);
    const fields = inputOptions.fields || {};

    for (const optionKey of Object.keys(categoryOptions)) {
      if (!allowedOptions.has(optionKey)) {
        throw new Error(
          `Invalid project config: modelOptions.${category}.${optionKey} is not supported for selected model`
        );
      }

      const field = fields[optionKey];
      if (!field || typeof field !== 'object') {
        throw new Error(
          `Invalid project config: modelOptions.${category}.${optionKey} has no metadata definition`
        );
      }

      validateFieldConstraints({
        category,
        optionKey,
        optionValue: categoryOptions[optionKey],
        field
      });
    }
  }
};

export function normalizeProjectConfig(config) {
  const nextConfig = config || {};

  if (nextConfig.schemaVersion !== undefined) {
    if (!Number.isInteger(nextConfig.schemaVersion) || nextConfig.schemaVersion < 1) {
      throw new Error('Invalid project config: schemaVersion must be a positive integer');
    }
    if (nextConfig.schemaVersion > PROJECT_CONFIG_SCHEMA_VERSION) {
      throw new Error(
        `Invalid project config: schemaVersion ${nextConfig.schemaVersion} is newer than supported version ${PROJECT_CONFIG_SCHEMA_VERSION}`
      );
    }
  }

  const mergedModels = nextConfig.models === undefined
    ? { ...DEFAULT_MODEL_SELECTIONS }
    : {
        ...DEFAULT_MODEL_SELECTIONS,
        ...(nextConfig.models || {})
      };
  const mergedModelOptions = mergeProjectModelOptions(nextConfig.modelOptions, mergedModels);

  return {
    ...DEFAULT_PROJECT_CONFIG,
    ...nextConfig,
    schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION,
    subtitleOptions: normalizeSubtitleOptions(nextConfig.subtitleOptions),
    models: mergedModels,
    modelOptions: mergedModelOptions
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

  if (!Number.isInteger(config.schemaVersion) || config.schemaVersion < 1) {
    throw new Error('Invalid project config: schemaVersion must be a positive integer');
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

  validateSubtitleOptions(config.subtitleOptions);

  if (typeof config.pauseAfterKeyframes !== 'boolean') {
    throw new Error('Invalid project config: pauseAfterKeyframes must be a boolean');
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
  validateProjectModelOptions(config.modelOptions, config.models);
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
