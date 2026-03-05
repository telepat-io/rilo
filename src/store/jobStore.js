import { v4 as uuidv4 } from 'uuid';
import { JobStatus } from '../types/job.js';
import { emptyPipelineArtifacts } from '../types/media.js';
import { emptyStepState } from '../types/job.js';

const jobs = new Map();
const projectRunLocks = new Map();

function normalizeProjectName(project) {
  return String(project || '').trim().toLowerCase();
}

export function createJob(payload) {
  const id = uuidv4();
  const job = {
    id,
    status: JobStatus.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payload,
    error: null,
    artifacts: emptyPipelineArtifacts(),
    steps: emptyStepState()
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id, updates) {
  const current = jobs.get(id);
  if (!current) return null;
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  jobs.set(id, next);
  return next;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function findActiveJobByProject(project, options = {}) {
  const targetProject = normalizeProjectName(project);
  if (!targetProject) {
    return null;
  }

  const excludeJobId = options.excludeJobId || null;
  return [...jobs.values()].find((job) => {
    if (!job || (excludeJobId && job.id === excludeJobId)) {
      return false;
    }

    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.RUNNING) {
      return false;
    }

    return normalizeProjectName(job.payload?.project) === targetProject;
  }) || null;
}

export function acquireProjectRunLock(project, jobId) {
  const projectName = normalizeProjectName(project);
  if (!projectName || !jobId) {
    return false;
  }

  const currentOwner = projectRunLocks.get(projectName);
  if (currentOwner && currentOwner !== jobId) {
    return false;
  }

  projectRunLocks.set(projectName, jobId);
  return true;
}

export function releaseProjectRunLock(project, jobId) {
  const projectName = normalizeProjectName(project);
  if (!projectName || !jobId) {
    return;
  }

  const currentOwner = projectRunLocks.get(projectName);
  if (currentOwner === jobId) {
    projectRunLocks.delete(projectName);
  }
}

export function getProjectRunLockOwner(project) {
  const projectName = normalizeProjectName(project);
  if (!projectName) {
    return null;
  }
  return projectRunLocks.get(projectName) || null;
}

export function listPendingJobs() {
  return [...jobs.values()].filter((job) => job.status === JobStatus.PENDING);
}
