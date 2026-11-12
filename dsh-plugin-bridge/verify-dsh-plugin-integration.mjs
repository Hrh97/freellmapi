// verify-dsh-plugin-integration.mjs — final end-to-end check for FreeLLMAPI + DSH plugin bridge.
import { readFile, writeFile } from 'node:fs/promises';
const cfg = JSON.parse(await readFile(new URL('./dsh-plugin-bridge.config.json', import.meta.url), 'utf8'));
const unifiedText = await readFile(new URL('./unified-key.txt', import.meta.url), 'utf8');
const unified = unifiedText.split(/\r?\n/).map(l => (l.match(/^(freellmapi-[0-9a-f]+)/) ?? [])[1]).find(Boolean);
const free = 'http://127.0.0.1:31415';
const bridge = 'http://127.0.0.1:31418/v1';
async function call(url, init = {}, timeout = 120000) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, contentType: r.headers.get('content-type') ?? '', text, json,
    content: json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text ?? null,
    error: typeof json?.error === 'string' ? json.error : (json?.error?.message ?? json?.message ?? null) };
}
function ids(payload) {
  return (Array.isArray(payload?.data) ? payload.data : []).map(x => typeof x === 'string' ? x : (x?.id ?? x?.modelId ?? x?.model ?? '')).filter(Boolean);
}
async function chat(model, stream = false) {
  const body = JSON.stringify({ model, messages: [{ role: 'user', content: 'say ok' }], max_tokens: 16, stream });
  const r = await call(free + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + unified }, body });
  return { status: r.status, contentType: r.contentType, content: r.content ? String(r.content).slice(0, 160) : String(r.text).slice(0, 160), error: r.error ? String(r.error).slice(0, 220) : null };
}
const [bridgeModels, publicModels, health] = await Promise.all([
  call(bridge + '/models', { headers: { authorization: 'Bearer ' + cfg.bridgeKey } }, 15000),
  call(free + '/v1/models', { headers: { authorization: 'Bearer ' + unified } }, 15000),
  call('http://127.0.0.1:31418/healthz', {}, 8000),
]);
const bridgeIds = ids(bridgeModels.json);
const publicIds = ids(publicModels.json);
const chatTargets = [
  'wb-cn/hy4free',
  'wb-cnhy4free',
  'wb-2/fast-model',
  'ofm/baidu/ernie-5.5-flash-preview:free',
  'ofm/liquid/lfm-3-1.7b:free',
];
const chats = [];
for (const model of chatTargets) chats.push({ model, ...(await chat(model)) });
const stream = await chat('wb-cn/hy4free', true);
const summary = {
  at: new Date().toISOString(),
  health: { status: health.status, routes: health.json?.routes ?? null },
  bridge: {
    status: bridgeModels.status,
    total: bridgeIds.length,
    workbuddy: bridgeIds.filter(x => x.startsWith('wb-cn/') || x.startsWith('wb-2/')).length,
    ourFreeModel: bridgeIds.filter(x => x.startsWith('ofm/')).length,
    samples: bridgeIds.slice(0, 8),
    ids: bridgeIds,
  },
  freeLlmApi: {
    status: publicModels.status,
    total: publicIds.length,
    workbuddy: publicIds.filter(x => x.startsWith('wb-')).length,
    ourFreeModel: publicIds.filter(x => x.startsWith('ofm')).length,
    workbuddySamples: publicIds.filter(x => x.startsWith('wb-')).slice(0, 8),
    ourFreeModelSamples: publicIds.filter(x => x.startsWith('ofm')).slice(0, 8),
  },
  chats,
  stream: { model: 'wb-cn/hy4free', status: stream.status, contentType: stream.contentType, head: String(stream.content).slice(0, 180) },
};
await writeFile(new URL('./dsh-plugin-integration-final.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  at: summary.at, health: summary.health, bridge: { status: summary.bridge.status, total: summary.bridge.total, workbuddy: summary.bridge.workbuddy, ourFreeModel: summary.bridge.ourFreeModel },
  freeLlmApi: { status: summary.freeLlmApi.status, total: summary.freeLlmApi.total, workbuddy: summary.freeLlmApi.workbuddy, ourFreeModel: summary.freeLlmApi.ourFreeModel },
  chats: chats.map(x => ({ model: x.model, status: x.status, content: x.content.slice(0, 80) })),
  stream: { status: summary.stream.status, contentType: summary.stream.contentType, head: summary.stream.head },
}, null, 2));
