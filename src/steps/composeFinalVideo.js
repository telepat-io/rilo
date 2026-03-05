import path from 'node:path';
import { concatSegments, muxVoiceover } from '../media/ffmpeg.js';
import { downloadToFile, ensureDir } from '../media/files.js';

export async function composeFinalVideo({
  projectDir,
  segmentUrls,
  segmentPaths = [],
  voiceoverPath = '',
  voiceoverUrl,
  keyframePaths = [],
  finalDurationMode = 'match_audio',
  deps = {}
}) {
  const ensureDirFn = deps.ensureDir || ensureDir;
  const downloadToFileFn = deps.downloadToFile || downloadToFile;
  const concatSegmentsFn = deps.concatSegments || concatSegments;
  const muxVoiceoverFn = deps.muxVoiceover || muxVoiceover;

  const assetsDir = path.join(projectDir, 'assets');
  const segmentsDir = path.join(assetsDir, 'segments');
  const audioDir = path.join(assetsDir, 'audio');
  await ensureDirFn(segmentsDir);
  await ensureDirFn(audioDir);

  const localSegmentPaths = [];
  if (segmentPaths.length === segmentUrls.length && segmentPaths.length > 0) {
    localSegmentPaths.push(...segmentPaths);
  } else {
    for (let i = 0; i < segmentUrls.length; i += 1) {
      const segmentPath = path.join(segmentsDir, `segment_${String(i + 1).padStart(2, '0')}.mp4`);
      await downloadToFileFn(segmentUrls[i], segmentPath);
      localSegmentPaths.push(segmentPath);
    }
  }

  let voicePath = voiceoverPath;
  if (!voicePath) {
    voicePath = path.join(audioDir, 'voiceover.mp3');
    await downloadToFileFn(voiceoverUrl, voicePath);
  }

  const concatPath = path.join(assetsDir, 'video_concat.mp4');
  const finalPath = path.join(projectDir, 'final.mp4');

  await concatSegmentsFn(localSegmentPaths, concatPath);
  await muxVoiceoverFn(concatPath, voicePath, finalPath, {
    trimToAudio: finalDurationMode !== 'match_visual'
  });

  return {
    finalVideoPath: finalPath,
    keyframePaths,
    segmentPaths: localSegmentPaths,
    voiceoverPath: voicePath
  };
}
