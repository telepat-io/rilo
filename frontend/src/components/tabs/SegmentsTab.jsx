import { MediaWrap } from '../ui/MediaWrap.jsx';
import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';

export function SegmentsTab({
  assets,
  expectedCount,
  selectedProject,
  isRunning,
  activeStep,
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
        <input id="seg-model" type="text" className="config-input" value={models.imageTextToVideo || ''} onChange={(event) => onPatchModel('imageTextToVideo', event.target.value)} />
      </div>
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
          const isGenerating = !asset && isRunning && activeStep === 'segments' && index === assets.length;
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
