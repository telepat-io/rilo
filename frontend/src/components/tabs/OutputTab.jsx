import { MediaWrap } from '../ui/MediaWrap.jsx';

export function OutputTab({
  finalVideo,
  selectedProject,
  assetCacheKey,
  mediaCss,
  isRunning,
  subtitleEnabled,
  alignBusy,
  burninBusy,
  toDisplayAssetUrl,
  onRegenerateProject,
  onRegenerateAlign,
  onRegenerateBurnin
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
          {subtitleEnabled && (
            <div className="output-actions-row">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onRegenerateAlign}
                disabled={isRunning || alignBusy || burninBusy}
              >
                {alignBusy ? 'Re-aligning…' : '↺ Re-align subtitles'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onRegenerateBurnin}
                disabled={isRunning || burninBusy || alignBusy}
              >
                {burninBusy ? 'Re-burning…' : '↺ Re-burn subtitles'}
              </button>
            </div>
          )}
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
