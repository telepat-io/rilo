import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir } from './files.js';

const ASS_ALIGNMENT_BY_POSITION = {
  top: 8,
  center: 5,
  bottom: 2
};

const SUBTITLE_HIGHLIGHT_MODE = {
  SPOKEN_UPCOMING: 'spoken_upcoming',
  CURRENT_ONLY: 'current_only'
};

function toMilliseconds(totalSeconds) {
  return Math.max(0, Math.round(Number(totalSeconds || 0) * 1000));
}

function pad(value, size) {
  return String(value).padStart(size, '0');
}

function formatSrtTimestamp(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

function formatAssTimestamp(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);
  return `${hours}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}`;
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function stripTrailingDot(text) {
  return normalizeWhitespace(text).replace(/\.$/, '');
}

function splitIntoSentences(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const sentenceMatches = normalized.match(/[^.!?]+[.!?]+(?:['")\]]+)?|[^.!?]+$/g) || [];
  return sentenceMatches
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(Boolean);
}

function splitScriptIntoLines(script, maxWordsPerLine = 7) {
  const safeMaxWords = Number.isInteger(maxWordsPerLine) && maxWordsPerLine > 0 ? maxWordsPerLine : 7;
  const sentences = splitIntoSentences(script);
  const chunks = [];

  for (const sentence of sentences) {
    const words = sentence.split(' ').filter(Boolean);
    if (words.length <= safeMaxWords) {
      chunks.push(sentence);
      continue;
    }

    for (let index = 0; index < words.length; index += safeMaxWords) {
      chunks.push(words.slice(index, index + safeMaxWords).join(' '));
    }
  }

  return chunks;
}

function estimateLineDurations(lines, totalDurationSec) {
  const totalDurationMs = Math.max(1000, toMilliseconds(totalDurationSec));
  if (!lines.length) {
    return [];
  }

  const weights = lines.map((line) => Math.max(1, normalizeWhitespace(line).length));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);

  let cursor = 0;
  return lines.map((line, idx) => {
    const isLast = idx === lines.length - 1;
    const durationMs = isLast
      ? Math.max(300, totalDurationMs - cursor)
      : Math.max(300, Math.round((weights[idx] / weightTotal) * totalDurationMs));
    const startMs = cursor;
    const endMs = Math.min(totalDurationMs, cursor + durationMs);
    cursor = endMs;
    return {
      index: idx + 1,
      startMs,
      endMs,
      text: stripTrailingDot(line)
    };
  });
}

export async function writeSeedSrtFromScript({
  script,
  totalDurationSec,
  outputPath,
  maxWordsPerLine = 7,
  deps = {}
}) {
  const ensureDirFn = deps.ensureDir || ensureDir;
  const writeFileFn = deps.writeFile || fs.writeFile;

  const lines = splitScriptIntoLines(script, maxWordsPerLine);
  const cues = estimateLineDurations(lines, totalDurationSec);

  const payload = cues.map((cue) => {
    return `${cue.index}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text}`;
  }).join('\n\n');

  await ensureDirFn(path.dirname(outputPath));
  await writeFileFn(outputPath, `${payload}\n`, 'utf8');

  return {
    cueCount: cues.length,
    outputPath
  };
}

export function parseSrtCues(rawSrt) {
  const normalized = String(rawSrt || '').replace(/\r/g, '');
  const blocks = normalized.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) {
      continue;
    }

    const timelineLine = lines.find((line) => line.includes('-->'));
    if (!timelineLine) {
      continue;
    }

    const [startRaw, endRaw] = timelineLine.split('-->').map((part) => part.trim());
    const textLines = lines.slice(lines.indexOf(timelineLine) + 1);
    const text = normalizeWhitespace(textLines.join(' '));

    const startMs = parseSrtTimestamp(startRaw);
    const endMs = parseSrtTimestamp(endRaw);
    if (startMs === null || endMs === null || endMs <= startMs || !text) {
      continue;
    }

    cues.push({ startMs, endMs, text });
  }

  return cues;
}

function parseSrtTimestamp(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/);
  if (!match) {
    return null;
  }

  const [, hh, mm, ss, ms] = match;
  return (
    Number(hh) * 3600000
    + Number(mm) * 60000
    + Number(ss) * 1000
    + Number(ms)
  );
}

function escapeAssText(text) {
  return String(text || '').replace(/[{}]/g, '').replace(/\n/g, '\\N');
}

function applyTextCase(text, subtitleOptions = {}) {
  const normalized = String(text || '');
  if (subtitleOptions.makeUppercase === true) {
    return normalized.toUpperCase();
  }
  return normalized;
}

function hexToAssBgr(hexColor) {
  return hexToAssAbgr(hexColor, 0);
}

