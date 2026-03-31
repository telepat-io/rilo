import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import { buildOpenCommand, getRiloHomeDir, openPath } from '../src/cli/commands/openHome.js';

test('getRiloHomeDir resolves to ~/.rilo', () => {
  assert.equal(getRiloHomeDir(), path.join(os.homedir(), '.rilo'));
});

test('buildOpenCommand uses macOS open', () => {
  assert.deepEqual(buildOpenCommand('/tmp/rilo-home', 'darwin'), {
    command: 'open',
    args: ['/tmp/rilo-home']
  });
});

test('buildOpenCommand uses xdg-open on Linux', () => {
  assert.deepEqual(buildOpenCommand('/tmp/rilo-home', 'linux'), {
    command: 'xdg-open',
    args: ['/tmp/rilo-home']
  });
});

test('buildOpenCommand uses cmd start on Windows', () => {
  assert.deepEqual(buildOpenCommand('C:\\Users\\me\\.rilo', 'win32'), {
    command: 'cmd',
    args: ['/c', 'start', '', 'C:\\Users\\me\\.rilo']
  });
});

test('buildOpenCommand rejects unsupported platforms', () => {
  assert.throws(
    () => buildOpenCommand('/tmp/rilo-home', 'sunos'),
    /Unsupported platform/
  );
});

test('openPath starts the expected opener and resolves on exit 0', async () => {
  const spawnCalls = [];

  await openPath('/tmp/rilo-home', {
    platform: 'darwin',
    spawnImpl(command, args, options) {
      spawnCalls.push({ command, args, options });
      return {
        once(eventName, handler) {
          if (eventName === 'exit') {
            queueMicrotask(() => handler(0));
          }
        }
      };
    }
  });

  assert.deepEqual(spawnCalls, [{
    command: 'open',
    args: ['/tmp/rilo-home'],
    options: { stdio: 'ignore' }
  }]);
});

test('openPath surfaces missing opener binaries clearly', async () => {
  await assert.rejects(
    openPath('/tmp/rilo-home', {
      platform: 'linux',
      spawnImpl() {
        return {
          once(eventName, handler) {
            if (eventName === 'error') {
              queueMicrotask(() => handler(Object.assign(new Error('missing'), { code: 'ENOENT' })));
            }
          }
        };
      }
    }),
    /'xdg-open' is not available/
  );
});

test('openPath surfaces non-zero exit codes', async () => {
  await assert.rejects(
    openPath('/tmp/rilo-home', {
      platform: 'darwin',
      spawnImpl() {
        return {
          once(eventName, handler) {
            if (eventName === 'exit') {
              queueMicrotask(() => handler(2));
            }
          }
        };
      }
    }),
    /exited with code 2/
  );
});

test('openPath surfaces synchronous spawn failures', async () => {
  await assert.rejects(
    openPath('/tmp/rilo-home', {
      platform: 'darwin',
      spawnImpl() {
        throw new Error('spawn exploded');
      }
    }),
    /spawn exploded/
  );
});