import { readFile } from 'node:fs/promises';
const d = JSON.parse(await readFile('model-connectivity-zero-token.json','utf8'));
const st = {};
for (const p of d.per_model) { const k = String(p.catalog_status ?? 0); st[k] = (st[k]||0)+1; }
const failed = d.per_model.filter(p => p.verdict === 'catalog_error');
const samples = failed.slice(0, 8).map(p => ({ id: p.id, status: p.catalog_status, available: p.available, reason: p.unavailable_reason, es: p.execution_status, src: p.source }));
const serial = [];
const key = (await readFile('unified-key.txt','utf8')).match(/^(freellmapi-[0-9a-f]+)/m)[1];
for (const p of failed.slice(0, 8)) {
  try { const r = await fetch('http://127.0.0.1:31415/v1/models/' + encodeURIComponent(p.id), { headers: { authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(10000) }); const t = await r.text(); serial.push({ id: p.id, status: r.status, head: t.slice(0, 120) }); } catch(e) { serial.push({ id: p.id, err: String(e.message) }); }
  await new Promise(r => setTimeout(r, 120));
}
console.log(JSON.stringify({ statuses: st, verdicts: d.verdict_counts, sampleFailures: samples, serialReprobe: serial, needsKeyCount: d.queries?.needsKey?.count, readyCount: d.queries?.ready?.count, exhaustedCount: d.queries?.exhausted?.count }, null, 2));
