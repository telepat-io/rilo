import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { env } from '../src/config/env.js';
import { downloadToFile } from '../src/media/files.js';

function makeResponse({ ok = true, status = 200, contentLength = null, chunks = [] }) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'content-length' && contentLength !== null) {
          return String(contentLength);
        }
        return null;
      }
    },
    body: {
      getReader() {
        let index = 0;
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          }
        };
      }
    }
  };
}

test('downloadToFile rejects non-https URLs', async () => {
  await assert.rejects(
    downloadToFile('http://replicate.delivery/file.txt', '/tmp/unused'),
    /must use https/
  );
});

test('downloadToFile rejects disallowed hosts', async () => {
  await assert.rejects(
    downloadToFile('https://example.com/file.txt', '/tmp/unused'),
    /host is not allowed/
  );
});

test('downloadToFile rejects content-length beyond configured maximum', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => makeResponse({ contentLength: env.downloadMaxBytes + 1 });

  try {
    await assert.rejects(
      downloadToFile('https://replicate.delivery/file.bin', '/tmp/unused'),
      /Download too large/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('downloadToFile writes streamed content for allowed URL', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-download-'));
  const targetPath = path.join(tmpDir, 'file.bin');

  const originalFetch = global.fetch;
  global.fetch = async () =>
    makeResponse({
      contentLength: 4,
      chunks: [new Uint8Array([1, 2]), new Uint8Array([3, 4])]
    });

  try {
    const writtenPath = await downloadToFile('https://replicate.delivery/path/file.bin', targetPath);
    assert.equal(writtenPath, targetPath);

    const content = await fs.readFile(targetPath);
    assert.deepEqual([...content], [1, 2, 3, 4]);
  } finally {
    global.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('downloadToFile rejects invalid URL and non-OK responses', async () => {
  await assert.rejects(
    downloadToFile('not-a-url', '/tmp/unused'),
    /Invalid download URL/
  );

  const originalFetch = global.fetch;
  global.fetch = async () => makeResponse({ ok: false, status: 503 });
  try {
    await assert.rejects(
      downloadToFile('https://replicate.delivery/file.bin', '/tmp/unused'),
      /Failed to download/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('downloadToFile handles unreadable body and streaming max-size overflow', async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get() {
        return null;
      }
    },
    body: null
  });

  try {
    await assert.rejects(
      downloadToFile('https://replicate.delivery/file.bin', '/tmp/unused'),
      /not readable/
    );
  } finally {
    global.fetch = originalFetch;
  }

  global.fetch = async () =>
    makeResponse({
      contentLength: null,
      chunks: [new Uint8Array(env.downloadMaxBytes), new Uint8Array([1])]
    });

  try {
    await assert.rejects(
      downloadToFile('https://replicate.delivery/file.bin', '/tmp/unused'),
      /exceeded max size/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('downloadToFile allows valid subdomain hosts', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'videogen-subdomain-download-'));
  const targetPath = path.join(tmpDir, 'file.bin');

  const originalFetch = global.fetch;
  global.fetch = async () =>
    makeResponse({
      contentLength: 1,
      chunks: [new Uint8Array([9])]
    });

  try {
    const writtenPath = await downloadToFile('https://cdn.replicate.delivery/file.bin', targetPath);
    assert.equal(writtenPath, targetPath);
  } finally {
    global.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
