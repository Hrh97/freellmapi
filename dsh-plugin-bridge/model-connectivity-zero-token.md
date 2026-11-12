# FreeLLMAPI 模型连通性报告（零 inference token · 修正版）

> 生成时间：2026-11-12T10:11:23.471Z · 版本 0.16.23 · 统一入口 `http://127.0.0.1:31415/v1`
> 本轮 **0 次** `/v1/chat/completions`、**0 次** provider 推理、**0 inference token**。仅 GET 目录/控制面 + 一次 `POST /api/auth/desktop-session` 管理鉴权 + 只读 DB 快照 + 历史日志。

## 修正说明

首轮 383 个并发 GET /v1/models/:id 触发 FreeLLMAPI 429 限流，268 条被误标为 catalog_error；串行复测 8/8 返回 200，证明是限速而非模型不可用。修正版以 /v1/models 目录行的 available / unavailable_reason / execution_status 字段为唯一判据，仅对 18 个代表 ID 做低速串行检索。

目录行字段是 FreeLLMAPI 自己的判定结果，零 token 且确定性最高；逐个 GET 只用于验证 retrieve 路由可用，不作为可用性判据。

## 结论（直接回答）

| 类别 | 数量 | 含义 |
|---|---:|---|
| 路由就绪 `ready_zero_token` | 120 | `available=true`、`execution_status=ready`、对应控制面健康。零 token 层确定「能路由到可用 key」。 |
| 确定不可用 | 258 | `no_key` 258、`disabled` 0、`no_models` 0、`unavailable_other` 0。 |
| 配额/密钥耗尽 `exhausted` | 0 | 有 key 但 `hasUsableKeyForModel` 为假（冷却/额度），零 token 层判为当前不可生成。 |
| 待真实生成确认 | 120 | `available_unknown` 5 + 路由就绪但无历史 200 证据 115。 |

- 历史实测 200（既有证据，本轮未重跑）：**5 个** → `glm-5.3-flash`、`ofmbaiduernie-5.5-flash-previewfree`、`ofmliquidlfm-3-1.7bfree`、`wb-2fast-model`、`wb-cnhy4free`
- 代表 ID 检索：9 个低速串行 `GET /v1/models/:id`，成功 7（9/9）。
- 控制面连通：bridge OK、grok OK、glm OK、ofm OK、builtin/api-health OK。

真实 provider 生成响应属于需 token 的验证层；本轮按零 token 约束未发起 `chat/completions`。因此「路由就绪」不等于「上游一定返回内容」；对未列在历史 200 名单中的模型，结论是「路由/密钥/控制面就绪，真实生成未在本轮复测」。

## 零 token 测试了什么

1. `GET /v1/models` 全量目录（权威字段 `available` / `unavailable_reason` / `execution_status`）+ `?available=true` + `?execution_status=ready|exhausted|needsKey` 过滤交叉核对。
2. 对 9 个代表 ID 做低速串行 `GET /v1/models/:id`（180ms 间隔），确认 retrieve 路由不被 429 干扰。
3. `POST /api/auth/desktop-session` 取管理 token 后 `GET /api/keys`、`/api/health`、`/api/models`、`/api/settings/version`。
4. 控制面 GET：桥接器 `/healthz` 与 `/v1/models`、Our Free Model `/health` 与 `/v1/models`、Grok gateway `/v1/models`、两个 WorkBuddy shim `/healthz`。
5. 只读 DB 既有快照：`models` 533 行、`model_probe_status` 0 行、`custom/source=user/enabled=1` 83 行（来源 [v3_read_probe_status.py](<v3_read_probe_status.py>)）；本轮未触发任何模型探测。
6. 读取 [ofm-chat-probe.json](<ofm-chat-probe.json>)、[dsh-plugin-integration-final.json](<dsh-plugin-integration-final.json>)、[dsh-plugin-verification.json](<dsh-plugin-verification.json>) 与 [check-freellmapi.ps1](<check-freellmapi.ps1>) 自检记录，复用之前已消耗的推理结果，不重跑。

源码判据（[freellmapi-asar/build/server.mjs](<freellmapi-asar/build/server.mjs>)）：

- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:104958 function executionStatusFor(modelDbIds, available) {`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:104959 if (available !== 1) return "needsKey";`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:104960 return modelDbIds.some((id) => hasUsableKeyForModel(id)) ? "ready" : "exhausted";`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:106866 available: m.available === 1,`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:106867 unavailable_reason: m.available === 1 ? null : m.enabled === 1 ? "no_key" : "disabled",`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:106871 execution_status: m.executionStatus,`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:106759 proxyRouter.get(["/models/:id", "/models/*rest"], (req, res) => {`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:106769 const entry = buildCatalogEntries().find((m) => m.id === id);`
- `D:/Ai/freellmapi/freellmapi-asar/build/server.mjs:106753 res.json({ object: "list", data: buildCatalogEntries({ onlyAvailable, executionStatus: es }) });`

## 端点状态

| 查询/端点 | HTTP | 条目数 |
|---|---:|---:|
| `catalog` | 200 | 383 |
| `available_true` | 200 | 125 |
| `ready` | 200 | 125 |
| `exhausted` | 200 | 5 |
| `needsKey` | 200 | 263 |
| `api_keys` | 200 | 7 |
| `api_health` | 200 | 7 |
| `api_models` | 200 | 533 |
| `version` | 200 | 0 |
| `bridge_health` | 200 | 0 |
| `bridge_models` | 200 | 62 |
| `ofm_health` | 200 | 0 |
| `ofm_models` | 200 | 18 |
| `grok_models` | 200 | 9 |
| `shim_0_health` | 200 | 0 |
| `shim_1_health` | 200 | 0 |

## 目录字段分布

### available

| 值 | 数量 |
|---|---:|
| `true` | 125 |
| `false` | 258 |

### unavailable_reason

| 值 | 数量 |
|---|---:|
| `null` | 125 |
| `no_key` | 258 |

### execution_status

| 值 | 数量 |
|---|---:|
| `null` | 5 |
| `ready` | 120 |
| `needsKey` | 258 |

## 分组计数

| 来源 | 模型数 |
|---|---:|
| builtin | 300 |
| glm | 12 |
| grok | 9 |
| ofm | 18 |
| wb-2 | 28 |
| wb-cn | 16 |

| verdict | 数量 |
|---|---:|
| available_unknown | 5 |
| ready_zero_token | 120 |
| no_key | 258 |

## 确定可用（零 token 层：路由就绪 120 个）

```text
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
gpt-oss-safeguard-20b
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
ofmbaiduernie-5.5-flash-previewfree
ofmdeepseek-aideepseek-v4.1-flash
ofmdeepseek-v4.1-flash-free
ofmflint-40b-free
ofmglm-5.3-flash-free
ofmiceman-free
ofminkling-2-small-free
ofmliquidlfm-3-1.7bfree
ofmlongcat-2.5-free
ofmminimaxaiminimax-m3.1-flash
ofmopencodedeepseek-v4.1-flash-free
ofmopencodeflint-40b-free
ofmopencodeglm-5.3-flash-free
ofmopencodenemotron-3.5-lightning-free
ofmopencodenemotron-3.5-super-vl-free
ofmstepfun-aistep-5-preview
ofmthinkingmachinesinkling-2-smallfree
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
wb-2hy4free
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
wb-cnhy3
wb-cnhy3-x
wb-cnhy4free
wb-cnhy4std
wb-cnkimi-k2.8-preview
wb-cnkimi-k3-1
wb-cnkimi-k3.1-pro
wb-cnmimo-v2.6-pro
wb-cnminimax-m3.1-flash
wb-cnspace-bunny
wb-cnstep-5-preview
north-mini-code
gemini-2.5-flash-lite
nemotron-3-nano-30b-reasoning
lfm2.5-2.6b
llama-3.3-70b
mistral-small-3.2-24b
qwen2.5-vl-72b
qwen3guard-gen-8b
qwen3guard-gen-0.6b
allam-2-7b
llama-prompt-guard-2-22m
llama-prompt-guard-2-86m
```

## 历史实测 200（既有证据，5 个）

```text
glm-5.3-flash
ofmbaiduernie-5.5-flash-previewfree
ofmliquidlfm-3-1.7bfree
wb-2fast-model
wb-cnhy4free
```

## 确定不可用（258 个）

### no_key 258

```text
qwen3.8-max
qwen3.8-flash
qwen3.8-flash-next
deepseek-v4.1-flash
qwen3.8-omni-flash
gpt-5.6-luna
agnes-3.0-flash
agnes-2.5-pro
deepseek-v4-flash
deepseek-v4-flash-0731
qwen-3.8-27b
deepseek-v4-pro
minimax-m3
nex-n2.5-pro
qwen3.7-max
gemma-e4b
gemma-4-31b-aura-large-v1.1
kimi-k3-nvidia-direct
llama-3.1-8b
llama-4-maverick-17b-128e-instruct
mimo-v2.6-flash-mopd
mistral-small-3.2-24b-instruct-2506
mistral-devstral-2512
mistral-mistral-large-3
mistral-mistral-medium-3.5
mistral-mistral-small-4
moondream-3-preview
moondream-3.1-9b-a2b
openai-gpt-oss-20b
openai-gpt-6-luna
plugsky-lite
plugsky-micro
qwen3-coder-480b-a35b-instruct
qwen3.6-max-preview
qwen3.8-27b-omnimerge-v6
qwen3.8-27b-swift
tencent-hy4-preview
typhoon-2.5-30b-a3b-instruct
xiaomi-mimo-v2.6-flash
agnes-2.5-pro-alpha
qwen3.6-plus
glm-5v-turbo
laguna-s-2.1
ling-3.0-flash-vl
poolside-laguna-s-2.1
qwen3.7-plus
deepseek-v4-flash-thinking
gpt-5.4-mini
ling-3.0-flash
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
gemma-4-26b-a4b-it
gemma-4-31b-heretic
gpt-5-mini
step-3.5-flash
aion-3.0-mini
qwen3-max
glm-4.7-flash
glm-4.7-flashx
laguna-xs-2.1
poolside-laguna-xs-2.1
qwen3.5-flash
agnes-2.0-flash
kilo-auto
mistral-medium-3.5
qwen-3.5-9b
command-a-2
free-router
gpt-4.1
gpt-5-nano
nemotron-3-120b
nemotron-3-super
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
qwen3-next-80b-a3b-instruct
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
qwen3-30b-a3b-fp8
command-a-vision
command-a
gemma-4-e4b-ultra-uncensored
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
mimo-v2.6-flash
mythomax-l2-13b
ctx65536-magidonia-24b-heretic
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
llava-1.5-7b
mini-magnum-12b-v1.1
mn-violet-lotus-12b-q8-0
rocinante-x-12b
thea-rp-3b-25r
sea-guard
cerebras-gpt-111m-instruct
pythia-70m-deduped
```

### disabled 0

```text

```

### no_models 0

```text

```

### unavailable_other

```text

```

## 配额/密钥耗尽（exhausted 0）

```text

```

## 待真实生成确认

### available_unknown 5

```text
auto
fusion
claude-opus-4-5
claude-sonnet-4-5
claude-haiku-4-5
```

### 路由就绪但无历史 200 证据（115）

```text
glm-4.5
glm-4.5-air
glm-4.6
glm-4.7
glm-5
glm-5-turbo
glm-5.1
glm-5.2
glm-5.3
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
gpt-oss-safeguard-20b
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
ofmdeepseek-aideepseek-v4.1-flash
ofmdeepseek-v4.1-flash-free
ofmflint-40b-free
ofmglm-5.3-flash-free
ofmiceman-free
ofminkling-2-small-free
ofmlongcat-2.5-free
ofmminimaxaiminimax-m3.1-flash
ofmopencodedeepseek-v4.1-flash-free
ofmopencodeflint-40b-free
ofmopencodeglm-5.3-flash-free
ofmopencodenemotron-3.5-lightning-free
ofmopencodenemotron-3.5-super-vl-free
ofmstepfun-aistep-5-preview
ofmthinkingmachinesinkling-2-smallfree
ofmz-aiglm-5.3-flash
wb-2balanced-model
wb-2deepseek-v4.1-flash
wb-2deepseek-v4.1-flash-sg
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
wb-2hy4free
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
wb-cnhy3
wb-cnhy3-x
wb-cnhy4std
wb-cnkimi-k2.8-preview
wb-cnkimi-k3-1
wb-cnkimi-k3.1-pro
wb-cnmimo-v2.6-pro
wb-cnminimax-m3.1-flash
wb-cnspace-bunny
wb-cnstep-5-preview
north-mini-code
gemini-2.5-flash-lite
nemotron-3-nano-30b-reasoning
lfm2.5-2.6b
llama-3.3-70b
mistral-small-3.2-24b
qwen2.5-vl-72b
qwen3guard-gen-8b
qwen3guard-gen-0.6b
allam-2-7b
llama-prompt-guard-2-22m
llama-prompt-guard-2-86m
```

## Our Free Model 既有上游异常（历史 token 探测，16 条）

- `deepseek-v4.1-flash-free` → 502：OpenCode 免费车道推理需要本机 Bun：请安装 Bun（https://bun.sh 或 npm i -g bun）后重试，或把 Bun 可执行文件路径写入 OUR_FREE_MODEL_BUN 环境变量。/ Install Bun or set OUR_FREE_MODEL_BUN to its executable path (OUR_FREE_MODEL_FREE_TRANSPORT=node restores the legacy transport).
- `glm-5.3-flash-free` → 502：OpenCode 免费车道推理需要本机 Bun：请安装 Bun（https://bun.sh 或 npm i -g bun）后重试，或把 Bun 可执行文件路径写入 OUR_FREE_MODEL_BUN 环境变量。/ Install Bun or set OUR_FREE_MODEL_BUN to its executable path (OUR_FREE_MODEL_FREE_TRANSPORT=node restores the legacy transport).
- `longcat-2.5-free` → 502：OpenCode 免费车道推理需要本机 Bun：请安装 Bun（https://bun.sh 或 npm i -g bun）后重试，或把 Bun 可执行文件路径写入 OUR_FREE_MODEL_BUN 环境变量。/ Install Bun or set OUR_FREE_MODEL_BUN to its executable path (OUR_FREE_MODEL_FREE_TRANSPORT=node restores the legacy transport).
- `iceman-free` → 502：OpenCode 免费车道推理需要本机 Bun：请安装 Bun（https://bun.sh 或 npm i -g bun）后重试，或把 Bun 可执行文件路径写入 OUR_FREE_MODEL_BUN 环境变量。/ Install Bun or set OUR_FREE_MODEL_BUN to its executable path (OUR_FREE_MODEL_FREE_TRANSPORT=node restores the legacy transport).
- `inkling-2-small-free` → 502：OpenCode 免费车道推理需要本机 Bun：请安装 Bun（https://bun.sh 或 npm i -g bun）后重试，或把 Bun 可执行文件路径写入 OUR_FREE_MODEL_BUN 环境变量。/ Install Bun or set OUR_FREE_MODEL_BUN to its executable path (OUR_FREE_MODEL_FREE_TRANSPORT=node restores the legacy transport).
- `flint-40b-free` → 502：OpenCode 免费车道推理需要本机 Bun：请安装 Bun（https://bun.sh 或 npm i -g bun）后重试，或把 Bun 可执行文件路径写入 OUR_FREE_MODEL_BUN 环境变量。/ Install Bun or set OUR_FREE_MODEL_BUN to its executable path (OUR_FREE_MODEL_FREE_TRANSPORT=node restores the legacy transport).
- `opencode/nemotron-3.5-lightning-free` → 502：model request failed: Invalid URL
- `minimaxai/minimax-m3.1-flash` → 502：model request failed: Invalid URL
- `opencode/flint-40b-free` → 502：model request failed: Invalid URL
- `z-ai/glm-5.3-flash` → 502：model request failed: Invalid URL
- `stepfun-ai/step-5-preview` → 502：model request failed: Invalid URL
- `deepseek-ai/deepseek-v4.1-flash` → 502：model request failed: Invalid URL
- `opencode/glm-5.3-flash-free` → 502：model request failed: Invalid URL
- `opencode/nemotron-3.5-super-vl-free` → 502：model request failed: Invalid URL
- `opencode/deepseek-v4.1-flash-free` → 502：model request failed: Invalid URL
- `thinkingmachines/inkling-2-small:free` → 429：Rate limit exceeded: limit_rpd/thinkingmachines/inkling-2-small-20261107/29add1e6-4e78-459f-bf7d-17faf77a0b44. Daily limit reached for thinkingmachines/inkling-2-small:free via Thinking Machines. Credits don't affect this cap. Add your own provider key to use your own limits: https://openrouter.ai/w

## 如何 100% 确认真实生成

对目标模型发一次 `max_tokens=1` 的 `POST /v1/chat/completions`，仅消耗极少 token。本轮按零 token 约束未执行该命令。

```bash
curl -s http://127.0.0.1:31415/v1/chat/completions -H "Authorization: Bearer ${FRELLMAPI_KEY}" -H "Content-Type: application/json" -d "{\"model\":\"wb-2fast-model\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":1}"
```

## 相关文件

- [AGENTS.md](<AGENTS.md>)：完整 383 个模型配置与维护规则（第 9 节为零 token 结论）。
- [model-connectivity-zero-token.json](<model-connectivity-zero-token.json>)：结构化全量数据（含每个模型 verdict 与 retrieval_status）。
- [probe-model-connectivity-zero-token.mjs](<probe-model-connectivity-zero-token.mjs>)：零 token 复测脚本，运行 `node probe-model-connectivity-zero-token.mjs` 即重建本文。
- [model-integration-audit.md](<model-integration-audit.md>)、[final-status.md](<final-status.md>)、[freellmapi-restart-status.md](<freellmapi-restart-status.md>)。
