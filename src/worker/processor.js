import { listPendingJobs } from '../store/jobStore.js';
import { runPipeline } from '../pipeline/orchestrator.js';
import { logInfo } from '../observability/logger.js';

async function tick() {
  const pending = listPendingJobs();
  if (pending.length === 0) return;

  const [job] = pending;
  logInfo('worker_picking_job', { jobId: job.id });
  await runPipeline(job.id);
}

async function loop() {
  for (;;) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

loop().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
