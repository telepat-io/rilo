import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';
import { ComboBox } from '../ui/ComboBox.jsx';

export function VoiceTab({
  voiceAsset,
  selectedProject,
  assetCacheKey,
  isRunning,
  busy,
  scriptBusy,
  scriptText,
  dirty,
  savingContent,
  onScriptChange,
  onSave,
  toDisplayAssetUrl,
  onRegenerateVoice,
  onRegenerateScript,
  configDraft,
  onPatchModel,
  onPatchModelOption,
  configDirty,
  savingConfig,
  onSaveConfig
}) {
  const models = configDraft?.models || {};
  const ttsOptions = configDraft?.modelOptions?.textToSpeech || {};

  return (
    <div className="tab-pane">
      <ModelConfigSection
        modelId={models.textToSpeech}
        configDirty={configDirty}
        savingConfig={savingConfig}
        isRunning={isRunning}
        onSaveConfig={onSaveConfig}
      >
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-model">Model ID</label>
            <input
              id="voice-model"
              type="text"
              className="config-input"
              value={models.textToSpeech || ''}
              onChange={(event) => onPatchModel('textToSpeech', event.target.value)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-id">Voice ID</label>
            <ComboBox
              id="voice-id"
              className="config-input"
              placeholder="Wise_Woman"
              value={ttsOptions.voice_id ?? ''}
              onChange={(v) => onPatchModelOption('textToSpeech', 'voice_id', v)}
              options={['Wise_Woman', 'Deep_Voice_Man', 'Imposing_Manner', 'Friendly_Person', 'Lively_Girl', 'Young_Knight']}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-emotion">Emotion</label>
            <select
              id="voice-emotion"
              className="config-select"
              value={ttsOptions.emotion ?? 'auto'}
              onChange={(event) => onPatchModelOption('textToSpeech', 'emotion', event.target.value)}
            >
              <option value="auto">auto</option>
              <option value="neutral">neutral</option>
              <option value="happy">happy</option>
              <option value="sad">sad</option>
              <option value="angry">angry</option>
              <option value="fearful">fearful</option>
              <option value="disgusted">disgusted</option>
              <option value="surprised">surprised</option>
              <option value="calm">calm</option>
              <option value="fluent">fluent</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-speed">Speed</label>
            <input
              id="voice-speed"
              type="number"
              className="config-input"
              min={0.5}
              max={2}
              step={0.05}
              placeholder="1"
              value={ttsOptions.speed ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                onPatchModelOption('textToSpeech', 'speed', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-pitch">Pitch</label>
            <input
              id="voice-pitch"
              type="number"
              className="config-input"
              min={-12}
              max={12}
              step={1}
              placeholder="0"
              value={ttsOptions.pitch ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToSpeech', 'pitch', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-volume">Volume</label>
            <input
              id="voice-volume"
              type="number"
              className="config-input"
              min={0}
              max={10}
              step={0.1}
              placeholder="1"
              value={ttsOptions.volume ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                onPatchModelOption('textToSpeech', 'volume', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-audio-format">Audio Format</label>
            <select
              id="voice-audio-format"
              className="config-select"
              value={ttsOptions.audio_format ?? 'mp3'}
              onChange={(event) => onPatchModelOption('textToSpeech', 'audio_format', event.target.value)}
            >
              <option value="mp3">mp3</option>
              <option value="wav">wav</option>
              <option value="flac">flac</option>
              <option value="pcm">pcm</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-channel">Channel</label>
            <select
              id="voice-channel"
              className="config-select"
              value={ttsOptions.channel ?? 'mono'}
              onChange={(event) => onPatchModelOption('textToSpeech', 'channel', event.target.value)}
            >
              <option value="mono">mono</option>
              <option value="stereo">stereo</option>
            </select>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-sample-rate">Sample Rate (Hz)</label>
            <input
              id="voice-sample-rate"
              type="number"
              className="config-input"
              min={8000}
              max={44100}
              step={100}
              placeholder="32000"
              value={ttsOptions.sample_rate ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToSpeech', 'sample_rate', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-bitrate">Bitrate (bps)</label>
            <input
              id="voice-bitrate"
              type="number"
              className="config-input"
              min={32000}
              max={256000}
              step={1000}
              placeholder="128000"
              value={ttsOptions.bitrate ?? ''}
              onChange={(event) => {
                const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                onPatchModelOption('textToSpeech', 'bitrate', Number.isNaN(v) ? undefined : v);
              }}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-lang-boost">Language Boost</label>
            <input
              id="voice-lang-boost"
              type="text"
              className="config-input"
              list="voice-lang-list"
              placeholder="None"
              value={ttsOptions.language_boost ?? ''}
              onChange={(event) => onPatchModelOption('textToSpeech', 'language_boost', event.target.value || undefined)}
            />
            <datalist id="voice-lang-list">
              <option value="None" />
              <option value="Automatic" />
              <option value="en" />
              <option value="zh" />
              <option value="ja" />
              <option value="ko" />
              <option value="es" />
              <option value="fr" />
              <option value="de" />
              <option value="pt" />
            </datalist>
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-subtitle">Subtitle Enable</label>
            <input
              id="voice-subtitle"
              type="checkbox"
              checked={ttsOptions.subtitle_enable ?? false}
              onChange={(event) => onPatchModelOption('textToSpeech', 'subtitle_enable', event.target.checked)}
            />
          </div>
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-en-norm">English Normalization</label>
            <input
              id="voice-en-norm"
              type="checkbox"
              checked={ttsOptions.english_normalization ?? false}
              onChange={(event) => onPatchModelOption('textToSpeech', 'english_normalization', event.target.checked)}
            />
          </div>
      </ModelConfigSection>

      <div className="editor-grid">
        <div className="field full-width">
          <label className="field-label">Script</label>
          <textarea value={scriptText} rows={10} onChange={(event) => onScriptChange(event.target.value)} />
        </div>
        <div className="full-width save-row">
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty || savingContent}>
            {savingContent ? 'Saving…' : dirty ? '● Save changes' : 'Up to date'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRegenerateScript} disabled={isRunning || scriptBusy}>
            {scriptBusy ? 'Regenerating…' : '↺ Regenerate script'}
          </button>
          {dirty && <span className="muted size-sm">Unsaved changes</span>}
        </div>
      </div>

      {!voiceAsset ? (
        <div className="empty-state">
          <p className="muted">No generated voiceover yet.</p>
          <button type="button" className="btn btn-secondary" onClick={onRegenerateVoice} disabled={isRunning || busy}>
            {busy ? 'Regenerating…' : '↺ Regenerate voice'}
          </button>
        </div>
      ) : (
        <section className="final-video-section">
          <h3 className="section-label">Generated voice</h3>
          <audio
            key={`${assetCacheKey}-voice`}
            src={toDisplayAssetUrl(selectedProject, voiceAsset, `${assetCacheKey}-${voiceAsset.path}`)}
            controls
            preload="metadata"
            className="full-width"
          />
          <div className="save-row" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRegenerateVoice} disabled={isRunning || busy}>
              {busy ? 'Regenerating…' : '↺ Regenerate voice'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
