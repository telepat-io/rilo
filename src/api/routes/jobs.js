import express from 'express';
import { createJob, findActiveJobByProject, getJob } from '../../store/jobStore.js';
import { runPipeline } from '../../pipeline/orchestrator.js';
import { ensureProject, resolveProjectName, writeProjectStory } from '../../store/projectStore.js';

export function createJobsRouter() {
  const router = express.Router();

  router.post('/', async (req, res) => {
    const { story, project, forceRestart } = req.body || {};
    if (!story) {
      res.status(400).json({ error: 'story is required' });
      return;
    }

    const resolvedProject = resolveProjectName(project || `api-${Date.now()}`);
    const existingActiveJob = findActiveJobByProject(resolvedProject);
    if (existingActiveJob) {
      res.status(409).json({
        error: `project already has an active job (${existingActiveJob.id})`,
        jobId: existingActiveJob.id,
        status: existingActiveJob.status
      });
      return;
    }

    await ensureProject(resolvedProject);
    await writeProjectStory(resolvedProject, story);

    const job = createJob({ story, project: resolvedProject });
    setImmediate(() => runPipeline(job.id, { forceRestart: Boolean(forceRestart) }));
    res.status(202).json({ jobId: job.id, status: job.status });
  });

  router.get('/:jobId', (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'job not found' });
      return;
    }
    res.json(job);
  });

  return router;
}
