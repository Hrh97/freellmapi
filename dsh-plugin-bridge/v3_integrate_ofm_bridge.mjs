// v3_integrate_ofm_bridge.mjs — runtime integration of Our Free Model via the stable bridge.
import { readFile } from 'node:fs/promises';
const cfg = JSON.parse(await readFile(new URL('./dsh-plugin-bridge.config.json', import.meta.url), 'utf8'));
const unifiedText = await readFile(new URL('./unified-key.txt', import.meta.url), 'utf8');
const unified = unifiedText.split(/\r?\n/).map(l => (l.match(/^(freellmapi-[0-9a-f]+)/) ?? [])[1]).find(Boolean);
const free = 'http://127.0.0.1:31415';
const bridge = 'http://127.0.0.1:31418/v1';
const ofmBase = cfg.ofm.baseUrl;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function call(url, init = {}, timeout = 15000) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, ok: r.ok, text, json, contentType: r.headers.get('content-type') ?? '' };
}
function ids(payload) {
  return (Array.isArray(payload?.data) ? payload.data : []).map(x => typeof x === 'string' ? x : (x?.id ?? x?.modelId ?? x?.model ?? '')).filter(Boolean);
}
const out = { ofm: {}, bridge: {}, registration: {}, verification: {} };
let ofmModels = [];
let ofmLastStatus = 0;
const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  try {
    const r = await call(ofmBase + '/v1/models', { headers: { authorization: 'Bearer ' + cfg.ofm.apiKey } }, 6000);
    ofmLastStatus = r.status;
    if (r.status === 200) { ofmModels = ids(r.json); if (ofmModels.length) break; }
  } catch (e) { out.ofm.pollError = String(e?.message ?? e); }
  await sleep(1000);
}
out.ofm.modelsStatus = ofmLastStatus;
out.ofm.count = ofmModels.length;
out.ofm.samples = ofmModels.slice(0, 14);
if (!ofmModels.length) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const reload = await call('http://127.0.0.1:31418/reload');
out.bridge.reload = { status: reload.status, ok: reload.ok, routes: reload.json?.routes ?? null };
let bridgeIds = [];
const bridgeDeadline = Date.now() + 30000;
while (Date.now() < bridgeDeadline) {
  try {
    const r = await call(bridge + '/models', { headers: { authorization: 'Bearer ' + cfg.bridgeKey } }, 10000);
    if (r.status === 200) { bridgeIds = ids(r.json); if (bridgeIds.some(x => x.startsWith('ofm/'))) break; }
  } catch (e) { out.bridge.pollError = String(e?.message ?? e); }
  await sleep(1000);
}
out.bridge.count = bridgeIds.length;
out.bridge.ofmCount = bridgeIds.filter(x => x.startsWith('ofm/')).length;
out.bridge.wbCount = bridgeIds.filter(x => x.startsWith('wb-')).length;
if (!bridgeIds.some(x => x.startsWith('ofm/'))) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const session = await call(free + '/api/auth/desktop-session', { method: 'POST' });
const adminToken = session.json?.token ?? '';
out.registration.sessionStatus = session.status;
if (!adminToken) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
const admin = { 'content-type': 'application/json', authorization: 'Bearer ' + adminToken };
const keys = await call(free + '/api/keys', { headers: admin });
const keyRows = Array.isArray(keys.json) ? keys.json : Array.isArray(keys.json?.keys) ? keys.json.keys : Array.isArray(keys.json?.data) ? keys.json.data : [];
const existing = keyRows.find(x => String(x?.baseUrl ?? x?.base_url ?? '').startsWith('http://127.0.0.1:31418'));
out.registration.existingKeyId = existing?.id ?? existing?.keyId ?? null;
const discovered = await call(free + '/api/keys/custom/discover-models', { method: 'POST', headers: admin, body: JSON.stringify({ baseUrl: bridge, apiKey: cfg.bridgeKey }) });
out.registration.discoverStatus = discovered.status;
out.registration.discovered = (discovered.json?.models ?? []).length;
const payload = { baseUrl: bridge, apiKey: cfg.bridgeKey, label: 'dsh-plugin-bridge', groupLabel: 'DSH Plugins', models: bridgeIds };
if (out.registration.existingKeyId) payload.keyId = out.registration.existingKeyId;
const created = await call(free + '/api/keys/custom', { method: 'POST', headers: admin, body: JSON.stringify(payload) }, 30000);
out.registration.createStatus = created.status;
out.registration.created = created.json?.created ?? null;
out.registration.alreadyRegistered = created.json?.alreadyRegistered ?? null;
out.registration.registeredModels = (created.json?.models ?? []).length;
out.registration.modelErrors = created.json?.modelErrors ?? [];
if (!created.ok) out.registration.createHead = created.text.slice(0, 300);

const publicModels = await call(free + '/v1/models', { headers: { authorization: 'Bearer ' + unified } });
const publicIds = ids(publicModels.json);
out.verification.publicStatus = publicModels.status;
out.verification.publicCount = publicIds.length;
out.verification.publicOfmCount = publicIds.filter(x => x.startsWith('ofm')).length;
out.verification.publicOfmSamples = publicIds.filter(x => x.startsWith('ofm')).slice(0, 14);
out.verification.publicWbCount = publicIds.filter(x => x.startsWith('wb-')).length;
const preferredOfm = ['ofm/baidu/ernie-5.5-flash-preview:free', 'ofm/liquid/lfm-3-1.7b:free'];
const chatModel = preferredOfm.find(x => bridgeIds.includes(x)) ?? bridgeIds.find(x => x.startsWith('ofm/')) ?? 'ofm/' + ofmModels[0];
const chat = await call(free + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + unified }, body: JSON.stringify({ model: chatModel, messages: [{ role: 'user', content: 'say ok' }], max_tokens: 16, stream: false }) }, 120000);
out.verification.ofmChat = { status: chat.status, model: chatModel, contentType: chat.contentType, content: String(chat.json?.choices?.[0]?.message?.content ?? chat.text).slice(0, 160) };
const wbModel = 'wb-cn/hy4free';
const wbChat = await call(free + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + unified }, body: JSON.stringify({ model: wbModel, messages: [{ role: 'user', content: 'say ok' }], max_tokens: 16, stream: false }) }, 120000);
out.verification.wbChat = { status: wbChat.status, model: wbModel, contentType: wbChat.contentType, content: String(wbChat.json?.choices?.[0]?.message?.content ?? wbChat.text).slice(0, 160) };
console.log(JSON.stringify(out, null, 2));
