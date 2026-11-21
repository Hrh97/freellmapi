# FreeLLMAPI 项目模型配置（给其他 Agent 读取）

> 本文件由 [generate-agent-model-doc 流水线](<collect-model-catalog.mjs>) 从运行态自动生成，采集时间 `2026-11-21T03:03:16.525Z`。
> 项目目录：`D:\Ai\freellmapi` · 桌面端 FreeLLMAPI **0.16.37** · 监听 `127.0.0.1:31415`。
> 当前 `/v1/models` 共 **419** 个模型 ID，本文全部列出，按来源分组。
> **维护说明（GLM 口径）**：§4.5 与选器里的 GLM 清单是人工维护口径，不随上游目录自动扩充。上游 `open.bigmodel.cn` 目录会返回 12 个 ID，其中只有 `glm-5.3` / `glm-5.3-flash` 是当前模型；重新生成本文时按 `collect-model-catalog.mjs` 的白名单过滤，同步进 Qoder 选器按 `qoder-sync-models.py` 的 `GLM_KEEP` 过滤。历史 ID（GLM-5.2/5.1 → GLM-5.3，GLM-5-Turbo/GLM-4.7 → GLM-5.3-Flash）由官方自动切换，不再作为可用模型列出。


## 1. 统一入口（推荐给所有 Agent）

所有模型都通过同一个 OpenAI 兼容入口调用，不需要分别配置 provider：

```dotenv
OPENAI_BASE_URL=http://127.0.0.1:31415/v1
OPENAI_API_KEY=${FRELLMAPI_KEY}
```

- `${FRELLMAPI_KEY}` 取自 [unified-key.txt](<unified-key.txt>)：匹配 `^(freellmapi-[0-9a-f]+)` 的那一行（第 6 行）。本文件不内联密钥，Agent 运行时读取该文件。
- 统一 key 只用于 `/v1/*`；管理接口 `/api/*` 需要另取 `POST /api/auth/desktop-session` 返回的 dashboard token，不要混用。

```bash
curl http://127.0.0.1:31415/v1/chat/completions \
  -H "Authorization: Bearer ${FRELLMAPI_KEY}" -H "Content-Type: application/json" \
  -d '{"model":"wb-2/fast-model","messages":[{"role":"user","content":"say ok"}],"max_tokens":64}'
```

```python
from openai import OpenAI
import os, re, pathlib
key = re.search(r"^(freellmapi-[0-9a-f]+)", pathlib.Path(r"D:\Ai\freellmapi\unified-key.txt").read_text(), re.M).group(1)
client = OpenAI(base_url="http://127.0.0.1:31415/v1", api_key=key)
client.chat.completions.create(model="glm-5.3-flash", messages=[{"role":"user","content":"hi"}])
```

```javascript
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
const key = (await readFile("D:/Ai/freellmapi/unified-key.txt", "utf8")).match(/^(freellmapi-[0-9a-f]+)/m)[1];
const client = new OpenAI({ baseURL: "http://127.0.0.1:31415/v1", apiKey: key });
await client.chat.completions.create({ model: "grok-4.7", messages: [{ role: "user", content: "hi" }] });
```

流式：请求加 `"stream": true`，返回 `text/event-stream`（已验证 200）。工具调用 / `response_format` / `max_tokens` 按 OpenAI 语义透传。

## 2. 模型 ID 规范化规则（重要）

FreeLLMAPI 对外 `/v1/models` 会把 custom 端点注册 ID 里的 `/` 和 `:` 去掉：

| 注册/桥接原始 ID | 公共 `/v1/models` ID |
|---|---|
| `wb-cn/hy4free` | `wb-cnhy4free` |
| `wb-2/fast-model` | `wb-2fast-model` |
| `ofm/baidu/ernie-5.5-flash-preview:free` | `ofmbaiduernie-5.5-flash-previewfree` |

- 列目录时以本文「公共 ID」列为准；`name` 字段保留原始带斜杠形态。
- 实测请求时**两种写法都能路由**：`wb-cn/hy4free` 与 `wb-cnhy4free`、`wb-2/fast-model` 与 `wb-2fast-model` 都返回 200。推荐用公共 ID，兼容性最稳。
- 内置模型（第 4.4 节）ID 不含斜杠，直接使用。

## 3. 模型来源总览

| keyId | 来源 | 上游 baseUrl | 模型数 | 状态 | 前缀 |
|---|---|---|---|---|---|
| 8 | dsh-plugin-bridge | `http://127.0.0.1:31418/v1` | 77 | healthy | wb-cn/ · wb-2/ · ofm/ |
| 7 | grok-subscription | `http://127.0.0.1:31416/v1` | 9 | healthy | grok-* |
| 2 | open.bigmodel.cn | `https://open.bigmodel.cn/api/coding/paas/v4` | 12 | healthy | glm-* |

- **刚刚接入**：keyId=8 `dsh-plugin-bridge`（WorkBuddy 44 + Our Free Model 18），固定本地端点 `http://127.0.0.1:31418/v1`。
- **原有 custom**：keyId=7 `grok-subscription`（`http://127.0.0.1:31416/v1`）、keyId=2 `open.bigmodel.cn`（智谱 GLM）。keyId=2 上游目录仍返回 12 个 ID，但按官方口径只有 `glm-5.3` / `glm-5.3-flash` 是当前模型，其余 10 个历史/变体 ID 调用时自动切换，可用模型清单只保留 2 个（见 §4.5）。
- **内置目录**：keyId=1/4/5/6（ovh / openrouter / groq / google）由 FreeLLMAPI 内置 provider 与签名目录提供，见第 4.4 节。
- 另有 `auto`、`fusion` 两个路由别名，由 FreeLLMAPI 自身调度。

## 4. 完整模型清单（419 个）

### 4.1 DSH 插件桥接 — WorkBuddy CN `wb-cn/`（15 个，keyId=8）

- `wb-cnhy4flash` — name: `wb-cn/hy4flash`
- `wb-cnhy4flash-free` — name: `wb-cn/hy4flash-free`
- `wb-cndeepseek-v4-pro` — name: `wb-cn/deepseek-v4-pro`
- `wb-cndeepseek-v4.1-flash` — name: `wb-cn/deepseek-v4.1-flash`
- `wb-cnglm-5.2` — name: `wb-cn/glm-5.2`
- `wb-cnglm-5.3` — name: `wb-cn/glm-5.3`
- `wb-cnglm-5.3-flash` — name: `wb-cn/glm-5.3-flash`
- `wb-cnhy4std` — name: `wb-cn/hy4std`
- `wb-cnkimi-k2.8-preview` — name: `wb-cn/kimi-k2.8-preview`
- `wb-cnkimi-k3-1` — name: `wb-cn/kimi-k3-1`
- `wb-cnkimi-k3.1-pro` — name: `wb-cn/kimi-k3.1-pro`
- `wb-cnmimo-v2.6-pro` — name: `wb-cn/mimo-v2.6-pro`
- `wb-cnminimax-m3.1-flash` — name: `wb-cn/minimax-m3.1-flash`
- `wb-cnspace-bunny` — name: `wb-cn/space-bunny`
- `wb-cnstep-5-preview` — name: `wb-cn/step-5-preview`

### 4.2 DSH 插件桥接 — WorkBuddy 2 `wb-2/`（34 个，keyId=8）

- `wb-2gemini-4-argon` — name: `wb-2/gemini-4-argon`
- `wb-2gemini-4-carbon` — name: `wb-2/gemini-4-carbon`
- `wb-2gpt-6.1-terra` — name: `wb-2/gpt-6.1-terra`
- `wb-2gpt-6.2-astra` — name: `wb-2/gpt-6.2-astra`
- `wb-2gpt-6.2-sol` — name: `wb-2/gpt-6.2-sol`
- `wb-2hy4flash` — name: `wb-2/hy4flash`
- `wb-2hy4flash-free` — name: `wb-2/hy4flash-free`
- `wb-2balanced-model` — name: `wb-2/balanced-model`
- `wb-2deepseek-v4.1-flash` — name: `wb-2/deepseek-v4.1-flash`
- `wb-2deepseek-v4.1-flash-sg` — name: `wb-2/deepseek-v4.1-flash-sg`
- `wb-2fast-model` — name: `wb-2/fast-model`
- `wb-2gemini-3.8-flash` — name: `wb-2/gemini-3.8-flash`
- `wb-2glm-5.2` — name: `wb-2/glm-5.2`
- `wb-2glm-5.3` — name: `wb-2/glm-5.3`
- `wb-2glm-5.3-flash` — name: `wb-2/glm-5.3-flash`
- `wb-2gpt-5.4` — name: `wb-2/gpt-5.4`
- `wb-2gpt-5.5` — name: `wb-2/gpt-5.5`
- `wb-2gpt-5.6-luna` — name: `wb-2/gpt-5.6-luna`
- `wb-2gpt-5.6-sol` — name: `wb-2/gpt-5.6-sol`
- `wb-2gpt-5.6-terra` — name: `wb-2/gpt-5.6-terra`
- `wb-2gpt-6-astra` — name: `wb-2/gpt-6-astra`
- `wb-2gpt-6-luna` — name: `wb-2/gpt-6-luna`
- `wb-2gpt-6-sol` — name: `wb-2/gpt-6-sol`
- `wb-2gpt-6.1-sol` — name: `wb-2/gpt-6.1-sol`
- `wb-2grok-4.7` — name: `wb-2/grok-4.7`
- `wb-2hy3` — name: `wb-2/hy3`
- `wb-2hy4-preview` — name: `wb-2/hy4-preview`
- `wb-2hy4std` — name: `wb-2/hy4std`
- `wb-2kimi-k3` — name: `wb-2/kimi-k3`
- `wb-2kimi-k3.1-pro` — name: `wb-2/kimi-k3.1-pro`
- `wb-2kimi-k3.1-pro-highspeed` — name: `wb-2/kimi-k3.1-pro-highspeed`
- `wb-2max-model` — name: `wb-2/max-model`
- `wb-2minimax-m3.1-flash` — name: `wb-2/minimax-m3.1-flash`
- `wb-2primary-model` — name: `wb-2/primary-model`

