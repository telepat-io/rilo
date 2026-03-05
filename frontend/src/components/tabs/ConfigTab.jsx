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
  onPatchOptionalInt,
  onSaveConfig
}) {
  const models = configDraft?.models || {};

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

              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-model-text">Text to Text Model</label>
                <input
                  id="cfg-model-text"
                  type="text"
                  className="config-input"
                  value={models.textToText || ''}
                  onChange={(event) => onPatchModel('textToText', event.target.value)}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-model-tts">Text to Speech Model</label>
                <input
                  id="cfg-model-tts"
                  type="text"
                  className="config-input"
                  value={models.textToSpeech || ''}
                  onChange={(event) => onPatchModel('textToSpeech', event.target.value)}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-model-image">Text to Image Model</label>
                <input
                  id="cfg-model-image"
                  type="text"
                  className="config-input"
                  value={models.textToImage || ''}
                  onChange={(event) => onPatchModel('textToImage', event.target.value)}
                />
              </div>
              <div className="config-form-field">
                <label className="config-form-label" htmlFor="cfg-model-video">Image + Text to Video Model</label>
                <input
                  id="cfg-model-video"
                  type="text"
                  className="config-input"
                  value={models.imageTextToVideo || ''}
                  onChange={(event) => onPatchModel('imageTextToVideo', event.target.value)}
                />
              </div>
            </div>
            <div className="config-form-actions">
              <button type="submit" className="btn btn-primary" disabled={!configDirty || savingConfig || isRunning}>
                {savingConfig ? 'Saving…' : 'Save Config'}
              </button>
              {configDirty && <span className="muted size-sm">Unsaved changes</span>}
            </div>
          </form>

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
