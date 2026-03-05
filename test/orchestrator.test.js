import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { regenerateProjectAsset, runPipeline } from '../src/pipeline/orchestrator.js';
import { acquireProjectRunLock, createJob, getJob, getProjectRunLockOwner, releaseProjectRunLock } from '../src/store/jobStore.js';
import {
  ensureProject,
  ensureProjectConfig,
  getProjectDir,
  writeProjectRunState,
  writeProjectStory
} from '../src/store/projectStore.js';
import { JobStep } from '../src/types/job.js';
import { emptyPipelineArtifacts } from '../src/types/media.js';

function uniqueProject(prefix) {
  const project = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  createdProjects.add(project);
  return project;
}

async function cleanupProject(project) {
  await fs.rm(getProjectDir(project), { recursive: true, force: true });
}

const createdProjects = new Set();

after(async () => {
  await Promise.all([...createdProjects].map((project) => cleanupProject(project)));
  createdProjects.clear();
});

function allStepsTrue() {
  return {
    [JobStep.SCRIPT]: true,
    [JobStep.VOICE]: true,
    [JobStep.KEYFRAMES]: true,
    [JobStep.SEGMENTS]: true,
    [JobStep.COMPOSE]: true
  };
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

test('runPipeline marks failed job and releases project lock on validation failure', async () => {
  const project = uniqueProject('ut-orch-fail');
  await ensureProject(project);
  await ensureProjectConfig(project);
  await writeProjectStory(project, 'too short');

  const job = createJob({
    project,
    story: 'too short'
  });

  const result = await runPipeline(job.id);
  assert.equal(result.status, 'failed');
  assert.match(result.error, /at least 50 characters/);
  assert.equal(getProjectRunLockOwner(project), null);

  await cleanupProject(project);
});

test('runPipeline executes all stages with injected deps and completes offline', async () => {
  const project = uniqueProject('ut-orch-mocked');

  const stepsCalled = {
    script: 0,
    voice: 0,
    keyframe: 0,
    segment: 0,
    compose: 0,
    checkpointSync: 0
  };

  const job = createJob({
    project,
    story: 'This is a long enough story body for mocked orchestrator execution path coverage.'
  });

  const result = await runPipeline(job.id, {
    forceRestart: true,
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 10,
        finalDurationMode: 'match_audio'
      }),
      readProjectRunState: async () => null,
      archiveProjectAssets: async () => null,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {
        stepsCalled.checkpointSync += 1;
      },
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      preprocessStory: (story) => story,
      generateScript: async () => {
        stepsCalled.script += 1;
        return {
          script: 'Generated script',
          tone: 'neutral',
          scriptWordCount: 10,
          targetWordCount: 10
        };
      },
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Shot ${index + 1}`)
      }),
      generateVoiceover: async () => {
        stepsCalled.voice += 1;
        return {
          timeline: [
            { index: 0, startSec: 0, endSec: 5 },
            { index: 1, startSec: 5, endSec: 10 }
          ],
          voiceoverUrl: 'https://replicate.delivery/audio.wav',
          ttsPlan: { speed: 1.0 }
        };
      },
      persistVoiceover: async () => '/tmp/voice.wav',
      probeMediaDurationSeconds: async () => 10,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [
        { index: 0, startSec: 0, endSec: 5 },
        { index: 1, startSec: 5, endSec: 10 }
      ],
      generateKeyframe: async (_shot, _tone, _aspect, index) => {
        stepsCalled.keyframe += 1;
        return `https://replicate.delivery/keyframe-${index}.png`;
      },
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/keyframe-${index}.png`,
      generateVideoSegmentAtIndex: async (index) => {
        stepsCalled.segment += 1;
        return `https://replicate.delivery/segment-${index}.mp4`;
      },
      persistSegment: async (_projectDir, _url, index) => `/tmp/segment-${index}.mp4`,
      composeFinalVideo: async () => {
        stepsCalled.compose += 1;
        return {
          finalVideoPath: '/tmp/final.mp4',
          voiceoverPath: '/tmp/voice.wav',
          keyframePaths: ['/tmp/keyframe-0.png', '/tmp/keyframe-1.png'],
          segmentPaths: ['/tmp/segment-0.mp4', '/tmp/segment-1.mp4']
        };
      }
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.artifacts.finalVideoPath, '/tmp/final.mp4');
  assert.equal(stepsCalled.script, 1);
  assert.equal(stepsCalled.voice, 1);
  assert.equal(stepsCalled.keyframe, 3);
  assert.equal(stepsCalled.segment, 2);
  assert.equal(stepsCalled.compose, 1);
  assert.ok(stepsCalled.checkpointSync >= 1);
  assert.equal(getProjectRunLockOwner(project), null);

  await cleanupProject(project);
});

test('runPipeline fails fast when project lock is already owned by another job', async () => {
  const project = uniqueProject('ut-orch-lock-contention');
  await ensureProject(project);
  await ensureProjectConfig(project);

  const ownerJobId = `owner-${Date.now()}`;
  assert.equal(acquireProjectRunLock(project, ownerJobId), true);

  try {
    const job = createJob({
      project,
      story: 'This is a long story text for lock contention behavior in orchestrator testing.'
    });

    const result = await runPipeline(job.id);
    assert.equal(result.status, 'failed');
    assert.match(result.error, /already running/);
  } finally {
    releaseProjectRunLock(project, ownerJobId);
    await cleanupProject(project);
  }
});

