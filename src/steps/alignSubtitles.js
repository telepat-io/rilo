import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { ensureDir } from '../media/files.js';
import { parseSrtCues, writeSeedSrtFromScript, writeAssFromSrt } from '../media/subtitles.js';

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error((stderr || `${command} exited with code ${code}`).trim()));
      }
    });
  });
}

function normalizeCueText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatSrtTimestamp(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function serializeSrtCues(cues) {
  return cues.map((cue, index) => {
    return `${index + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text}`;
  }).join('\n\n');
}

function restoreDroppedLeadingCues(seedCues, alignedCues) {
  if (!Array.isArray(seedCues) || !Array.isArray(alignedCues) || !alignedCues.length || alignedCues.length >= seedCues.length) {
    return alignedCues;
  }

  const firstAligned = alignedCues[0];
  const firstAlignedText = normalizeCueText(firstAligned.text);
  if (!firstAlignedText) {
    return alignedCues;
  }

  const firstSeedMatchIndex = seedCues.findIndex((cue) => normalizeCueText(cue.text) === firstAlignedText);
  if (firstSeedMatchIndex <= 0) {
    return alignedCues;
  }

  const shiftMs = firstAligned.startMs - seedCues[firstSeedMatchIndex].startMs;
  const recoveredLeading = seedCues.slice(0, firstSeedMatchIndex).map((cue) => {
    const shiftedStartMs = cue.startMs + shiftMs;
    const shiftedEndMs = cue.endMs + shiftMs;
    const startMs = Math.max(0, shiftedStartMs);
    const endMs = Math.max(startMs + 120, shiftedEndMs);
    return {
      startMs,
      endMs,
      text: cue.text
    };
  });

  return [...recoveredLeading, ...alignedCues];
}

async function reconcileAlignedSrt(seedSrtPath, alignedSrtPath, deps = {}) {
  const readFileFn = deps.readFile || fs.readFile;
  const writeFileFn = deps.writeFile || fs.writeFile;

  const [seedRaw, alignedRaw] = await Promise.all([
    readFileFn(seedSrtPath, 'utf8'),
    readFileFn(alignedSrtPath, 'utf8')
  ]);

  const seedCues = parseSrtCues(seedRaw);
  const alignedCues = parseSrtCues(alignedRaw);

  if (!seedCues.length || !alignedCues.length) {
    return;
  }

  const reconciled = restoreDroppedLeadingCues(seedCues, alignedCues);
  if (reconciled.length === alignedCues.length) {
    return;
  }

  await writeFileFn(alignedSrtPath, `${serializeSrtCues(reconciled)}\n`, 'utf8');
}

export async function alignSubtitlesToVideo({
  projectDir,
  videoPath,
  script,
  totalDurationSec,
  subtitleOptions,
  deps = {}
}) {
  const ensureDirFn = deps.ensureDir || ensureDir;
  const runCommandFn = deps.runCommand || runCommand;
  const reconcileAlignedSrtFn = deps.reconcileAlignedSrt || reconcileAlignedSrt;
  const writeSeedSrtFn = deps.writeSeedSrtFromScript || writeSeedSrtFromScript;
  const writeAssFromSrtFn = deps.writeAssFromSrt || writeAssFromSrt;

  if (!script || !String(script).trim()) {
    throw new Error('Cannot align subtitles: script is empty');
  }

  const subtitlesDir = path.join(projectDir, 'assets', 'subtitles');
  await ensureDirFn(subtitlesDir);

  const seedSrtPath = path.join(subtitlesDir, 'seed.srt');
  const alignedSrtPath = path.join(subtitlesDir, 'aligned.srt');
  const alignedAssPath = path.join(subtitlesDir, 'aligned.ass');

  await writeSeedSrtFn({
    script,
    totalDurationSec,
    outputPath: seedSrtPath,
    maxWordsPerLine: subtitleOptions?.maxWordsPerLine
  });

  await runCommandFn(env.ffsubsyncBin, [
    videoPath,
    '-i',
    seedSrtPath,
    '-o',
    alignedSrtPath
  ]);

  await reconcileAlignedSrtFn(seedSrtPath, alignedSrtPath, deps);

  await writeAssFromSrtFn({
    sourceSrtPath: alignedSrtPath,
    outputAssPath: alignedAssPath,
    subtitleOptions
  });

  return {
    subtitleSeedPath: seedSrtPath,
    subtitleAlignedSrtPath: alignedSrtPath,
    subtitleAssPath: alignedAssPath
  };
}
