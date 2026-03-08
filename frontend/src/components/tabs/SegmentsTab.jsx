import { MediaWrap } from '../ui/MediaWrap.jsx';
import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';

const IMAGE_TO_VIDEO_MODEL_IDS = {
  wan: 'wan-video/wan-2.2-i2v-fast',
  klingV3: 'kwaivgi/kling-v3-video',
  pixverseV56: 'pixverse/pixverse-v5.6',
  veo31: 'google/veo-3.1',
  veo31Fast: 'google/veo-3.1-fast'
};

const KLING_USD_PER_SECOND = {
  standard: {
    withAudio: 0.252,
    withoutAudio: 0.168
  },
  pro: {
    withAudio: 0.336,
    withoutAudio: 0.224
  }
};

const PIXVERSE_USD_PER_SECOND = {
  '360p': 0.07,
  '540p': 0.07,
  '720p': 0.09,
  '1080p': 0.15
};

const VEO_USD_PER_SECOND = {
  standardWithoutAudio: 0.2,
  withoutAudio: 0.1
};

export function SegmentsTab({
  assets,
  expectedCount,
  selectedProject,
  isRunning,
  activeStep,
  activeSegmentIndex,
  regeneratingMap,
  mediaCss,
  mediaColMin,
  assetCacheKey,
  toDisplayAssetUrl,
  onRegenerateProject,
  onTargetedRegenerate,
  configDraft,
  onPatchModel,
  onPatchModelOption,
  configDirty,
  savingConfig,
  onSaveConfig
}) {
  const models = configDraft?.models || {};
  const i2vOptions = configDraft?.modelOptions?.imageTextToVideo || {};
  const totalCards = Math.max(assets.length, expectedCount || 0);

  function getKlingEstimatedCostLabel() {
    const mode = i2vOptions.mode === 'standard' ? 'standard' : 'pro';
    const withAudio = false;
    const usdPerSecond = withAudio
      ? KLING_USD_PER_SECOND[mode].withAudio
      : KLING_USD_PER_SECOND[mode].withoutAudio;
    const estimatedCost = usdPerSecond * 5;
    return `Estimated cost for current settings: $${estimatedCost.toFixed(2)} per 5s segment.`;
  }

  function getPixverseEstimatedCostLabel() {
    const quality = ['360p', '540p', '720p', '1080p'].includes(i2vOptions.quality)
      ? i2vOptions.quality
      : '540p';
    const usdPerSecond = PIXVERSE_USD_PER_SECOND[quality];
    const estimatedCost = usdPerSecond * 5;
    return `Estimated cost for current settings: $${estimatedCost.toFixed(2)} per 5s segment (${quality}).`;
  }

  function getVeoEstimatedCostLabel() {
    const isVeo31 = models.imageTextToVideo === IMAGE_TO_VIDEO_MODEL_IDS.veo31;
    const usdPerSecond = isVeo31 ? VEO_USD_PER_SECOND.standardWithoutAudio : VEO_USD_PER_SECOND.withoutAudio;
    const estimatedCost = usdPerSecond * 5;
    return `Estimated cost for current settings: $${estimatedCost.toFixed(2)} per 5s segment (audio disabled).`;
  }

  function handleModelChange(nextModelId) {
    onPatchModel('imageTextToVideo', nextModelId);

    const clearOptions = (keys) => {
      for (const key of keys) {
        onPatchModelOption('imageTextToVideo', key, undefined);
      }
    };

    if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.wan) {
      clearOptions(['negative_prompt', 'mode', 'generate_audio', 'quality', 'generate_audio_switch', 'thinking_type', 'resolution']);
      return;
    }

    if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.klingV3) {
      clearOptions([
        'interpolate_output',
        'go_fast',
        'sample_shift',
        'seed',
        'disable_safety_checker',
        'lora_weights_transformer',
        'lora_scale_transformer',
        'lora_weights_transformer_2',
        'lora_scale_transformer_2',
        'quality',
        'generate_audio_switch',
        'thinking_type',
        'resolution'
      ]);
      onPatchModelOption('imageTextToVideo', 'generate_audio', false);
      return;
    }

    if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.pixverseV56) {
      clearOptions([
        'interpolate_output',
        'go_fast',
        'sample_shift',
        'disable_safety_checker',
        'lora_weights_transformer',
        'lora_scale_transformer',
        'lora_weights_transformer_2',
        'lora_scale_transformer_2',
        'mode',
        'generate_audio',
        'resolution'
      ]);
      onPatchModelOption('imageTextToVideo', 'generate_audio_switch', false);
      return;
    }

    if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31 || nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31Fast) {
      clearOptions([
        'interpolate_output',
        'go_fast',
        'sample_shift',
        'disable_safety_checker',
        'lora_weights_transformer',
        'lora_scale_transformer',
        'lora_weights_transformer_2',
        'lora_scale_transformer_2',
        'mode',
        'quality',
        'generate_audio_switch',
        'thinking_type'
      ]);
      onPatchModelOption('imageTextToVideo', 'generate_audio', false);
    }
  }

  function renderModelSpecificFields() {
    if (models.imageTextToVideo === IMAGE_TO_VIDEO_MODEL_IDS.klingV3) {
      return (
        <>
          <p className="muted size-sm">
            Kling v3 uses start/end keyframes and fixed <code>duration=5s</code>.
          </p>
          <p className="muted size-sm">{getKlingEstimatedCostLabel()}</p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-negative-prompt">Negative Prompt</label>
            <textarea
              id="seg-negative-prompt"
              className="config-input"
              rows={3}
              placeholder="Optional exclusions"
              value={i2vOptions.negative_prompt ?? ''}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'negative_prompt', event.target.value || null)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-mode">Mode</label>
            <select
              id="seg-mode"
              className="config-select"
              value={i2vOptions.mode ?? 'pro'}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'mode', event.target.value)}
            >
              <option value="standard">standard (720p)</option>
              <option value="pro">pro (1080p)</option>
            </select>
          </div>
          <p className="muted size-sm">Native audio generation is currently disabled for this model.</p>
        </>
      );
    }

    if (models.imageTextToVideo === IMAGE_TO_VIDEO_MODEL_IDS.pixverseV56) {
      return (
        <>
          <p className="muted size-sm">
            PixVerse v5.6 uses start/end keyframes and fixed <code>duration=5s</code>.
          </p>
          <p className="muted size-sm">{getPixverseEstimatedCostLabel()}</p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-quality">Quality</label>
            <select
              id="seg-quality"
              className="config-select"
              value={i2vOptions.quality ?? '540p'}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'quality', event.target.value)}
            >
              <option value="360p">360p</option>
              <option value="540p">540p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-negative-prompt">Negative Prompt</label>
            <textarea
              id="seg-negative-prompt"
              className="config-input"
              rows={3}
              placeholder="Optional exclusions"
              value={i2vOptions.negative_prompt ?? ''}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'negative_prompt', event.target.value || null)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-seed">Seed <span className="config-form-optional">(optional)</span></label>
            <input
              id="seg-seed"
              type="number"
              className="config-input"
              step={1}
              placeholder="random"
              value={i2vOptions.seed ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? null : parseInt(event.target.value, 10);
                onPatchModelOption('imageTextToVideo', 'seed', Number.isNaN(v) ? null : v);
              }}
            />
          </div>
          <p className="muted size-sm">Native audio generation is currently disabled for this model.</p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-thinking-type">Thinking Type</label>
            <input
              id="seg-thinking-type"
              type="text"
              className="config-input"
              placeholder="auto"
              value={i2vOptions.thinking_type ?? ''}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'thinking_type', event.target.value || undefined)}
            />
          </div>
        </>
      );
    }

    if (
      models.imageTextToVideo === IMAGE_TO_VIDEO_MODEL_IDS.veo31
      || models.imageTextToVideo === IMAGE_TO_VIDEO_MODEL_IDS.veo31Fast
    ) {
      const label = models.imageTextToVideo === IMAGE_TO_VIDEO_MODEL_IDS.veo31 ? 'Veo 3.1' : 'Veo 3.1 Fast';
      return (
        <>
          <p className="muted size-sm">
            {label} uses start/end keyframes and fixed <code>duration=5s</code>.
          </p>
          <p className="muted size-sm">{getVeoEstimatedCostLabel()}</p>
          <p className="muted size-sm">Native audio generation is currently disabled for this model.</p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-resolution">Resolution</label>
            <select
              id="seg-resolution"
              className="config-select"
              value={i2vOptions.resolution ?? '1080p'}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'resolution', event.target.value)}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-negative-prompt">Negative Prompt</label>
            <textarea
              id="seg-negative-prompt"
              className="config-input"
              rows={3}
              placeholder="Optional exclusions"
              value={i2vOptions.negative_prompt ?? ''}
              onChange={(event) => onPatchModelOption('imageTextToVideo', 'negative_prompt', event.target.value || null)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="seg-seed">Seed <span className="config-form-optional">(optional)</span></label>
            <input
              id="seg-seed"
              type="number"
              className="config-input"
              step={1}
              placeholder="random"
              value={i2vOptions.seed ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? null : parseInt(event.target.value, 10);
                onPatchModelOption('imageTextToVideo', 'seed', Number.isNaN(v) ? null : v);
              }}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-sample-shift">Sample Shift</label>
          <input id="seg-sample-shift" type="number" className="config-input" min={1} max={20} step={0.1} placeholder="12" value={i2vOptions.sample_shift ?? ''} onChange={(event) => { const v = event.target.value === '' ? undefined : parseFloat(event.target.value); onPatchModelOption('imageTextToVideo', 'sample_shift', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-seed">Seed <span className="config-form-optional">(optional)</span></label>
          <input id="seg-seed" type="number" className="config-input" step={1} placeholder="random" value={i2vOptions.seed ?? ''} onChange={(event) => { const v = event.target.value === '' ? null : parseInt(event.target.value, 10); onPatchModelOption('imageTextToVideo', 'seed', Number.isNaN(v) ? null : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-lora1">LoRA Weights <span className="config-form-optional">(optional)</span></label>
          <input id="seg-lora1" type="text" className="config-input" placeholder="none" value={i2vOptions.lora_weights_transformer ?? ''} onChange={(event) => onPatchModelOption('imageTextToVideo', 'lora_weights_transformer', event.target.value || null)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-lora1-scale">LoRA Scale</label>
          <input id="seg-lora1-scale" type="number" className="config-input" step={0.1} placeholder="1" value={i2vOptions.lora_scale_transformer ?? ''} onChange={(event) => { const v = event.target.value === '' ? undefined : parseFloat(event.target.value); onPatchModelOption('imageTextToVideo', 'lora_scale_transformer', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-lora2">LoRA Weights 2 <span className="config-form-optional">(optional)</span></label>
          <input id="seg-lora2" type="text" className="config-input" placeholder="none" value={i2vOptions.lora_weights_transformer_2 ?? ''} onChange={(event) => onPatchModelOption('imageTextToVideo', 'lora_weights_transformer_2', event.target.value || null)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-lora2-scale">LoRA Scale 2</label>
          <input id="seg-lora2-scale" type="number" className="config-input" step={0.1} placeholder="1" value={i2vOptions.lora_scale_transformer_2 ?? ''} onChange={(event) => { const v = event.target.value === '' ? undefined : parseFloat(event.target.value); onPatchModelOption('imageTextToVideo', 'lora_scale_transformer_2', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-go-fast">Go Fast</label>
          <input id="seg-go-fast" type="checkbox" checked={i2vOptions.go_fast ?? true} onChange={(event) => onPatchModelOption('imageTextToVideo', 'go_fast', event.target.checked)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-interpolate">Interpolate Output</label>
          <input id="seg-interpolate" type="checkbox" checked={i2vOptions.interpolate_output ?? false} onChange={(event) => onPatchModelOption('imageTextToVideo', 'interpolate_output', event.target.checked)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="seg-safety">Disable Safety Checker</label>
          <input id="seg-safety" type="checkbox" checked={i2vOptions.disable_safety_checker ?? false} onChange={(event) => onPatchModelOption('imageTextToVideo', 'disable_safety_checker', event.target.checked)} />
        </div>
      </>
    );
  }

  const modelConfig = (
    <ModelConfigSection
      modelId={models.imageTextToVideo}
      configDirty={configDirty}
      savingConfig={savingConfig}
      isRunning={isRunning}
      onSaveConfig={onSaveConfig}
    >
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="seg-model">Model ID</label>
        <select
          id="seg-model"
          className="config-select"
          value={models.imageTextToVideo || IMAGE_TO_VIDEO_MODEL_IDS.wan}
          onChange={(event) => handleModelChange(event.target.value)}
        >
          <option value={IMAGE_TO_VIDEO_MODEL_IDS.wan}>Wan 2.2 I2V Fast (`wan-video/wan-2.2-i2v-fast`)</option>
          <option value={IMAGE_TO_VIDEO_MODEL_IDS.klingV3}>Kling V3 Video (`kwaivgi/kling-v3-video`)</option>
          <option value={IMAGE_TO_VIDEO_MODEL_IDS.pixverseV56}>PixVerse v5.6 (`pixverse/pixverse-v5.6`)</option>
          <option value={IMAGE_TO_VIDEO_MODEL_IDS.veo31}>Veo 3.1 (`google/veo-3.1`)</option>
          <option value={IMAGE_TO_VIDEO_MODEL_IDS.veo31Fast}>Veo 3.1 Fast (`google/veo-3.1-fast`)</option>
        </select>
      </div>
      {renderModelSpecificFields()}
    </ModelConfigSection>
  );

  if (totalCards === 0) {
    return (
      <div className="tab-pane">
        {modelConfig}
        <div className="empty-state">
          <p className="muted">No segments generated yet.</p>
          <button type="button" className="btn btn-secondary" onClick={onRegenerateProject} disabled={isRunning}>
            ▶ Regenerate project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-pane">
      {modelConfig}
      <div className="asset-grid" style={{ '--grid-col-min': mediaColMin }}>
        {Array.from({ length: totalCards }, (_, index) => {
          const asset = assets[index] || null;
          const mapKey = `segment-${index}`;
          const busy = Boolean(regeneratingMap[mapKey]);
          const isGeneratingByIndex = Number.isInteger(activeSegmentIndex)
            && isRunning
            && activeStep === 'segments'
            && activeSegmentIndex === index;
          const isGeneratingBySlot = !asset
            && isRunning
            && activeStep === 'segments'
            && !Number.isInteger(activeSegmentIndex)
            && index === assets.length;
          const isGenerating = isGeneratingByIndex || isGeneratingBySlot;
          const isPending = !asset && !isGenerating;
          return (
            <article key={asset?.path || `segment-slot-${index}`} className="asset-card">
              <div className="asset-status-row">
                <div className="asset-index">#{index + 1}</div>
                {isGenerating && <span className="badge badge-running">Generating</span>}
                {isPending && <span className="badge badge-pending">Pending</span>}
              </div>
              <MediaWrap ar={mediaCss}>
                {busy || isGenerating ? (
                  <div className="media-placeholder">
                    <div className="media-placeholder-content">
                      <span className="spinner" />
                      <span className="media-placeholder-title">Generating segment</span>
                    </div>
                  </div>
                ) : isPending ? (
                  <div className="media-placeholder">
                    <div className="media-placeholder-content">
                      <span className="media-placeholder-title">Pending segment</span>
                    </div>
                  </div>
                ) : (
                  <video
                    key={`${assetCacheKey}-${asset.path}`}
                    src={toDisplayAssetUrl(selectedProject, asset, `${assetCacheKey}-${asset.path}`)}
                    controls
                    preload="metadata"
                  />
                )}
              </MediaWrap>
              <button
                type="button"
                className="btn btn-ghost btn-sm full-width"
                onClick={() => onTargetedRegenerate('segment', index)}
                disabled={!asset || busy || isRunning || isGenerating}
              >
                {busy || isGenerating ? 'Regenerating…' : asset ? '↺ Regenerate' : 'Waiting for generation'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