test('regenerateProjectAsset regenerates targeted keyframe and invalidates downstream stages', async () => {
  const persisted = {
    artifacts: null,
    runState: null,
    syncCalls: 0
  };

  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      aspectRatio: '9:16',
      script: 'Script body',
      tone: 'neutral',
      shots: ['Shot A', 'Shot B', 'Shot C'],
      timeline: [
        { index: 0, startSec: 0, endSec: 5 },
        { index: 1, startSec: 5, endSec: 10 },
        { index: 2, startSec: 10, endSec: 15 }
      ],
      keyframeUrls: ['https://old/k0.png', 'https://old/k1.png', 'https://old/k2.png'],
      keyframePaths: ['/tmp/k0.png', '/tmp/k1.png', '/tmp/k2.png'],
      segmentUrls: ['https://old/s0.mp4', 'https://old/s1.mp4', 'https://old/s2.mp4'],
      segmentPaths: ['/tmp/s0.mp4', '/tmp/s1.mp4', '/tmp/s2.mp4'],
      finalVideoPath: '/tmp/final.mp4'
    }
  };

  const result = await regenerateProjectAsset('test-project', { targetType: 'keyframe', index: 1 }, {
    deps: {
      resolveProjectName: (project) => project,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => runState,
      generateKeyframe: async (_shot, _tone, _aspect, index) => `https://new/keyframe-${index}.png`,
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/new-k${index}.png`,
      persistArtifacts: async (_project, artifacts) => {
        persisted.artifacts = artifacts;
      },
      writeProjectRunState: async (_project, nextState) => {
        persisted.runState = nextState;
      },
      syncProjectSnapshot: async () => {
        persisted.syncCalls += 1;
      }
    }
  });

  assert.equal(result.targetType, 'keyframe');
  assert.equal(result.index, 1);
  assert.equal(result.artifacts.keyframeUrls[1], 'https://new/keyframe-1.png');
  assert.equal(result.artifacts.keyframePaths[1], '/tmp/new-k1.png');
  assert.equal(result.artifacts.segmentUrls[0], '');
  assert.equal(result.artifacts.segmentUrls[1], '');
  assert.equal(result.steps[JobStep.SEGMENTS], false);
  assert.equal(result.steps[JobStep.COMPOSE], false);
  assert.equal(result.artifacts.finalVideoPath, '');
  assert.equal(persisted.syncCalls, 1);
  assert.ok(persisted.runState);
});

test('runPipeline regenerates keyframe when saved path is missing but url exists', async () => {
  const project = uniqueProject('ut-orch-missing-keyframe-file');
  const story = 'This is a sufficiently long story used to validate missing keyframe path repair behavior.';
  const missingPath = path.join(os.tmpdir(), `missing-keyframe-${Date.now()}.png`);

  const job = createJob({ project, story });
  let keyframePersistCalls = 0;
  let keyframeGenerateCalls = 0;

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: {
          [JobStep.SCRIPT]: true,
          [JobStep.VOICE]: true,
          [JobStep.KEYFRAMES]: false,
          [JobStep.SEGMENTS]: true,
          [JobStep.COMPOSE]: true
        },
        artifacts: {
          ...emptyPipelineArtifacts(),
          aspectRatio: '9:16',
          script: 'Script body',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Script body'),
          shotHashes: [hashText('Shot 1')],
          shots: ['Shot 1'],
          tone: 'neutral',
          timeline: [{ index: 0, startSec: 0, endSec: 5 }],
          keyframeUrls: ['https://existing/keyframe-0.png'],
          keyframePaths: [missingPath],
          segmentUrls: ['https://existing/segment-0.mp4'],
          segmentPaths: ['/tmp/segment-0.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        }
      }),
      archiveProjectAssets: async () => null,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      preprocessStory: (input) => input,
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ index: 0, startSec: 0, endSec: 5 }],
      generateKeyframe: async () => {
        keyframeGenerateCalls += 1;
        return 'https://new/keyframe.png';
      },
      persistKeyframe: async () => {
        keyframePersistCalls += 1;
        return '/tmp/repaired-keyframe-0.png';
      },
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/final.mp4',
        voiceoverPath: '/tmp/voice.wav',
        keyframePaths: ['/tmp/repaired-keyframe-0.png'],
        segmentPaths: ['/tmp/segment-0.mp4']
      })
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(keyframeGenerateCalls, 0);
  assert.equal(keyframePersistCalls, 1);
  assert.equal(result.artifacts.keyframePaths[0], '/tmp/repaired-keyframe-0.png');
});

test('regenerateProjectAsset regenerates targeted segment and invalidates compose only', async () => {
  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      aspectRatio: '9:16',
      script: 'Script body',
      tone: 'neutral',
      shots: ['Shot A', 'Shot B', 'Shot C'],
      timeline: [
        { index: 0, startSec: 0, endSec: 5 },
        { index: 1, startSec: 5, endSec: 10 }
      ],
      keyframeUrls: ['https://old/k0.png', 'https://old/k1.png', 'https://old/k2.png'],
      keyframePaths: ['/tmp/k0.png', '/tmp/k1.png', '/tmp/k2.png'],
      segmentUrls: ['https://old/s0.mp4', 'https://old/s1.mp4'],
      segmentPaths: ['/tmp/s0.mp4', '/tmp/s1.mp4'],
      finalVideoPath: '/tmp/final.mp4'
    }
  };

  const result = await regenerateProjectAsset('test-project-segment', { targetType: 'segment', index: 1 }, {
    deps: {
      resolveProjectName: (project) => project,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => runState,
      generateVideoSegmentAtIndex: async (index) => `https://new/segment-${index}.mp4`,
      persistSegment: async (_projectDir, _url, index) => `/tmp/new-s${index}.mp4`,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {}
    }
  });

  assert.equal(result.targetType, 'segment');
  assert.equal(result.index, 1);
  assert.equal(result.artifacts.segmentUrls[1], 'https://new/segment-1.mp4');
  assert.equal(result.artifacts.segmentPaths[1], '/tmp/new-s1.mp4');
  assert.equal(result.steps[JobStep.SEGMENTS], true);
  assert.equal(result.steps[JobStep.COMPOSE], false);
  assert.equal(result.artifacts.finalVideoPath, '');
});

test('regenerateProjectAsset regenerates voiceover and invalidates compose only', async () => {
  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      aspectRatio: '9:16',
      script: 'Script body for voice regeneration.',
      tone: 'neutral',
      shots: ['Shot A', 'Shot B'],
      timeline: [
        { index: 0, startSec: 0, endSec: 5 },
        { index: 1, startSec: 5, endSec: 10 }
      ],
      voiceoverUrl: 'https://old/voice.mp3',
      voiceoverPath: '/tmp/old-voice.mp3',
      keyframeUrls: ['https://old/k0.png', 'https://old/k1.png'],
      keyframePaths: ['/tmp/k0.png', '/tmp/k1.png'],
      segmentUrls: ['https://old/s0.mp4', 'https://old/s1.mp4'],
      segmentPaths: ['/tmp/s0.mp4', '/tmp/s1.mp4'],
      finalVideoPath: '/tmp/final.mp4'
    }
  };

  const result = await regenerateProjectAsset('test-project-voiceover', { targetType: 'voiceover' }, {
    deps: {
      resolveProjectName: (project) => project,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => runState,
      generateVoiceover: async () => ({
        voiceoverUrl: 'https://new/voice.mp3',
        timeline: [
          { index: 0, startSec: 0, endSec: 5 },
          { index: 1, startSec: 5, endSec: 10 }
        ],
        ttsPlan: { speed: 1.0 }
      }),
      persistVoiceover: async () => '/tmp/new-voice.mp3',
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ index: 0, startSec: 0, endSec: 5 }],
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {}
    }
  });

  assert.equal(result.targetType, 'voiceover');
  assert.equal(result.index, undefined);
  assert.equal(result.artifacts.voiceoverUrl, 'https://new/voice.mp3');
  assert.equal(result.artifacts.voiceoverPath, '/tmp/new-voice.mp3');
  assert.equal(result.steps[JobStep.VOICE], true);
  assert.equal(result.steps[JobStep.KEYFRAMES], true);
  assert.equal(result.steps[JobStep.SEGMENTS], true);
  assert.equal(result.steps[JobStep.COMPOSE], false);
  assert.equal(result.artifacts.finalVideoPath, '');
});