function hexToAssAbgr(hexColor, alpha = 0) {
  const normalized = String(hexColor || '').trim().replace(/^#/, '');
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(255, Math.round(alpha))) : 0;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return '&H00FFFFFF';
  }

  const r = normalized.slice(0, 2);
  const g = normalized.slice(2, 4);
  const b = normalized.slice(4, 6);
  return `&H${safeAlpha.toString(16).padStart(2, '0')}${b}${g}${r}`.toUpperCase();
}


function splitWordsIntoDisplayLines(words, maxLines = 2) {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const safeMaxLines = Number.isInteger(maxLines) && maxLines > 0 ? maxLines : 2;
  const lineCount = Math.max(1, Math.min(safeMaxLines, words.length));
  const baseSize = Math.floor(words.length / lineCount);
  let remainder = words.length % lineCount;

  const lines = [];
  let cursor = 0;
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const currentSize = baseSize + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    lines.push(words.slice(cursor, cursor + currentSize));
    cursor += currentSize;
  }

  return lines.filter((line) => line.length > 0);
}

function buildKaraokeText(text, cueDurationMs, subtitleOptions = {}) {
  const words = applyTextCase(text, subtitleOptions).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '';
  }

  const highlightMode = subtitleOptions.highlightMode || SUBTITLE_HIGHLIGHT_MODE.SPOKEN_UPCOMING;
  const baseColor = hexToAssBgr(subtitleOptions.primaryColor);
  const activeColor = hexToAssBgr(subtitleOptions.activeColor);

  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, '').length || word.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let allocatedCentis = 0;
  const totalCentis = Math.max(1, Math.round(cueDurationMs / 10));

  const timedWords = words.map((word, index) => {
    const isLast = index === words.length - 1;
    const portion = isLast
      ? Math.max(1, totalCentis - allocatedCentis)
      : Math.max(1, Math.round((weights[index] / totalWeight) * totalCentis));
    allocatedCentis += portion;

    if (highlightMode === SUBTITLE_HIGHLIGHT_MODE.CURRENT_ONLY) {
      return `{\\2c${activeColor}\\k${portion}}${escapeAssText(word)}{\\2c${baseColor}}`;
    }

    return `{\\k${portion}}${escapeAssText(word)}`;
  });

  const lines = splitWordsIntoDisplayLines(timedWords, subtitleOptions.maxLines);
  return lines.map((lineWords) => lineWords.join(' ')).join('\\N');
}

function calculateWordTimingPortions(words, cueDurationMs) {
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, '').length || word.length));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let allocatedCentis = 0;
  const totalCentis = Math.max(1, Math.round(cueDurationMs / 10));

  return words.map((_, index) => {
    const isLast = index === words.length - 1;
    const portion = isLast
      ? Math.max(1, totalCentis - allocatedCentis)
      : Math.max(1, Math.round((weights[index] / totalWeight) * totalCentis));
    allocatedCentis += portion;
    return portion;
  });
}

function buildCurrentWordOnlyEvents(text, cueDurationMs, subtitleOptions = {}) {
  const words = applyTextCase(text, subtitleOptions).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [];
  }

  const portions = calculateWordTimingPortions(words, cueDurationMs);
  const baseColor = hexToAssBgr(subtitleOptions.primaryColor);
  const activeColor = hexToAssBgr(subtitleOptions.activeColor);
  const lines = splitWordsIntoDisplayLines(words, subtitleOptions.maxLines);

  let globalWordIndex = 0;
  const lineWordIndexes = lines.map((line) => {
    const indexes = line.map(() => {
      const current = globalWordIndex;
      globalWordIndex += 1;
      return current;
    });
    return indexes;
  });

  const events = [];
  let cursorMs = 0;

  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const durationMs = Math.max(10, portions[wordIndex] * 10);
    const startMs = cursorMs;
    const endMs = startMs + durationMs;
    cursorMs = endMs;

    const linesText = lines.map((lineWords, lineIndex) => {
      const wordIndexes = lineWordIndexes[lineIndex];
      return lineWords.map((word, inLineIndex) => {
        const thisWordIndex = wordIndexes[inLineIndex];
        const escaped = escapeAssText(word);
        if (thisWordIndex === wordIndex) {
          return `{\\1c${activeColor}}${escaped}{\\1c${baseColor}}`;
        }
        return escaped;
      }).join(' ');
    });

    events.push({
      startOffsetMs: startMs,
      endOffsetMs: endMs,
      text: linesText.join('\\N')
    });
  }

  return events;
}

