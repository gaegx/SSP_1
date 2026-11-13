const startedAt = Date.now();
const latencies = [];
const MAX_SAMPLES = 500;

export const metrics = {
  requests: 0,
  errors: 0,
  rejected: 0,
  inFlight: 0,
  byStatus: {},
  subgraphErrors: { items: 0, authors: 0, ops: 0 },
};

export function recordLatency(ms) {
  latencies.push(ms);
  if (latencies.length > MAX_SAMPLES) latencies.shift();
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

export function snapshot(extra = {}) {
  const uptimeSec = (Date.now() - startedAt) / 1000;
  return {
    uptimeSec: Math.round(uptimeSec),
    requests: metrics.requests,
    errors: metrics.errors,
    rejected: metrics.rejected,
    inFlight: metrics.inFlight,
    rps: uptimeSec > 0 ? Number((metrics.requests / uptimeSec).toFixed(2)) : 0,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      last: latencies[latencies.length - 1] || 0,
      samples: latencies.length,
    },
    byStatus: metrics.byStatus,
    subgraphErrors: metrics.subgraphErrors,
    ...extra,
  };
}
