// dsh-plugin-bridge.mjs — stable OpenAI-compatible aggregator for DSH plugin model gateways.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(here, 'dsh-plugin-bridge.config.json');
let config = JSON.parse(await readFile(configPath, 'utf8'));

function routes() {
  const list = Array.isArray(config.shims) ? config.shims.filter(x => x && x.enabled !== false && x.baseUrl && x.prefix).map(x => ({ ...x, kind: 'shim' })) : [];
  if (config.ofm && config.ofm.enabled !== false && config.ofm.baseUrl && config.ofm.prefix) list.push({ ...config.ofm, kind: 'ofm' });
  return list;
}
function upstream(r) { return String(r.baseUrl).replace(/\/+$/, ''); }
function upstreamPath(urlPath) {
  const p = String(urlPath).replace(/^\/v1/, '');
  return p.startsWith('/') ? p : '/' + p;
}
function normalizePath(p) {
  const tail = upstreamPath(p);
  return tail === '/' ? '/v1' : '/v1' + tail;
}
function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}
function openAiError(res, status, message, type = 'invalid_request_error') { json(res, status, { error: { message, type } }); }
function authOk(req) {
  const expected = config.bridgeKey;
  if (!expected) return true;
  const got = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim();
  return got === expected || got === 'no-key';
}
function parseModelId(id) {
  const s = String(id ?? '').trim();
  const candidates = routes().slice().sort((a, b) => String(b.prefix).length - String(a.prefix).length);
  for (const r of candidates) {
    const slash = String(r.prefix).replace(/\/$/, '') + '/';
    if (s.startsWith(slash) && s.length > slash.length) return { route: r, realId: s.slice(slash.length), publicId: s };
  }
  // FreeLLMAPI's public /v1/models removes '/' from custom ids: wb-cn/hy4free -> wb-cnhy4free.
  for (const r of candidates) {
    const bare = String(r.prefix).replace(/\/$/, '');
    if (!s.startsWith(bare) || s.length === bare.length) continue;
    const rest = s.slice(bare.length).replace(/^[\/\-_.]+/, '');
    if (rest) return { route: r, realId: rest, publicId: s };
  }
  return null;
}
async function loadConfig() {
  try { config = JSON.parse(await readFile(configPath, 'utf8')); return true; }
  catch (e) { console.error('[dsh-plugin-bridge] config reload failed:', e.message); return false; }
}
async function fetchUpstream(r, method, urlPath, headers, body) {
  const u = new URL(normalizePath(urlPath), upstream(r));
  const h = { ...headers };
  delete h.host; delete h['content-length']; delete h.connection; delete h['accept-encoding'];
  h.authorization = 'Bearer ' + String(r.apiKey ?? '');
  return fetch(u, { method, headers: h, body: body && body.length ? body : undefined, signal: AbortSignal.timeout(10 * 60 * 1000) });
}
async function listModels(req, res) {
  const all = [];
  for (const r of routes()) {
    try {
      const up = await fetchUpstream(r, 'GET', '/v1/models', {}, null);
      if (!up.ok) { console.error('[dsh-plugin-bridge] models', r.id, up.status, await up.text().catch(() => '')); continue; }
      const payload = await up.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      for (const row of rows) {
        const id = String(row?.id ?? '').trim();
        if (!id) continue;
        all.push({ id: String(r.prefix).replace(/\/$/, '') + '/' + id, object: 'model', created: Number(row?.created ?? 0) || 0, owned_by: r.ownedBy ?? 'dsh-plugin-bridge' });
      }
    } catch (e) { console.error('[dsh-plugin-bridge] models', r.id, e.message); }
  }
  json(res, 200, { object: 'list', data: all });
}
function forwardHeaders(up) {
  return Object.fromEntries([...up.headers].filter(([k]) => !['content-encoding','content-length','transfer-encoding','connection'].includes(k.toLowerCase())));
}

function* ssePayloads(text) {
  let data = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('data:')) { data.push(line.slice(5).replace(/^ /, '')); continue; }
    if (line === '') { if (data.length) yield data.join('\n').trim(); data = []; }
  }
  if (data.length) yield data.join('\n').trim();
}