test('regenerateProjectAsset regenerates script and invalidates downstream stages', async () => {
  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      aspectRatio: '9:16',
      script: 'Old script body.',
      tone: 'neutral',
      shots: ['Old shot A', 'Old shot B'],
      shotHashes: [hashText('Old shot A'), hashText('Old shot B')],
      timeline: [{ index: 0, startSec: 0, endSec: 5 }],
      voiceoverUrl: 'https://old/voice.mp3',
      voiceoverPath: '/tmp/old-voice.mp3',
      keyframeUrls: ['https://old/k0.png', 'https://old/k1.png'],
      keyframePaths: ['/tmp/k0.png', '/tmp/k1.png'],
      segmentUrls: ['https://old/s0.mp4'],
      segmentPaths: ['/tmp/s0.mp4'],
      finalVideoPath: '/tmp/final.mp4'
    }
  };

  const result = await regenerateProjectAsset('test-project-script', { targetType: 'script' }, {
    deps: {
      resolveProjectName: (project) => project,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => runState,
      readProjectStory: async () => 'A sufficiently long source story for targeted script regeneration behavior.',
      preprocessStory: (story) => story,
      generateScript: async () => ({
        script: 'New regenerated script body.',
        tone: 'dramatic',
        scriptWordCount: 42,
        targetWordCount: 40
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {}
    }
  });

  assert.equal(result.targetType, 'script');
  assert.equal(result.index, undefined);
  assert.equal(result.artifacts.script, 'New regenerated script body.');
  assert.equal(result.artifacts.tone, 'dramatic');
  assert.equal(result.artifacts.shots.length, 0);
  assert.equal(result.artifacts.voiceoverUrl, '');
  assert.equal(result.artifacts.keyframeUrls.length, 0);
  assert.equal(result.artifacts.segmentUrls.length, 0);
  assert.equal(result.steps[JobStep.SCRIPT], true);
  assert.equal(result.steps[JobStep.VOICE], false);
  assert.equal(result.steps[JobStep.KEYFRAMES], false);
  assert.equal(result.steps[JobStep.SEGMENTS], false);
  assert.equal(result.steps[JobStep.COMPOSE], false);
});

test('runPipeline regenerates voiceover after targeted script regeneration', async () => {
  const project = uniqueProject('ut-orch-script-regen-voice-next-run');
  const story = 'This is a sufficiently long story used to verify voiceover regeneration after targeted script regeneration.';

  let runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      aspectRatio: '9:16',
      script: 'Original script body.',
      scriptHash: hashText('Original script body.'),
      scriptSourceStoryHash: hashText(story),
      tone: 'neutral',
      shots: ['Original shot A', 'Original shot B'],
      shotHashes: [hashText('Original shot A'), hashText('Original shot B')],
      timeline: [{ index: 0, startSec: 0, endSec: 5 }],
      voiceoverUrl: 'https://old/voice.wav',
      voiceoverPath: '/tmp/old-voice.wav',
      keyframeUrls: ['https://old/k0.png', 'https://old/k1.png'],
      keyframePaths: ['/tmp/k0.png', '/tmp/k1.png'],
      segmentUrls: ['https://old/s0.mp4'],
      segmentPaths: ['/tmp/s0.mp4'],
      finalVideoPath: '/tmp/old-final.mp4'
    }
  };

  await regenerateProjectAsset(project, { targetType: 'script' }, {
    deps: {
      resolveProjectName: (name) => name,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => runState,
      readProjectStory: async () => story,
      preprocessStory: (value) => value,
      generateScript: async () => ({
        script: 'Regenerated script body.',
        tone: 'dramatic',
        scriptWordCount: 20,
        targetWordCount: 26
      }),
      persistArtifacts: async (_project, artifacts) => {
        runState = {
          ...runState,
          artifacts
        };
      },
      writeProjectRunState: async (_project, nextState) => {
        runState = nextState;
      },
      syncProjectSnapshot: async () => {}
    }
  });

  assert.equal(runState.steps[JobStep.VOICE], false);
  assert.equal(runState.artifacts.voiceoverUrl, '');
  assert.equal(runState.artifacts.voiceoverPath, '');

  const job = createJob({ project, story });
  let scriptCalls = 0;
  let voiceoverCalls = 0;

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      readProjectRunState: async () => runState,
      archiveProjectAssets: async () => null,
      persistArtifacts: async (_project, artifacts) => {
        runState = {
          ...runState,
          artifacts
        };
      },
      writeProjectRunState: async (_project, nextState) => {
        runState = nextState;
      },
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      preprocessStory: (value) => value,
      generateScript: async () => {
        scriptCalls += 1;
        return {
          script: 'Unexpected fallback script generation',
          tone: 'neutral',
          scriptWordCount: 20,
          targetWordCount: 26
        };
      },
      probeMediaDurationSeconds: async () => 10,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [
        { index: 0, startSec: 0, endSec: 5 },
        { index: 1, startSec: 5, endSec: 10 }
      ],
      generateVoiceover: async () => {
        voiceoverCalls += 1;
        return {
          timeline: [
            { index: 0, startSec: 0, endSec: 5 },
            { index: 1, startSec: 5, endSec: 10 }
          ],
          voiceoverUrl: 'https://replicate.delivery/new-voice.wav',
          ttsPlan: { speed: 1.0 }
        };
      },
      persistVoiceover: async () => '/tmp/new-voice.wav',
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, idx) => `Shot ${idx + 1}`)
      }),
      generateKeyframe: async (_shot, _tone, _aspect, idx) => `https://replicate.delivery/keyframe-${idx}.png`,
      persistKeyframe: async (_projectDir, _url, idx) => `/tmp/keyframe-${idx}.png`,
      generateVideoSegmentAtIndex: async (idx) => `https://replicate.delivery/segment-${idx}.mp4`,
      persistSegment: async (_projectDir, _url, idx) => `/tmp/segment-${idx}.mp4`,
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/final.mp4',
        voiceoverPath: '/tmp/new-voice.wav',
        keyframePaths: ['/tmp/keyframe-0.png', '/tmp/keyframe-1.png', '/tmp/keyframe-2.png'],
        segmentPaths: ['/tmp/segment-0.mp4', '/tmp/segment-1.mp4']
      })
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(scriptCalls, 0);
  assert.equal(voiceoverCalls, 1);
  assert.equal(result.artifacts.voiceoverUrl, 'https://replicate.delivery/new-voice.wav');
  assert.equal(result.artifacts.voiceoverPath, '/tmp/new-voice.wav');
});

