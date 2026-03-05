const counters = new Map();

export function incrementMetric(name) {
  const value = counters.get(name) || 0;
  counters.set(name, value + 1);
}

export function readMetrics() {
  return Object.fromEntries(counters.entries());
}
