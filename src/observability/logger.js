export function logInfo(message, data = {}) {
  console.log(JSON.stringify({ level: 'info', message, ...data, ts: new Date().toISOString() }));
}

export function logError(message, data = {}) {
  console.error(JSON.stringify({ level: 'error', message, ...data, ts: new Date().toISOString() }));
}
