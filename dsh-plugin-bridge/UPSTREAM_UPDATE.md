# FreeLLMAPI 上游更新巡检

- 巡检时间：2026-11-12 17:10+08
- 上游仓库：https://github.com/tashfeenahmed/freellmapi
- fork：https://github.com/Hrh97/freellmapi
- 本地版本：0.16.23；D:/Ai/freellmapi/freellmapi-asar/package.json 与 D:/Ai/freellmapi/latest-new.yml 均为 0.16.23，releaseDate 2026-11-09T19:14:22.379Z。
- 上游最新发布：v0.16.26，published_at 2026-11-11T15:56:21Z，target_commitish a958ad293b75045cc42dfca8f8eb4054832c3e04。
- 本地落后发布标签：v0.16.24、v0.16.25、v0.16.26。
- 上游 main：sha ae915683cdbfa074d89bf5aa5e8415dfcfc2ad98，最新提交 2026-11-11T17:58:31Z，晚于 v0.16.26 发布时间；最新提交包括 fix(desktop): identify macOS release downloads (#1859)、fix: correct Varosity free credit eligibility (#1858)、fix(keys): list keyless HAL-X and AI SENSE decision providers (#1804) (#1831)、docs: credit contributors (#1906)。
- v0.16.26 发布说明要点：Outcrawl web search、每条 chain 独立 routing strategy、月 token budget bar 修复、Zod v4 / Vitest v5、Windows CLI 测试，以及 v0.16.25 的 overloaded-model fallback、Gemini tool schema items、Start on system startup。
- compare v0.16.26...main 的 web_fetch 尝试报 web fetch failed: TypeError: fetch failed；main 更新结论由 list_branches 与 list_commits 结果直接确认。
