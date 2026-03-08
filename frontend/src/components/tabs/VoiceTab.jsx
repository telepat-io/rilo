import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';
import { ComboBox } from '../ui/ComboBox.jsx';

const TTS_MODEL_IDS = {
  minimax: 'minimax/speech-02-turbo',
  chatterboxTurbo: 'resemble-ai/chatterbox-turbo',
  kokoro82m: 'jaaari/kokoro-82m'
};

const MINIMAX_OPTION_KEYS = [
  'emotion',
  'pitch',
  'speed',
  'volume',
  'voice_id',
  'audio_format',
  'sample_rate',
  'bitrate',
  'channel',
  'language_boost',
  'subtitle_enable',
  'english_normalization'
];

const CHATTERBOX_OPTION_KEYS = [
  'voice',
  'temperature',
  'top_p',
  'top_k',
  'repetition_penalty',
  'seed'
];

const KOKORO_OPTION_KEYS = [
  'voice',
  'speed'
];

const CHATTERBOX_VOICES = [
  'Aaron',
  'Abigail',
  'Anaya',
  'Andy',
  'Archer',
  'Brian',
  'Chloe',
  'Dylan',
  'Emmanuel',
  'Ethan',
  'Evelyn',
  'Gavin',
  'Gordon',
  'Ivan',
  'Laura',
  'Lucy',
  'Madison',
  'Marisol',
  'Meera',
  'Walter'
];