function mergeToolCalls(message, calls) {
  if (!Array.isArray(message.tool_calls)) message.tool_calls = [];
  for (const [fallbackIndex, call] of calls.entries()) {
    if (!call || typeof call !== 'object') continue;
    const idx = Number.isInteger(call.index) ? call.index : fallbackIndex;
    while (message.tool_calls.length <= idx) message.tool_calls.push(null);
    const prev = message.tool_calls[idx] ?? { index: idx, id: '', type: 'function', function: { name: '', arguments: '' } };
    if (call.id) prev.id = call.id;
    if (call.type) prev.type = call.type;
    if (call.function && typeof call.function === 'object') {
      if (typeof call.function.name === 'string' && !prev.function.name) prev.function.name = call.function.name;
      if (typeof call.function.arguments === 'string') prev.function.arguments = (prev.function.arguments ?? '') + call.function.arguments;
    }
    message.tool_calls[idx] = prev;
  }
  message.tool_calls = message.tool_calls.filter(Boolean);
}

function aggregateSse(text, publicId) {
  const protectedKeys = new Set(['object','choices','id','created','model','usage','system_fingerprint','service_tier']);
  const message = { role: 'assistant', content: '' };
  const out = {
    id: 'chatcmpl-dsh-plugin-' + Math.random().toString(36).slice(2),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: publicId,
    choices: [{ index: 0, message, finish_reason: null, logprobs: null }],
    usage: null,
  };
  let saw = false;
  for (const raw of ssePayloads(text)) {
    if (!raw || raw === '[DONE]') continue;
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }
    if (!obj || typeof obj !== 'object') continue;
    if (obj.error) return { error: obj.error, status: Number.isInteger(obj.status) ? obj.status : 502 };
    saw = true;
    if (typeof obj.id === 'string') out.id = obj.id;
    if (Number.isInteger(obj.created)) out.created = obj.created;
    if (typeof obj.system_fingerprint === 'string') out.system_fingerprint = obj.system_fingerprint;
    if (typeof obj.service_tier === 'string') out.service_tier = obj.service_tier;
    if (obj.usage && typeof obj.usage === 'object') out.usage = obj.usage;
    for (const [k, v] of Object.entries(obj)) if (!protectedKeys.has(k)) out[k] = v;
    const choice = Array.isArray(obj.choices) ? obj.choices[0] : null;
    if (!choice) continue;
    const delta = choice.delta ?? choice.message ?? {};
    if (delta.role) message.role = delta.role;
    if (typeof delta.content === 'string') message.content = (message.content ?? '') + delta.content;
    else if (delta.content != null && message.content === '') message.content = delta.content;
    if (typeof delta.reasoning_content === 'string') message.reasoning_content = (message.reasoning_content ?? '') + delta.reasoning_content;
    if (typeof delta.refusal === 'string' && delta.refusal) message.refusal = delta.refusal;
    if (delta.function_call && typeof delta.function_call === 'object') message.function_call = delta.function_call;
    if (Array.isArray(delta.tool_calls)) mergeToolCalls(message, delta.tool_calls);
    if (choice.finish_reason != null) out.choices[0].finish_reason = choice.finish_reason;
    if (choice.logprobs != null) out.choices[0].logprobs = choice.logprobs;
    if (choice.index != null) out.choices[0].index = choice.index;
  }
  if (!saw) return { error: { message: 'upstream returned an empty SSE stream', type: 'upstream_error' }, status: 502 };
  out.object = 'chat.completion';
  out.model = publicId;
  if (out.choices[0].finish_reason == null) out.choices[0].finish_reason = 'stop';
  return { completion: out };
}

function rewriteJsonModel(obj, publicId) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return { ...obj, model: publicId };
}
function rewriteSseText(text, publicId) {
  const source = String(text ?? '');
  const lines = source.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (!line.startsWith('data:')) { out.push(line); continue; }
    const raw = line.slice(5).trim();
    if (!raw || raw === '[DONE]') { out.push(line); continue; }
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        obj.model = publicId;
        if (obj.object === 'chat.completion') obj.object = 'chat.completion.chunk';
        for (const choice of Array.isArray(obj.choices) ? obj.choices : []) {
          const delta = choice?.delta;
          if (!delta || typeof delta !== 'object') continue;
          const content = typeof delta.content === 'string' ? delta.content : '';
          const reasoning = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : (typeof delta.reasoning === 'string' ? delta.reasoning : '');
          if (!content && reasoning) delta.content = reasoning;
        }
        out.push('data: ' + JSON.stringify(obj));
        continue;
      }
    } catch {}
    out.push(line);
  }
  return out.join('\n') + '\n';
}

