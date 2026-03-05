import { MediaWrap } from '../ui/MediaWrap.jsx';

export function OutputTab({
  finalVideo,
  selectedProject,
  assetCacheKey,
  mediaCss,
  isRunning,
  toDisplayAssetUrl,
  onRegenerateProject
}) {
  return (
    <div className="tab-pane tab-pane-output">
      {finalVideo ? (
        <section className="final-video-section">
          <h3 className="section-label">Final video</h3>
          <div className="final-video-wrap">
            <MediaWrap ar={mediaCss}>
              <video
                key={`${assetCacheKey}-final`}
                src={toDisplayAssetUrl(selectedProject, finalVideo, `${assetCacheKey}-${finalVideo.path}`)}
                controls
                preload="metadata"
              />
            </MediaWrap>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <p className="muted">No final video yet.</p>
          <button type="button" className="btn btn-secondary" onClick={onRegenerateProject} disabled={isRunning}>
            ▶ Regenerate project
          </button>
        </div>
      )}
    </div>
  );
}
