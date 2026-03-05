import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

function isAllowedHost(hostname) {
  const normalizedHost = String(hostname || '').toLowerCase();
  return env.downloadAllowedHosts.some((allowedHost) => {
    return normalizedHost === allowedHost || normalizedHost.endsWith(`.${allowedHost}`);
  });
}

function parseDownloadUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid download URL');
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Download URL must use https');
  }

  if (!isAllowedHost(parsedUrl.hostname)) {
    throw new Error(`Download host is not allowed: ${parsedUrl.hostname}`);
  }

  return parsedUrl;
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function downloadToFile(url, outputPath) {
  const parsedUrl = parseDownloadUrl(url);
  const response = await fetch(parsedUrl, {
    signal: AbortSignal.timeout(env.downloadTimeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${parsedUrl}: ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > env.downloadMaxBytes) {
    throw new Error(`Download too large (${contentLength} bytes > ${env.downloadMaxBytes} bytes)`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Download response body is not readable');
  }

  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = Buffer.from(value);
    totalBytes += chunk.length;
    if (totalBytes > env.downloadMaxBytes) {
      throw new Error(`Download exceeded max size (${env.downloadMaxBytes} bytes)`);
    }
    chunks.push(chunk);
  }

  await ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, Buffer.concat(chunks));
  return outputPath;
}
