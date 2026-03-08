import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  ensureProject,
  ensureProjectConfig,
  getProjectConfigPath,
  getProjectDir,
  normalizeAndValidateProjectConfig,
  readProjectConfig,
  resolveProjectName,
  writeProjectConfig
} from '../src/store/projectStore.js';
import { DEFAULT_MODEL_SELECTIONS } from '../src/config/models.js';

function uniqueProject(prefix) {
  const project = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  createdProjects.add(project);
  return project;
}

async function cleanupProject(project) {
  await fs.rm(getProjectDir(project), { recursive: true, force: true });
}

const createdProjects = new Set();

after(async () => {
  await Promise.all([...createdProjects].map((project) => cleanupProject(project)));
  createdProjects.clear();
});

test('resolveProjectName normalizes valid names and rejects invalid names', () => {
  assert.equal(resolveProjectName('  MY_Project-01 '), 'my_project-01');

  assert.throws(() => resolveProjectName(''), /Project name is required/);
  assert.throws(() => resolveProjectName('bad project!'), /Invalid project name/);
  assert.throws(() => resolveProjectName('_badstart'), /Invalid project name/);
});

test('normalizeAndValidateProjectConfig applies defaults and validates fields', () => {
  const normalized = normalizeAndValidateProjectConfig({ targetDurationSec: 30 });
  assert.equal(normalized.aspectRatio, '9:16');
  assert.equal(normalized.targetDurationSec, 30);
  assert.equal(normalized.finalDurationMode, 'match_audio');
  assert.equal(normalized.subtitleOptions.enabled, false);
  assert.equal(normalized.subtitleOptions.templateId, 'custom');
  assert.equal(normalized.subtitleOptions.position, 'center');
  assert.equal(normalized.subtitleOptions.fontSize, 100);
  assert.equal(normalized.subtitleOptions.bold, true);
  assert.equal(normalized.subtitleOptions.italic, false);
  assert.equal(normalized.subtitleOptions.makeUppercase, false);
  assert.equal(normalized.subtitleOptions.backgroundEnabled, false);
  assert.equal(normalized.subtitleOptions.maxLines, 2);
  assert.equal(normalized.subtitleOptions.highlightMode, 'spoken_upcoming');
  assert.deepEqual(normalized.models, DEFAULT_MODEL_SELECTIONS);

  assert.throws(
    () => normalizeAndValidateProjectConfig({ targetDurationSec: '30' }),
    /targetDurationSec must be an integer/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ finalDurationMode: 'other' }),
    /finalDurationMode must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ keyframeWidth: 512 }),
    /keyframeWidth and keyframeHeight must be set together/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ models: { unknownCategory: 'deepseek-ai/deepseek-v3' } }),
    /not a supported model category/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ models: { textToText: 'unknown/model' } }),
    /must reference a supported model id/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { enabled: true, primaryColor: 'yellow' } }),
    /must be a hex color/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { highlightMode: 'blink' } }),
    /subtitleOptions\.highlightMode must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { templateId: 'invalid_template' } }),
    /subtitleOptions\.templateId must be one of/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { backgroundOpacity: 0.95 } }),
    /subtitleOptions\.backgroundOpacity must be between 0 and 0\.85/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { outlineColor: 'orange' } }),
    /must be a hex color/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ subtitleOptions: { makeUppercase: 'yes' } }),
    /subtitleOptions\.makeUppercase must be a boolean/
  );
});

test('normalizeAndValidateProjectConfig supports partial model overrides', () => {
  const normalized = normalizeAndValidateProjectConfig({
    models: {
      textToText: 'deepseek-ai/deepseek-v3'
    }
  });

  assert.equal(normalized.models.textToText, 'deepseek-ai/deepseek-v3');
  assert.equal(normalized.models.textToSpeech, DEFAULT_MODEL_SELECTIONS.textToSpeech);
  assert.equal(normalized.models.textToImage, DEFAULT_MODEL_SELECTIONS.textToImage);
  assert.equal(normalized.models.imageTextToVideo, DEFAULT_MODEL_SELECTIONS.imageTextToVideo);
});

test('normalizeAndValidateProjectConfig remaps legacy subtitle template ids', () => {
  const topLegacy = normalizeAndValidateProjectConfig({ subtitleOptions: { templateId: 'social_top_minimal' } });
  const bottomLegacy = normalizeAndValidateProjectConfig({ subtitleOptions: { templateId: 'social_bottom_classic' } });

  assert.equal(topLegacy.subtitleOptions.templateId, 'social_center_clean');
  assert.equal(bottomLegacy.subtitleOptions.templateId, 'social_center_story');
});

test('normalizeAndValidateProjectConfig validates modelOptions per selected model', () => {
  const normalized = normalizeAndValidateProjectConfig({
    modelOptions: {
      textToText: {
        temperature: 0.7,
        top_p: 0.9
      },
      textToSpeech: {
        voice_id: 'Deep_Voice_Man',
        speed: 1.1
      },
      textToImage: {
        num_inference_steps: 10,
        output_format: 'png'
      },
      imageTextToVideo: {
        interpolate_output: true,
        sample_shift: 14
      }
    }
  });

  assert.equal(normalized.modelOptions.textToText.temperature, 0.7);
  assert.equal(normalized.modelOptions.textToSpeech.voice_id, 'Deep_Voice_Man');
  assert.equal(normalized.modelOptions.textToImage.output_format, 'png');
  assert.equal(normalized.modelOptions.imageTextToVideo.interpolate_output, true);

  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { unknownCategory: {} } }),
    /modelOptions\.unknownCategory is not a supported model category/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToText: { unknown_key: true } } }),
    /is not supported for selected model/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToText: { temperature: 'hot' } } }),
    /must be a number/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToImage: { num_inference_steps: 99 } } }),
    /must be <= 50/
  );
  assert.throws(
    () => normalizeAndValidateProjectConfig({ modelOptions: { textToImage: { output_format: 'gif' } } }),
    /must be one of/
  );
});

test('writeProjectConfig and readProjectConfig enforce canonical validated config', async () => {
  const project = uniqueProject('ut-project-config');
  await ensureProject(project);

  const written = await writeProjectConfig(project, {
    aspectRatio: '1:1',
    targetDurationSec: 45,
    finalDurationMode: 'match_visual',
    keyframeWidth: 512,
    keyframeHeight: 512,
    models: {
      textToText: 'deepseek-ai/deepseek-v3',
      textToSpeech: 'minimax/speech-02-turbo',
      textToImage: 'prunaai/z-image-turbo',
      imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
    }
  });

  assert.equal(written.aspectRatio, '1:1');
  assert.equal(written.targetDurationSec, 45);
  assert.equal(written.finalDurationMode, 'match_visual');
  assert.equal(written.models.textToImage, 'prunaai/z-image-turbo');

  const readBack = await readProjectConfig(project);
  assert.deepEqual(readBack, written);

  await cleanupProject(project);
});

test('ensureProjectConfig writes default config when missing', async () => {
  const project = uniqueProject('ut-project-default');
  await ensureProject(project);
  const configPath = getProjectConfigPath(project);
  await fs.rm(configPath, { force: true });

  const config = await ensureProjectConfig(project);
  assert.equal(config.aspectRatio, '9:16');
  assert.equal(config.finalDurationMode, 'match_audio');
  assert.deepEqual(config.models, DEFAULT_MODEL_SELECTIONS);

  const persistedRaw = JSON.parse(await fs.readFile(configPath, 'utf8'));
  assert.equal(persistedRaw.aspectRatio, '9:16');

  await cleanupProject(project);
});
