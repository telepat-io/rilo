import { useState, useEffect, useRef } from 'react';
import { MediaWrap } from '../ui/MediaWrap.jsx';
import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';

export function KeyframeTab({
  assets,
  shots,
  selectedProject,
  isRunning,
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
  const models = configDraft?.models || {};
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

  if (assets.length === 0) {
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
            <input id="kf-model" type="text" className="config-input" value={models.textToImage || ''} onChange={(event) => onPatchModel('textToImage', event.target.value)} />
          </div>
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
          <input id="kf-model" type="text" className="config-input" value={models.textToImage || ''} onChange={(event) => onPatchModel('textToImage', event.target.value)} />
        </div>
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
      </ModelConfigSection>
      <div className="asset-grid" style={{ '--grid-col-min': mediaColMin }}>
        {assets.map((asset, index) => {
          const mapKey = `keyframe-${index}`;
          const busy = Boolean(regeneratingMap[mapKey]);
          const isEditing = editingIndex === index;
          const isSaving = savingIndex === index;
          const prompt = shots[index] ?? '';

          return (
            <article key={asset.path} className="asset-card">
              <div className="asset-index">#{index + 1}</div>
              <MediaWrap ar={mediaCss}>
                {busy ? (
                  <div className="media-placeholder"><span className="spinner" /></div>
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
                      disabled={isRunning || busy}
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
                disabled={busy || isRunning}
              >
                {busy ? 'Regenerating…' : '↺ Regenerate'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