test('regenerateProjectAsset regenerates shots when voiceover changes required count', async () => {
  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      aspectRatio: '9:16',
      script: 'Script body for voice regeneration.',
      tone: 'neutral',
      shots: ['Shot A', 'Shot B'],
      shotHashes: [hashText('Shot A'), hashText('Shot B')],
      timeline: [
        { index: 0, startSec: 0, endSec: 5 }
      ],
      voiceoverUrl: 'https://old/voice.mp3',
      voiceoverPath: '/tmp/old-voice.mp3',
      keyframeUrls: ['https://old/k0.png', 'https://old/k1.png'],
      keyframePaths: ['/tmp/k0.png', '/tmp/k1.png'],
      segmentUrls: ['https://old/s0.mp4'],
      segmentPaths: ['/tmp/s0.mp4'],
      finalVideoPath: '/tmp/final.mp4'
    }
  };

  const result = await regenerateProjectAsset('test-project-voiceover-reshot', { targetType: 'voiceover' }, {
    deps: {
      resolveProjectName: (project) => project,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => runState,
      generateVoiceover: async () => ({
        voiceoverUrl: 'https://new/voice.mp3',
        timeline: [{ index: 0, startSec: 0, endSec: 5 }],
        ttsPlan: { speed: 1.0 }
      }),
      persistVoiceover: async () => '/tmp/new-voice.mp3',
      probeMediaDurationSeconds: async () => 14,
      resolveSegmentCountFromAudioDuration: () => 3,
      buildFixedTimeline: () => [
        { index: 0, startSec: 0, endSec: 5 },
        { index: 1, startSec: 5, endSec: 10 },
        { index: 2, startSec: 10, endSec: 15 }
      ],
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Regenerated shot ${index + 1}`)
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {}
    }
  });

  assert.equal(result.targetType, 'voiceover');
  assert.equal(result.artifacts.shots.length, 4);
  assert.equal(result.artifacts.shots[0], 'Regenerated shot 1');
  assert.equal(result.steps[JobStep.VOICE], true);
  assert.equal(result.steps[JobStep.KEYFRAMES], false);
  assert.equal(result.steps[JobStep.SEGMENTS], false);
  assert.equal(result.steps[JobStep.COMPOSE], false);
  assert.equal(result.artifacts.keyframeUrls.length, 0);
  assert.equal(result.artifacts.segmentUrls.length, 0);
});

test('regenerateProjectAsset validates target and state preconditions', async () => {
  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'unknown', index: 0 }, {
      deps: { resolveProjectName: (project) => project }
    }),
    /targetType must be one of script, voiceover, keyframe, segment/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'voiceover', index: 0 }, {
      deps: { resolveProjectName: (project) => project }
    }),
    /index is not supported for script\/voiceover regeneration/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'keyframe', index: -1 }, {
      deps: { resolveProjectName: (project) => project }
    }),
    /index must be a non-negative integer/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'keyframe', index: 0 }, {
      deps: {
        resolveProjectName: (project) => project,
        ensureProject: async () => {},
        readProjectConfig: async () => ({ aspectRatio: '9:16' }),
        getProjectDir: () => '/tmp/project',
        readProjectRunState: async () => null
      }
    }),
    /project has no prior artifacts/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'segment', index: 0 }, {
      deps: {
        resolveProjectName: (project) => project,
        ensureProject: async () => {},
        readProjectConfig: async () => ({ aspectRatio: '9:16' }),
        getProjectDir: () => '/tmp/project',
        readProjectRunState: async () => ({
          status: 'completed',
          error: null,
          steps: allStepsTrue(),
          artifacts: {
            ...emptyPipelineArtifacts(),
            shots: ['Shot A', 'Shot B'],
            timeline: [{ index: 0, startSec: 0, endSec: 5 }],
            keyframeUrls: ['', '']
          }
        })
      }
    }),
    /missing keyframe URL required/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'keyframe', index: 0 }, {
      deps: {
        resolveProjectName: (project) => project,
        ensureProject: async () => {},
        readProjectConfig: async () => ({ aspectRatio: '9:16' }),
        getProjectDir: () => '/tmp/project',
        readProjectRunState: async () => ({
          status: 'completed',
          error: null,
          steps: allStepsTrue(),
          artifacts: {
            ...emptyPipelineArtifacts(),
            shots: []
          }
        })
      }
    }),
    /project has no shots/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'keyframe', index: 3 }, {
      deps: {
        resolveProjectName: (project) => project,
        ensureProject: async () => {},
        readProjectConfig: async () => ({ aspectRatio: '9:16' }),
        getProjectDir: () => '/tmp/project',
        readProjectRunState: async () => ({
          status: 'completed',
          error: null,
          steps: allStepsTrue(),
          artifacts: {
            ...emptyPipelineArtifacts(),
            shots: ['Shot 1']
          }
        })
      }
    }),
    /index out of range/
  );

  await assert.rejects(
    regenerateProjectAsset('p', { targetType: 'segment', index: 0 }, {
      deps: {
        resolveProjectName: (project) => project,
        ensureProject: async () => {},
        readProjectConfig: async () => ({ aspectRatio: '9:16' }),
        getProjectDir: () => '/tmp/project',
        readProjectRunState: async () => ({
          status: 'completed',
          error: null,
          steps: allStepsTrue(),
          artifacts: {
            ...emptyPipelineArtifacts(),
            shots: ['Shot 1'],
            keyframeUrls: ['https://existing/keyframe.png'],
            timeline: []
          }
        })
      }
    }),
    /out of range for project segments/
  );
});

test('regenerateProjectAsset keyframe at last index invalidates final adjacent segment and defaults status/error', async () => {
  let writtenRunState = null;

  const result = await regenerateProjectAsset('project-tail-keyframe', { targetType: 'keyframe', index: 1 }, {
    deps: {
      resolveProjectName: (project) => project,
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => '/tmp/project-dir',
      readProjectRunState: async () => ({
        status: '',
        error: 'prior-error',
        steps: {},
        artifacts: {
          ...emptyPipelineArtifacts(),
          shots: ['Shot A', 'Shot B'],
          tone: 'neutral',
          timeline: [
            { index: 0, startSec: 0, endSec: 5 },
            { index: 1, startSec: 5, endSec: 10 }
          ],
          keyframeUrls: ['https://old/k0.png', 'https://old/k1.png'],
          keyframePaths: ['/tmp/k0.png', '/tmp/k1.png'],
          segmentUrls: ['https://old/s0.mp4'],
          segmentPaths: ['/tmp/s0.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        }
      }),
      generateKeyframe: async (_shot, _tone, _aspect, index) => `https://new/keyframe-${index}.png`,
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/new-k${index}.png`,
      persistArtifacts: async () => {},
      writeProjectRunState: async (_project, state) => {
        writtenRunState = state;
      },
      syncProjectSnapshot: async () => {}
    }
  });

  assert.equal(result.artifacts.segmentUrls[0], '');
  assert.equal(result.artifacts.segmentPaths[0], '');
  assert.ok(writtenRunState);
  assert.equal(writtenRunState.status, 'completed');
  assert.equal(writtenRunState.error, 'prior-error');
});

test('runPipeline regenerates segment when saved path is missing but url exists', async () => {
  const project = uniqueProject('ut-orch-missing-segment-file');
  const story = 'This is a sufficiently long story used to validate missing segment path repair behavior.';
  const missingPath = path.join(os.tmpdir(), `missing-segment-${Date.now()}.mp4`);

  const job = createJob({ project, story });
  let segmentPersistCalls = 0;
  let segmentGenerateCalls = 0;

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: {
          [JobStep.SCRIPT]: true,
          [JobStep.VOICE]: true,
          [JobStep.KEYFRAMES]: true,
          [JobStep.SEGMENTS]: false,
          [JobStep.COMPOSE]: true
        },
        artifacts: {
          ...emptyPipelineArtifacts(),
          aspectRatio: '9:16',
          script: 'Script body',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Script body'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2')],
          shots: ['Shot 1', 'Shot 2'],
          tone: 'neutral',
          timeline: [{ index: 0, startSec: 0, endSec: 5 }],
          keyframeUrls: ['https://existing/keyframe-0.png', 'https://existing/keyframe-1.png'],
          keyframePaths: ['/tmp/keyframe-0.png', '/tmp/keyframe-1.png'],
          segmentUrls: ['https://existing/segment-0.mp4'],
          segmentPaths: [missingPath],
          finalVideoPath: '/tmp/final.mp4'
        }
      }),
      archiveProjectAssets: async () => null,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      preprocessStory: (input) => input,
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ index: 0, startSec: 0, endSec: 5 }],
      generateVideoSegmentAtIndex: async () => {
        segmentGenerateCalls += 1;
        return 'https://new/segment.mp4';
      },
      persistSegment: async () => {
        segmentPersistCalls += 1;
        return '/tmp/repaired-segment-0.mp4';
      },
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/final.mp4',
        voiceoverPath: '/tmp/voice.wav',
        keyframePaths: ['/tmp/keyframe-0.png', '/tmp/keyframe-1.png'],
        segmentPaths: ['/tmp/repaired-segment-0.mp4']
      })
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(segmentGenerateCalls, 0);
  assert.equal(segmentPersistCalls, 1);
  assert.equal(result.artifacts.segmentPaths[0], '/tmp/repaired-segment-0.mp4');
});

test('runPipeline completes using fully reused resume state without external generation', async () => {
  const project = uniqueProject('ut-orch-resume');
  await ensureProject(project);
  await ensureProjectConfig(project);

  const story = 'This is a sufficiently long anonymized legal narrative input for resume-path orchestration tests.';
  await writeProjectStory(project, story);

  const artifacts = {
    ...emptyPipelineArtifacts(),
    renderSpecVersion: 2,
    aspectRatio: '9:16',
    keyframeSizeKey: '576x1024',
    finalDurationMode: 'match_audio',
    targetDurationSec: 60,
    segmentDurationSec: 5,
    plannedShots: 1,
    script: 'Narration text',
    scriptSourceStoryHash: hashText(story),
    scriptHash: hashText('Narration text'),
    shotHashes: [hashText('Shot 1')],
    shots: ['Shot 1'],
    timeline: [{ index: 0, startSec: 0, endSec: 5 }]
  };

  await writeProjectRunState(project, {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts,
    updatedAt: new Date().toISOString()
  });

  const job = createJob({
    project,
    story
  });

  const result = await runPipeline(job.id);
  assert.equal(result.status, 'completed');
  assert.equal(result.steps[JobStep.SCRIPT], true);
  assert.equal(result.steps[JobStep.COMPOSE], true);
  assert.equal(getProjectRunLockOwner(project), null);

  await cleanupProject(project);
});

test('runPipeline repairs missing local artifacts for reused voice/keyframes/segments', async () => {
  const project = uniqueProject('ut-orch-repair-resume');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-repair-'));
  const story = 'This is a sufficiently long story for resume repair branch coverage in orchestrator execution.';

  const repaired = {
    voiceover: 0,
    keyframes: 0,
    segments: 0,
    compose: 0
  };

  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      renderSpecVersion: 2,
      aspectRatio: '9:16',
      keyframeSizeKey: '576x1024',
      finalDurationMode: 'match_audio',
      targetDurationSec: 60,
      segmentDurationSec: 5,
      plannedShots: 3,
      script: 'Reused script text',
      scriptSourceStoryHash: hashText(story),
      scriptHash: hashText('Reused script text'),
      shotHashes: [hashText('Shot 1'), hashText('Shot 2'), hashText('Shot 3')],
      shots: ['Shot 1', 'Shot 2', 'Shot 3'],
      timeline: [{ durationSec: 5 }, { durationSec: 5 }],
      voiceoverUrl: 'https://replicate.delivery/voice.mp3',
      keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png', 'https://replicate.delivery/k3.png'],
      segmentUrls: ['https://replicate.delivery/s1.mp4', 'https://replicate.delivery/s2.mp4']
    },
    updatedAt: new Date().toISOString()
  };

  const job = createJob({
    project,
    story
  });

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => runState,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      persistVoiceover: async () => {
        repaired.voiceover += 1;
        return '/tmp/repaired-voice.mp3';
      },
      persistKeyframes: async () => {
        repaired.keyframes += 1;
        return ['/tmp/repaired-k1.png', '/tmp/repaired-k2.png', '/tmp/repaired-k3.png'];
      },
      persistSegments: async () => {
        repaired.segments += 1;
        return ['/tmp/repaired-s1.mp4', '/tmp/repaired-s2.mp4'];
      },
      composeFinalVideo: async () => {
        repaired.compose += 1;
        return {
          finalVideoPath: '/tmp/should-not-compose.mp4',
          voiceoverPath: '/tmp/should-not-compose-voice.mp3',
          keyframePaths: ['/tmp/should-not-compose-k1.png'],
          segmentPaths: ['/tmp/should-not-compose-s1.mp4']
        };
      },
      probeMediaDurationSeconds: async () => 10,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }]
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(repaired.voiceover, 1);
  assert.equal(repaired.keyframes, 1);
  assert.equal(repaired.segments, 1);
  assert.equal(repaired.compose, 0);
  assert.equal(result.artifacts.voiceoverPath, '/tmp/repaired-voice.mp3');
  assert.equal(result.artifacts.keyframePaths.length, 3);
  assert.equal(result.artifacts.segmentPaths.length, 2);
  assert.equal(getProjectRunLockOwner(project), null);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline partially regenerates changed shots from script asset and composes', async () => {
  const project = uniqueProject('ut-orch-partial-regen');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-partial-'));
  const story = 'This is a sufficiently long story used to validate partial regeneration of changed shots.';

  const artifacts = {
    ...emptyPipelineArtifacts(),
    renderSpecVersion: 2,
    aspectRatio: '9:16',
    keyframeSizeKey: '576x1024',
    finalDurationMode: 'match_audio',
    targetDurationSec: 60,
    segmentDurationSec: 5,
    plannedShots: 3,
    script: 'Narration text',
    scriptSourceStoryHash: hashText(story),
    scriptHash: hashText('Narration text'),
    shotHashes: [hashText('Shot 1'), hashText('Shot 2'), hashText('Shot 3')],
    shots: ['Shot 1', 'Shot 2', 'Shot 3'],
    tone: 'neutral',
    timeline: [{ durationSec: 5 }, { durationSec: 5 }],
    voiceoverUrl: 'https://replicate.delivery/voice.mp3',
    voiceoverPath: '/tmp/voice.mp3',
    keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png', 'https://replicate.delivery/k3.png'],
    keyframePaths: ['/tmp/k1.png', '/tmp/k2.png', '/tmp/k3.png'],
    segmentUrls: ['https://replicate.delivery/s1.mp4', 'https://replicate.delivery/s2.mp4'],
    segmentPaths: ['/tmp/s1.mp4', '/tmp/s2.mp4'],
    finalVideoPath: '/tmp/old-final.mp4'
  };

  await fs.mkdir(path.join(projectDir, 'assets', 'text'), { recursive: true });
  await fs.writeFile(
    path.join(projectDir, 'assets', 'text', 'script.json'),
    JSON.stringify({
      script: 'Narration text',
      shots: ['Shot 1', 'Shot 2 changed', 'Shot 3'],
      tone: 'neutral'
    }),
    'utf8'
  );

  const counts = {
    keyframe: 0,
    segment: 0,
    compose: 0
  };
  const activeStepSamples = {
    keyframes: [],
    segments: []
  };

  const job = createJob({
    project,
    story
  });

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts,
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      generateKeyframe: async (_shot, _tone, _aspectRatio, index) => {
        activeStepSamples.keyframes.push(getJob(job.id)?.payload?.activeStep || null);
        counts.keyframe += 1;
        return `https://replicate.delivery/new-k-${index}.png`;
      },
      persistKeyframe: async (_projectDir, _keyframeUrl, index) => `/tmp/new-k-${index}.png`,
      generateVideoSegmentAtIndex: async (segmentIndex) => {
        activeStepSamples.segments.push(getJob(job.id)?.payload?.activeStep || null);
        counts.segment += 1;
        return `https://replicate.delivery/new-s-${segmentIndex}.mp4`;
      },
      persistSegment: async (_projectDir, _segmentUrl, index) => `/tmp/new-s-${index}.mp4`,
      composeFinalVideo: async () => {
        counts.compose += 1;
        return {
          finalVideoPath: '/tmp/new-final.mp4',
          voiceoverPath: '/tmp/voice.mp3',
          keyframePaths: ['/tmp/new-k-0.png', '/tmp/new-k-1.png', '/tmp/new-k-2.png'],
          segmentPaths: ['/tmp/new-s-0.mp4', '/tmp/new-s-1.mp4']
        };
      },
      probeMediaDurationSeconds: async () => 10,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }]
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(counts.keyframe, 1);
  assert.equal(counts.segment, 2);
  assert.equal(counts.compose, 1);
  assert.deepEqual(activeStepSamples.keyframes, [JobStep.KEYFRAMES]);
  assert.deepEqual(activeStepSamples.segments, [JobStep.SEGMENTS, JobStep.SEGMENTS]);
  assert.deepEqual(result.payload.changedShotIndexes, []);
  assert.equal(result.payload.activeStep, null);
  assert.equal(result.artifacts.finalVideoPath, '/tmp/new-final.mp4');
  assert.equal(getProjectRunLockOwner(project), null);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline partial regen skips out-of-range changed shot indexes from hash length mismatch', async () => {
  const project = uniqueProject('ut-orch-partial-regen-out-of-range');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-partial-out-of-range-'));
  const story = 'This is a sufficiently long story used to validate partial regeneration branch handling for out-of-range changed indexes.';

  const artifacts = {
    ...emptyPipelineArtifacts(),
    renderSpecVersion: 2,
    aspectRatio: '9:16',
    keyframeSizeKey: '576x1024',
    finalDurationMode: 'match_audio',
    targetDurationSec: 60,
    segmentDurationSec: 5,
    plannedShots: 2,
    script: 'Narration text',
    scriptSourceStoryHash: hashText(story),
    scriptHash: hashText('Narration text'),
    shotHashes: [hashText('Shot 1'), hashText('Shot 2'), hashText('Shot 3')],
    shots: ['Shot 1', 'Shot 2', 'Shot 3'],
    tone: 'neutral',
    timeline: [{ durationSec: 5 }],
    voiceoverUrl: 'https://replicate.delivery/voice.mp3',
    voiceoverPath: '/tmp/voice.mp3',
    keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png', 'https://replicate.delivery/k3.png'],
    keyframePaths: ['/tmp/k1.png', '/tmp/k2.png', '/tmp/k3.png'],
    segmentUrls: ['https://replicate.delivery/s1.mp4', 'https://replicate.delivery/s2.mp4'],
    segmentPaths: ['/tmp/s1.mp4', '/tmp/s2.mp4'],
    finalVideoPath: '/tmp/old-final.mp4'
  };

  await fs.mkdir(path.join(projectDir, 'assets', 'text'), { recursive: true });
  await fs.writeFile(
    path.join(projectDir, 'assets', 'text', 'script.json'),
    JSON.stringify({
      script: 'Narration text',
      shots: ['Shot 1', 'Shot 2'],
      tone: 'neutral'
    }),
    'utf8'
  );

  const counts = {
    keyframe: 0,
    segment: 0,
    compose: 0
  };

  const job = createJob({
    project,
    story
  });

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts,
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      generateKeyframe: async () => {
        counts.keyframe += 1;
        return 'https://replicate.delivery/new-k-out-of-range.png';
      },
      persistKeyframe: async () => '/tmp/new-k-out-of-range.png',
      generateVideoSegmentAtIndex: async () => {
        counts.segment += 1;
        return 'https://replicate.delivery/new-s-out-of-range.mp4';
      },
      persistSegment: async () => '/tmp/new-s-out-of-range.mp4',
      composeFinalVideo: async () => {
        counts.compose += 1;
        return {
          finalVideoPath: '/tmp/new-final-out-of-range.mp4',
          voiceoverPath: '/tmp/voice.mp3',
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png', '/tmp/k3.png'],
          segmentPaths: ['/tmp/s1.mp4', '/tmp/s2.mp4']
        };
      },
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ durationSec: 5 }]
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(counts.keyframe, 0);
  assert.equal(counts.segment, 0);
  assert.equal(counts.compose, 1);
  assert.deepEqual(result.payload.changedShotIndexes, []);
  assert.equal(result.payload.activeStep, null);
  assert.equal(result.artifacts.finalVideoPath, '/tmp/new-final-out-of-range.mp4');
  assert.equal(getProjectRunLockOwner(project), null);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline continues when voiceover duration probe fails during alignment', async () => {
  const project = uniqueProject('ut-orch-probe-fail');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-probe-fail-'));
  const story = 'This story is long enough to validate graceful handling of audio probe failures in alignment.';

  const job = createJob({
    project,
    story
  });

  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 2,
          script: 'Narration',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2')],
          shots: ['Shot 1', 'Shot 2'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png'],
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => {
        throw new Error('ffprobe unavailable');
      }
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.steps[JobStep.COMPOSE], true);
  assert.equal(result.artifacts.finalVideoPath, '/tmp/final.mp4');
  assert.equal(getProjectRunLockOwner(project), null);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline alignment handles empty shots with positive and zero required segments', async () => {
  const project = uniqueProject('ut-orch-align-empty-shots');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-align-empty-'));
  const story = 'This story is long enough to exercise alignment branches for empty shots and segment count edge cases.';

  const runState = {
    status: 'completed',
    error: null,
    steps: allStepsTrue(),
    artifacts: {
      ...emptyPipelineArtifacts(),
      renderSpecVersion: 2,
      aspectRatio: '9:16',
      keyframeSizeKey: '576x1024',
      finalDurationMode: 'match_audio',
      targetDurationSec: 60,
      segmentDurationSec: 5,
      plannedShots: 0,
      script: 'Narration from prior state',
      scriptSourceStoryHash: hashText(story),
      scriptHash: hashText('Narration from prior state'),
      shotHashes: [],
      shots: [],
      timeline: [],
      voiceoverUrl: 'https://replicate.delivery/voice.mp3',
      voiceoverPath: '/tmp/voice.mp3'
    },
    updatedAt: new Date().toISOString()
  };

  const firstJob = createJob({ project, story });
  const first = await runPipeline(firstJob.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => runState,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 9,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }],
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Generated shot ${index + 1}`)
      }),
      generateKeyframe: async (_shot, _tone, _aspect, index) => `https://replicate.delivery/new-k-${index}.png`,
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/new-k-${index}.png`,
      generateVideoSegmentAtIndex: async (index) => `https://replicate.delivery/new-s-${index}.mp4`,
      persistSegment: async (_projectDir, _url, index) => `/tmp/new-s-${index}.mp4`,
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/new-final.mp4',
        voiceoverPath: '/tmp/voice.mp3',
        keyframePaths: ['/tmp/new-k-0.png', '/tmp/new-k-1.png', '/tmp/new-k-2.png'],
        segmentPaths: ['/tmp/new-s-0.mp4', '/tmp/new-s-1.mp4']
      })
    }
  });

  assert.equal(first.status, 'completed');
  assert.equal(first.artifacts.shots.length, 3);
  assert.equal(first.artifacts.shots[0], 'Generated shot 1');
  assert.equal(first.artifacts.shots[1], 'Generated shot 2');
  assert.equal(first.artifacts.shots[2], 'Generated shot 3');

  const secondJob = createJob({ project, story });
  const second = await runPipeline(secondJob.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => runState,
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 9,
      resolveSegmentCountFromAudioDuration: () => 0,
      buildFixedTimeline: () => [],
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Generated shot ${index + 1}`)
      }),
      generateKeyframe: async (_shot, _tone, _aspect, index) => `https://replicate.delivery/zero-k-${index}.png`,
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/zero-k-${index}.png`,
      generateVideoSegmentAtIndex: async (index) => `https://replicate.delivery/zero-s-${index}.mp4`,
      persistSegment: async (_projectDir, _url, index) => `/tmp/zero-s-${index}.mp4`,
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/zero-final.mp4',
        voiceoverPath: '/tmp/voice.mp3',
        keyframePaths: ['/tmp/zero-k-0.png', '/tmp/zero-k-1.png'],
        segmentPaths: ['/tmp/zero-s-0.mp4']
      })
    }
  });

  assert.equal(second.status, 'completed');
  assert.deepEqual(second.artifacts.shots, ['Generated shot 1', 'Generated shot 2']);
  assert.equal(getProjectRunLockOwner(project), null);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline alignment trims and extends shots to match required segment count', async () => {
  const trimProject = uniqueProject('ut-orch-align-trim');
  const trimProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-align-trim-'));
  const story = 'This story is long enough to validate alignShotsToCount trim and extend branch behavior.';

  const trimJob = createJob({ project: trimProject, story });
  const trimResult = await runPipeline(trimJob.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => trimProjectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 3,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2'), hashText('Shot 3')],
          shots: ['Shot 1', 'Shot 2', 'Shot 3'],
          timeline: [{ durationSec: 5 }, { durationSec: 5 }, { durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png', 'https://replicate.delivery/k3.png'],
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png', '/tmp/k3.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4', 'https://replicate.delivery/s2.mp4', 'https://replicate.delivery/s3.mp4'],
          segmentPaths: ['/tmp/s1.mp4', '/tmp/s2.mp4', '/tmp/s3.mp4'],
          finalVideoPath: '/tmp/old-final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 9,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }],
      generateKeyframe: async (_shot, _tone, _aspect, index) => `https://replicate.delivery/new-k-${index}.png`,
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/new-k-${index}.png`,
      generateVideoSegmentAtIndex: async (index) => `https://replicate.delivery/new-s-${index}.mp4`,
      persistSegment: async (_projectDir, _url, index) => `/tmp/new-s-${index}.mp4`,
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/new-final-trim.mp4',
        voiceoverPath: '/tmp/voice.mp3',
        keyframePaths: ['/tmp/new-k-0.png', '/tmp/new-k-1.png', '/tmp/new-k-2.png'],
        segmentPaths: ['/tmp/new-s-0.mp4', '/tmp/new-s-1.mp4']
      })
    }
  });

  assert.equal(trimResult.status, 'completed');
  assert.deepEqual(trimResult.artifacts.shots, ['Shot 1', 'Shot 2', 'Shot 3']);

  const extendProject = uniqueProject('ut-orch-align-extend');
  const extendProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-align-extend-'));
  const generatedShots = [];

  const extendJob = createJob({ project: extendProject, story });
  const extendResult = await runPipeline(extendJob.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => extendProjectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 2,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Only shot')],
          shots: ['Only shot'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png'],
          keyframePaths: ['/tmp/k1.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/old-final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 14,
      resolveSegmentCountFromAudioDuration: () => 3,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }, { durationSec: 5 }],
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Expanded shot ${index + 1}`)
      }),
      generateKeyframe: async (shot, _tone, _aspect, index) => {
        generatedShots.push(shot);
        return `https://replicate.delivery/new-k-${index}.png`;
      },
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/new-k-${index}.png`,
      generateVideoSegmentAtIndex: async (index) => `https://replicate.delivery/new-s-${index}.mp4`,
      persistSegment: async (_projectDir, _url, index) => `/tmp/new-s-${index}.mp4`,
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/new-final-extend.mp4',
        voiceoverPath: '/tmp/voice.mp3',
        keyframePaths: ['/tmp/new-k-0.png', '/tmp/new-k-1.png', '/tmp/new-k-2.png', '/tmp/new-k-3.png'],
        segmentPaths: ['/tmp/new-s-0.mp4', '/tmp/new-s-1.mp4', '/tmp/new-s-2.mp4']
      })
    }
  });

  assert.equal(extendResult.status, 'completed');
  assert.deepEqual(extendResult.artifacts.shots, [
    'Expanded shot 1',
    'Expanded shot 2',
    'Expanded shot 3',
    'Expanded shot 4'
  ]);
  assert.deepEqual(generatedShots, [
    'Expanded shot 1',
    'Expanded shot 2',
    'Expanded shot 3',
    'Expanded shot 4'
  ]);

  await fs.rm(trimProjectDir, { recursive: true, force: true });
  await fs.rm(extendProjectDir, { recursive: true, force: true });
});

