// verify-dsh-plugin-models.mjs — verify FreeLLMAPI /v1/models and one chat completion via the bridge.
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.FREELLMAPI_BASE ?? 'http://127.0.0.1:31415';
const lines = (await readFile(new URL('./unified-key.txt', import.meta.url), 'utf8')).split(/\r?\n/);
const key = lines.map(l => (l.match(/^(freellmapi-[0-9a-f]+)/) ?? [])[1]).find(Boolean);
if (!key) throw new Error('unified key not found');
const modelsResp = await fetch(base + '/v1/models', { headers: { authorization: 'Bearer ' + key } });
const modelsJson = await modelsResp.json();
const ids = (modelsJson.data ?? []).map(m => m.id);
const wbCn = ids.filter(id => id.startsWith('wb-cn/'));
const wb2 = ids.filter(id => id.startsWith('wb-2/'));
const ofm = ids.filter(id => id.startsWith('ofm/'));
const model = wbCn.find(id => id.endsWith('/hy4free')) ?? wbCn[0] ?? wb2[0];
let chat = null;
if (model) {
  const r = await fetch(base + '/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with exactly: bridge-ok' }], max_tokens: 32, stream: false }) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  chat = { status: r.status, model, content: j?.choices?.[0]?.message?.content ?? null, error: j?.error ?? null, raw: t.slice(0, 500) };
}
const out = { modelsStatus: modelsResp.status, totalIds: ids.length, wbCn: wbCn.length, wb2: wb2.length, ofm: ofm.length, samples: { wbCn: wbCn.slice(0, 5), wb2: wb2.slice(0, 5), ofm: ofm.slice(0, 5) }, chat };
await writeFile(new URL('./dsh-plugin-verification.json', import.meta.url), JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(out, null, 2));
