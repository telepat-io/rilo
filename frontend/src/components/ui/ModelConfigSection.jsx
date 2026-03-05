import { useState } from 'react';

// Static metadata for the default/known model IDs.
// When a user overrides the model ID to a custom string we fall back gracefully.
const MODEL_META = {
  'deepseek-ai/deepseek-v3': {
    displayName: 'DeepSeek V3',
    url: 'https://replicate.com/deepseek-ai/deepseek-v3',
    pricingLabel: '$0.00145 / 1k tokens (in + out)'
  },
  'minimax/speech-02-turbo': {
    displayName: 'Minimax Speech 02 Turbo',
    url: 'https://replicate.com/minimax/speech-02-turbo',
    pricingLabel: '$0.06 / 1k input tokens'
  },
  'prunaai/z-image-turbo': {
    displayName: 'Z Image Turbo',
    url: 'https://replicate.com/prunaai/z-image-turbo',
    pricingLabel: 'Tiered by output megapixels (~$0.0025–$0.0115 / image)'
  },
  'wan-video/wan-2.2-i2v-fast': {
    displayName: 'Wan 2.2 I2V Fast',
    url: 'https://replicate.com/wan-video/wan-2.2-i2v-fast',
    pricingLabel: '~$0.05 / 5 s clip (480p)'
  }
};

/**
 * A collapsible model configuration card.
 *
 * Props:
 *  - modelId: string — currently selected model identifier
 *  - title: string — section heading (e.g. "Voice Model")
 *  - children: the full settings form fields
 *  - configDirty, savingConfig, isRunning, onSaveConfig — for the Save button
 */
export function ModelConfigSection({ modelId, title, configDirty, savingConfig, isRunning, onSaveConfig, children }) {
  const [open, setOpen] = useState(false);
  const meta = MODEL_META[modelId] || null;
  const displayName = meta?.displayName || modelId || '—';
  const url = meta?.url || null;
  const pricingLabel = meta?.pricingLabel || null;

  return (
    <div className="model-config-section">
      <button
        type="button"
        className="model-config-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="model-config-summary">
          <span className="model-config-name">{displayName}</span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="model-config-url muted size-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {modelId}
            </a>
          )}
          {!url && modelId && (
            <span className="model-config-url muted size-sm">{modelId}</span>
          )}
          {pricingLabel && (
            <span className="model-config-pricing muted size-sm">{pricingLabel}</span>
          )}
        </div>
        <span className="model-config-chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="model-config-body">
          <form className="config-form" onSubmit={(e) => { e.preventDefault(); onSaveConfig(); }}>
            <div className="config-form-fields">
              {children}
            </div>
            <div className="config-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!configDirty || savingConfig || isRunning}
              >
                {savingConfig ? 'Saving…' : 'Save Config'}
              </button>
              {configDirty && <span className="muted size-sm">Unsaved changes</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