test('runPipeline ignores invalid script asset JSON shape during resume', async () => {
  const project = uniqueProject('ut-orch-invalid-script-asset');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-invalid-script-'));
  const story = 'This story is long enough to validate invalid script asset handling during resume orchestration.';

  await fs.mkdir(path.join(projectDir, 'assets', 'text'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'assets', 'text', 'script.json'), JSON.stringify({ bad: true }), 'utf8');

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 1,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2')],
          shots: ['Shot 1', 'Shot 2'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png'],
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ durationSec: 5 }]
    }
  });

  assert.equal(result.steps[JobStep.SCRIPT], true);
  assert.equal(result.artifacts.finalVideoPath, '/tmp/final.mp4');
  assert.equal(getProjectRunLockOwner(project), null);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline fails when script asset JSON is malformed during resume', async () => {
  const project = uniqueProject('ut-orch-malformed-script-asset');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-malformed-script-'));
  const story = 'This story is long enough to validate malformed script asset JSON branch behavior.';

  await fs.mkdir(path.join(projectDir, 'assets', 'text'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'assets', 'text', 'script.json'), '{broken-json', 'utf8');

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 2,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2')],
          shots: ['Shot 1', 'Shot 2'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png'],
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => []
    }
  });

  assert.equal(result.status, 'failed');
  assert.match(result.error, /Unexpected token|JSON/);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline throws when job id does not exist', async () => {
  await assert.rejects(
    runPipeline('missing-job-id-123'),
    /Job not found/
  );
});

