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
  'resemble-ai/chatterbox-turbo': {
    displayName: 'Chatterbox Turbo',
    url: 'https://replicate.com/resemble-ai/chatterbox-turbo',
    pricingLabel: '$0.025 / 1k input characters'
  },
  'prunaai/z-image-turbo': {
    displayName: 'Z Image Turbo',
    url: 'https://replicate.com/prunaai/z-image-turbo',
    pricingLabel: 'Tiered by output megapixels (~$0.0025–$0.0115 / image)'
  },
  'black-forest-labs/flux-2-pro': {
    displayName: 'FLUX 2 Pro',
    url: 'https://replicate.com/black-forest-labs/flux-2-pro',
    pricingLabel: 'Multi-property pricing on Replicate (run + megapixels)'
  },
  'black-forest-labs/flux-schnell': {
    displayName: 'FLUX Schnell',
    url: 'https://replicate.com/black-forest-labs/flux-schnell',
    pricingLabel: '$0.003 / output image'
  },
  'google/nano-banana-pro': {
    displayName: 'Nano Banana Pro',
    url: 'https://replicate.com/google/nano-banana-pro',
    pricingLabel: 'Tiered by resolution ($0.15-$0.30 / output image)'
  },
  'bytedance/seedream-4': {
    displayName: 'Seedream 4',
    url: 'https://replicate.com/bytedance/seedream-4',
    pricingLabel: '$0.03 / output image'
  },
  'wan-video/wan-2.2-i2v-fast': {
    displayName: 'Wan 2.2 I2V Fast',
    url: 'https://replicate.com/wan-video/wan-2.2-i2v-fast',
    pricingLabel: '~$0.05 / 5 s clip (480p)'
  },
  'kwaivgi/kling-v3-video': {
    displayName: 'Kling V3 Video',
    url: 'https://replicate.com/kwaivgi/kling-v3-video',
    pricingLabel: 'Mode/audio tiered per-second pricing on Replicate'
  },
  'pixverse/pixverse-v5.6': {
    displayName: 'PixVerse v5.6',
    url: 'https://replicate.com/pixverse/pixverse-v5.6',
    pricingLabel: 'Quality-tiered per-second pricing on Replicate ($0.07-$0.15 / s)'
  },
  'google/veo-3.1': {
    displayName: 'Veo 3.1',
    url: 'https://replicate.com/google/veo-3.1',
    pricingLabel: 'Audio-tiered per-second pricing on Replicate ($0.20-$0.40 / s)'
  },
  'google/veo-3.1-fast': {
    displayName: 'Veo 3.1 Fast',
    url: 'https://replicate.com/google/veo-3.1-fast',
    pricingLabel: 'Audio-tiered per-second pricing on Replicate ($0.10-$0.15 / s)'
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
          <span className="model-config-title muted size-sm">{title}</span>
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