### 4.3 DSH 插件桥接 — Our Free Model `ofm/`（19 个，keyId=8）

上游 `http://127.0.0.1:18899`（dsh-our-free-model forward），车道状态逐模型记录于 [ofm-chat-probe.json](<ofm-chat-probe.json>)：

- `ofmhy4-flash-free` — name: `ofm/hy4-flash-free`
- `ofmrecursiveflint-v1.0free` — name: `ofm/recursive/flint-v1.0:free`
- `ofmtidepool-alpha-free` — name: `ofm/tidepool-alpha-free`
- `ofmbaiduernie-5.5-flash-previewfree` — name: `ofm/baidu/ernie-5.5-flash-preview:free`
- `ofmdeepseek-aideepseek-v4.1-flash` — name: `ofm/deepseek-ai/deepseek-v4.1-flash`
- `ofmdeepseek-v4.1-flash-free` — name: `ofm/deepseek-v4.1-flash-free`
- `ofmflint-40b-free` — name: `ofm/flint-40b-free`
- `ofmiceman-free` — name: `ofm/iceman-free`
- `ofminclusionailing-3.2-flashfree` — name: `ofm/inclusionai/ling-3.2-flash:free`
- `ofmjev-1.13-free` — name: `ofm/jev-1.13-free`
- `ofmliquidlfm-3-1.7bfree` — name: `ofm/liquid/lfm-3-1.7b:free`
- `ofmlongcat-2.5-free` — name: `ofm/longcat-2.5-free`
- `ofmminimaxaiminimax-m3.1-flash` — name: `ofm/minimaxai/minimax-m3.1-flash`
- `ofmmoonshotaikimi-k3.1-pro` — name: `ofm/moonshotai/kimi-k3.1-pro`
- `ofmopencodedeepseek-v4.1-flash-free` — name: `ofm/opencode/deepseek-v4.1-flash-free`
- `ofmopencodeglm-5.3-flash-free` — name: `ofm/opencode/glm-5.3-flash-free`
- `ofmparticle-aiparticle-1free` — name: `ofm/particle-ai/particle-1:free`
- `ofmstepfun-aistep-5-preview` — name: `ofm/stepfun-ai/step-5-preview`
- `ofmz-aiglm-5.3-flash` — name: `ofm/z-ai/glm-5.3-flash`

- 当前经 FreeLLMAPI 实测 200 的代表：`ofm/baidu/ernie-5.5-flash-preview:free`、`ofm/liquid/lfm-3-1.7b:free`（探测确认 2 条）。
- 6 条 OpenCode 免费车道上游要求本机 Bun；若干 OpenRouter 斜杠 ID 返回 `model request failed: Invalid URL`；`thinkingmachines/inkling-2-small:free` 返回 429。目录已完整挂载，差异来自上游车道本身。

### 4.4 原有 custom — Grok Subscription（9 个，keyId=7）

上游 `http://127.0.0.1:31416/v1`，保持原状，未做改动。

- `grok-4.20-0309-non-reasoning`
- `grok-4.20-0309-reasoning`
- `grok-4.20-multi-agent-0309`
- `grok-4.3`
- `grok-4.5`
- `grok-4.6`
- `grok-4.7`
- `grok-4.7-build-fast`
- `grok-build-0.1`

### 4.5 原有 custom — 智谱 GLM / open.bigmodel.cn（可用 2 个，keyId=2）

上游 `https://open.bigmodel.cn/api/coding/paas/v4`。原有自检脚本 [check-freellmapi.ps1](<check-freellmapi.ps1>) 用的就是 `glm-5.3-flash`。

> **智谱官方口径（所有套餐均支持）**：当前真模型只有 `GLM-5.3` 与 `GLM-5.3-Flash` 两个。
> 调用历史模型 `GLM-5.2`、`GLM-5.1` 将自动切换至 `GLM-5.3`；调用 `GLM-5-Turbo`、`GLM-4.7`
> 将自动切换至 `GLM-5.3-Flash`（`GLM-4.5` / `GLM-4.6` / `GLM-4.5-air` / `GLM-5` 同族历史 ID 同理）。
> 因此上游目录里那 10 个历史/变体 ID 不再列入可用模型，选器只暴露下面两个。

- `glm-5.3` — name: `GLM-5.3` · ctx 1000000
- `glm-5.3-flash` — name: `GLM-5.3-Flash` · ctx 128000

### 4.6 内置目录 / 其他 provider（330 个）

由 FreeLLMAPI 内置 provider（ovh / openrouter / groq / google 等）与签名模型目录提供，按 ID 前缀分组。这一组是接入插件之前就有的 **330** 个模型。

#### 路由别名 auto（2）

- `auto` — name: `Auto (router picks the best available model)` · ctx 209715
- `auto-route` — name: `Auto route` · ctx 104857 · **unavailable** (no_key)

#### 路由别名 fusion（1）

- `fusion` — name: `Fusion (panel of models answer in parallel, a judge synthesizes one answer)` · ctx 209715

#### Claude 系列（4）

- `claude-opus-4-5` — name: `Opus slot (auto-routed to a free model)` · ctx 209715
- `claude-sonnet-4-5` — name: `Sonnet slot (auto-routed to a free model)` · ctx 209715
- `claude-haiku-4-5` — name: `Haiku slot (auto-routed to a free model)` · ctx 209715
- `claude-haiku-4.5` — name: `Claude Haiku 4.5` · **unavailable** (no_key)

#### Gemini 系列（13）

- `gemini-3.8-flash` — name: `Gemini 3.8 Flash` · ctx 800000
- `gemini-flash` — name: `Gemini Flash`
- `gemini-3.7-flash` — name: `Gemini 3.7 Flash` · ctx 838860
- `gemini-3.6-flash` — name: `Gemini 3.6 Flash` · ctx 838860
- `gemini-3.5-flash` — name: `Gemini 3.5 Flash` · ctx 838860
- `gemini-robotics-er-2-preview` — name: `Gemini Robotics-ER 2 Preview` · ctx 104857
- `gemini-3.5-flash-lite` — name: `Gemini 3.5 Flash Lite` · ctx 800000
- `gemini-flash-lite` — name: `Gemini Flash Lite`
- `gemini-3-flash-preview` — name: `Gemini 3 Flash Preview` · ctx 838860
- `gemini-3.1-flash-lite-preview` — name: `Gemini 3.1 Flash Lite Preview`
- `gemini-3.1-flash-lite` — name: `Gemini 3.1 Flash-Lite` · ctx 838860
- `gemini-2.5-flash` — name: `Gemini 2.5 Flash` · ctx 838860
- `gemini-2.5-flash-lite` — name: `Gemini 2.5 Flash-Lite` · ctx 800000

#### 其他内置模型（125）

