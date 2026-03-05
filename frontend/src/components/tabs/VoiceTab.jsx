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
  onRegenerateScript
}) {
  return (
    <div className="tab-pane">
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