test('runPipeline handles non-object script asset payload as absent data', async () => {
  const project = uniqueProject('ut-orch-non-object-script-asset');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-non-object-script-'));
  const story = 'This story is long enough to validate non-object script asset handling in runPipeline.';

  await fs.mkdir(path.join(projectDir, 'assets', 'text'), { recursive: true });
  await fs.writeFile(path.join(projectDir, 'assets', 'text', 'script.json'), 'null', 'utf8');

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 1,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Shot 1')],
          shots: ['Shot 1'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png'],
          keyframePaths: ['/tmp/k1.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => []
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.steps[JobStep.SCRIPT], true);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline alignment returns early when visual plan is already aligned', async () => {
  const project = uniqueProject('ut-orch-aligned-noop');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-aligned-noop-'));
  const story = 'This story is long enough to validate no-op alignment branch behavior in orchestrator.';

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 3,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2'), hashText('Shot 3')],
          shots: ['Shot 1', 'Shot 2', 'Shot 3'],
          timeline: [{ durationSec: 5 }, { durationSec: 5 }],
          audioDurationSec: 10,
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png', 'https://replicate.delivery/k3.png'],
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png', '/tmp/k3.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4', 'https://replicate.delivery/s2.mp4'],
          segmentPaths: ['/tmp/s1.mp4', '/tmp/s2.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 10,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }]
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.artifacts.finalVideoPath, '/tmp/final.mp4');

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline alignment invalidates segments when timeline changes but shots remain same', async () => {
  const project = uniqueProject('ut-orch-timeline-change');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-timeline-change-'));
  const story = 'This story is long enough to validate timeline-only alignment branch behavior.';

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 3,
          script: 'Narration from prior state',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Narration from prior state'),
          shotHashes: [hashText('Shot 1'), hashText('Shot 2'), hashText('Shot 3')],
          shots: ['Shot 1', 'Shot 2', 'Shot 3'],
          timeline: [{ durationSec: 4 }, { durationSec: 4 }],
          audioDurationSec: 10,
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png', 'https://replicate.delivery/k2.png', 'https://replicate.delivery/k3.png'],
          keyframePaths: ['/tmp/k1.png', '/tmp/k2.png', '/tmp/k3.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4', 'https://replicate.delivery/s2.mp4'],
          segmentPaths: ['/tmp/s1.mp4', '/tmp/s2.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      probeMediaDurationSeconds: async () => 10,
      resolveSegmentCountFromAudioDuration: () => 2,
      buildFixedTimeline: () => [{ durationSec: 5 }, { durationSec: 5 }],
      generateVideoSegmentAtIndex: async (index) => `https://replicate.delivery/timeline-seg-${index}.mp4`,
      persistSegment: async (_projectDir, _url, index) => `/tmp/new-s${index + 1}.mp4`,
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/final-updated.mp4',
        voiceoverPath: '/tmp/voice.mp3',
        keyframePaths: ['/tmp/k1.png', '/tmp/k2.png'],
        segmentPaths: ['/tmp/new-s1.mp4', '/tmp/new-s2.mp4']
      }),
      persistSegments: async () => ['/tmp/new-s1.mp4', '/tmp/new-s2.mp4']
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.steps[JobStep.SEGMENTS], true);
  assert.equal(result.steps[JobStep.COMPOSE], true);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline invalidates legacy resume state without script source hash', async () => {
  const project = uniqueProject('ut-orch-legacy-reset');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-legacy-reset-'));
  const story = 'This story is long enough to validate legacy resume state invalidation behavior.';

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 1,
          script: 'Legacy script without source hash',
          scriptHash: hashText('Legacy script without source hash'),
          shotHashes: [hashText('Legacy shot')],
          shots: ['Legacy shot'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png'],
          keyframePaths: ['/tmp/k1.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/legacy-final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      generateScript: async () => ({
        script: 'Regenerated script',
        tone: 'neutral',
        scriptWordCount: 10,
        targetWordCount: 10
      }),
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Shot ${index + 1}`)
      }),
      generateVoiceover: async () => ({
        timeline: [{ durationSec: 5 }],
        voiceoverUrl: 'https://replicate.delivery/new-voice.mp3',
        ttsPlan: { speed: 1 }
      }),
      persistVoiceover: async () => '/tmp/new-voice.mp3',
      generateKeyframe: async () => 'https://replicate.delivery/new-k1.png',
      persistKeyframe: async () => '/tmp/new-k1.png',
      generateVideoSegmentAtIndex: async () => 'https://replicate.delivery/new-s1.mp4',
      persistSegment: async () => '/tmp/new-s1.mp4',
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/new-final.mp4',
        voiceoverPath: '/tmp/new-voice.mp3',
        keyframePaths: ['/tmp/new-k1.png'],
        segmentPaths: ['/tmp/new-s1.mp4']
      }),
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ durationSec: 5 }]
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.artifacts.script, 'Regenerated script');
  assert.equal(result.artifacts.scriptSourceStoryHash.length > 0, true);

  await fs.rm(projectDir, { recursive: true, force: true });
});

test('runPipeline invalidates voice/segments when script asset hash changes', async () => {
  const project = uniqueProject('ut-orch-script-hash-change');
  const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-orch-script-hash-change-'));
  const story = 'This story is long enough to validate script-hash mismatch branch behavior.';

  await fs.mkdir(path.join(projectDir, 'assets', 'text'), { recursive: true });
  await fs.writeFile(
    path.join(projectDir, 'assets', 'text', 'script.json'),
    JSON.stringify({ script: 'Updated script from asset', shots: ['Shot A'], tone: 'neutral' }),
    'utf8'
  );

  const job = createJob({ project, story });
  const result = await runPipeline(job.id, {
    deps: {
      ensureProject: async () => {},
      readProjectConfig: async () => ({
        aspectRatio: '9:16',
        targetDurationSec: 60,
        finalDurationMode: 'match_audio'
      }),
      getProjectDir: () => projectDir,
      readProjectRunState: async () => ({
        status: 'completed',
        error: null,
        steps: allStepsTrue(),
        artifacts: {
          ...emptyPipelineArtifacts(),
          renderSpecVersion: 2,
          aspectRatio: '9:16',
          keyframeSizeKey: '576x1024',
          finalDurationMode: 'match_audio',
          targetDurationSec: 60,
          segmentDurationSec: 5,
          plannedShots: 1,
          script: 'Old script value',
          scriptSourceStoryHash: hashText(story),
          scriptHash: hashText('Different previous hash'),
          shotHashes: [hashText('Shot A')],
          shots: ['Shot A'],
          timeline: [{ durationSec: 5 }],
          voiceoverUrl: 'https://replicate.delivery/voice.mp3',
          voiceoverPath: '/tmp/voice.mp3',
          keyframeUrls: ['https://replicate.delivery/k1.png'],
          keyframePaths: ['/tmp/k1.png'],
          segmentUrls: ['https://replicate.delivery/s1.mp4'],
          segmentPaths: ['/tmp/s1.mp4'],
          finalVideoPath: '/tmp/final.mp4'
        },
        updatedAt: new Date().toISOString()
      }),
      persistArtifacts: async () => {},
      writeProjectRunState: async () => {},
      syncProjectSnapshot: async () => {},
      writeRunRecord: async () => {},
      collectRunPredictions: async () => [],
      generateVoiceover: async () => ({
        timeline: [{ durationSec: 5 }],
        voiceoverUrl: 'https://replicate.delivery/new-voice.mp3',
        ttsPlan: { speed: 1 }
      }),
      generateShots: async (_script, { shotCount }) => ({
        shots: Array.from({ length: shotCount }, (_value, index) => `Shot ${index + 1}`)
      }),
      persistVoiceover: async () => '/tmp/new-voice.mp3',
      generateKeyframe: async (_shot, _tone, _aspect, index) => `https://replicate.delivery/new-k${index + 1}.png`,
      persistKeyframe: async (_projectDir, _url, index) => `/tmp/new-k${index + 1}.png`,
      generateVideoSegmentAtIndex: async () => 'https://replicate.delivery/new-s1.mp4',
      persistSegment: async () => '/tmp/new-s1.mp4',
      composeFinalVideo: async () => ({
        finalVideoPath: '/tmp/new-final.mp4',
        voiceoverPath: '/tmp/new-voice.mp3',
        keyframePaths: ['/tmp/new-k1.png', '/tmp/new-k2.png'],
        segmentPaths: ['/tmp/new-s1.mp4']
      }),
      probeMediaDurationSeconds: async () => 5,
      resolveSegmentCountFromAudioDuration: () => 1,
      buildFixedTimeline: () => [{ durationSec: 5 }]
    }
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.artifacts.script, 'Updated script from asset');

  await fs.rm(projectDir, { recursive: true, force: true });
});
