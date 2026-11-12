// sync-dsh-plugin-models.mjs — one-command, idempotent DSH plugin model sync.
// Replaces the full 5-step integration: only does work when something actually changed.
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(here, 'dsh-plugin-bridge.config.json');
const heartbeat = 'C:\\Users\\onemt\\.dsh\\.workbuddy-host-heartbeat.json';
const bridge = 'http://127.0.0.1:31418';
const free = 'http://127.0.0.1:31415';
const node = process.execPath;
const python = process.env.DSH_PYTHON ?? 'C:\\Users\\onemt\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe';

const norm = s => String(s).replace(/[\/:]/g, '');
const idsOf = p => (Array.isArray(p && p.data) ? p.data : []).map(x => typeof x === 'string' ? x : String((x && x.id) || '')).filter(Boolean);
const getJson = async (url, headers) => {
  try { const r = await fetch(url, { headers: headers || {}, signal: AbortSignal.timeout(15000) }); return { status: r.status, body: await r.json().catch(() => null) }; }
  catch (e) { return { status: 0, body: null, error: String(e && e.message ? e.message : e) }; }
};

const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
const bridgeKey = 'Bearer ' + cfg.bridgeKey;
const out = { at: new Date().toISOString(), shimRefreshed: false, bridgeRestarted: false, registered: false, ok: false };

// 1) Are the WorkBuddy shims still alive with their current token/port?
let alive = true;
for (const s of (cfg.shims || [])) {
  if (s.enabled === false) continue;
  const r = await getJson(String(s.baseUrl).replace(/\/+$/, '') + '/healthz', { authorization: 'Bearer ' + s.apiKey });
  if (r.status !== 200) { alive = false; break; }
}
out.shimsAlive = alive;

// 2) Only when the DSH host / WorkBuddy plugin restarted: rediscover random port + secret.
if (!alive) {
  const hb = JSON.parse(await readFile(heartbeat, 'utf8'));
  if (!Number.isFinite(Number(hb.pid))) throw new Error('WorkBuddy host heartbeat has no pid');
  const scanArgs = [path.join(here, 'v3_scan_dsh_memory.py'), String(hb.pid)];
  const { stdout } = await run(python, scanArgs, { cwd: here, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
  const scan = JSON.parse(stdout);
  const found = (Array.isArray(scan.discovered) ? scan.discovered : []).filter(x => x && x.modelsStatus === 200 && Array.isArray(x.ids) && x.ids.length > 0 && x.token);
  const seen = new Set();
  const unique = found.filter(x => { const k = x.port + ':' + x.token; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => Number(a.port) - Number(b.port));
  if (!unique.length) throw new Error('no WorkBuddy shim discovered');
  const oldById = new Map((cfg.shims || []).map(x => [x.baseUrl, x]));
  cfg.shims = unique.map((x, i) => {
    const baseUrl = 'http://127.0.0.1:' + x.port;
    const old = oldById.get(baseUrl);
    return { id: (old && old.id) || (i === 0 ? 'workbuddy-cn' : 'workbuddy-' + (i + 1)), prefix: (old && old.prefix) || (i === 0 ? 'wb-cn' : 'wb-' + (i + 1)), baseUrl, apiKey: x.token, ownedBy: 'workbuddy' };
  });
  await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  out.shimRefreshed = true;
  out.shims = cfg.shims.map(x => ({ id: x.id, prefix: x.prefix, baseUrl: x.baseUrl }));
}

// 3) Make sure the bridge process is up; hot-reload config instead of restarting when possible.
let health = await getJson(bridge + '/healthz');
if (health.status !== 200) {
  await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'start-dsh-plugin-bridge-cim.ps1')], { cwd: here, timeout: 180000 });
  out.bridgeRestarted = true;
  health = await getJson(bridge + '/healthz');
} else if (out.shimRefreshed) {
  await getJson(bridge + '/reload');
  out.bridgeReloaded = true;
}
out.health = { status: health.status, routes: health.body && health.body.routes };
if (health.status !== 200) throw new Error('bridge is not healthy');

// 4) Bridge serves /v1/models live from upstream, so compare with FreeLLMAPI and register only the delta.
const bm = await getJson(bridge + '/v1/models', { authorization: bridgeKey });
const bridgeIds = idsOf(bm.body);
out.bridgeModels = bridgeIds.length;
const unifiedText = await readFile(path.join(here, 'unified-key.txt'), 'utf8');
const unified = (String(unifiedText).match(/^(freellmapi-[0-9a-f]+)/m) || [])[1];
if (!unified) throw new Error('unified key not found');
const fm = await getJson(free + '/v1/models', { authorization: 'Bearer ' + unified });
const freeIds = new Set(idsOf(fm.body));
out.freeModels = freeIds.size;
const missing = bridgeIds.filter(id => !freeIds.has(norm(id)));
const prefixSet = new Set((cfg.shims || []).map(x => String(x.prefix)).concat(cfg.ofm && cfg.ofm.prefix ? [String(cfg.ofm.prefix)] : []));
const orphaned = [...freeIds].filter(id => [...prefixSet].some(p => id.startsWith(norm(p)))).filter(id => !bridgeIds.some(b => norm(b) === id));
out.missingInFreeLlmApi = missing.length;
out.orphanedInFreeLlmApi = orphaned.length;
if (missing.length) {
  await run(node, [path.join(here, 'register-dsh-plugin-models.mjs')], { cwd: here, timeout: 180000 });
  out.registered = true;
  out.registeredIds = missing;
}
out.ok = true;
console.log(JSON.stringify(out, null, 2));
