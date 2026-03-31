import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function getRiloHomeDir() {
  return path.join(os.homedir(), '.rilo');
}

export function buildOpenCommand(targetPath, platform = process.platform) {
  if (platform === 'darwin') {
    return { command: 'open', args: [targetPath] };
  }

  if (platform === 'linux') {
    return { command: 'xdg-open', args: [targetPath] };
  }

  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'start', '', targetPath] };
  }

  throw new Error(`Unsupported platform for 'rilo home': ${platform}`);
}

export async function openPath(targetPath, options = {}) {
  const platform = options.platform || process.platform;
  const spawnImpl = options.spawnImpl || spawn;
  const { command, args } = buildOpenCommand(targetPath, platform);

  await new Promise((resolve, reject) => {
    let child;

    try {
      child = spawnImpl(command, args, {
        stdio: 'ignore'
      });
    } catch (error) {
      reject(new Error(`Unable to open ${targetPath}: ${error.message}`));
      return;
    }

    child.once('error', (error) => {
      if (error && error.code === 'ENOENT') {
        reject(new Error(`Unable to open ${targetPath}: '${command}' is not available on this system.`));
        return;
      }

      reject(new Error(`Unable to open ${targetPath}: ${error.message}`));
    });

    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Unable to open ${targetPath}: '${command}' exited with code ${code}.`));
    });
  });
}

export async function openHome(options = {}) {
  const targetPath = options.targetPath || getRiloHomeDir();

  await fs.mkdir(targetPath, { recursive: true });
  await openPath(targetPath, options);

  console.log(`Opened ${targetPath}`);
}