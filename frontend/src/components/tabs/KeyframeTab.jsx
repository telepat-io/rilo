import { useState, useEffect, useRef } from 'react';
import { MediaWrap } from '../ui/MediaWrap.jsx';

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
  onTargetedRegenerate
}) {
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
