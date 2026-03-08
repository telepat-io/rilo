import { useState, useEffect, useRef } from 'react';
import { MediaWrap } from '../ui/MediaWrap.jsx';
import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';

const TEXT_TO_IMAGE_MODEL_IDS = {
  pruna: 'prunaai/z-image-turbo',
  flux: 'black-forest-labs/flux-2-pro',
  fluxSchnell: 'black-forest-labs/flux-schnell',
  nanoBananaPro: 'google/nano-banana-pro',
  seedream4: 'bytedance/seedream-4'
};

export function KeyframeTab({
  assets,
  shots,
  selectedProject,
  isRunning,
  activeStep,
  regeneratingMap,
  mediaCss,
  mediaColMin,
  assetCacheKey,
  toDisplayAssetUrl,
  onSaveShotPrompts,
  onRegenerateProject,
  onTargetedRegenerate,
  configDraft,
  onPatchModel,
  onPatchModelOption,
  configDirty,
  savingConfig,
  onSaveConfig
}) {
  const totalCards = Math.max(assets.length, shots.length);

  const models = configDraft?.models || {};
  const textToImageModelId = models.textToImage || '';
  const t2iOptions = configDraft?.modelOptions?.textToImage || {};
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingIndex, setSavingIndex] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [editValue]);

  function startEdit(index) {
    setEditingIndex(index);
    setEditValue(shots[index] ?? '');
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditValue('');
  }

  async function handleSaveEdit(index) {
    const newShots = shots.map((s, i) => (i === index ? editValue : s));
    while (newShots.length <= index) newShots.push('');
    newShots[index] = editValue;
    setSavingIndex(index);
    try {
      await onSaveShotPrompts(newShots.join('\n'));
      setEditingIndex(null);
      setEditValue('');
    } finally {
      setSavingIndex(null);
    }
  }

  function handleModelChange(nextModelId) {
    onPatchModel('textToImage', nextModelId);

    const clearOptions = (keys) => {
      for (const key of keys) {
        onPatchModelOption('textToImage', key, undefined);
      }
    };

    if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.flux) {
      clearOptions([
        'num_inference_steps',
        'guidance_scale',
        'go_fast',
        'num_outputs',
        'disable_safety_checker',
        'megapixels',
        'resolution',
        'safety_filter_level',
        'allow_fallback_model',
        'size',
        'sequential_image_generation',
        'max_images',
        'enhance_prompt'
      ]);
      return;
    }

    if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell) {
      clearOptions([
        'guidance_scale',
        'safety_tolerance',
        'num_inference_steps',
        'output_format',
        'resolution',
        'safety_filter_level',
        'allow_fallback_model',
        'size',
        'sequential_image_generation',
        'max_images',
        'enhance_prompt'
      ]);
      return;
    }

    if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro) {
      clearOptions([
        'num_inference_steps',
        'guidance_scale',
        'safety_tolerance',
        'seed',
        'go_fast',
        'output_quality',
        'num_outputs',
        'disable_safety_checker',
        'megapixels',
        'output_format',
        'size',
        'sequential_image_generation',
        'max_images',
        'enhance_prompt'
      ]);
      return;
    }

    if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.seedream4) {
      clearOptions([
        'num_inference_steps',
        'guidance_scale',
        'safety_tolerance',
        'seed',
        'go_fast',
        'output_quality',
        'num_outputs',
        'disable_safety_checker',
        'megapixels',
        'output_format',
        'resolution',
        'safety_filter_level',
        'allow_fallback_model'
      ]);
      return;
    }

    if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.pruna) {
      clearOptions([
        'safety_tolerance',
        'num_outputs',
        'disable_safety_checker',
        'megapixels',
        'resolution',
        'safety_filter_level',
        'allow_fallback_model',
        'size',
        'sequential_image_generation',
        'max_images',
        'enhance_prompt'
      ]);
    }
  }

  function renderModelSpecificFields() {
    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.flux) {
      return (
        <>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-safety">Safety Tolerance</label>
            <input
              id="kf-safety"
              type="number"
              className="config-input"
              min={1}
              max={5}
              step={1}
              placeholder="2"
              value={t2iOptions.safety_tolerance ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'safety_tolerance', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-seed">Seed <span className="config-form-optional">(optional)</span></label>
            <input
              id="kf-seed"
              type="number"
              className="config-input"
              step={1}
              placeholder="random"
              value={t2iOptions.seed ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? null : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'seed', Number.isNaN(v) ? null : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-output-format">Output Format</label>
            <select
              id="kf-output-format"
              className="config-select"
              value={t2iOptions.output_format ?? 'webp'}
              onChange={(event) => onPatchModelOption('textToImage', 'output_format', event.target.value)}
            >
              <option value="webp">webp</option>
              <option value="png">png</option>
              <option value="jpg">jpg</option>
              <option value="jpeg">jpeg</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-quality">Output Quality</label>
            <input
              id="kf-quality"
              type="number"
              className="config-input"
              min={0}
              max={100}
              step={1}
              placeholder="80"
              value={t2iOptions.output_quality ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'output_quality', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
        </>
      );
    }

    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell) {
      return (
        <>
          <p className="muted size-sm">
            FLUX Schnell uses project <code>aspectRatio</code> and ignores custom <code>keyframeWidth</code>/<code>keyframeHeight</code> overrides.
          </p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-num-outputs">Number of Outputs</label>
            <input
              id="kf-num-outputs"
              type="number"
              className="config-input"
              min={1}
              max={4}
              step={1}
              placeholder="1"
              value={t2iOptions.num_outputs ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'num_outputs', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-steps">Inference Steps</label>
            <input
              id="kf-steps"
              type="number"
              className="config-input"
              min={1}
              max={4}
              step={1}
              placeholder="4"
              value={t2iOptions.num_inference_steps ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'num_inference_steps', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-seed">Seed <span className="config-form-optional">(optional)</span></label>
            <input
              id="kf-seed"
              type="number"
              className="config-input"
              step={1}
              placeholder="random"
              value={t2iOptions.seed ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? null : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'seed', Number.isNaN(v) ? null : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-output-format">Output Format</label>
            <select
              id="kf-output-format"
              className="config-select"
              value={t2iOptions.output_format ?? 'webp'}
              onChange={(event) => onPatchModelOption('textToImage', 'output_format', event.target.value)}
            >
              <option value="webp">webp</option>
              <option value="jpg">jpg</option>
              <option value="png">png</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-quality">Output Quality</label>
            <input
              id="kf-quality"
              type="number"
              className="config-input"
              min={0}
              max={100}
              step={1}
              placeholder="80"
              value={t2iOptions.output_quality ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'output_quality', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-disable-safety">Disable Safety Checker</label>
            <input
              id="kf-disable-safety"
              type="checkbox"
              checked={t2iOptions.disable_safety_checker ?? false}
              onChange={(event) => onPatchModelOption('textToImage', 'disable_safety_checker', event.target.checked)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-go-fast">Go Fast</label>
            <input
              id="kf-go-fast"
              type="checkbox"
              checked={t2iOptions.go_fast ?? true}
              onChange={(event) => onPatchModelOption('textToImage', 'go_fast', event.target.checked)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-megapixels">Megapixels</label>
            <input
              id="kf-megapixels"
              type="text"
              className="config-input"
              placeholder="1"
              value={t2iOptions.megapixels ?? ''}
              onChange={(event) => onPatchModelOption('textToImage', 'megapixels', event.target.value || undefined)}
            />
          </div>
        </>
      );
    }

    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro) {
      return (
        <>
          <p className="muted size-sm">
            Nano Banana Pro uses project <code>aspectRatio</code> and ignores custom <code>keyframeWidth</code>/<code>keyframeHeight</code> overrides.
          </p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-resolution">Resolution</label>
            <select
              id="kf-resolution"
              className="config-select"
              value={t2iOptions.resolution ?? '2K'}
              onChange={(event) => onPatchModelOption('textToImage', 'resolution', event.target.value)}
            >
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-output-format">Output Format</label>
            <select
              id="kf-output-format"
              className="config-select"
              value={t2iOptions.output_format ?? 'jpg'}
              onChange={(event) => onPatchModelOption('textToImage', 'output_format', event.target.value)}
            >
              <option value="jpg">jpg</option>
              <option value="png">png</option>
              <option value="webp">webp</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-safety-level">Safety Filter Level</label>
            <select
              id="kf-safety-level"
              className="config-select"
              value={t2iOptions.safety_filter_level ?? 'block_only_high'}
              onChange={(event) => onPatchModelOption('textToImage', 'safety_filter_level', event.target.value)}
            >
              <option value="block_low_and_above">block_low_and_above</option>
              <option value="block_medium_and_above">block_medium_and_above</option>
              <option value="block_only_high">block_only_high</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-allow-fallback">Allow Fallback Model</label>
            <input
              id="kf-allow-fallback"
              type="checkbox"
              checked={t2iOptions.allow_fallback_model ?? false}
              onChange={(event) => onPatchModelOption('textToImage', 'allow_fallback_model', event.target.checked)}
            />
          </div>
        </>
      );
    }

    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.seedream4) {
      return (
        <>
          <p className="muted size-sm">
            Seedream 4 uses project <code>aspectRatio</code> and preset sizes (<code>1K</code>, <code>2K</code>, <code>4K</code>).
          </p>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-size">Size</label>
            <select
              id="kf-size"
              className="config-select"
              value={t2iOptions.size ?? '2K'}
              onChange={(event) => onPatchModelOption('textToImage', 'size', event.target.value)}
            >
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-seq-gen">Sequential Image Generation</label>
            <select
              id="kf-seq-gen"
              className="config-select"
              value={t2iOptions.sequential_image_generation ?? 'disabled'}
              onChange={(event) => onPatchModelOption('textToImage', 'sequential_image_generation', event.target.value)}
            >
              <option value="disabled">disabled</option>
              <option value="auto">auto</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-max-images">Max Images</label>
            <input
              id="kf-max-images"
              type="number"
              className="config-input"
              min={1}
              max={15}
              step={1}
              placeholder="1"
              value={t2iOptions.max_images ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToImage', 'max_images', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-enhance">Enhance Prompt</label>
            <input
              id="kf-enhance"
              type="checkbox"
              checked={t2iOptions.enhance_prompt ?? true}
              onChange={(event) => onPatchModelOption('textToImage', 'enhance_prompt', event.target.checked)}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-steps">Inference Steps</label>
          <input id="kf-steps" type="number" className="config-input" min={1} max={50} step={1} placeholder="8" value={t2iOptions.num_inference_steps ?? ''} onChange={(event) => { const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10); onPatchModelOption('textToImage', 'num_inference_steps', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-guidance">Guidance Scale</label>
          <input id="kf-guidance" type="number" className="config-input" min={0} max={20} step={0.1} placeholder="0" value={t2iOptions.guidance_scale ?? ''} onChange={(event) => { const v = event.target.value === '' ? undefined : parseFloat(event.target.value); onPatchModelOption('textToImage', 'guidance_scale', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-seed">Seed <span className="config-form-optional">(optional)</span></label>
          <input id="kf-seed" type="number" className="config-input" step={1} placeholder="random" value={t2iOptions.seed ?? ''} onChange={(event) => { const v = event.target.value === '' ? null : parseInt(event.target.value, 10); onPatchModelOption('textToImage', 'seed', Number.isNaN(v) ? null : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-output-format">Output Format</label>
          <select id="kf-output-format" className="config-select" value={t2iOptions.output_format ?? 'jpg'} onChange={(event) => onPatchModelOption('textToImage', 'output_format', event.target.value)}><option value="jpg">jpg</option><option value="jpeg">jpeg</option><option value="png">png</option><option value="webp">webp</option></select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-quality">Output Quality</label>
          <input id="kf-quality" type="number" className="config-input" min={0} max={100} step={1} placeholder="80" value={t2iOptions.output_quality ?? ''} onChange={(event) => { const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10); onPatchModelOption('textToImage', 'output_quality', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-go-fast">Go Fast</label>
          <input id="kf-go-fast" type="checkbox" checked={t2iOptions.go_fast ?? false} onChange={(event) => onPatchModelOption('textToImage', 'go_fast', event.target.checked)} />
        </div>
      </>
    );
  }

  if (totalCards === 0) {
    return (
      <div className="tab-pane">
        <ModelConfigSection
          modelId={models.textToImage}
          configDirty={configDirty}
          savingConfig={savingConfig}
          isRunning={isRunning}
          onSaveConfig={onSaveConfig}
        >
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="kf-model">Model ID</label>
            <select
              id="kf-model"
              className="config-select"
              value={models.textToImage || TEXT_TO_IMAGE_MODEL_IDS.pruna}
              onChange={(event) => handleModelChange(event.target.value)}
            >
              <option value={TEXT_TO_IMAGE_MODEL_IDS.pruna}>Z Image Turbo (`prunaai/z-image-turbo`)</option>
              <option value={TEXT_TO_IMAGE_MODEL_IDS.flux}>FLUX 2 Pro (`black-forest-labs/flux-2-pro`)</option>
              <option value={TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell}>FLUX Schnell (`black-forest-labs/flux-schnell`)</option>
              <option value={TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro}>Nano Banana Pro (`google/nano-banana-pro`)</option>
              <option value={TEXT_TO_IMAGE_MODEL_IDS.seedream4}>Seedream 4 (`bytedance/seedream-4`)</option>
            </select>
          </div>
          {renderModelSpecificFields()}
        </ModelConfigSection>
        <div className="empty-state">
          <p className="muted">No keyframes generated yet.</p>
          <button type="button" className="btn btn-secondary" onClick={onRegenerateProject} disabled={isRunning}>
            ▶ Regenerate project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-pane">
      <ModelConfigSection
        modelId={models.textToImage}
        configDirty={configDirty}
        savingConfig={savingConfig}
        isRunning={isRunning}
        onSaveConfig={onSaveConfig}
      >
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="kf-model">Model ID</label>
          <select
            id="kf-model"
            className="config-select"
            value={models.textToImage || TEXT_TO_IMAGE_MODEL_IDS.pruna}
            onChange={(event) => handleModelChange(event.target.value)}
          >
            <option value={TEXT_TO_IMAGE_MODEL_IDS.pruna}>Z Image Turbo (`prunaai/z-image-turbo`)</option>
            <option value={TEXT_TO_IMAGE_MODEL_IDS.flux}>FLUX 2 Pro (`black-forest-labs/flux-2-pro`)</option>
            <option value={TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell}>FLUX Schnell (`black-forest-labs/flux-schnell`)</option>
            <option value={TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro}>Nano Banana Pro (`google/nano-banana-pro`)</option>
            <option value={TEXT_TO_IMAGE_MODEL_IDS.seedream4}>Seedream 4 (`bytedance/seedream-4`)</option>
          </select>
        </div>
        {renderModelSpecificFields()}
      </ModelConfigSection>
      <div className="asset-grid" style={{ '--grid-col-min': mediaColMin }}>
        {Array.from({ length: totalCards }, (_, index) => {
          const asset = assets[index] || null;
          const mapKey = `keyframe-${index}`;
          const busy = Boolean(regeneratingMap[mapKey]);
          const isGenerating = !asset && isRunning && activeStep === 'keyframes' && index === assets.length;
          const isPending = !asset && !isGenerating;
          const isEditing = editingIndex === index;
          const isSaving = savingIndex === index;
          const prompt = shots[index] ?? '';

          return (
            <article key={asset?.path || `keyframe-slot-${index}`} className="asset-card">
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
                      <span className="media-placeholder-title">Generating keyframe</span>
                    </div>
                  </div>
                ) : isPending ? (
                  <div className="media-placeholder">
                    <div className="media-placeholder-content">
                      <span className="media-placeholder-title">Pending keyframe</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={toDisplayAssetUrl(selectedProject, asset, `${assetCacheKey}-${asset.path}`)}
                    alt={`Keyframe ${index + 1}`}
                    loading="lazy"
                  />
                )}
              </MediaWrap>
              <div className="card-prompt">
                {isEditing ? (
                  <>
                    <textarea
                      ref={textareaRef}
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      className="prompt-textarea"
                    />
                    <div className="prompt-edit-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveEdit(index)}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={cancelEdit}
                        disabled={isSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="card-prompt-row">
                    <p className="prompt-text">{prompt || <em className="muted">No prompt</em>}</p>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm card-prompt-edit-btn"
                      onClick={() => startEdit(index)}
                      disabled={isRunning || busy || isGenerating}
                      title="Edit prompt"
                    >
                      ✎
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm full-width"
                onClick={() => onTargetedRegenerate('keyframe', index)}
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