- `dots3-note-preview` — name: `Dots3 Note Preview` · ctx 409600
- `nemotron-3.5-super-vl` — name: `Nemotron 3.5 Super VL` · ctx 800000
- `north-mini-code` — name: `North Mini Code` · ctx 204800
- `nemotron-3.5-lightning` — name: `Nemotron 3.5 Lightning` · ctx 838860
- `ofmamddeepseek-v4-flash` — name: `ofm/amd/DeepSeek-V4-Flash`
- `ofmamddeepseek-v4.1-flash` — name: `ofm/amd/DeepSeek-V4.1-Flash`
- `ofmamdgemma-4-31b-it` — name: `ofm/amd/Gemma-4-31B-IT`
- `ofmamdglm-5.3-flash` — name: `ofm/amd/GLM-5.3-Flash`
- `ofmamdmimo-v2.6-flash` — name: `ofm/amd/MiMo-V2.6-Flash`
- `ofmamdminicpm-v-4.7-1b` — name: `ofm/amd/MiniCPM-V-4.7-1B`
- `ofmamdminicpm-v-4.7-35b-a3b` — name: `ofm/amd/MiniCPM-V-4.7-35B-A3B`
- `ofmamdminicpm5-2b` — name: `ofm/amd/MiniCPM5-2B`
- `ofmamdqwen3.8-27b` — name: `ofm/amd/Qwen3.8-27B`
- `nemotron-3-nano-30b-reasoning` — name: `Nemotron 3 Nano 30B Reasoning` · ctx 209715
- `agnes-3.0-flash` — name: `Agnes 3.0 Flash` · **unavailable** (no_key)
- `nex-n2.5-pro` · ctx 209715 · **unavailable** (no_key)
- `google-gemma-2-27b` — name: `Google: Gemma 2 27B` · ctx 6400 · **unavailable** (no_key)
- `google-gemma-3-27b` — name: `Google: Gemma 3 27B` · ctx 25600 · **unavailable** (no_key)
- `ling-3.1-flash` — name: `Ling 3.1 Flash` · ctx 209715 · **unavailable** (no_key)
- `moondream-3-preview` — name: `Moondream 3 Preview` · **unavailable** (no_key)
- `moondream-3.1-9b-a2b` — name: `Moondream 3.1 9B A2B` · ctx 26214 · **unavailable** (no_key)
- `nvidia-nemotron-3-nano-30b-a3b` — name: `NVIDIA Nemotron 3 Nano 30B A3B` · ctx 6553 · **unavailable** (no_key)
- `openai-gpt-oss-20b` — name: `OpenAI: GPT OSS 20B` · ctx 102400 · **unavailable** (no_key)
- `openai-gpt-6-luna` — name: `OpenAI: GPT-6 Luna` · ctx 840000 · **unavailable** (no_key)
- `plugsky-lite` — name: `Plugsky Lite` · ctx 104857 · **unavailable** (no_key)
- `plugsky-micro` — name: `Plugsky Micro` · ctx 209715 · **unavailable** (no_key)
- `tencent-hy4-preview` — name: `Tencent: Hy4 Preview` · ctx 800000 · **unavailable** (no_key)
- `typhoon-2.5-30b-a3b-instruct` — name: `Typhoon 2.5 30B A3B Instruct` · ctx 104857 · **unavailable** (no_key)
- `xiaomi-mimo-v2.6-flash` — name: `Xiaomi: MiMo V2.6 Flash` · ctx 800000 · **unavailable** (no_key)
- `zhipuai-glm-4.5-air` — name: `ZhipuAI: GLM 4.5 Air` · ctx 104800 · **unavailable** (no_key)
- `laguna-s-2.1` — name: `Laguna S 2.1` · ctx 209600 · **unavailable** (no_key)
- `ling-3.0-flash-vl` · ctx 209715 · **unavailable** (no_key)
- `poolside-laguna-s-2.1` — name: `Poolside Laguna S 2.1` · ctx 209715 · **unavailable** (no_key)
- `nemotron-3-ultra` — name: `Nemotron 3 Ultra` · ctx 800000 · **unavailable** (no_key)
- `nemotron-3-ultra-550b` — name: `Nemotron 3 Ultra 550B` · ctx 800000 · **unavailable** (no_key)
- `agnes-2.5-flash` — name: `Agnes 2.5 Flash` · ctx 209715 · **unavailable** (no_key)
- `nex-n2.5-mini` · ctx 209715 · **unavailable** (no_key)
- `ling-3.0-flash-sante` · ctx 209715 · **unavailable** (no_key)
- `sensenova-6.8-flash-lite` — name: `SenseNova 6.8 Flash-Lite` · ctx 209715 · **unavailable** (no_key)
- `aion-3.0` — name: `Aion 3.0` · ctx 104857 · **unavailable** (no_key)
- `muse-glimmer-30b` — name: `Muse Glimmer 30B` · ctx 104857 · **unavailable** (no_key)
- `aion-3.0-mini` — name: `Aion 3.0 Mini` · ctx 104857 · **unavailable** (no_key)
- `laguna-xs-2.1` — name: `Laguna XS 2.1` · ctx 209600 · **unavailable** (no_key)
- `poolside-laguna-xs-2.1` — name: `Poolside Laguna XS 2.1` · ctx 104857 · **unavailable** (no_key)
- `kilo-auto` — name: `Kilo Auto` · ctx 204800 · **unavailable** (no_key)
- `free-router` — name: `Free Router` · ctx 160000 · **unavailable** (no_key)
- `nemotron-3-120b` — name: `Nemotron 3 120B` · ctx 209715 · **unavailable** (no_key)
- `nemotron-3-super-120b` — name: `Nemotron 3 Super 120B` · ctx 209715 · **unavailable** (no_key)
- `nemotron-3.5-lightning-30b` — name: `Nemotron 3.5 Lightning 30B` · ctx 838860 · **unavailable** (no_key)
- `nemotron-3.5-lightning-30b-a3b` — name: `Nemotron 3.5 Lightning 30B A3B` · ctx 800000 · **unavailable** (no_key)
- `nemotron-3-super-120b-a12b` · ctx 209715 · **unavailable** (no_key)
- `aion-2.0` — name: `Aion 2.0` · ctx 104857 · **unavailable** (no_key)
- `bazaarlink-auto` — name: `BazaarLink Auto` · ctx 104857 · **unavailable** (no_key)
- `logfare-auto` — name: `Logfare Auto` · ctx 104857 · **unavailable** (no_key)
- `default` — name: `Default` · **unavailable** (no_key)
- `diffusiongemma-26b-a4b-it` — name: `DiffusionGemma 26B A4B IT` · ctx 209715 · **unavailable** (no_key)
- `qwq-32b` — name: `QwQ 32B` · ctx 104857 · **unavailable** (no_key)
- `devstral-2` — name: `Devstral 2` · ctx 209715 · **unavailable** (no_key)
- `nemotron-3-nano-omni` — name: `Nemotron 3 Nano Omni` · ctx 204800 · **unavailable** (no_key)
- `nemotron-3-nano-omni-30b-a3b-reasoning` — name: `Nemotron 3 Nano Omni 30B A3B Reasoning` · ctx 209715 · **unavailable** (no_key)
- `nemotron-3-nano-omni-reasoning` — name: `Nemotron 3 Nano Omni Reasoning` · ctx 204800 · **unavailable** (no_key)
- `lfm-2.5-2.6b` · ctx 26214 · **unavailable** (no_key)
- `r1-distill-qwen-32b` — name: `R1 Distill Qwen 32B` · ctx 104800 · **unavailable** (no_key)
- `ch.at` · **unavailable** (no_key)
- `ising-calibration-1.5-31b` — name: `Ising Calibration 1.5 31B` · ctx 104857 · **unavailable** (no_key)
- `rnj-1` · **unavailable** (no_key)
- `unmoderated-gpt` · **unavailable** (no_key)
- `groq-compound-mini` — name: `Groq Compound Mini` · ctx 104857 · **unavailable** (no_key)
- `hermes-3-llama-3.1-405b` — name: `Hermes 3 Llama 3.1 405B` · ctx 102400 · **unavailable** (no_key)
- `ministral-14b` — name: `Ministral 14B` · ctx 209715 · **unavailable** (no_key)
- `ministral-3-14b` — name: `Ministral 3 14B` · ctx 209715 · **unavailable** (no_key)
- `ministral-14b-2512` · ctx 209715 · **unavailable** (no_key)
- `ministral-14b-latest` · ctx 209715 · **unavailable** (no_key)
- `aion-rp-llama-3.1-8b` — name: `Aion-RP Llama 3.1 8B` · ctx 26214 · **unavailable** (no_key)
- `hunyuan-a13b-instruct` — name: `Hunyuan A13B Instruct` · ctx 102400 · **unavailable** (no_key)
- `leanstral-1.5` — name: `Leanstral 1.5` · ctx 209715 · **unavailable** (no_key)
- `ministral-3-3b` — name: `Ministral 3 3B` · ctx 104857 · **unavailable** (no_key)
- `ministral-3-8b` — name: `Ministral 3 8B` · ctx 209715 · **unavailable** (no_key)
- `ministral-3b` — name: `Ministral 3B` · ctx 209715 · **unavailable** (no_key)
- `ministral-8b` — name: `Ministral 8B` · ctx 209600 · **unavailable** (no_key)
- `ministral-3b-2512` · ctx 209715 · **unavailable** (no_key)
- `ministral-3b-latest` · ctx 209715 · **unavailable** (no_key)
- `ministral-8b-2512` · ctx 209715 · **unavailable** (no_key)
- `ministral-8b-latest` · ctx 209715 · **unavailable** (no_key)
- `north-small-translate` — name: `North Small Translate` · ctx 26214 · **unavailable** (no_key)
- `tiny-aya-global` — name: `Tiny Aya Global` · ctx 6553 · **unavailable** (no_key)
- `codestral` — name: `Codestral` · ctx 25600 · **unavailable** (no_key)
- `codestral-2508` — name: `Codestral 2508` · ctx 204800 · **unavailable** (no_key)
- `codestral-latest` · ctx 25600 · **unavailable** (no_key)
- `hermes-4-14b` — name: `Hermes 4 14B` · ctx 32000 · **unavailable** (no_key)
- `impish-llama-4b` — name: `Impish LLAMA 4B` · **unavailable** (no_key)
- `open-mistral-nemo-2407` — name: `Open Mistral Nemo 2407` · ctx 104800 · **unavailable** (no_key)
- `open-mistral-nemo` · **unavailable** (no_key)
- `tiny-aya-earth` — name: `Tiny Aya Earth` · ctx 6553 · **unavailable** (no_key)
- `tiny-aya-fire` — name: `Tiny Aya Fire` · ctx 6553 · **unavailable** (no_key)
- `tiny-aya-water` — name: `Tiny Aya Water` · ctx 6553 · **unavailable** (no_key)
- `devstral-small-2` — name: `Devstral Small 2` · ctx 209600 · **unavailable** (no_key)
- `mythomax-l2-13b` — name: `MythoMax L2 13B` · ctx 3200 · **unavailable** (no_key)
- `ctx65536-magidonia-24b-heretic` — name: `[ctx:65536] Magidonia-24B-heretic-` · **unavailable** (no_key)
- `allam-2-7b` — name: `ALLaM 2 7B` · ctx 3276 · **unavailable** (no_key)
- `behemoth-x-123b-v2-1` — name: `Behemoth-X-123B-v2 1` · **unavailable** (no_key)
- `granite-4.0-h-micro` — name: `Granite 4.0 H Micro` · ctx 104857 · **unavailable** (no_key)
- `riva-translate-4b-instruct-v2` — name: `Riva Translate 4B Instruct v2` · ctx 26214 · **unavailable** (no_key)
- `thedrummer-behemoth-128b-v3-q4-k-m` — name: `TheDrummer Behemoth-128B-v3-Q4 K M` · **unavailable** (no_key)
- `voxtral-small` — name: `Voxtral Small` · ctx 26214 · **unavailable** (no_key)
- `voxtral-small-2507` — name: `Voxtral Small 2507` · ctx 26214 · **unavailable** (no_key)
- `voxtral-small-latest` · ctx 26214 · **unavailable** (no_key)
- `aya-expanse-32b` — name: `Aya Expanse 32B` · ctx 104857 · **unavailable** (no_key)
- `aya-vision-32b` — name: `Aya Vision 32B` · ctx 13107 · **unavailable** (no_key)
- `cydonia-24b-v4.3` — name: `Cydonia 24B v4.3` · ctx 6553 · **unavailable** (no_key)
- `nemotron-3.5-content-safety` — name: `Nemotron 3.5 Content Safety` · ctx 102400 · **unavailable** (no_key)
- `nemotron-parse-2.0` — name: `Nemotron Parse 2.0` · **unavailable** (no_key)
- `skyfall-31b-v4.2` — name: `Skyfall 31B v4.2` · ctx 3276 · **unavailable** (no_key)
- `angelic-eclipse-12b` — name: `Angelic Eclipse 12B` · ctx 3276 · **unavailable** (no_key)
- `forgotten-safeword-22b` — name: `Forgotten-Safeword-22B` · **unavailable** (no_key)
- `impish-bloodmoon-12b` — name: `Impish Bloodmoon 12B` · **unavailable** (no_key)
- `l3-8b-lunaris-v1` — name: `L3 8B Lunaris v1` · ctx 6400 · **unavailable** (no_key)
- `l3-8b-stheno-v3-2-q5-k-m` — name: `L3-8B-Stheno-v3 2-Q5 K M` · **unavailable** (no_key)
- `llava-1.5-7b` — name: `LLaVA 1.5 7B` · ctx 3276 · **unavailable** (no_key)
- `mini-magnum-12b-v1.1` — name: `Mini Magnum 12B v1.1` · ctx 3276 · **unavailable** (no_key)
- `mn-violet-lotus-12b-q8-0` — name: `MN-Violet-Lotus-12B Q8 0` · **unavailable** (no_key)
- `thea-rp-3b-25r` · **unavailable** (no_key)
- `sea-guard` — name: `SEA-Guard` · ctx 6553 · **unavailable** (no_key)
- `cerebras-gpt-111m-instruct` — name: `Cerebras GPT 111M Instruct` · ctx 3276 · **unavailable** (no_key)
- `pythia-70m-deduped` — name: `Pythia 70M Deduped` · ctx 3276 · **unavailable** (no_key)