async function readUpstreamBody(up) {
  if (!up.body) return Buffer.alloc(0);
  const chunks = [];
  const reader = up.body.getReader();
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); }
  } finally { reader.releaseLock?.(); }
  return Buffer.concat(chunks);
}

async function proxyCompletion(req, res, body) {
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); }
  catch { return openAiError(res, 400, 'invalid JSON body'); }
  const parsed = parseModelId(payload.model);
  if (!parsed) return openAiError(res, 400, 'model must use a configured prefix: ' + routes().map(r => r.prefix + '/').join(', '));
  const publicId = parsed.publicId ?? String(payload.model);
  const wantsStream = payload.stream === true;
  payload.model = parsed.realId;
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  const headers = { ...req.headers, 'content-type': 'application/json', 'content-length': String(raw.length), accept: wantsStream ? 'text/event-stream' : 'application/json, text/event-stream' };
  let up;
  try { up = await fetchUpstream(parsed.route, 'POST', '/v1/chat/completions', headers, raw); }
  catch (e) { return openAiError(res, 502, 'upstream request failed: ' + e.message, 'upstream_error'); }
  const ct = String(up.headers.get('content-type') ?? '').toLowerCase();
  console.log('[dsh-plugin-bridge] chat ' + JSON.stringify({ model: publicId, upstream: parsed.route.id, stream: wantsStream, status: up.status, contentType: ct }));
  if (wantsStream) {
    const buf = await readUpstreamBody(up);
    const text = buf.toString('utf8');
    const streamCt = String(up.headers.get('content-type') ?? '').toLowerCase();
    if (streamCt.includes('text/event-stream') || /^\s*(data:|event:)/.test(text)) {
      const rewritten = rewriteSseText(text, publicId);
      const headers = forwardHeaders(up);
      headers['content-type'] = 'text/event-stream; charset=utf-8';
      headers['cache-control'] = 'no-cache';
      headers['content-length'] = String(Buffer.byteLength(rewritten));
      res.writeHead(up.status, headers);
      return res.end(rewritten);
    }
    res.writeHead(up.status, forwardHeaders(up));
    return res.end(buf);
  }
  const buf = await readUpstreamBody(up);
  const text = buf.toString('utf8');
  const isSse = ct.includes('text/event-stream') || /^\s*(data:|event:)/.test(text);
  if (isSse) {
    const agg = aggregateSse(text, publicId);
    if (agg.error) return json(res, agg.status ?? 502, typeof agg.error === 'string' ? { error: { message: agg.error, type: 'upstream_error' } } : { error: agg.error });
    return json(res, up.status, agg.completion);
  }
  if (ct.includes('application/json') || text.trimStart().startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (up.status >= 400) return json(res, up.status, obj);
      return json(res, up.status, rewriteJsonModel(obj, publicId));
    } catch {
      return json(res, up.status, { error: { message: 'upstream returned invalid JSON', type: 'upstream_error' } });
    }
  }
  return json(res, up.status || 502, { error: { message: 'upstream returned a non-JSON body', type: 'upstream_error' } });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const p = url.pathname.replace(/\/+$/, '') || '/';
  if (p === '/healthz' || p === '/health') return json(res, 200, { ok: true, service: 'dsh-plugin-bridge', routes: routes().length });
  if (p === '/reload') { await loadConfig(); return json(res, 200, { ok: true, routes: routes().length }); }
  if (!authOk(req)) return openAiError(res, 401, 'missing or invalid API key', 'authentication_error');
  if (p === '/v1/models' || p === '/models') { if (req.method !== 'GET') return openAiError(res, 405, 'method not allowed'); return listModels(req, res); }
  if (p === '/v1/chat/completions' || p === '/chat/completions') {
    if (req.method !== 'POST') return openAiError(res, 405, 'method not allowed');
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    return proxyCompletion(req, res, Buffer.concat(chunks));
  }
  return openAiError(res, 404, 'not found');
});
server.listen(config.listenPort, config.listenHost, () => console.log('[dsh-plugin-bridge] listening on http://' + config.listenHost + ':' + config.listenPort + '/v1 with ' + routes().length + ' upstream routes'));
