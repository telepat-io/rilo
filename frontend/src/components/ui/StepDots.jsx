const STEP_ORDER = ['script', 'voiceover', 'keyframes', 'segments', 'compose'];
const STEP_LABELS = {
  script: 'Script',
  voiceover: 'Voice',
  keyframes: 'Keyframes',
  segments: 'Segments',
  compose: 'Compose'
};

export function StepDots({ steps, running, activeStep }) {
  const resolvedActiveStep = running
    ? (STEP_ORDER.includes(activeStep) ? activeStep : STEP_ORDER.find((key) => !steps?.[key]) || null)
    : null;

  return (
    <div className="step-dots">
      {STEP_ORDER.map((key) => {
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