#### Qwen 系列（59）

- `qwen3.8-27b` — name: `Qwen3.8 27B` · ctx 209600
- `qwen3.6-27b` — name: `Qwen3.6 27B` · ctx 104857
- `qwen3.5-397b` — name: `Qwen3.5 397B` · ctx 209715
- `qwen3.5-9b` — name: `Qwen3.5 9B` · ctx 209715
- `qwen2.5-vl-72b` — name: `Qwen2.5 VL 72B` · ctx 26214
- `qwen3guard-gen-8b` — name: `Qwen3Guard Gen 8B` · ctx 26214
- `qwen3guard-gen-0.6b` — name: `Qwen3Guard Gen 0.6B` · ctx 26214
- `qwen3.8-max` — name: `Qwen3.8 Max` · **unavailable** (no_key)
- `qwen3.8-flash` — name: `Qwen3.8 Flash` · ctx 6553 · **unavailable** (no_key)
- `qwen3.8-flash-next` — name: `Qwen3.8 Flash Next` · ctx 209600 · **unavailable** (no_key)
- `qwen-3.8-27b` — name: `Qwen 3.8 27B` · ctx 209715 · **unavailable** (no_key)
- `qwen3.7-max` — name: `Qwen3.7 Max` · **unavailable** (no_key)
- `qwen-3-14b` — name: `Qwen 3 14B` · ctx 6553 · **unavailable** (no_key)
- `qwen-3-vl-235b-a22b-instruct` — name: `Qwen 3 VL 235B A22B Instruct` · ctx 6553 · **unavailable** (no_key)
- `qwen-3-vl-30b-a3b-instruct` — name: `Qwen 3 VL 30B A3B Instruct` · ctx 6553 · **unavailable** (no_key)
- `qwen-3.5-9b` — name: `Qwen 3.5 9B` · ctx 6553 · **unavailable** (no_key)
- `qwen-3.6-35b-a3b` — name: `Qwen 3.6 35B A3B` · ctx 6553 · **unavailable** (no_key)
- `qwen2.5-72b-fp8` — name: `Qwen2.5 72B FP8` · ctx 6553 · **unavailable** (no_key)
- `qwen3-30b-a3b-fp8` — name: `Qwen3 30B A3B FP8` · ctx 6553 · **unavailable** (no_key)
- `qwen3-32b-fp8` — name: `Qwen3 32B FP8` · ctx 6553 · **unavailable** (no_key)
- `qwen3-coder-480b-a35b-instruct` — name: `Qwen3 Coder 480B A35B Instruct` · ctx 6553 · **unavailable** (no_key)
- `qwen3-next-80b-a3b-instruct` — name: `Qwen3 Next 80B A3B Instruct` · ctx 102400 · **unavailable** (no_key)
- `qwen3.5-35b-a3b` — name: `Qwen3.5 35B A3B` · ctx 6553 · **unavailable** (no_key)
- `qwen3.6-max-preview` — name: `Qwen3.6 Max Preview` · **unavailable** (no_key)
- `qwen3.8-27b-omnimerge-v6` — name: `Qwen3.8-27B-Omnimerge-v6` · ctx 209600 · **unavailable** (no_key)
- `qwen3.8-27b-swift` — name: `Qwen3.8-27B-Swift` · ctx 209600 · **unavailable** (no_key)
- `qwen3.6-plus` — name: `Qwen3.6 Plus` · **unavailable** (no_key)
- `qwen3.7-plus` — name: `Qwen3.7 Plus` · **unavailable** (no_key)
- `qwen3.5-omni-plus` — name: `Qwen3.5 Omni Plus` · **unavailable** (no_key)
- `qwen-sea-lion-v4.5-27b` — name: `Qwen SEA-LION v4.5 27B` · ctx 26214 · **unavailable** (no_key)
- `qwen3.5-plus` — name: `Qwen3.5 Plus` · **unavailable** (no_key)
- `qwen3.7-flash` — name: `Qwen3.7 Flash` · ctx 209715 · **unavailable** (no_key)
- `qwen3.5-397b-a17b` — name: `Qwen3.5 397B A17B` · ctx 209715 · **unavailable** (no_key)
- `qwen3.6-35b-a3b` — name: `Qwen3.6 35B A3B` · **unavailable** (no_key)
- `qwen3-max` — name: `Qwen3 Max` · **unavailable** (no_key)
- `qwen3.5-flash` — name: `Qwen3.5 Flash` · **unavailable** (no_key)
- `qwen3-235b-a22b-thinking-2507` — name: `Qwen3 235B A22B Thinking 2507` · ctx 209715 · **unavailable** (no_key)
- `qwen3-235b-a22b-instruct-2507` — name: `Qwen3 235B A22B Instruct 2507` · ctx 209715 · **unavailable** (no_key)
- `qwen3-coder` — name: `Qwen3 Coder` · ctx 102400 · **unavailable** (no_key)
- `qwen3.5-omni-flash` — name: `Qwen3.5 Omni Flash` · **unavailable** (no_key)
- `qwen3-coder-plus` — name: `Qwen3 Coder Plus` · **unavailable** (no_key)
- `qwen3-next-80b-a3b-thinking` — name: `Qwen3 Next 80B A3B Thinking` · ctx 209715 · **unavailable** (no_key)
- `qwen-plus-2025-07-28` — name: `Qwen Plus 2025-07-28` · **unavailable** (no_key)
- `qwen3-vl-235b-a22b-instruct` — name: `Qwen3 VL 235B A22B Instruct` · ctx 104857 · **unavailable** (no_key)
- `qwen3-vl-plus` — name: `Qwen3 VL Plus` · **unavailable** (no_key)
- `qwen3-coder-30b-a3b-instruct` — name: `Qwen3 Coder 30B A3B Instruct` · ctx 209600 · **unavailable** (no_key)
- `qwen3-omni-flash` — name: `Qwen3 Omni Flash` · **unavailable** (no_key)
- `qwen-sea-lion-v4-32b` — name: `Qwen SEA-LION v4 32B` · ctx 26214 · **unavailable** (no_key)
- `qwen2.5-72b-instruct` — name: `Qwen2.5 72B Instruct` · ctx 25600 · **unavailable** (no_key)
- `qwen3-30b-a3b-instruct-2507` — name: `Qwen3 30B A3B Instruct 2507` · ctx 104800 · **unavailable** (no_key)
- `qwen2.5-32b-instruct` — name: `Qwen2.5 32B Instruct` · ctx 104800 · **unavailable** (no_key)
- `qwen2.5-coder-32b` — name: `Qwen2.5 Coder 32B` · ctx 26214 · **unavailable** (no_key)
- `qwen2.5-coder-32b-instruct` — name: `Qwen2.5 Coder 32B Instruct` · ctx 26400 · **unavailable** (no_key)
- `qwen2.5-7b-instruct` — name: `Qwen2.5 7B Instruct` · ctx 104800 · **unavailable** (no_key)
- `qwen2.5-coder-7b-instruct` — name: `Qwen2.5 Coder 7B Instruct` · ctx 25600 · **unavailable** (no_key)
- `qwen3-4b-nymphaea-rp-i1-q4-k-s` — name: `Qwen3-4B-Nymphaea-RP i1-Q4 K S` · **unavailable** (no_key)
- `qwen3.5-0.8b` — name: `Qwen3.5 0.8B` · ctx 3276 · **unavailable** (no_key)
- `qwen3-0.6b-iq4` — name: `Qwen3 0.6B IQ4` · ctx 3276 · **unavailable** (no_key)
- `qwen2.5-coder-3b-instruct` — name: `Qwen2.5 Coder 3B Instruct` · **unavailable** (no_key)

