// register-dsh-plugin-models.mjs — discover bridge models and register them with FreeLLMAPI custom endpoint API.
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.FREELLMAPI_BASE ?? 'http://127.0.0.1:31415';
const bridge = process.env.DSH_PLUGIN_BRIDGE ?? 'http://127.0.0.1:31418/v1';
const bridgeKey = (JSON.parse(await readFile(new URL('./dsh-plugin-bridge.config.json', import.meta.url), 'utf8'))).bridgeKey;
const authHeaders = { 'content-type': 'application/json', authorization: 'Bearer ' + bridgeKey };
async function api(path, init = {}) {
  const r = await fetch(base + path, init);
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status + ' ' + JSON.stringify(j));
  return j;
}
const session = await api('/api/auth/desktop-session', { method: 'POST' });
const token = session.token;
if (!token) throw new Error('desktop-session returned no token');
const admin = { 'content-type': 'application/json', authorization: 'Bearer ' + token };
const discovered = await api('/api/keys/custom/discover-models', { method: 'POST', headers: admin, body: JSON.stringify({ baseUrl: bridge, apiKey: bridgeKey }) });
const ids = (discovered.models ?? []).map(m => m.id ?? m.modelId ?? m.model).filter(Boolean);
if (!ids.length) throw new Error('bridge discovery returned no models');
const keys = await api('/api/keys', { headers: admin });
const keyRows = Array.isArray(keys) ? keys : Array.isArray(keys.keys) ? keys.keys : Array.isArray(keys.data) ? keys.data : [];
const existing = keyRows.find(x => String(x?.baseUrl ?? x?.base_url ?? '').startsWith(bridge));
const body = { baseUrl: bridge, apiKey: bridgeKey, label: 'dsh-plugin-bridge', groupLabel: 'DSH Plugins', models: ids };
if (existing?.id) body.keyId = existing.id;
const created = await api('/api/keys/custom', { method: 'POST', headers: admin, body: JSON.stringify(body) });
const out = { bridge, discovered: ids.length, ids, registration: { keyId: created.keyId, created: created.created, alreadyRegistered: created.alreadyRegistered, registeredModels: (created.models ?? []).length, modelErrors: created.modelErrors ?? [] } };
await writeFile(new URL('./dsh-plugin-registration.json', import.meta.url), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
