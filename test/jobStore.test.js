import test from 'node:test';
import assert from 'node:assert/strict';

import {
  acquireProjectRunLock,
  createJob,
  findActiveJobByProject,
  getProjectRunLockOwner,
  releaseProjectRunLock,
  updateJob
} from '../src/store/jobStore.js';
import { JobStatus } from '../src/types/job.js';

function uniqueProject(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

test('findActiveJobByProject returns pending/running jobs and ignores completed/failed', () => {
  const project = uniqueProject('ut-job-active');
  const pending = createJob({ project, story: 'pending' });
  const running = createJob({ project, story: 'running' });
  const completed = createJob({ project, story: 'completed' });

  updateJob(running.id, { status: JobStatus.RUNNING });
  updateJob(completed.id, { status: JobStatus.COMPLETED });

  const found = findActiveJobByProject(project);
  assert.ok(found);
  assert.ok(found.id === pending.id || found.id === running.id);

  updateJob(pending.id, { status: JobStatus.FAILED });
  updateJob(running.id, { status: JobStatus.COMPLETED });

  assert.equal(findActiveJobByProject(project), null);
});

test('project run lock allows single owner and supports release by owner only', () => {
  const project = uniqueProject('ut-job-lock');
  const ownerA = `job-a-${Date.now()}`;
  const ownerB = `job-b-${Date.now()}`;

  assert.equal(acquireProjectRunLock(project, ownerA), true);
  assert.equal(getProjectRunLockOwner(project), ownerA);

  assert.equal(acquireProjectRunLock(project, ownerB), false);
  assert.equal(getProjectRunLockOwner(project), ownerA);

  releaseProjectRunLock(project, ownerB);
  assert.equal(getProjectRunLockOwner(project), ownerA);

  releaseProjectRunLock(project, ownerA);
  assert.equal(getProjectRunLockOwner(project), null);
});

test('jobStore handles find/exclude and invalid lock arguments', () => {
  const project = uniqueProject('ut-job-edge');
  const jobA = createJob({ project, story: 'a' });
  const jobB = createJob({ project, story: 'b' });
  updateJob(jobB.id, { status: JobStatus.RUNNING });

  const foundExcludingA = findActiveJobByProject(project, { excludeJobId: jobA.id });
  assert.equal(foundExcludingA?.id, jobB.id);
  assert.equal(findActiveJobByProject('   '), null);

  assert.equal(acquireProjectRunLock('', 'x'), false);
  assert.equal(acquireProjectRunLock(project, ''), false);
  assert.equal(getProjectRunLockOwner('   '), null);

  releaseProjectRunLock('', 'x');
  releaseProjectRunLock(project, '');
});