#### Gemma 系列（27）

- `gemma-4-31b-it` — name: `Gemma 4 31B IT` · ctx 26214
- `gemma-4-31b` — name: `Gemma 4 31B` · ctx 209715
- `gemma-4-26b-it` — name: `Gemma 4 26B IT` · ctx 26214
- `gemma-4-26b-a4b` — name: `Gemma 4 26B-A4B` · ctx 209600
- `gemma-3-12b` — name: `Gemma 3 12B` · ctx 6553 · **unavailable** (no_key)
- `gemma-3-27b` — name: `Gemma 3 27B` · ctx 6553 · **unavailable** (no_key)
- `gemma-3-4b` — name: `Gemma 3 4B` · ctx 6553 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it` — name: `Gemma 4 26B A4B IT` · ctx 6553 · **unavailable** (no_key)
- `gemma-e4b` — name: `Gemma E4B` · ctx 104857 · **unavailable** (no_key)
- `gemma-4-31b-aura-large-v1.1` — name: `Gemma-4-31B-Aura-Large-v1.1` · ctx 209600 · **unavailable** (no_key)
- `gemma-4-26b` — name: `Gemma 4 26B` · **unavailable** (no_key)
- `gemma-4-31b-heretic` — name: `Gemma 4 31B Heretic` · ctx 3276 · **unavailable** (no_key)
- `gemma-4-e4b-uncensored-aggressive` — name: `Gemma 4 E4B Uncensored Aggressive` · ctx 3276 · **unavailable** (no_key)
- `gemma-4-e4b-uncensored-hauhaucs-aggressive-q4-k-m` — name: `Gemma-4-E4B-Uncensored-HauhauCS-Aggressive-Q4 K M` · **unavailable** (no_key)
- `gemma-3-1b` — name: `Gemma 3 1B` · ctx 25600 · **unavailable** (no_key)
- `gemma-3-4b-it` — name: `gemma 3 4b it` · ctx 25600 · **unavailable** (no_key)
- `gemma-sea-lion-v4-27b` — name: `Gemma SEA-LION v4 27B` · ctx 104857 · **unavailable** (no_key)
- `gemma-3-12b-it` — name: `gemma 3 12b it` · ctx 25600 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it-chimerax` — name: `Gemma 4 26B A4B IT chimerax` · ctx 49600 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it-darksoul` — name: `Gemma 4 26B A4B IT darksoul` · ctx 49600 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it-luminous` — name: `Gemma 4 26B A4B IT luminous` · ctx 49600 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it-meromero` — name: `Gemma 4 26B A4B IT meromero` · ctx 49600 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it-moonlight` — name: `Gemma 4 26B A4B IT moonlight` · ctx 49600 · **unavailable** (no_key)
- `gemma-4-26b-a4b-it-musica` — name: `Gemma 4 26B A4B IT musica` · ctx 49600 · **unavailable** (no_key)
- `gemma-2-9b` — name: `Gemma 2 9B` · ctx 6400 · **unavailable** (no_key)
- `gemma-2b-it-lora` — name: `Gemma 2B IT LoRA` · ctx 6553 · **unavailable** (no_key)
- `gemma-7b-it-lora` — name: `Gemma 7B IT LoRA` · ctx 6553 · **unavailable** (no_key)

#### GPT / OpenAI 系列（14）

- `gpt-oss-120b` — name: `GPT Oss 120B` · ctx 104857
- `gpt-oss-20b` — name: `GPT Oss 20B` · ctx 104857
- `gpt-5.6-luna` — name: `GPT-5.6 Luna` · ctx 800000 · **unavailable** (no_key)
- `gpt-6-luna` — name: `Gpt 6 Luna` · ctx 800000 · **unavailable** (no_key)
- `gpt-oss-safeguard-20b` — name: `GPT OSS Safeguard 20B` · ctx 104857 · **unavailable** (no_key)
- `gpt-oss20b` — name: `gpt-oss:20b` · ctx 102400 · **unavailable** (no_key)
- `gpt-5.4-mini` — name: `GPT 5.4 Mini` · ctx 320000 · **unavailable** (no_key)
- `gpt-5.4-nano` — name: `GPT 5.4 Nano` · ctx 320000 · **unavailable** (no_key)
- `gpt-5-mini` — name: `GPT 5 Mini` · ctx 320000 · **unavailable** (no_key)
- `gpt-4.1` — name: `GPT 4.1` · ctx 800000 · **unavailable** (no_key)
- `gpt-5-nano` — name: `GPT 5 Nano` · ctx 320000 · **unavailable** (no_key)
- `gpt-4.1-mini` — name: `GPT 4.1 Mini` · ctx 800000 · **unavailable** (no_key)
- `gpt-4o` — name: `GPT 4o` · ctx 102400 · **unavailable** (no_key)
- `gpt-4o-mini` — name: `GPT 4o Mini` · ctx 102400 · **unavailable** (no_key)

#### Llama 系列（26）

- `llama-3.3-70b` — name: `Llama 3.3 70B` · ctx 104857
- `llama-3.1-8b` — name: `Llama 3.1 8B` · ctx 104857 · **unavailable** (no_key)
- `llama-3.3-70b-instruct` — name: `Llama 3.3 70B Instruct` · ctx 6553 · **unavailable** (no_key)
- `llama-4-scout-17b-16e-instruct` — name: `Llama 4 Scout 17B 16E Instruct` · ctx 6553 · **unavailable** (no_key)
- `llama-3.3-70b-fp8-fast` — name: `Llama 3.3 70B fp8-fast` · ctx 19200 · **unavailable** (no_key)
- `llama-4-scout` — name: `Llama 4 Scout` · ctx 104857 · **unavailable** (no_key)
- `llama-3.2-3b` — name: `Llama 3.2 3B` · ctx 102400 · **unavailable** (no_key)
- `llama-3.2-90b-vision` — name: `Llama 3.2 90B Vision` · ctx 104857 · **unavailable** (no_key)
- `llama-sea-lion-v3-70b` — name: `Llama SEA-LION v3 70B` · ctx 104857 · **unavailable** (no_key)
- `llama-3-2-3b-instruct` — name: `Llama-3 2-3B-Instruct` · ctx 104857 · **unavailable** (no_key)
- `llama-3-2-3b-instruct-q4-k-m` — name: `Llama-3 2-3B-Instruct-Q4 K M` · **unavailable** (no_key)
- `llama-instant` · **unavailable** (no_key)
- `llama-3.2-11b-vision` — name: `Llama 3.2 11B Vision` · ctx 104857 · **unavailable** (no_key)
- `llama-3.2-1b` — name: `Llama 3.2 1B` · ctx 102400 · **unavailable** (no_key)
- `llama-3.2-1b-instruct` — name: `Llama 3.2 1B Instruct` · ctx 104857 · **unavailable** (no_key)
- `llama-3.2-1b-unsloth` — name: `Llama 3.2 1B Unsloth` · ctx 3276 · **unavailable** (no_key)
- `llama-3-2-1b-instruct` — name: `Llama-3 2-1B-Instruct` · ctx 104857 · **unavailable** (no_key)
- `llama-3-stheno-8b-v3.2` — name: `Llama 3 Stheno 8B v3.2` · ctx 3276 · **unavailable** (no_key)
- `llama-3-super-nova-rp-8b` — name: `Llama 3 Super Nova RP 8B` · ctx 3276 · **unavailable** (no_key)
- `llama-2-7b-chat-lora` — name: `Llama 2 7B Chat LoRA` · ctx 6553 · **unavailable** (no_key)
- `llama-3.1-nemoguard-8b-content-safety` — name: `Llama 3.1 NemoGuard 8B Content Safety` · ctx 104857 · **unavailable** (no_key)
- `llama-3.1-nemoguard-8b-topic-control` — name: `Llama 3.1 NemoGuard 8B Topic Control` · ctx 104857 · **unavailable** (no_key)
- `llama-3.1-nemotron-safety-guard-8b-v3` — name: `Llama 3.1 Nemotron Safety Guard 8B v3` · ctx 104857 · **unavailable** (no_key)
- `llama-guard-3-8b` — name: `Llama Guard 3 8B` · ctx 104857 · **unavailable** (no_key)
- `llama-prompt-guard-2-22m` — name: `Llama Prompt Guard 2 22M` · ctx 409 · **unavailable** (no_key)
- `llama-prompt-guard-2-86m` — name: `Llama Prompt Guard 2 86M` · ctx 409 · **unavailable** (no_key)

