// refresh-dsh-plugin-bridge.mjs — re-discover WorkBuddy shim credentials after DSH restarts.
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(here, 'dsh-plugin-bridge.config.json');
const python = process.env.DSH_PYTHON ?? 'C:\\Users\\onemt\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe';
const heartbeatPath = 'C:\\Users\\onemt\\.dsh\\.workbuddy-host-heartbeat.json';
const cfg = JSON.parse(await readFile(cfgPath, 'utf8'));
const hb = JSON.parse(await readFile(heartbeatPath, 'utf8'));
if (!Number.isFinite(Number(hb.pid))) throw new Error('WorkBuddy host heartbeat has no pid');
const { stdout } = await run(python, [path.join(here, 'v3_scan_dsh_memory.py'), String(hb.pid)], { cwd: here, maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000 });
const scan = JSON.parse(stdout);
const found = (Array.isArray(scan.discovered) ? scan.discovered : []).filter(x => x && x.modelsStatus === 200 && Array.isArray(x.ids) && x.ids.length > 0 && x.token);
const unique = [];
const seen = new Set();
for (const x of found) { const k = x.port + ':' + x.token; if (!seen.has(k)) { seen.add(k); unique.push(x); } }
unique.sort((a,b) => Number(a.port) - Number(b.port));
if (!unique.length) throw new Error('no WorkBuddy shim discovered');
const oldById = new Map((cfg.shims ?? []).map(x => [x.baseUrl, x]));
cfg.shims = unique.map((x, i) => {
  const baseUrl = 'http://127.0.0.1:' + x.port;
  const old = oldById.get(baseUrl);
  return { id: old?.id ?? (i === 0 ? 'workbuddy-cn' : 'workbuddy-' + (i+1)), prefix: old?.prefix ?? (i === 0 ? 'wb-cn' : 'wb-' + (i+1)), baseUrl, apiKey: x.token, ownedBy: 'workbuddy' };
});
await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ok: true, pid: hb.pid, shims: cfg.shims.map(x => ({ id: x.id, prefix: x.prefix, baseUrl: x.baseUrl, models: unique.find(y => 'http://127.0.0.1:' + y.port === x.baseUrl)?.ids?.length ?? 0 })) }));