function toAssStyle(subtitleOptions = {}) {
  const position = subtitleOptions.position || 'center';
  const highlightMode = subtitleOptions.highlightMode || SUBTITLE_HIGHLIGHT_MODE.SPOKEN_UPCOMING;
  const alignment = ASS_ALIGNMENT_BY_POSITION[position] || ASS_ALIGNMENT_BY_POSITION.bottom;
  const primaryColor = hexToAssBgr(subtitleOptions.primaryColor);
  const activeColor = hexToAssBgr(subtitleOptions.activeColor);
  const secondaryColor = highlightMode === SUBTITLE_HIGHLIGHT_MODE.CURRENT_ONLY ? primaryColor : activeColor;
  const backgroundEnabled = subtitleOptions.backgroundEnabled === true;
  const opacity = typeof subtitleOptions.backgroundOpacity === 'number' && Number.isFinite(subtitleOptions.backgroundOpacity)
    ? Math.max(0, Math.min(0.85, subtitleOptions.backgroundOpacity))
    : 0.45;
  const backgroundAlpha = Math.round((1 - opacity) * 255);
  const backgroundAssColor = hexToAssAbgr(subtitleOptions.backgroundColor, backgroundAlpha);
  const requestedOutline = Number.isInteger(subtitleOptions.outline) ? subtitleOptions.outline : 3;
  // BorderStyle=3 uses Outline as box padding; multi-line events can stack boxes and darken overlaps.
  const effectiveOutline = backgroundEnabled && (subtitleOptions.maxLines || 2) > 1
    ? 1
    : requestedOutline;
  const outlineColor = backgroundEnabled
    ? backgroundAssColor
    : hexToAssBgr(subtitleOptions.outlineColor);
  const backColor = backgroundEnabled
    ? backgroundAssColor
    : hexToAssAbgr(subtitleOptions.backgroundColor, backgroundAlpha);

  return {
    name: 'Karaoke',
    fontName: subtitleOptions.fontName || 'Poppins',
    fontSize: Number.isInteger(subtitleOptions.fontSize) ? subtitleOptions.fontSize : 58,
    primaryColor,
    secondaryColor,
    outlineColor,
    backColor,
    marginV: Number.isInteger(subtitleOptions.marginV) ? subtitleOptions.marginV : 70,
    outline: effectiveOutline,
    shadow: Number.isInteger(subtitleOptions.shadow) ? subtitleOptions.shadow : 0,
    alignment,
    bold: subtitleOptions.bold !== false,
    italic: subtitleOptions.italic === true,
    borderStyle: backgroundEnabled ? 3 : 1
  };
}

export function renderAssFromCues(cues, subtitleOptions = {}) {
  const style = toAssStyle(subtitleOptions);
  const highlightMode = subtitleOptions.highlightMode || SUBTITLE_HIGHLIGHT_MODE.SPOKEN_UPCOMING;
  const assHeader = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'Collisions: Normal',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${style.name},${style.fontName},${style.fontSize},${style.primaryColor},${style.secondaryColor},${style.outlineColor},${style.backColor},${style.bold ? 1 : 0},${style.italic ? 1 : 0},0,0,100,100,0,0,${style.borderStyle},${style.outline},${style.shadow},${style.alignment},60,60,${style.marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
  ];

  const assEvents = [];

  for (const cue of cues) {
    if (highlightMode === SUBTITLE_HIGHLIGHT_MODE.CURRENT_ONLY) {
      const timedEvents = buildCurrentWordOnlyEvents(cue.text, cue.endMs - cue.startMs, subtitleOptions);
      for (const event of timedEvents) {
        assEvents.push(
          `Dialogue: 0,${formatAssTimestamp(cue.startMs + event.startOffsetMs)},${formatAssTimestamp(cue.startMs + event.endOffsetMs)},${style.name},,0,0,0,,${event.text}`
        );
      }
      continue;
    }

    const karaokeText = buildKaraokeText(cue.text, cue.endMs - cue.startMs, subtitleOptions);
    assEvents.push(
      `Dialogue: 0,${formatAssTimestamp(cue.startMs)},${formatAssTimestamp(cue.endMs)},${style.name},,0,0,0,,${karaokeText}`
    );
  }

  return `${assHeader.join('\n')}\n${assEvents.join('\n')}\n`;
}

export async function writeAssFromSrt({
  sourceSrtPath,
  outputAssPath,
  subtitleOptions,
  deps = {}
}) {
  const readFileFn = deps.readFile || fs.readFile;
  const writeFileFn = deps.writeFile || fs.writeFile;
  const ensureDirFn = deps.ensureDir || ensureDir;

  const rawSrt = await readFileFn(sourceSrtPath, 'utf8');
  const cues = parseSrtCues(rawSrt);
  if (!cues.length) {
    throw new Error('Unable to generate ASS: aligned subtitle file has no cues');
  }

  const payload = renderAssFromCues(cues, subtitleOptions);
  await ensureDirFn(path.dirname(outputAssPath));
  await writeFileFn(outputAssPath, payload, 'utf8');

  return {
    cueCount: cues.length,
    outputPath: outputAssPath
  };
}