#### Mistral 系列（21）

- `mistral-small-3.2-24b` — name: `Mistral Small 3.2 24B` · ctx 102400
- `mistral-nemo-fp8` — name: `Mistral Nemo FP8` · ctx 6553 · **unavailable** (no_key)
- `mistral-small-24b-fp8` — name: `Mistral Small 24B FP8` · ctx 6553 · **unavailable** (no_key)
- `mistral-small-3.2-24b-instruct-2506` — name: `Mistral Small 3.2 24B Instruct 2506` · ctx 6553 · **unavailable** (no_key)
- `mistral-devstral-2512` — name: `Mistral: Devstral 2512` · ctx 209600 · **unavailable** (no_key)
- `mistral-mistral-large-3` — name: `Mistral: Mistral Large 3` · ctx 209600 · **unavailable** (no_key)
- `mistral-mistral-medium-3.5` — name: `Mistral: Mistral Medium 3.5` · ctx 209600 · **unavailable** (no_key)
- `mistral-mistral-small-3.1-24b` — name: `Mistral: Mistral Small 3.1 24B` · ctx 102400 · **unavailable** (no_key)
- `mistral-mistral-small-4` — name: `Mistral: Mistral Small 4` · ctx 209600 · **unavailable** (no_key)
- `mistral-medium-3.5` — name: `Mistral Medium 3.5` · ctx 209715 · **unavailable** (no_key)
- `mistral-small-4` — name: `Mistral Small 4` · ctx 209715 · **unavailable** (no_key)
- `mistral-code` — name: `Mistral Code` · ctx 204800 · **unavailable** (no_key)
- `mistral-large-3` — name: `Mistral Large 3` · ctx 209715 · **unavailable** (no_key)
- `mistral-code-latest` · ctx 204800 · **unavailable** (no_key)
- `mistral-small-3.1-24b` — name: `Mistral Small 3.1 24B` · ctx 104857 · **unavailable** (no_key)
- `mistral-code-fim` — name: `Mistral Code FIM` · ctx 204800 · **unavailable** (no_key)
- `mistral-nemo-instruct-2407` — name: `Mistral Nemo Instruct 2407` · ctx 102400 · **unavailable** (no_key)
- `mistral-code-fim-latest` · ctx 204800 · **unavailable** (no_key)
- `mistral-tiny-2407` · **unavailable** (no_key)
- `mistral-tiny-latest` · **unavailable** (no_key)
- `mistral-7b-instruct-v0.2-lora` — name: `Mistral 7B Instruct v0.2 LoRA` · ctx 26214 · **unavailable** (no_key)

#### DeepSeek 系列（9）

- `deepseek-v4.1-flash` — name: `Deepseek V4.1 Flash` · ctx 800000 · **unavailable** (no_key)
- `deepseek-v4-flash` — name: `DeepSeek V4 Flash` · ctx 800000 · **unavailable** (no_key)
- `deepseek-v4-flash-0731` — name: `DeepSeek V4 Flash 0731` · ctx 419200 · **unavailable** (no_key)
- `deepseek-v4-pro` — name: `DeepSeek V4 Pro` · ctx 800000 · **unavailable** (no_key)
- `deepseek-v3` — name: `DeepSeek V3` · ctx 6553 · **unavailable** (no_key)
- `deepseek-v3.1-fp4` — name: `DeepSeek V3.1 FP4` · ctx 6553 · **unavailable** (no_key)
- `deepseek-v3.2-fp4` — name: `DeepSeek V3.2 FP4` · ctx 6553 · **unavailable** (no_key)
- `deepseek-v4-flash-thinking` — name: `DeepSeek V4 Flash Thinking` · **unavailable** (no_key)
- `deepseek-r1-distill-qwen-32b` — name: `DeepSeek R1 Distill Qwen 32B` · ctx 104857 · **unavailable** (no_key)

#### MiniMax 系列（4）

- `minimax-m3` — name: `MiniMax M3` · ctx 157286 · **unavailable** (no_key)
- `minimax-minimax-m2.1` — name: `MiniMax: MiniMax M2.1` · ctx 160000 · **unavailable** (no_key)
- `minimax-m2.5` — name: `MiniMax M2.5` · ctx 102400 · **unavailable** (no_key)
- `minimax-m2.7` — name: `MiniMax M2.7` · ctx 160000 · **unavailable** (no_key)

#### GLM / 智谱系列（9）

- `glm-4.5v` — name: `GLM 4.5V` · ctx 6553 · **unavailable** (no_key)
- `glm-4.6-fp4` — name: `GLM 4.6 FP4` · ctx 6553 · **unavailable** (no_key)
- `glm-4.6v` — name: `GLM 4.6V` · ctx 6553 · **unavailable** (no_key)
- `glm-4.7-flash` — name: `GLM 4.7 Flash` · ctx 104857 · **unavailable** (no_key)
- `glm-5v-turbo` — name: `GLM-5V Turbo` · **unavailable** (no_key)
- `glm-4.7-flashx` — name: `GLM-4.7 FlashX` · **unavailable** (no_key)
- `glm-4.5-airx` — name: `GLM-4.5 AirX` · **unavailable** (no_key)
- `glm-4.5-flash` — name: `GLM-4.5 Flash` · ctx 104857 · **unavailable** (no_key)
- `glm-4.6v-flash` — name: `GLM-4.6V Flash` · ctx 104857 · **unavailable** (no_key)

#### Kimi 系列（1）

- `kimi-k3-nvidia-direct` — name: `Kimi K3 NVIDIA Direct` · **unavailable** (no_key)

#### MiMo 系列（1）

- `mimo-v2.6-flash-mopd` — name: `MiMo-V2.6-Flash-MOPD` · ctx 419200 · **unavailable** (no_key)

#### Step 系列（3）

- `step-5-preview` — name: `Step 5 Preview` · **unavailable** (no_key)
- `step-3.7-flash` — name: `Step 3.7 Flash` · ctx 204800 · **unavailable** (no_key)
- `step-3.5-flash` — name: `Step 3.5 Flash` · ctx 204800 · **unavailable** (no_key)

#### Command 系列（9）

- `command-a-2` — name: `Command A+` · ctx 104857 · **unavailable** (no_key)
- `command-a-reasoning` — name: `Command A Reasoning` · ctx 204800 · **unavailable** (no_key)
- `command-a-vision` — name: `Command A Vision` · ctx 102400 · **unavailable** (no_key)
- `command-a` — name: `Command-A` · ctx 104857 · **unavailable** (no_key)
- `command-a-translate` — name: `Command A Translate` · ctx 204800 · **unavailable** (no_key)
- `command-r-2` — name: `Command R+` · ctx 104857 · **unavailable** (no_key)
- `command-r` — name: `Command R` · ctx 102400 · **unavailable** (no_key)
- `command-r7b` — name: `Command R7B` · ctx 104857 · **unavailable** (no_key)
- `command-r7b-arabic` — name: `Command R7B Arabic` · ctx 102400 · **unavailable** (no_key)

#### LongCat 系列（1）

- `longcat-flash-chat` — name: `LongCat Flash Chat` · ctx 102400 · **unavailable** (no_key)

#### Phi 系列（1）

- `phi-4` — name: `phi 4` · ctx 12800 · **unavailable** (no_key)

## 5. 直连端点（调试用，一般不需要）

| 端点 | baseUrl | key | 用途 |
|---|---|---|---|
| FreeLLMAPI | `http://127.0.0.1:31415/v1` | `unified-key.txt` | 统一入口，全部模型 |
| DSH 桥接器 | `http://127.0.0.1:31418/v1` | `dsh-plugin-bridge-local`（[dsh-plugin-bridge.config.json](<dsh-plugin-bridge.config.json>) 的 `bridgeKey`） | 直接看 62 个插件模型、调试 SSE |
| Grok subscription | `http://127.0.0.1:31416/v1` | 由该网关自身管理 | 原有 grok-* |
| Our Free Model forward | `http://127.0.0.1:18899/v1` | `C:\Users\onemt\.dsh\our-free-model\settings.json` 的 `forwardKey` | OFM 车道直连 |
| WorkBuddy shim | `http://127.0.0.1:54001` / `:54002` | 进程内随机 base64url token | DSH 启动时随机，勿直接依赖 |

直连桥接器时模型 ID 用**原始带前缀**形态（`wb-cn/hy4free`）；经 FreeLLMAPI 时用公共 ID（`wb-cnhy4free`），两种写法在 FreeLLMAPI 侧都接受。

## 6. 配置建议与已知限制

- 快速低成本：`wb-2/fast-model`、`glm-5.3-flash`、`gemini-3.8-flash`。
- 长上下文 / 推理：`wb-cn/hy4free`（reasoning 输出走 `reasoning_content`）、`grok-4.7`、`claude-*` 系列。
- 免费车道：`ofm/*` 与内置 `*-free` 模型；先按第 4.3 节的实测标记选。
- 路由别名 `auto` / `fusion` 由 FreeLLMAPI 自动选路，适合不指定具体模型的场景。
- 非流式请求：桥接器会把 WorkBuddy 恒返回的 SSE 聚合成 `chat.completion` JSON；流式请求把 `reasoning_content` 提升到 `delta.content`，避免 FreeLLMAPI 判 `empty_completion`。
- Our Free Model 部分上游返回 `Invalid URL` / Bun 依赖 / 429，属车道差异，不是配置错误。

