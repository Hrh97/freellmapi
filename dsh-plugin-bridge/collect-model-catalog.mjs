// collect-model-catalog.mjs — emit structured FULL live catalog as JSON for AGENTS.md generation.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const read = async p => { try { return await readFile(path.join(here, p), "utf8"); } catch { return ""; } };
const norm = s => String(s).replace(/[\/:]/g, "");
const unified = (String(await read("unified-key.txt")).match(/^(freellmapi-[0-9a-f]+)/m) || [])[1] || "";
const cfg = JSON.parse(await read("dsh-plugin-bridge.config.json"));
const j = async (url, init) => { try { const r = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(20000) }); return { status: r.status, body: await r.json().catch(() => null) }; } catch (e) { return { status: 0, body: null, error: String(e && e.message ? e.message : e) }; } };
const free = "http://127.0.0.1:31415";
const [pub, session, ofmProbe, allTxt] = await Promise.all([
  j(free + "/v1/models", { headers: { authorization: "Bearer " + unified } }),
  j(free + "/api/auth/desktop-session", { method: "POST" }),
  read("ofm-chat-probe.json"), read("all-models.txt"),
]);
const admin = session.body && session.body.token ? { authorization: "Bearer " + session.body.token } : {};
const keys = await j(free + "/api/keys", { headers: admin });
const ver = await j(free + "/api/settings/version", { headers: admin });
const pubRows = (Array.isArray(pub.body && pub.body.data) ? pub.body.data : []).map(r => ({
  id: String((r && r.id) || ""), name: String((r && r.name) || (r && r.id) || ""),
  owned: String((r && r.owned_by) || ""), ctx: (r && (r.context_window ?? r.context_length)) ?? "",
  available: r && r.available, reason: String((r && r.unavailable_reason) || ""),
})).filter(r => r.id);
let keyRows = [];
try { const k = keys.body; keyRows = Array.isArray(k) ? k : Array.isArray(k && k.keys) ? k.keys : Array.isArray(k && k.data) ? k.data : []; } catch {}
const endpoints = keyRows.map(k => ({
  keyId: k && k.id, platform: (k && k.platform) || "", label: (k && (k.label || k.groupLabel)) || "",
  baseUrl: (k && (k.baseUrl || k.base_url)) || "", status: (k && k.status) || "", enabled: !!(k && k.enabled),
  models: (Array.isArray(k && k.models) ? k.models : []).map(m => typeof m === "string" ? m : String((m && (m.modelId || m.id || m.model)) || "")).filter(Boolean),
})).filter(e => e.models.length);
const epNorm = {};
for (const e of endpoints) { epNorm[e.keyId] = new Set(e.models.map(norm)); }
const belongs = (r, kid) => epNorm[kid] && epNorm[kid].has(norm(r.id));
const groups = { wbCn: [], wb2: [], ofm: [], grok: [], glm: [], builtin: {} };
const bkeys = [
  ["glm-", "GLM / 智谱系列"], ["gpt-", "GPT / OpenAI 系列"], ["grok-", "Grok 系列"],
  ["gemini-", "Gemini 系列"], ["claude-", "Claude 系列"], ["deepseek", "DeepSeek 系列"],
  ["qwen", "Qwen 系列"], ["llama-", "Llama 系列"], ["mistral-", "Mistral 系列"],
  ["kimi-", "Kimi 系列"], ["minimax", "MiniMax 系列"], ["ernie-", "文心系列"],
  ["step-", "Step 系列"], ["longcat", "LongCat 系列"], ["mimo-", "MiMo 系列"],
  ["gemma", "Gemma 系列"], ["command", "Command 系列"], ["nova", "Nova 系列"],
  ["phi-", "Phi 系列"], ["auto", "路由别名 auto"], ["fusion", "路由别名 fusion"],
];
const bkeyOf = id => { const s = String(id); for (const [p, n] of bkeys) if (s.startsWith(p)) return n; return "其他内置模型"; };
for (const r of pubRows) {
  if (belongs(r, 8)) {
    if (r.name.startsWith("wb-cn/") || r.name.startsWith("wbcn")) groups.wbCn.push(r);
    else if (r.name.startsWith("wb-2/") || r.name.startsWith("wb-2")) groups.wb2.push(r);
    else groups.ofm.push(r);
  } else if (belongs(r, 7)) groups.grok.push(r);
  else if (belongs(r, 2)) groups.glm.push(r);
  else { const k = bkeyOf(r.id); if (!groups.builtin[k]) groups.builtin[k] = []; groups.builtin[k].push(r); }
}
let probes = [];
try { const o = JSON.parse(ofmProbe); const arr = Array.isArray(o) ? o : Array.isArray(o && o.rows) ? o.rows : Array.isArray(o && o.results) ? o.results : [];
  probes = arr.map(x => ({ model: String((x && (x.model || x.id)) || ""), status: (x && (x.freeStatus ?? (x.free && x.free.status) ?? (x.freeLlmApi && x.freeLlmApi.status) ?? x.status)) ?? null,
    error: String((x && (x.error || (x.free && x.free.error) || (x.bridge && x.bridge.error) || (x.direct && x.direct.error))) || "").slice(0, 220) })); } catch {}
console.log(JSON.stringify({
  at: new Date().toISOString(), version: (ver.body && ver.body.version) || "0.16.23",
  publicTotal: pubRows.length, endpoints, groups, probes,
  allTxtLines: String(allTxt).split(/\r?\n/).filter(Boolean).length,
  keyFile: "D:/Ai/freellmapi/unified-key.txt", unifiedPresent: !!unified,
}));
