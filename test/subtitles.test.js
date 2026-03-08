import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  parseSrtCues,
  renderAssFromCues,
  writeAssFromSrt,
  writeSeedSrtFromScript
} from '../src/media/subtitles.js';

test('writeSeedSrtFromScript creates deterministic cue file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-seed-srt-'));
  try {
    const outputPath = path.join(tempDir, 'seed.srt');
    const result = await writeSeedSrtFromScript({
      script: 'alpha beta gamma delta epsilon zeta eta theta',
      totalDurationSec: 8,
      outputPath,
      maxWordsPerLine: 4
    });

    assert.equal(result.cueCount, 2);
    const raw = await fs.readFile(outputPath, 'utf8');
    assert.match(raw, /00:00:00,000 -->/);
    assert.match(raw, /alpha beta gamma delta/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('writeSeedSrtFromScript splits cues on sentence boundaries', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-seed-sentence-srt-'));
  try {
    const outputPath = path.join(tempDir, 'seed.srt');
    const result = await writeSeedSrtFromScript({
      script: 'First short sentence. Second sentence is here! Third one?',
      totalDurationSec: 9,
      outputPath,
      maxWordsPerLine: 20
    });

    assert.equal(result.cueCount, 3);
    const raw = await fs.readFile(outputPath, 'utf8');
    assert.match(raw, /First short sentence/);
    assert.doesNotMatch(raw, /First short sentence\./);
    assert.match(raw, /Second sentence is here!/);
    assert.match(raw, /Third one\?/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('parseSrtCues parses cue windows and text', () => {
  const cues = parseSrtCues(`1\n00:00:00,000 --> 00:00:02,000\nhello world\n\n2\n00:00:02,000 --> 00:00:04,000\nnext line\n`);

  assert.equal(cues.length, 2);
  assert.equal(cues[0].startMs, 0);
  assert.equal(cues[1].endMs, 4000);
  assert.equal(cues[0].text, 'hello world');
});

test('renderAssFromCues emits karaoke tags and style header', () => {
  const payload = renderAssFromCues([
    { startMs: 0, endMs: 1200, text: 'hello world' }
  ], {
    primaryColor: '#ffffff',
    activeColor: '#00ff00',
    outlineColor: '#000000',
    position: 'bottom'
  });

  assert.match(payload, /\[V4\+ Styles\]/);
  assert.match(payload, /Dialogue:/);
  assert.match(payload, /\\k/);
});

test('renderAssFromCues wraps social-style cues across two centered lines', () => {
  const payload = renderAssFromCues([
    { startMs: 0, endMs: 2800, text: 'one two three four five six seven' }
  ], {
    position: 'center',
    maxLines: 2
  });

  assert.match(payload, /Style: Karaoke,[^\n]*,5,/);
  assert.match(payload, /\\N/);
  assert.match(payload, /\\k/);
});

test('renderAssFromCues supports optional uppercase caption text', () => {
  const payload = renderAssFromCues([
    { startMs: 0, endMs: 1000, text: 'mixed Case words' }
  ], {
    makeUppercase: true
  });

  assert.match(payload, /MIXED/);
  assert.match(payload, /CASE/);
  assert.match(payload, /WORDS/);
});

test('renderAssFromCues supports current-word-only highlight mode', () => {
  const payload = renderAssFromCues([
    { startMs: 0, endMs: 2000, text: 'focus each word' }
  ], {
    primaryColor: '#ffffff',
    activeColor: '#00ff00',
    highlightMode: 'current_only'
  });

  assert.match(payload, /Style: Karaoke,[^\n]*,&H00FFFFFF,&H00FFFFFF,/);
  assert.doesNotMatch(payload, /\\k/);
  assert.match(payload, /\\1c&H0000FF00/);
  assert.match(payload, /\\1c&H00FFFFFF/);
  assert.match(payload, /Dialogue: 0,0:00:00\.00,0:00:00\./);
});

test('renderAssFromCues emits background box and style toggles', () => {
  const payload = renderAssFromCues([
    { startMs: 0, endMs: 1000, text: 'boxed text' }
  ], {
    backgroundEnabled: true,
    backgroundColor: '#000000',
    backgroundOpacity: 0.45,
    bold: false,
    italic: true
  });

  assert.match(payload, /Style: Karaoke,[^\n]*,&H8C000000,&H8C000000,0,1,0,0,100,100,0,0,3,/);
});

test('renderAssFromCues minimizes multi-line opaque box padding to avoid overlap', () => {
  const payload = renderAssFromCues([
    { startMs: 0, endMs: 1200, text: 'one two three four five six seven' }
  ], {
    backgroundEnabled: true,
    backgroundColor: '#000000',
    backgroundOpacity: 0.45,
    outline: 8,
    maxLines: 2,
    maxWordsPerLine: 4
  });

  // Format tail is BorderStyle,Outline,Shadow,Alignment,...
  assert.match(payload, /,3,1,0,5,60,60,/);
});

test('writeAssFromSrt converts aligned srt into .ass karaoke file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-ass-write-'));
  try {
    const srtPath = path.join(tempDir, 'aligned.srt');
    const assPath = path.join(tempDir, 'aligned.ass');
    await fs.writeFile(
      srtPath,
      '1\n00:00:00,000 --> 00:00:01,000\none two\n\n2\n00:00:01,000 --> 00:00:02,000\nthree four\n',
      'utf8'
    );

    const result = await writeAssFromSrt({
      sourceSrtPath: srtPath,
      outputAssPath: assPath,
      subtitleOptions: {
        enabled: true,
        fontName: 'Poppins'
      }
    });

    assert.equal(result.cueCount, 2);
    const rawAss = await fs.readFile(assPath, 'utf8');
    assert.match(rawAss, /Style: Karaoke/);
    assert.match(rawAss, /Dialogue: 0,/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('writeSeedSrtFromScript handles empty script by writing zero cues', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-seed-empty-srt-'));
  try {
    const outputPath = path.join(tempDir, 'seed.srt');
    const result = await writeSeedSrtFromScript({
      script: '',
      totalDurationSec: 5,
      outputPath,
      maxWordsPerLine: 4
    });

    assert.equal(result.cueCount, 0);
    const raw = await fs.readFile(outputPath, 'utf8');
    assert.equal(raw, '\n');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('parseSrtCues skips malformed and invalid timing blocks', () => {
  const cues = parseSrtCues([
    '1',
    '00:00:00,000 --> 00:00:00,000',
    'invalid same-start-end',
    '',
    '2',
    '00:00:00,000 --> 00:00:02,000',
    '',
    '',
    '3',
    'bad timeline',
    'text',
    '',
    '4',
    '00:00:01,000 --> 00:00:03,000',
    'valid cue text'
  ].join('\n'));

  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, 'valid cue text');
});

test('writeAssFromSrt throws when aligned srt has no valid cues', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-ass-empty-'));
  try {
    const srtPath = path.join(tempDir, 'aligned.srt');
    const assPath = path.join(tempDir, 'aligned.ass');
    await fs.writeFile(srtPath, '1\n00:00:00,000 --> 00:00:00,000\n\n', 'utf8');

    await assert.rejects(
      () => writeAssFromSrt({
        sourceSrtPath: srtPath,
        outputAssPath: assPath,
        subtitleOptions: {}
      }),
      /has no cues/
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
