import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { startApiServer } from '../../api/server.js';
import { openPath } from './openHome.js';

function parsePort(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return parsed;
}

function resolveDashboardDir() {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(commandDir, '../../../frontend/dist');
}

function resolveWorkerEntryPoint() {
  const commandDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(commandDir, '../../worker/processor.js');
}

function buildWorkerProcess() {
  const workerPath = resolveWorkerEntryPoint();
  return spawn(process.execPath, [workerPath], {
    stdio: 'inherit'
  });
}

function printUnsafeExposeWarning(url) {
  console.warn('WARNING: running preview in exposed mode without auth.');
  console.warn(`WARNING: dashboard and API are reachable from ${url}`);
  console.warn('WARNING: use only on trusted networks or isolated containers.');
}

function resolveOpenUrl(host, port) {
  if (host === '0.0.0.0' || host === '::') {
    return `http://127.0.0.1:${port}`;
  }

  return `http://${host}:${port}`;
}

export async function startPreview({ args = process.argv.slice(3) } = {}) {
  const expose = args.includes('--expose');
  const unsafeNoAuth = args.includes('--unsafe-no-auth');
  const noOpen = args.includes('--no-open');

  if (!expose && unsafeNoAuth) {
    throw new Error('--unsafe-no-auth can only be used with --expose');
  }

  if (expose && !unsafeNoAuth) {
    throw new Error('Exposed preview requires --unsafe-no-auth');
  }

  const portArgIndex = args.indexOf('--port');
  const portArg = portArgIndex === -1 ? null : args[portArgIndex + 1] || null;
  const port = parsePort(portArg, 3000);

  const hostArgIndex = args.indexOf('--host');
  const hostArg = hostArgIndex === -1 ? null : args[hostArgIndex + 1] || null;
  const host = hostArg || (expose ? '0.0.0.0' : '127.0.0.1');

  const dashboardDir = resolveDashboardDir();
  if (!fs.existsSync(path.join(dashboardDir, 'index.html'))) {
    throw new Error('Dashboard bundle not found. Run `npm run frontend:build` first.');
  }

  const apiServer = startApiServer({
    port,
    host,
    dashboardDir,
    auth: {
      previewMode: true,
      allowUnauthenticatedExposedPreview: unsafeNoAuth
    }
  });

  const worker = buildWorkerProcess();
  const openUrl = resolveOpenUrl(host, port);

  const stopAll = () => {
    if (!worker.killed) {
      worker.kill('SIGTERM');
    }
    apiServer.close();
  };

  process.once('SIGINT', () => {
    stopAll();
    process.exit(0);
  });

  process.once('SIGTERM', () => {
    stopAll();
    process.exit(0);
  });

  worker.once('exit', (code) => {
    apiServer.close(() => {
      if (typeof code === 'number' && code !== 0) {
        process.exit(code);
      }
    });
  });

  if (unsafeNoAuth) {
    printUnsafeExposeWarning(openUrl);
  }

  console.log(`Dashboard: ${openUrl}`);
  console.log(`Docs: ${openUrl}/docs`);

  if (!noOpen) {
    await openPath(openUrl);
  }
}
