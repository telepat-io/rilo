import { MediaWrap } from '../ui/MediaWrap.jsx';

export function AssetGridTab({
  assets,
  type,
  selectedProject,
  isRunning,
  regeneratingMap,
  mediaCss,
  mediaColMin,
  assetCacheKey,
  toDisplayAssetUrl,
  onRegenerateProject,
  onTargetedRegenerate
}) {
  if (assets.length === 0) {
    return (
      <div className="tab-pane">
        <div className="empty-state">
          <p className="muted">No {type === 'keyframe' ? 'keyframes' : 'segments'} generated yet.</p>
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
          const mapKey = `${type}-${index}`;
          const busy = Boolean(regeneratingMap[mapKey]);
          return (
            <article key={asset.path} className="asset-card">
              <div className="asset-index">#{index + 1}</div>
              <MediaWrap ar={mediaCss}>
                {busy ? (
                  <div className="media-placeholder"><span className="spinner" /></div>
                ) : type === 'keyframe' ? (
                  <img
                    src={toDisplayAssetUrl(selectedProject, asset, `${assetCacheKey}-${asset.path}`)}
                    alt={`Keyframe ${index + 1}`}
                    loading="lazy"
                  />
                ) : (
                  <video
                    key={`${assetCacheKey}-${asset.path}`}
                    src={toDisplayAssetUrl(selectedProject, asset, `${assetCacheKey}-${asset.path}`)}
                    controls
                    preload="metadata"
                  />
                )}
              </MediaWrap>
              <button
                type="button"
                className="btn btn-ghost btn-sm full-width"
                onClick={() => onTargetedRegenerate(type, index)}
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
