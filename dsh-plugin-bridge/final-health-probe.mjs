// final-health-probe.mjs — explicit-port reachability check for the integration endpoints.
const targets = [
  { name: 'bridge-health', url: 'http://127.0.0.1:31418/healthz' },
  { name: 'ofm-health', url: 'http://127.0.0.1:18899/health' },
  { name: 'grok-models', url: 'http://127.0.0.1:31416/v1/models' },
  { name: 'freellmapi-models', url: 'http://127.0.0.1:31415/v1/models' },
  { name: 'workbuddy-cn-health', url: 'http://127.0.0.1:54001/healthz' },
  { name: 'workbuddy-2-health', url: 'http://127.0.0.1:54002/healthz' },
];
const rows = [];
for (const t of targets) {
  try {
    const r = await fetch(t.url, { signal: AbortSignal.timeout(6000) });
    const text = await r.text();
    rows.push({ name: t.name, url: t.url, status: r.status, reachable: true, contentType: r.headers.get('content-type') ?? '', head: text.slice(0, 100).replace(/[A-Za-z0-9_-]{28,}/g, '[redacted]') });
  } catch (e) {
    rows.push({ name: t.name, url: t.url, status: 0, reachable: false, error: String(e?.message ?? e) });
  }
}
console.log(JSON.stringify({ at: new Date().toISOString(), reachable: rows.filter(x => x.reachable).length, total: rows.length, rows }, null, 2));