const KOKORO_VOICES = [
  'af_alloy',
  'af_aoede',
  'af_bella',
  'af_jessica',
  'af_kore',
  'af_nicole',
  'af_nova',
  'af_river',
  'af_sarah',
  'af_sky',
  'am_adam',
  'am_echo',
  'am_eric',
  'am_fenrir',
  'am_liam',
  'am_michael',
  'am_onyx',
  'am_puck',
  'bf_alice',
  'bf_emma',
  'bf_isabella',
  'bf_lily',
  'bm_daniel',
  'bm_fable',
  'bm_george',
  'bm_lewis',
  'ff_siwis',
  'hf_alpha',
  'hf_beta',
  'hm_omega',
  'hm_psi',
  'if_sara',
  'im_nicola',
  'jf_alpha',
  'jf_gongitsune',
  'jf_nezumi',
  'jf_tebukuro',
  'jm_kumo',
  'zf_xiaobei',
  'zf_xiaoni',
  'zf_xiaoxiao',
  'zf_xiaoyi',
  'zm_yunjian',
  'zm_yunxi',
  'zm_yunxia',
  'zm_yunyang'
];

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
  const selectedTtsModelId = models.textToSpeech || TTS_MODEL_IDS.minimax;
  const isMinimax = selectedTtsModelId === TTS_MODEL_IDS.minimax;
  const isChatterbox = selectedTtsModelId === TTS_MODEL_IDS.chatterboxTurbo;
  const isKokoro = selectedTtsModelId === TTS_MODEL_IDS.kokoro82m;

  function clearOptions(keys) {
    for (const key of keys) {
      onPatchModelOption('textToSpeech', key, undefined);
    }
  }

  function handleModelChange(nextModelId) {
    onPatchModel('textToSpeech', nextModelId);

    if (nextModelId === TTS_MODEL_IDS.minimax) {
      clearOptions([...CHATTERBOX_OPTION_KEYS, ...KOKORO_OPTION_KEYS]);
      return;
    }

    if (nextModelId === TTS_MODEL_IDS.chatterboxTurbo) {
      clearOptions([...MINIMAX_OPTION_KEYS, 'speed']);
      return;
    }

    clearOptions([...MINIMAX_OPTION_KEYS, ...CHATTERBOX_OPTION_KEYS]);
  }

  return (
    <div className="tab-pane">
      <ModelConfigSection
        modelId={selectedTtsModelId}
        configDirty={configDirty}
        savingConfig={savingConfig}
        isRunning={isRunning}
        onSaveConfig={onSaveConfig}
      >
          <div className="config-form-field">
            <label className="config-form-label" htmlFor="voice-model">Model</label>
            <select
              id="voice-model"
              className="config-select"
              value={selectedTtsModelId}
              onChange={(event) => handleModelChange(event.target.value)}
            >
              <option value={TTS_MODEL_IDS.minimax}>minimax/speech-02-turbo</option>
              <option value={TTS_MODEL_IDS.chatterboxTurbo}>resemble-ai/chatterbox-turbo</option>
              <option value={TTS_MODEL_IDS.kokoro82m}>jaaari/kokoro-82m</option>
            </select>
          </div>
          {isMinimax && (
            <>
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
            </>
          )}

          {isChatterbox && (
            <>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-chatterbox-voice">Voice</label>
                <select
                  id="voice-chatterbox-voice"
                  className="config-select"
                  value={ttsOptions.voice ?? 'Andy'}
                  onChange={(event) => onPatchModelOption('textToSpeech', 'voice', event.target.value)}
                >
                  {CHATTERBOX_VOICES.map((voiceName) => (
                    <option key={voiceName} value={voiceName}>{voiceName}</option>
                  ))}
                </select>
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-chatterbox-temperature">Temperature</label>
                <input
                  id="voice-chatterbox-temperature"
                  type="number"
                  className="config-input"
                  min={0.05}
                  max={2}
                  step={0.01}
                  placeholder="0.8"
                  value={ttsOptions.temperature ?? ''}
                  onChange={(event) => {
                    const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                    onPatchModelOption('textToSpeech', 'temperature', Number.isNaN(v) ? undefined : v);
                  }}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-chatterbox-top-p">Top P</label>
                <input
                  id="voice-chatterbox-top-p"
                  type="number"
                  className="config-input"
                  min={0.5}
                  max={1}
                  step={0.01}
                  placeholder="0.95"
                  value={ttsOptions.top_p ?? ''}
                  onChange={(event) => {
                    const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                    onPatchModelOption('textToSpeech', 'top_p', Number.isNaN(v) ? undefined : v);
                  }}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-chatterbox-top-k">Top K</label>
                <input
                  id="voice-chatterbox-top-k"
                  type="number"
                  className="config-input"
                  min={1}
                  max={2000}
                  step={1}
                  placeholder="1000"
                  value={ttsOptions.top_k ?? ''}
                  onChange={(event) => {
                    const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                    onPatchModelOption('textToSpeech', 'top_k', Number.isNaN(v) ? undefined : v);
                  }}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-chatterbox-repetition">Repetition Penalty</label>
                <input
                  id="voice-chatterbox-repetition"
                  type="number"
                  className="config-input"
                  min={1}
                  max={2}
                  step={0.01}
                  placeholder="1.2"
                  value={ttsOptions.repetition_penalty ?? ''}
                  onChange={(event) => {
                    const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                    onPatchModelOption('textToSpeech', 'repetition_penalty', Number.isNaN(v) ? undefined : v);
                  }}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-chatterbox-seed">Seed</label>
                <input
                  id="voice-chatterbox-seed"
                  type="number"
                  className="config-input"
                  min={0}
                  step={1}
                  placeholder="Random"
                  value={ttsOptions.seed ?? ''}
                  onChange={(event) => {
                    const v = event.target.value === '' ? null : parseInt(event.target.value, 10);
                    onPatchModelOption('textToSpeech', 'seed', Number.isNaN(v) ? undefined : v);
                  }}
                />
              </div>
              <div className="config-form-field">
                <p className="muted size-sm" style={{ margin: 0 }}>
                  Voice cloning via <code>reference_audio</code> is supported by this model but disabled in this app for now.
                </p>
              </div>
            </>
          )}

          {isKokoro && (
            <>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-kokoro-voice">Voice</label>
                <select
                  id="voice-kokoro-voice"
                  className="config-select"
                  value={ttsOptions.voice ?? 'af_bella'}
                  onChange={(event) => onPatchModelOption('textToSpeech', 'voice', event.target.value)}
                >
                  {KOKORO_VOICES.map((voiceName) => (
                    <option key={voiceName} value={voiceName}>{voiceName}</option>
                  ))}
                </select>
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="voice-kokoro-speed">Speed</label>
                <input
                  id="voice-kokoro-speed"
                  type="number"
                  className="config-input"
                  min={0.1}
                  max={5}
                  step={0.1}
                  placeholder="1"
                  value={ttsOptions.speed ?? ''}
                  onChange={(event) => {
                    const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                    onPatchModelOption('textToSpeech', 'speed', Number.isNaN(v) ? undefined : v);
                  }}
                />
              </div>
            </>
          )}
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
