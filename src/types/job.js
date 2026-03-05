export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  FAILED: 'failed',
  COMPLETED: 'completed'
};

export const JobStep = {
  SCRIPT: 'script',
  VOICE: 'voiceover',
  KEYFRAMES: 'keyframes',
  SEGMENTS: 'segments',
  COMPOSE: 'compose'
};

export function emptyStepState() {
  return {
    [JobStep.SCRIPT]: false,
    [JobStep.VOICE]: false,
    [JobStep.KEYFRAMES]: false,
    [JobStep.SEGMENTS]: false,
    [JobStep.COMPOSE]: false
  };
}