## 7. 维护（其他 Agent 请读这里）

1. **日常 / DSH 或 WorkBuddy 插件更新后**：双击 [同步插件模型.cmd](<同步插件模型.cmd>) 或 `node sync-dsh-plugin-models.mjs`。幂等，无变化则零操作；只在 shim 随机端口/secret 失效时重新扫描并 `/reload`，只在出现新模型 ID 时补注册。
2. **首次部署或改了桥接器代码**：跑 [integrate-dsh-plugin-models.ps1](<integrate-dsh-plugin-models.ps1>)（5 步全量）。
3. **FreeLLMAPI 不用重启**：模型通过 `POST /api/keys/custom` 写 `freeapi.db`，运行态直接生效。只有设置进程级环境变量（如 `CUSTOM_MODEL_SYNC_INTERVAL_MS`，默认 24h）或升级桌面版时才需要重启。
4. **新增模型自动补注册**：FreeLLMAPI 内置 `custom-model-sync` 默认每 24h 拉一次自定义端点的 `/models`，只增不删。插件删掉模型会留下孤儿 ID，同步脚本用 `orphanedInFreeLlmApi` 报告，需在 Keys 页手动删。
5. **上游版本**：本地 0.16.37；上游 [tashfeenahmed/freellmapi](https://github.com/tashfeenahmed/freellmapi) 最新 v0.16.37（2026-11-20，main `a773d8ef44f824c15826c64369d096a962953d06`，release id 452527821）。升级报告见 [upstream-merge-0.16.37.md](<upstream-merge-0.16.37.md>)；更早的升级记录见 [upstream-merge-0.16.36.md](<upstream-merge-0.16.36.md>)、[upstream-fork-upload-report.md](<upstream-fork-upload-report.md>)。
6. **重生成本文**：`node collect-model-catalog.mjs` 输出结构化 JSON，再由 [generate-agent-model-doc 流水线](<collect-model-catalog.mjs>) 渲染；模型清单以运行态 `/v1/models` 为准，不要手改本文件。

## 8. 附录：全部 419 个公共 ID（纯列表，便于 grep）

```text
auto
fusion
claude-opus-4-5
claude-sonnet-4-5
claude-haiku-4-5
glm-4.5
glm-4.5-air
glm-4.6
glm-4.7
glm-5
glm-5-turbo
glm-5.1
glm-5.2
glm-5.3
glm-5.3-flash
glm-5.3-flashx
gemini-3.8-flash
gemini-flash
gemini-3.7-flash
dots3-note-preview
gemini-3.6-flash
qwen3.8-27b
gemini-3.5-flash
gemma-4-31b-it
gpt-oss-120b
gpt-oss-20b
nemotron-3.5-super-vl
north-mini-code
gemini-robotics-er-2-preview
gemini-3.5-flash-lite
gemini-flash-lite
qwen3.6-27b
gemma-4-31b
gemini-3-flash-preview
qwen3.5-397b
gemma-4-26b-it
gemma-4-26b-a4b
gemini-3.1-flash-lite-preview
gemini-3.1-flash-lite
qwen3.5-9b
gemini-2.5-flash
nemotron-3.5-lightning
ofmhy4-flash-free
ofmrecursiveflint-v1.0free
ofmtidepool-alpha-free
wb-2gemini-4-argon
wb-2gemini-4-carbon
wb-2gpt-6.1-terra
wb-2gpt-6.2-astra
wb-2gpt-6.2-sol
wb-2hy4flash
wb-2hy4flash-free
wb-cnhy4flash
wb-cnhy4flash-free
glm-5.3-flashx-legal
grok-4.20-0309-non-reasoning
grok-4.20-0309-reasoning
grok-4.20-multi-agent-0309
grok-4.3
grok-4.5
grok-4.6
grok-4.7
grok-4.7-build-fast
grok-build-0.1
ofmamddeepseek-v4-flash
ofmamddeepseek-v4.1-flash
ofmamdgemma-4-31b-it
ofmamdglm-5.3-flash
ofmamdmimo-v2.6-flash
ofmamdminicpm-v-4.7-1b
ofmamdminicpm-v-4.7-35b-a3b
ofmamdminicpm5-2b
ofmamdqwen3.8-27b
ofmbaiduernie-5.5-flash-previewfree
ofmdeepseek-aideepseek-v4.1-flash
ofmdeepseek-v4.1-flash-free
ofmflint-40b-free
ofmiceman-free
ofminclusionailing-3.2-flashfree
ofmjev-1.13-free
ofmliquidlfm-3-1.7bfree
ofmlongcat-2.5-free
ofmminimaxaiminimax-m3.1-flash
ofmmoonshotaikimi-k3.1-pro
ofmopencodedeepseek-v4.1-flash-free
ofmopencodeglm-5.3-flash-free
ofmparticle-aiparticle-1free
ofmstepfun-aistep-5-preview
ofmz-aiglm-5.3-flash
wb-2balanced-model
wb-2deepseek-v4.1-flash
wb-2deepseek-v4.1-flash-sg
wb-2fast-model
wb-2gemini-3.8-flash
wb-2glm-5.2
wb-2glm-5.3
wb-2glm-5.3-flash
wb-2gpt-5.4
wb-2gpt-5.5
wb-2gpt-5.6-luna
wb-2gpt-5.6-sol
wb-2gpt-5.6-terra
wb-2gpt-6-astra
wb-2gpt-6-luna
wb-2gpt-6-sol
wb-2gpt-6.1-sol
wb-2grok-4.7
wb-2hy3
wb-2hy4-preview
wb-2hy4std
wb-2kimi-k3
wb-2kimi-k3.1-pro
wb-2kimi-k3.1-pro-highspeed
wb-2max-model
wb-2minimax-m3.1-flash
wb-2primary-model
wb-cndeepseek-v4-pro
wb-cndeepseek-v4.1-flash
wb-cnglm-5.2
wb-cnglm-5.3
wb-cnglm-5.3-flash
wb-cnhy4std
wb-cnkimi-k2.8-preview
wb-cnkimi-k3-1
wb-cnkimi-k3.1-pro
wb-cnmimo-v2.6-pro
wb-cnminimax-m3.1-flash
wb-cnspace-bunny
wb-cnstep-5-preview
gemini-2.5-flash-lite
nemotron-3-nano-30b-reasoning
llama-3.3-70b
mistral-small-3.2-24b
qwen2.5-vl-72b
qwen3guard-gen-8b
qwen3guard-gen-0.6b
qwen3.8-max
qwen3.8-flash
qwen3.8-flash-next
deepseek-v4.1-flash
gpt-5.6-luna
agnes-3.0-flash
deepseek-v4-flash
deepseek-v4-flash-0731
qwen-3.8-27b
deepseek-v4-pro
minimax-m3
nex-n2.5-pro
qwen3.7-max
deepseek-v3
deepseek-v3.1-fp4
deepseek-v3.2-fp4
gemma-3-12b
gemma-3-27b
gemma-3-4b
gemma-4-26b-a4b-it
gemma-e4b
gemma-4-31b-aura-large-v1.1
glm-4.5v
glm-4.6-fp4
glm-4.6v
glm-4.7-flash
google-gemma-2-27b
google-gemma-3-27b
gpt-6-luna
gpt-oss-safeguard-20b
gpt-oss20b
kimi-k3-nvidia-direct
ling-3.1-flash
llama-3.1-8b
llama-3.3-70b-instruct
llama-4-scout-17b-16e-instruct
mimo-v2.6-flash-mopd
minimax-minimax-m2.1
mistral-nemo-fp8
mistral-small-24b-fp8
mistral-small-3.2-24b-instruct-2506
mistral-devstral-2512
mistral-mistral-large-3
mistral-mistral-medium-3.5
mistral-mistral-small-3.1-24b
mistral-mistral-small-4
moondream-3-preview
moondream-3.1-9b-a2b
nvidia-nemotron-3-nano-30b-a3b
openai-gpt-oss-20b
openai-gpt-6-luna
plugsky-lite
plugsky-micro
qwen-3-14b
qwen-3-vl-235b-a22b-instruct
qwen-3-vl-30b-a3b-instruct
qwen-3.5-9b
qwen-3.6-35b-a3b
qwen2.5-72b-fp8
qwen3-30b-a3b-fp8
qwen3-32b-fp8
qwen3-coder-480b-a35b-instruct
qwen3-next-80b-a3b-instruct
qwen3.5-35b-a3b
qwen3.6-max-preview
qwen3.8-27b-omnimerge-v6
qwen3.8-27b-swift
step-5-preview
tencent-hy4-preview
typhoon-2.5-30b-a3b-instruct
xiaomi-mimo-v2.6-flash
zhipuai-glm-4.5-air
qwen3.6-plus
glm-5v-turbo
laguna-s-2.1
ling-3.0-flash-vl
poolside-laguna-s-2.1
qwen3.7-plus
deepseek-v4-flash-thinking
gpt-5.4-mini
minimax-m2.5
minimax-m2.7
nemotron-3-ultra
nemotron-3-ultra-550b
agnes-2.5-flash
nex-n2.5-mini
gpt-5.4-nano
ling-3.0-flash-sante
sensenova-6.8-flash-lite
aion-3.0
muse-glimmer-30b
qwen3.5-omni-plus
step-3.7-flash
qwen-sea-lion-v4.5-27b
qwen3.5-plus
qwen3.7-flash
qwen3.5-397b-a17b
qwen3.6-35b-a3b
claude-haiku-4.5
gemma-4-26b
gemma-4-31b-heretic
gpt-5-mini
step-3.5-flash
aion-3.0-mini
qwen3-max
glm-4.7-flashx
laguna-xs-2.1
poolside-laguna-xs-2.1
qwen3.5-flash
kilo-auto
mistral-medium-3.5
command-a-2
free-router
gpt-4.1
gpt-5-nano
nemotron-3-120b
nemotron-3-super-120b
nemotron-3.5-lightning-30b
nemotron-3.5-lightning-30b-a3b
nemotron-3-super-120b-a12b
qwen3-235b-a22b-thinking-2507
aion-2.0
auto-route
bazaarlink-auto
logfare-auto
qwen3-235b-a22b-instruct-2507
qwen3-coder
qwen3.5-omni-flash
glm-4.5-airx
longcat-flash-chat
mistral-small-4
qwen3-coder-plus
qwen3-next-80b-a3b-thinking
default
gpt-4.1-mini
qwen-plus-2025-07-28
qwen3-vl-235b-a22b-instruct
qwen3-vl-plus
diffusiongemma-26b-a4b-it
qwen3-coder-30b-a3b-instruct
qwq-32b
command-a-reasoning
devstral-2
mistral-code
mistral-large-3
mistral-code-latest
nemotron-3-nano-omni
nemotron-3-nano-omni-30b-a3b-reasoning
nemotron-3-nano-omni-reasoning
deepseek-r1-distill-qwen-32b
lfm-2.5-2.6b
r1-distill-qwen-32b
ch.at
glm-4.5-flash
gpt-4o
ising-calibration-1.5-31b
llama-3.3-70b-fp8-fast
llama-4-scout
qwen3-omni-flash
rnj-1
unmoderated-gpt
qwen-sea-lion-v4-32b
qwen2.5-72b-instruct
qwen3-30b-a3b-instruct-2507
command-a-vision
command-a
gemma-4-e4b-uncensored-aggressive
gemma-4-e4b-uncensored-hauhaucs-aggressive-q4-k-m
gpt-4o-mini
groq-compound-mini
hermes-3-llama-3.1-405b
mistral-small-3.1-24b
qwen2.5-32b-instruct
qwen2.5-coder-32b
qwen2.5-coder-32b-instruct
llama-3.2-3b
llama-3.2-90b-vision
llama-sea-lion-v3-70b
llama-3-2-3b-instruct
llama-3-2-3b-instruct-q4-k-m
llama-instant
ministral-14b
ministral-3-14b
ministral-14b-2512
ministral-14b-latest
qwen2.5-7b-instruct
qwen2.5-coder-7b-instruct
qwen3-4b-nymphaea-rp-i1-q4-k-s
qwen3.5-0.8b
aion-rp-llama-3.1-8b
command-a-translate
gemma-3-1b
gemma-3-4b-it
gemma-sea-lion-v4-27b
glm-4.6v-flash
hunyuan-a13b-instruct
leanstral-1.5
llama-3.2-11b-vision
llama-3.2-1b
llama-3.2-1b-instruct
llama-3.2-1b-unsloth
llama-3-2-1b-instruct
ministral-3-3b
ministral-3-8b
ministral-3b
ministral-8b
ministral-3b-2512
ministral-3b-latest
ministral-8b-2512
ministral-8b-latest
north-small-translate
phi-4
qwen3-0.6b-iq4
tiny-aya-global
codestral
codestral-2508
codestral-latest
gemma-3-12b-it
hermes-4-14b
impish-llama-4b
llama-3-stheno-8b-v3.2
llama-3-super-nova-rp-8b
mistral-code-fim
mistral-nemo-instruct-2407
mistral-code-fim-latest
mistral-tiny-2407
mistral-tiny-latest
open-mistral-nemo-2407
open-mistral-nemo
tiny-aya-earth
tiny-aya-fire
tiny-aya-water
devstral-small-2
gemma-4-26b-a4b-it-chimerax
gemma-4-26b-a4b-it-darksoul
gemma-4-26b-a4b-it-luminous
gemma-4-26b-a4b-it-meromero
gemma-4-26b-a4b-it-moonlight
gemma-4-26b-a4b-it-musica
mythomax-l2-13b
ctx65536-magidonia-24b-heretic
allam-2-7b
behemoth-x-123b-v2-1
command-r-2
gemma-2-9b
granite-4.0-h-micro
llama-2-7b-chat-lora
mistral-7b-instruct-v0.2-lora
riva-translate-4b-instruct-v2
thedrummer-behemoth-128b-v3-q4-k-m
voxtral-small
voxtral-small-2507
voxtral-small-latest
aya-expanse-32b
aya-vision-32b
command-r
command-r7b
command-r7b-arabic
cydonia-24b-v4.3
llama-3.1-nemoguard-8b-content-safety
llama-3.1-nemoguard-8b-topic-control
llama-3.1-nemotron-safety-guard-8b-v3
llama-guard-3-8b
nemotron-3.5-content-safety
nemotron-parse-2.0
skyfall-31b-v4.2
angelic-eclipse-12b
forgotten-safeword-22b
gemma-2b-it-lora
gemma-7b-it-lora
impish-bloodmoon-12b
l3-8b-lunaris-v1
l3-8b-stheno-v3-2-q5-k-m
llama-prompt-guard-2-22m
llama-prompt-guard-2-86m
llava-1.5-7b
mini-magnum-12b-v1.1
mn-violet-lotus-12b-q8-0
qwen2.5-coder-3b-instruct
thea-rp-3b-25r
sea-guard
cerebras-gpt-111m-instruct
pythia-70m-deduped
```

---

相关文件：[model-integration-audit.md](<model-integration-audit.md>) · [final-status.md](<final-status.md>) · [dsh-plugin-integration-final.json](<dsh-plugin-integration-final.json>) · [dsh-plugin-registration.json](<dsh-plugin-registration.json>) · [freellmapi-restart-status.md](<freellmapi-restart-status.md>) · [models-live-0.16.37.json](<models-live-0.16.37.json>)（最新快照） · [models-0.16.23.json](<models-0.16.23.json>)（旧快照） · [all-models.txt](<all-models.txt>)（290 行历史清单）。
## 9. 零 token 连通性结论（修正版，2026-11-12）

> 完整报告：[model-connectivity-zero-token.md](<model-connectivity-zero-token.md>) · 结构化数据：[model-connectivity-zero-token.json](<model-connectivity-zero-token.json>)。
> **0 次** `chat/completions`、**0 inference token**；仅 GET 目录/控制面 + 管理鉴权 + 只读 DB + 历史日志。真实生成响应属于需 token 的验证层，本轮未复测。

- 代表 ID 低速串行检索：7/7 返回 200（首轮 383 并发 GET 触发 429 限流，已改为目录字段判定；详见修正说明）。
- 路由就绪 `ready_zero_token`：120 个；确定不可用：258 个（no_key 258、disabled 0、no_models 0、unavailable_other 0）；exhausted 0；available_unknown 5。
- 历史实测 200（既有证据）：5 个：`glm-5.3-flash`、`ofmbaiduernie-5.5-flash-previewfree`、`ofmliquidlfm-3-1.7bfree`、`wb-2fast-model`、`wb-cnhy4free`。
- 控制面：bridge/grok/glm/ofm/builtin 全部 OK。
- 按 `verdict` 选模型：`ready_zero_token` + `historical_200` 优先；`no_key`/`disabled`/`no_models` 直接排除；`exhausted`/`available_unknown`/无历史 200 的 `ready_zero_token` 属路由就绪但真实生成未在本轮复测。
- 复测：`node probe-model-connectivity-zero-token.mjs` 重建 [model-connectivity-zero-token.md](<model-connectivity-zero-token.md>) 与 JSON；要确认真实生成再对目标模型发 `max_tokens=1` 的 `chat/completions`。


## 10. 慢调用优化（2026-11-13）

- 慢调用根因与完整证据：[latency-optimization-report.md](<latency-optimization-report.md>)、[v3-slow-call-evidence.json](<v3-slow-call-evidence.json>)。
- 桥接器已改为逐 chunk 透传 SSE、首字节/总超时、并行目录拉取、15s 目录缓存、/stats、进程内日志；配置见 [dsh-plugin-bridge.config.json](<dsh-plugin-bridge.config.json>)。
- 推荐快车道：`wb-2fast-model`、`wb-cnhy4std`、`wb-cn/hy4std`、`wb-2/fast-model`。被限流或 60s 级慢车道临时放入 `disabledModels`，到期 `2026-11-14T10:11:00+08:00`。
- 复跑：`start-dsh-plugin-bridge-cim.ps1` → `node optimize-freellmapi.mjs` → `node verify-dsh-plugin-integration.mjs` → `node verify-latency-optimization.mjs <unified-key>`。
- 最终验证快照：[final-validation.json](<final-validation.json>)；CIM 启动的 node 无控制台，桥接器日志覆盖已做 stdout try/catch 保护。
