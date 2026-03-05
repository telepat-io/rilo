import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDir } from '../media/files.js';

function getTraceFilePath(projectDir) {
  return path.join(projectDir, 'assets', 'debug', 'api-requests.jsonl');
}

export async function appendApiTrace(projectDir, record) {
  if (!projectDir) {
    return;
  }

  const filePath = getTraceFilePath(projectDir);
  await ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}
