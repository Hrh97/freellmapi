# DSH plugin model bridge for FreeLLMAPI

本目录保存桌面版 DSH 插件模型接入 FreeLLMAPI 的本地桥接增量。

## 文件

- dsh-plugin-bridge.mjs：固定监听 127.0.0.1:31418/v1，聚合 WorkBuddy 与 Our Free Model 上游，处理 SSE→JSON、流式 reasoning_content→delta.content、公共 ID 去斜杠兼容。
- refresh-dsh-plugin-bridge.mjs 与 v3_scan_dsh_memory.py：DSH 重启后刷新 WorkBuddy 随机 shim 端口和 bearer。
- register-dsh-plugin-models.mjs：向 FreeLLMAPI 官方 /api/keys/custom 注册桥接器模型。
- v3_integrate_ofm_bridge.mjs：轮询 OFM forward、刷新桥接、注册 62 个模型并验证。
- verify-dsh-plugin-integration.mjs 与 final-health-probe.mjs：端到端与端口健康验证。
- start-dsh-plugin-bridge-cim.ps1：用 CIM 脱离 DSH 作业树启动桥接器。
- integrate-dsh-plugin-models.ps1：一键刷新、注册、集成、验证。
- dsh-plugin-bridge.config.example.json：脱敏配置模板；复制为同目录 dsh-plugin-bridge.config.json 后填入本地 shim token 与 OFM forwardKey。
- model-integration-audit.md、final-status.md、UPSTREAM_UPDATE.md、FORK_NOTES.md：巡检、复检、上游更新与 fork 说明。
- dsh-plugin-integration-final.json、dsh-plugin-registration.json、ofm-chat-probe.json：验证快照与逐模型探测结果。

## 本地使用

1. 复制 dsh-plugin-bridge.config.example.json 为 dsh-plugin-bridge.config.json。
2. 按本机运行态填写 WorkBuddy shim apiKey 与 Our Free Model forwardKey；也可运行 refresh-dsh-plugin-bridge.mjs 自动刷新 WorkBuddy 两个 shim。
3. 准备 D:/Ai/freellmapi/unified-key.txt 或按 verify-dsh-plugin-integration.mjs 中的路径规则放置 FreeLLMAPI 统一 key。
4. 运行 integrate-dsh-plugin-models.ps1。

## 当前验证结果

- FreeLLMAPI /v1/models：383 ids，新增 62 个插件模型。
- WorkBuddy：44 个；Our Free Model：18 个。
- 非流式 /v1/chat/completions：5/5 HTTP 200。
- stream:true：HTTP 200，content-type text/event-stream。
