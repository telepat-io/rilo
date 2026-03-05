import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';

export function ConfigTab({
  configDraft,
  projectConfig,
  mediaW,
  mediaH,
  configDirty,
  savingConfig,
  isRunning,
  onPatchConfig,
  onPatchModel,
  onPatchModelOption,
  onPatchOptionalInt,
  onSaveConfig
}) {
  const models = configDraft?.models || {};
  const tttOptions = configDraft?.modelOptions?.textToText || {};

  return (
    <div className="tab-pane">
      {configDraft ? (
        <>
          <form className="config-form" onSubmit={(event) => { event.preventDefault(); onSaveConfig(); }}>
            <div className="config-form-fields">
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-aspect">Aspect Ratio</label>
                <select
                  id="cfg-aspect"
                  className="config-select"
                  value={configDraft.aspectRatio || '9:16'}
                  onChange={(event) => onPatchConfig('aspectRatio', event.target.value)}
                >
                  <option value="9:16">9:16 — Portrait</option>
                  <option value="16:9">16:9 — Landscape</option>
                  <option value="1:1">1:1 — Square</option>
                </select>
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-duration">Target Duration (sec)</label>
                <input
                  id="cfg-duration"
                  type="number"
                  className="config-input"
                  min={5}
                  max={600}
                  step={1}
                  value={configDraft.targetDurationSec ?? ''}
                  onChange={(event) => {
                    const value = parseInt(event.target.value, 10);
                    if (!isNaN(value)) {
                      onPatchConfig('targetDurationSec', value);
                    }
                  }}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-finalduration">Final Duration Mode</label>
                <select
                  id="cfg-finalduration"
                  className="config-select"
                  value={configDraft.finalDurationMode || 'match_audio'}
                  onChange={(event) => onPatchConfig('finalDurationMode', event.target.value)}
                >
                  <option value="match_audio">Match Audio</option>
                  <option value="match_visual">Match Visual</option>
                </select>
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-kfw">Keyframe Width <span className="config-form-optional">(optional)</span></label>
                <input
                  id="cfg-kfw"
                  type="number"
                  className="config-input"
                  min={64}
                  max={2048}
                  step={1}
                  placeholder="auto"
                  value={configDraft.keyframeWidth ?? ''}
                  onChange={(event) => onPatchOptionalInt('keyframeWidth', event.target.value)}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-kfh">Keyframe Height <span className="config-form-optional">(optional)</span></label>
                <input
                  id="cfg-kfh"
                  type="number"
                  className="config-input"
                  min={64}
                  max={2048}
                  step={1}
                  placeholder="auto"
                  value={configDraft.keyframeHeight ?? ''}
                  onChange={(event) => onPatchOptionalInt('keyframeHeight', event.target.value)}
                />
              </div>
              <div className="config-form-field config-form-field--readonly">
                <span className="config-form-label">Resolved Size</span>
                <span className="config-value">{`${mediaW} × ${mediaH}`}</span>
              </div>
            </div>
            <div className="config-form-actions">
              <button type="submit" className="btn btn-primary" disabled={!configDirty || savingConfig || isRunning}>
                {savingConfig ? 'Saving…' : 'Save Config'}
              </button>
              {configDirty && <span className="muted size-sm">Unsaved changes</span>}
            </div>
          </form>

          <ModelConfigSection
            modelId={models.textToText}
            title="Text to Text Model"
            configDirty={configDirty}
            savingConfig={savingConfig}
            isRunning={isRunning}
            onSaveConfig={onSaveConfig}
          >
            <div className="config-form-field">
              <label className="config-form-label" htmlFor="cfg-model-text">Model ID</label>
              <input
                id="cfg-model-text"
                type="text"
                className="config-input"
                value={models.textToText || ''}
                onChange={(event) => onPatchModel('textToText', event.target.value)}
              />
            </div>
            <div className="config-form-field">
              <label className="config-form-label" htmlFor="cfg-ttt-max-tokens">Max Tokens</label>
              <input
                id="cfg-ttt-max-tokens"
                type="number"
                className="config-input"
                min={1}
                max={8192}
                step={1}
                placeholder="2048"
                value={tttOptions.max_tokens ?? ''}
                onChange={(event) => {
                  const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                  onPatchModelOption('textToText', 'max_tokens', Number.isNaN(v) ? undefined : v);
                }}
              />
            </div>
            <div className="config-form-field">
              <label className="config-form-label" htmlFor="cfg-ttt-temperature">Temperature</label>
              <input
                id="cfg-ttt-temperature"
                type="number"
                className="config-input"
                min={0}
                max={2}
                step={0.01}
                placeholder="0.1"
                value={tttOptions.temperature ?? ''}
                onChange={(event) => {
                  const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                  onPatchModelOption('textToText', 'temperature', Number.isNaN(v) ? undefined : v);
                }}
              />
            </div>
            <div className="config-form-field">
              <label className="config-form-label" htmlFor="cfg-ttt-presence">Presence Penalty</label>
              <input
                id="cfg-ttt-presence"
                type="number"
                className="config-input"
                min={-2}
                max={2}
                step={0.01}
                placeholder="0"
                value={tttOptions.presence_penalty ?? ''}
                onChange={(event) => {
                  const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                  onPatchModelOption('textToText', 'presence_penalty', Number.isNaN(v) ? undefined : v);
                }}
              />
            </div>
            <div className="config-form-field">
              <label className="config-form-label" htmlFor="cfg-ttt-frequency">Frequency Penalty</label>
              <input
                id="cfg-ttt-frequency"
                type="number"
                className="config-input"
                min={-2}
                max={2}
                step={0.01}
                placeholder="0"
                value={tttOptions.frequency_penalty ?? ''}
                onChange={(event) => {
                  const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                  onPatchModelOption('textToText', 'frequency_penalty', Number.isNaN(v) ? undefined : v);
                }}
              />
            </div>
            <div className="config-form-field">
              <label className="config-form-label" htmlFor="cfg-ttt-top-p">Top P</label>
              <input
                id="cfg-ttt-top-p"
                type="number"
                className="config-input"
                min={0}
                max={1}
                step={0.01}
                placeholder="1"
                value={tttOptions.top_p ?? ''}
                onChange={(event) => {
                  const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                  onPatchModelOption('textToText', 'top_p', Number.isNaN(v) ? undefined : v);
                }}
              />
            </div>
          </ModelConfigSection>

          <section>
            <h3 className="section-label">Raw config</h3>
            <pre className="config-json">{JSON.stringify(projectConfig, null, 2)}</pre>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <p className="muted">No project config found.</p>
        </div>
      )}
    </div>
  );
}

