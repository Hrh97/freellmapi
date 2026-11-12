# FreeLLMAPI × DSH 插件模型最终状态

- 复检时间：2026-11-12T08:37:50.863Z
- 桥接器 `/healthz`：HTTP 200，routes=3
- 桥接器 `/v1/models`：HTTP 200，62 ids（WorkBuddy 44，Our Free Model 18）
- FreeLLMAPI `/v1/models`：HTTP 200，383 ids（WorkBuddy 44，Our Free Model 18）
- 非流式 `/v1/chat/completions`：5/5 HTTP 200
- 流式 `stream:true`：HTTP 200，text/event-stream
- 显式端口复检：6/6 reachable；bridge-health=200，ofm-health=200，grok-models=200，freellmapi-models=401，workbuddy-cn-health=401，workbuddy-2-health=401
- 语法检查：4/4 exit 0

## 代表模型

- `wb-cn/hy4free` → HTTP 200，"Okay, the user said \"say ok.\" At first glance, this seems like"
- `wb-cnhy4free` → HTTP 200，"Okay, the user asked me to \"say ok\". That's pretty straightforward."
- `wb-2/fast-model` → HTTP 200，"ok"
- `ofm/baidu/ernie-5.5-flash-preview:free` → HTTP 200，"OK"
- `ofm/liquid/lfm-3-1.7b:free` → HTTP 200，"Ok! Let me know if you need anything else."

## 维护入口

- [integrate-dsh-plugin-models.ps1](<integrate-dsh-plugin-models.ps1>)：DSH 重启后一键刷新 WorkBuddy shim、CIM 重启桥接器、注册模型、集成 OFM、最终验证。
- [verify-dsh-plugin-integration.mjs](<verify-dsh-plugin-integration.mjs>)：端到端验证器并写回 [dsh-plugin-integration-final.json](<dsh-plugin-integration-final.json>)。
- [model-integration-audit.md](<model-integration-audit.md>)：完整巡检与决策记录。
