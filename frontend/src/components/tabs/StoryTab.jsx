export function StoryTab({
  storyText,
  dirty,
  savingContent,
  onStoryChange,
  onSave
}) {
  return (
    <div className="tab-pane">
      <div className="editor-grid">
        <div className="field full-width">
          <label className="field-label">Story</label>
          <textarea value={storyText} rows={12} onChange={(event) => onStoryChange(event.target.value)} />
        </div>
        <div className="full-width save-row">
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty || savingContent}>
            {savingContent ? 'Saving…' : dirty ? '● Save changes' : 'Up to date'}
          </button>
          {dirty && <span className="muted size-sm">Unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}
