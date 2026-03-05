import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { ensureDir } from './files.js';

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.ffmpegBin, args, { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error((stderr || `Command failed with exit code ${code}`).trim()));
      }
    });
  });
}

export async function concatSegments(segmentPaths, outputPath, options = {}) {
  const runFfmpegFn = options.runFfmpeg || runFfmpeg;
  const ensureDirFn = options.ensureDir || ensureDir;
  const writeFileFn = options.writeFile || fs.writeFile;

  const listFilePath = path.join(path.dirname(outputPath), 'segments.txt');
  const listContent = segmentPaths.map((segment) => `file '${path.resolve(segment)}'`).join('\n');
  await ensureDirFn(path.dirname(outputPath));
  await writeFileFn(listFilePath, listContent, 'utf8');

  await runFfmpegFn([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFilePath,
    '-c',
    'copy',
    outputPath
  ]);
}

export async function muxVoiceover(videoPath, audioPath, outputPath, options = {}) {
  const trimToAudio = options.trimToAudio !== false;
  const runFfmpegFn = options.runFfmpeg || runFfmpeg;
  const args = [
    '-y',
    '-i',
    videoPath,
    '-i',
    audioPath,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    '-c:a',
    'aac'
  ];

  if (trimToAudio) {
    args.push('-shortest');
  }

  args.push(outputPath);
  await runFfmpegFn(args);
}

export async function probeMediaDurationSeconds(mediaPath, options = {}) {
  const runCaptureFn = options.runCapture || runCapture;
  const output = await runCaptureFn(env.ffprobeBin, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    mediaPath
  ]);

  const parsed = Number.parseFloat(output);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Unable to determine media duration for ${mediaPath}`);
  }

  return parsed;
}
