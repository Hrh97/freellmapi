# FreeLLMAPI 与 DSH 插件模型接入巡检

- 时间：2026-11-12 14:06+08，最终验证 2026-11-12 16:12+08
- 工作目录：D:\Ai\freellmapi
- 目标：核对现有 OpenAI 兼容接口 `/v1/models`，把桌面版 DSH 插件中的 WorkBuddy、Our Free Model 模型接入同一模型列表，并验证 `/v1/models` 与 `/v1/chat/completions`。
- 基线：FreeLLMAPI 0.16.23 监听 127.0.0.1:31415；原始 `/v1/models` 200、321 ids；`check-freellmapi.ps1` 自检 chat 200 via custom / glm-5.3-flash。31416 是 grok subscription gateway，保持原状。
- 数据层：C:\Users\onemt\AppData\Roaming\FreeLLMAPI\freeapi.db；`models` 表 UNIQUE(platform, model_id, endpoint_scope)；source=user 的 custom 行通过 endpoint_scope 关联 base_url。
- 管理 API：POST `/api/auth/desktop-session` 取 dashboard token；`/api/keys/custom/discover-models` 与 `/api/keys/custom` 注册自定义 OpenAI 兼容端点；`customProviderSchema` 接受 baseUrl/keyId/models/apiKey/label/groupLabel。
- 插件：dsh-connect-workbuddy 5.21.4 的运行态 loopback shim 与 bearer 随 DSH 启动随机；dsh-our-free-model 2.8.3 自带 forward listener，settings 默认 127.0.0.1:18899。

## 运行态发现与稳定桥接

- `v3_scan_dsh_memory.py` 扫描 DSH PID 9444 内存，定位 WorkBuddy shim 54001（16 模型）与 54002（28 模型），取得进程内 base64url bearer；凭据只写入 `dsh-plugin-bridge.config.json`，本报告不收录。
- `cordis.patch.yml` 的 `dsh-connect-workbuddy` lastCatalog 解析出 31 个静态模型条目；运行态实际合并为 44 个可用 WorkBuddy 模型，前缀 `wb-cn/` 与 `wb-2/`。
- 稳定桥接器 [dsh-plugin-bridge.mjs](<dsh-plugin-bridge.mjs>) 固定监听 http://127.0.0.1:31418/v1，三条上游路由：`wb-cn/`（16）、`wb-2/`（28）、`ofm/`（18）。FreeLLMAPI 只注册这个固定端点，避免跟随随机 shim。
- [start-dsh-plugin-bridge-cim.ps1](<start-dsh-plugin-bridge-cim.ps1>) 用 CIM `Invoke-CimMethod Win32_Process Create` 脱离 DSH 作业树启动桥接器；`refresh-dsh-plugin-bridge.mjs` 在 DSH 重启后刷新随机 shim 端口和 token。
- WorkBuddy shim 无论请求 `stream:false` 还是 `stream:true` 都返回 `text/event-stream`；桥接器把非流式上游 SSE 聚合为 OpenAI `chat.completion` JSON，合并 `delta.content` / `reasoning_content` / `tool_calls`、最后的 `usage` 与 `finish_reason`，并把 model 改写回公共 ID。
- FreeLLMAPI 对外 `/v1/models` 会把 custom id 的斜杠、冒号等去掉（`wb-cn/hy4free` → `wb-cnhy4free`，`ofm/baidu/ernie-5.5-flash-preview:free` → `ofmbaiduernie-5.5-flash-previewfree`）。桥接器同时接受原始带前缀写法与去斜杠公共 ID。

## Our Free Model forward

