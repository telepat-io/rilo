import path from 'node:path';
import { burnInAssSubtitles } from '../media/ffmpeg.js';

export async function burnInSubtitles({
  projectDir,
  videoPath,
  subtitleAssPath,
  deps = {}
}) {
  const burnInAssSubtitlesFn = deps.burnInAssSubtitles || burnInAssSubtitles;

  if (!subtitleAssPath) {
    throw new Error('Cannot burn subtitles: subtitle ASS path is missing');
  }

  const outputPath = path.join(projectDir, 'final_captioned.mp4');
  await burnInAssSubtitlesFn(videoPath, subtitleAssPath, outputPath);

  return {
    finalCaptionedVideoPath: outputPath
  };
}
