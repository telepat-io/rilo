const BASE_STEP_ORDER = ['script', 'voiceover', 'keyframes', 'segments', 'compose'];
const SUBTITLE_STEP_ORDER = ['align', 'burnin'];
const STEP_LABELS = {
  script: 'Script',
  voiceover: 'Voice',
  keyframes: 'Keyframes',
  segments: 'Segments',
  compose: 'Compose',
  align: 'Align',
  burnin: 'Burn In'
};

export function StepDots({ steps, running, activeStep, includeSubtitleStages = true }) {
  const stepOrder = includeSubtitleStages
    ? [...BASE_STEP_ORDER, ...SUBTITLE_STEP_ORDER]
    : BASE_STEP_ORDER;
  const resolvedActiveStep = running
    ? (stepOrder.includes(activeStep) ? activeStep : stepOrder.find((key) => !steps?.[key]) || null)
    : null;

  return (
    <div className="step-dots">
      {stepOrder.map((key) => {
        const done = steps?.[key];
        const className = done
          ? 'dot dot-done'
          : key === resolvedActiveStep
            ? 'dot dot-running'
            : 'dot dot-idle';
        return (
          <span key={key} className={className} title={STEP_LABELS[key]}>
            <span className="dot-label">{STEP_LABELS[key]}</span>
          </span>
        );
      })}
    </div>
  );
}
