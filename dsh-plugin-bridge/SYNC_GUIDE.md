# 日常同步：一条命令

- 首次部署或改了桥接器代码：跑 integrate-dsh-plugin-models.ps1（5 步全量）。
- 日常 / DSH 或 WorkBuddy 插件更新后：双击 同步插件模型.cmd，或 node sync-dsh-plugin-models.mjs。

## 脚本实际做什么

1. 用现有 token 探测 WorkBuddy shim 的 /healthz；全部 200 就跳过内存扫描。
2. 只有 shim 失效（DSH 重启导致随机端口/secret 变了）才跑 v3_scan_dsh_memory.py，重写 config 并调 /reload 热加载，不重启桥接进程。
3. 桥接器不可达时才用 CIM 重启。
4. 对比桥接器 /v1/models 与 FreeLLMAPI /v1/models；只有新模型 ID 缺失才调 register-dsh-plugin-models.mjs（幂等）。
5. 输出 shimsAlive / shimRefreshed / bridgeReloaded / missingInFreeLlmApi / orphanedInFreeLlmApi。

## 插件更新后要不要重新应用

- 只改模型清单、端口和 secret 没变：零操作。桥接器每次请求实时拉上游 /v1/models；FreeLLMAPI 自带 custom-model-sync 默认每 24h 自动补新模型。
- 插件更新触发 DSH 宿主重启：跑一次同步脚本即可，不需要重新注册、不需要改 FreeLLMAPI 配置。
- Our Free Model 插件更新：forward 端口 18899 与 forwardKey 落在 settings.json，不变则零操作；设置被重置才需重新启用 forward。
- 插件删了模型：FreeLLMAPI 的 custom-model-sync 只增不删，脚本会报 orphanedInFreeLlmApi，需手动在 Keys 页删除残留模型。