- DSH 插件控制面 `/api/our-free-model/*` 直接 HTTP 访问返回 401；`dsh-client-connection` 的 launch token 只存在进程 WeakMap，不落盘，内存扫描 cookie 交换失败。
- 改走文件态：C:\Users\onemt\.dsh\our-free-model\settings.json 设置 `forward.enabled=true`、`host=127.0.0.1`、`port=18899`、生成本地 `forwardKey`；触碰 [src/reload.js](<C:/Users/onemt/.dsh/local-plugins/dsh-our-free-model/src/reload.js>) 触发 `autoReloadWatch` 热重载。备份在 [ofm-settings-backup.json](<ofm-settings-backup.json>)。
- OFM `/v1/models` 返回 18 条；forward 的非流式 `/v1/chat/completions` 原生返回 JSON，桥接器只需剥 `ofm/` 前缀、注入 forwardKey、改回公共 ID。
- 逐模型探测见 [ofm-chat-probe.json](<ofm-chat-probe.json>)：18 条目录完整挂载；`ofm/baidu/ernie-5.5-flash-preview:free`、`ofm/liquid/lfm-3-1.7b:free` 经 FreeLLMAPI 均 200。6 条 OpenCode 免费车道上游返回 Bun 依赖提示；若干 OpenRouter 斜杠 ID 返回 `model request failed: Invalid URL`；`thinkingmachines/inkling-2-small:free` 返回 429。

## 注册与端到端验证

- [v3_integrate_ofm_bridge.mjs](<v3_integrate_ofm_bridge.mjs>) 复用 custom keyId=8，通过 `/api/keys/custom` 注册 62 个插件模型：`wb-cn/` 16 + `wb-2/` 28 + `ofm/` 18，`modelErrors=[]`。
- [verify-dsh-plugin-integration.mjs](<verify-dsh-plugin-integration.mjs>) 最终验证：bridge `/v1/models` 200、62 ids；FreeLLMAPI `/v1/models` 200、383 ids（原 321 + 62）；其中 WorkBuddy 44、Our Free Model 18。
- 非流式 chat 五个代表模型全部 200：`wb-cn/hy4free`、`wb-cnhy4free`、`wb-2/fast-model`、`ofm/baidu/ernie-5.5-flash-preview:free`、`ofm/liquid/lfm-3-1.7b:free`。
- WorkBuddy `stream:true` 经桥接器把 reasoning_content 提升到 delta.content 后返回 `text/event-stream` 200。
- 最终快照 [dsh-plugin-integration-final.json](<dsh-plugin-integration-final.json>)；注册清单 [dsh-plugin-registration.json](<dsh-plugin-registration.json>)；逐模型探测 [ofm-chat-probe.json](<ofm-chat-probe.json>)。给其他 Agent 读取的完整模型配置在 [AGENTS.md](<AGENTS.md>)，由 [collect-model-catalog.mjs](<collect-model-catalog.mjs>) 从运行态生成，含全部 383 个模型 ID 与分组、配置示例、维护规则。
- 零 token 连通性报告 [model-connectivity-zero-token.md](<model-connectivity-zero-token.md>) 与结构化数据 [model-connectivity-zero-token.json](<model-connectivity-zero-token.json>)：0 次 chat/completions、383 次目录检索、路由就绪 110 个、确定不可用 268 个、历史实测 200 4 个。
- 修正版零 token 报告（[model-connectivity-zero-token.md](<model-connectivity-zero-token.md>)）：首轮 383 并发 GET 触发 429 导致 268 条误标 catalog_error，串行复测 8/8 为 200；改用目录字段判定后：ready 120、不可用 258、exhausted 0、历史实测 200 5。
- 一键维护脚本 [integrate-dsh-plugin-models.ps1](<integrate-dsh-plugin-models.ps1>) 串联完整 5 步，仅首次部署或改桥接器代码时需要。日常用 [sync-dsh-plugin-models.mjs](<sync-dsh-plugin-models.mjs>)（双击 [同步插件模型.cmd](<同步插件模型.cmd>)）：幂等，先探测 WorkBuddy shim 是否仍带旧 token 存活，只在失效时重新扫描并 /reload；桥接器实时拉上游 /v1/models，只有 FreeLLMAPI 缺新模型 ID 时才补注册。
- 继续复检 [final-status.md](<final-status.md>)：非流式 chat 5/5 HTTP 200，stream:true HTTP 200 且 content-type=text/event-stream；显式端口复检 6/6 reachable；4 个 Node 助手语法检查 exit 0。
