import { StatusBadge } from '../ui/StatusBadge.jsx';
import { StepDots } from '../ui/StepDots.jsx';
import { TabBar } from '../ui/TabBar.jsx';

export function ProjectHeader({
  selectedProject,
  runStatus,
  isRunning,
  loadingDetails,
  steps,
  activeStep,
  tabs,
  activeTab,
  onRefresh,
  onRegenerate,
  onForceRestart,
  onChangeTab
}) {
  return (
    <div className="project-header">
      <div className="project-header-top">
        <div className="project-title-row">
          <h2 className="project-name">{selectedProject}</h2>
          <StatusBadge status={runStatus} />
          {isRunning && <span className="spinner" aria-label="Running" />}
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh} disabled={loadingDetails}>
            {loadingDetails ? '…' : '↻ Refresh'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRegenerate} disabled={isRunning}>
            ▶ Regenerate
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={onForceRestart} disabled={isRunning}>
            ↺ Force restart
          </button>
        </div>
      </div>

      {steps && <StepDots steps={steps} running={isRunning} activeStep={activeStep} />}

      <TabBar tabs={tabs} active={activeTab} onChange={onChangeTab} />
    </div>
  );
}
