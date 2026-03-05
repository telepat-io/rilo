import { useState, useEffect } from 'react';
import { getProjectAnalytics, getProjectAnalyticsRuns } from '../../api.js';

const STAGE_LABELS = {
  script: 'Script',
  voiceover: 'Voice',
  keyframes: 'Keyframes',
  segments: 'Segments',
  compose: 'Compose'
};

const STAGE_ORDER = ['script', 'voiceover', 'keyframes', 'segments', 'compose'];

function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function fmtCost(usd) {
  if (!Number.isFinite(usd)) return '—';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function RunStatusBadge({ status }) {
  const classMap = {
    completed: 'run-badge run-badge-ok',
    failed: 'run-badge run-badge-fail',
    running: 'run-badge run-badge-running'
  };
  const labelMap = {
    completed: 'Completed',
    failed: 'Failed',
    running: 'Running'
  };
  return (
    <span className={classMap[status] || 'run-badge'}>
      {labelMap[status] || status}
    </span>
  );
}

function StageStatusDot({ status }) {
  if (status === 'succeeded') return <span className="stage-dot stage-dot-ok" title="Succeeded" />;
  if (status === 'reused') return <span className="stage-dot stage-dot-reused" title="Reused" />;
  if (status === 'failed') return <span className="stage-dot stage-dot-fail" title="Failed" />;
  if (status === 'running') return <span className="stage-dot stage-dot-running" title="Running" />;
  return <span className="stage-dot stage-dot-idle" title="Pending" />;
}

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="run-row">
      <button
        type="button"
        className="run-row-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <RunStatusBadge status={run.status} />
        <span className="run-row-date">{fmtDate(run.invokedAt)}</span>
        <span className="run-row-meta">{fmtDuration(run.totalDurationMs)}</span>
        <span className="run-row-meta">{run.totals?.predictionCount ?? 0} pred.</span>
        <span className="run-row-meta run-row-cost">{fmtCost(run.totals?.costUsd)}</span>
        <span className="run-row-chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="run-stages">
          <table className="stages-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Predictions</th>
                <th>Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map((stage) => {
                const s = run.stages?.[stage];
                if (!s) return null;
                return (
                  <tr key={stage} className={s.status === 'pending' ? 'stage-row-pending' : ''}>
                    <td className="stage-name-cell">
                      <StageStatusDot status={s.status} />
                      {STAGE_LABELS[stage] || stage}
                    </td>
                    <td className="stage-status-cell">
                      {s.reused ? 'reused' : s.status}
                    </td>
                    <td>{fmtDuration(s.durationMs)}</td>
                    <td>{s.predictionCount ?? 0}</td>
                    <td>{fmtCost(s.costUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AnalyticsTab({ selectedProject }) {
  const [summary, setSummary] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedProject) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getProjectAnalytics(selectedProject),
      getProjectAnalyticsRuns(selectedProject)
    ])
      .then(([analyticsRes, runsRes]) => {
        if (cancelled) return;
        setSummary(analyticsRes.summary || null);
        setRuns(runsRes.runs || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load analytics');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  if (loading) {
    return (
      <div className="tab-pane analytics-pane">
        <p className="muted">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-pane analytics-pane">
        <p className="analytics-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="tab-pane analytics-pane">
      {summary && (
        <div className="analytics-summary">
          <div className="analytics-stat-card">
            <span className="stat-value">{summary.totalRuns}</span>
            <span className="stat-label">Total Runs</span>
          </div>
          <div className="analytics-stat-card">
            <span className="stat-value">
              <span className="stat-ok">{summary.completedRuns}</span>
              {summary.failedRuns > 0 && (
                <> / <span className="stat-fail">{summary.failedRuns}</span></>
              )}
            </span>
            <span className="stat-label">Done / Failed</span>
          </div>
          <div className="analytics-stat-card">
            <span className="stat-value">{fmtDuration(summary.averageDurationMs)}</span>
            <span className="stat-label">Avg Duration</span>
          </div>
          <div className="analytics-stat-card">
            <span className="stat-value">
              {Number.isFinite(summary.totalCostUsd) ? fmtCost(summary.totalCostUsd) : '—'}
            </span>
            <span className="stat-label">Est. Total Cost</span>
          </div>
        </div>
      )}

      {runs.length === 0 && !loading && (
        <p className="muted analytics-empty">No runs recorded yet.</p>
      )}

      {runs.length > 0 && (
        <div className="analytics-runs">
          <p className="analytics-runs-title">Recent runs</p>
          {runs.map((run) => (
            <RunRow key={run.runId} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
