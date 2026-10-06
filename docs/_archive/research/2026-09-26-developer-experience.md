# Developer Experience Research: Plugin Shell (terminal + companion, agent-first)

Research date: 2026-09-26. Sources are cited inline with their publication dates where known. Statements about the repository come from reading `README.md`, `SHELL-FIRST-OVERVIEW.md`, `AGENTS.md`, `docs/development/FRAMEWORK-CLI.md`, `docs/development/OPERATION-PROTOCOL.md`, `docs/development/LOGGING-AND-DEBUGGING.md`, `docs/concepts/companion/README.md`, and `docs/concepts/companion/PROJECT-STARTERS.md`, and from running `node shell.mjs` and `npx vitest run` locally (Node 22.22.2 in this container, not the pinned 24.21.0).

---

## Executive summary

1. **Obsidian now has an official CLI with developer commands** (early access in 1.12.0 on 2026-02-10, generally available in 1.12.4 on 2026-02-27). It provides `plugin:reload`, `dev:errors`, `dev:console`, `dev:screenshot`, `dev:dom`, `dev:css`, `dev:cdp`, `dev:mobile` and `eval`. It remote-controls a *running* app and has no headless mode ([Obsidian Help: CLI](https://obsidian.md/help/cli); [DEV, 2026-03-06](https://dev.to/shimo4228/obsidians-official-cli-is-here-no-more-hacking-your-vault-from-the-back-door-3123)). This is the missing "eyes" for agents. The shell should wrap it rather than rebuild it. I found no documented JSON output mode for these commands.
2. **The reference loop is reload → errors → screenshot → console.** Kepano's official-org `obsidian-cli` agent skill encodes it ([kepano/obsidian-skills](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md)). `dev:obsidian --once --json` should emit exactly this bundle.
3. **Obsidian plugin review is now automated and runs on every release.** The Community directory launched 2026-05-12 ([Obsidian blog](https://obsidian.md/blog/future-of-plugins/)). It scans with `eslint-plugin-obsidianmd` plus policy, vulnerability and malware checks, and developers can run preview scans on any branch. A secondary source reports that scans of existing plugins are informational only **until 2026-10-30**, about five weeks from now ([AlternativeTo, 2026-05](https://alternativeto.net/news/2026/5/obsidian-launches-community-hub-with-automated-plugin-reviews-and-enhanced-safety/)). The shell needs a `check submission` gate that behaves like the scanner.
4. **Short, non-inferable agent files beat long ones.** An ETH study found that context files did not raise agent success rates and increased cost by more than 20%. LLM-generated files had a slightly negative effect, and repository overviews did not help ([Gloaguen et al., arXiv 2602.11988, 2026-02](https://arxiv.org/abs/2602.11988)). A second study found curated AGENTS.md files cut runtime by 28.6% and output tokens by 16.6% ([Lulla et al., arXiv 2601.20404](https://arxiv.org/abs/2601.20404)). Put commands and gotchas in the file and move everything else into skills or docs. The repository's own AGENTS.md is 1,211 words of mostly policy.
5. **"Give the agent a check it can run" is Anthropic's top recommendation**, and hooks turn advice into guarantees. A Stop hook can block the end of a turn until tests pass (exit code 2, with stderr fed back to the agent) ([Claude Code best practices](https://code.claude.com/docs/en/best-practices); [hooks](https://code.claude.com/docs/en/hooks)).
6. **The fast loop is too slow today.** `npx vitest run` took **50.7 s** here with `fileParallelism: false`. Vitest itself suggested `isolate: false` (about 4.8 s saved). Vitest 5 (2026-09-03) makes `fsModuleCache` stable and adds `vitest doctor` ([Vitest 5](https://vitest.dev/blog/vitest-5.html)). The target is under 10 s for the default and related-file loops, with heavy gates moved to `verify` and CI.
7. **Vitest turns on an `agent` reporter automatically inside coding agents**: failures only, and 64.7 KB of output dropped to 228 B in one report. Configuring custom reporters turns the automatic detection off ([Vitest reporters](https://vitest.dev/guide/reporters); [PR #9779](https://github.com/vitest-dev/vitest/pull/9779)). Generated configs must keep it.
8. **Use one operation core with many front ends.** LSP-style separation turns M×N integrations into M+N ([LSP](https://microsoft.github.io/language-server-protocol/)). Nx Console renders generator forms from `schema.json` and re-runs `--dry-run` as you type ([Nx docs](https://nx.dev/docs/kb/console-generate-command)). Backstage builds forms from JSON Schema and has a dry-run template editor ([Backstage](https://backstage.io/docs/features/software-templates/writing-templates/)). The shell already has `executeOperation(request, context)` and `schema`. The companion should render forms from that schema and add nothing else.
9. **Framework CLIs now ship MCP servers**, for example `ng mcp` in the Angular CLI and `nx-mcp` ([Angular](https://angular.dev/ai/mcp); [Nx Console](https://github.com/nrwl/nx-console)). But CLI plus skill is often more token-efficient than MCP: Playwright's own `@playwright/cli` (early 2026) uses about 4x fewer tokens than Playwright MCP ([Playwright docs](https://playwright.dev/docs/getting-started-cli); [TestCollab](https://testcollab.com/blog/playwright-cli)). Priority order: CLI `--json` plus skills first, then a thin MCP adapter.
10. **Real-host E2E is mature enough to rely on.** `obsidian-launcher` downloads any Obsidian version, including the plugin's `minAppVersion` via `earliest`, into sandboxed config dirs. It has a `watch` mode that installs hot-reload automatically, and wdio-obsidian-service adds mobile emulation and Android via Appium ([obsidian-launcher README](https://github.com/jesse-r-s-hines/wdio-obsidian-service/blob/main/packages/obsidian-launcher/README.md); [wdio-obsidian-service](https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README.html)). One caveat: the official Obsidian CLI is documented to work with a single instance only.
11. **Debugging basics are missing in the shell.** The official sample plugin ships inline source maps in dev builds (`sourcemap: prod ? false : 'inline'`) ([sample esbuild config](https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/esbuild.config.mjs)). The shell sets `sourcemap: false` for every build, so stack traces in real Obsidian point at minified code.
12. **Human-mode CLI output needs the clig.dev basics**: examples first, "did you mean", suggested next command, and no raw JSON unless `--json` is passed ([clig.dev](https://clig.dev/)). Today `doctor` and `make list` print raw JSON in human mode, `shell.mjs statu` gives no suggestion, and help lists option names with no descriptions or allowed values.
13. **Ship a golden path of about five commands, not 57 npm scripts plus 38 CLI commands.** The DevEx framework names feedback loops, cognitive load and flow as the three levers ([Noda, Storey, Forsgren, Greiler, CACM 2023](https://dl.acm.org/doi/10.1145/3610285)). The current surface maximizes coverage, not cognitive ease.
14. **Chrome DevTools MCP and Playwright can attach to Obsidian's Electron renderer over CDP** (`--remote-debugging-port=9222`, then `--browser-url`/`connectOverCDP`) ([Chrome DevTools MCP](https://developer.chrome.com/docs/devtools/agents/get-started/configuration); [jsade, 2025](https://jsade.github.io/posts/how-to-connect-visual-studio-code-s-debugger-to-obsidian-in-macos/)). The same port serves VS Code breakpoints, agent screenshots and log capture.

---

## 1. DX principles for frameworks, CLIs and templates

**Research framing.** DevEx names three dimensions: *feedback loops* ("the speed and quality of responses to developers' actions"), *cognitive load* ("the mental processing required to perform tasks") and *flow state*. The authors say measurement must combine perceptions with system data, and that "one metric or dimension alone is not enough" ([Noda et al., CACM 66(11), 2023](https://dl.acm.org/doi/10.1145/3610285); summary at [Develocity](https://develocity.io/a-summary-devex-what-actually-drives-productivity-by-noda-et-al-2023/)). In practice this means measuring *time-to-first-green* (the first passing test in a real host), *edit-to-reload latency*, and *number of concepts a newcomer must learn before shipping one change*.

**Pit of success.** Rico Mariani's principle is that users should "simply fall into winning practices" ([Coding Horror](https://blog.codinghorror.com/falling-into-the-pit-of-success/)). For the shell, the safe path (isolated vault, reviewed plans, preserved `data.json`) must also be the *shortest* path.

**CLI guidelines (clig.dev)** ([clig.dev](https://clig.dev/)). Patterns worth copying directly:
- Concise help by default, "lead with examples", and the most common flags first.
- Rewrite errors for humans, "suggest corrections" for mistyped subcommands, "suggest commands the user should run next", and put the most important information at the end.
- Primary output goes to stdout and messaging to stderr. `--json` is for machines. Only prompt when stdin is a TTY, and honour `--no-input`.
- Print something within 100 ms and show progress for long work. Offer `--dry-run`. Scale confirmations to severity. Make commands crash-only and re-runnable.

**Exemplary tools and the specific pattern to copy from each**

| Tool | Pattern | Source |
|---|---|---|
| create-vite | One-line non-interactive scaffold: `npm create vite@latest app -- --template vue-ts`; `--no-interactive` | [Vite guide](https://vite.dev/guide/) |
| create-t3-app | Every prompt has a flag; `--CI` mode for scripted scaffolds; `--noInstall`, `--noGit` | [T3 install docs](https://create.t3.gg/en/installation) |
| Astro | `astro add <integration>` edits config *and* installs deps in one reviewed step; `create astro --template` accepts any repo | [Astro CLI](https://docs.astro.build/en/reference/cli-reference/), [integrations](https://docs.astro.build/en/guides/integrations/) |
| Nx / Nx Console | Generators declare `schema.json`, and the IDE renders a form and re-runs `--dry-run` live as options change | [Nx Console generate](https://nx.dev/docs/kb/console-generate-command) |
| Rails | `--pretend` (dry run), `destroy` undoes `generate`, per-file status verbs, `--skip/--force` | [Rails CLI guide](https://guides.rubyonrails.org/command_line.html) |
| Phoenix | `mix phx.gen.live` prints the exact snippet to paste (routes) and the next command (migrate) | [phx.gen.live](https://hexdocs.pm/phoenix/Mix.Tasks.Phx.Gen.Live.html) |
| Playwright | UI mode with watch and time-travel trace, trace viewer, codegen | [UI Mode](https://playwright.dev/docs/test-ui-mode), [Trace viewer](https://playwright.dev/docs/trace-viewer) |
| Vitest 5 | Duration breakdown by phase, `vitest doctor` suggests faster config, trace view in watch mode, single-file HTML report | [Vitest 5, 2026-09-03](https://vitest.dev/blog/vitest-5.html) |

**Tool design for agents** ([Anthropic, "Writing effective tools for agents", 2025-09-11](https://www.anthropic.com/engineering/writing-tools-for-agents)):
- Consolidate multi-step operations into one call.
- Namespace commands.
- Return "only high signal information", with human-readable identifiers.
- Offer a concise/detailed response format.
- Write error messages that steer the agent toward a correct retry.

---

## 2. State of the art in Obsidian plugin development

**Official baseline.** The sample plugin is a GitHub template with esbuild, watch mode (`npm run dev`), `eslint-plugin-obsidianmd`, `version-bump.mjs` and inline dev source maps ([sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin)). It now ships an **AGENTS.md** that says: "Keep `main.ts` small", keep files around 200–300 lines, copy artifacts into `<Vault>/.obsidian/plugins/<id>/`, no hidden telemetry, and use `register*` helpers for cleanup ([AGENTS.md](https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/AGENTS.md)). The docs still recommend pjeby's Hot-Reload plugin for reloading ([Build a plugin](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)).

**Official Obsidian CLI (2026).**
- Requires the 1.12 installer (1.12.7+). Enable it under Settings → General → Command line interface, and the app must be running (it launches if absent).
- Developer commands: `plugin:reload id=`, `devtools`, `dev:debug on|off`, `dev:cdp method= params=`, `dev:screenshot path=`, `dev:errors [clear]`, `dev:console limit= level= clear`, `dev:css selector= prop=`, `dev:dom selector= …`, `dev:mobile on|off`, `eval code=`, plus `vault=` targeting ([Obsidian Help: CLI](https://obsidian.md/help/cli); [obsidian.md/cli](https://obsidian.md/cli)).
- **Uncertain:** I found no documented JSON output flag for developer commands, and the obsidian-launcher README says the native CLI "works with single instance only". Whether it can target a launcher sandbox instance while the developer's own Obsidian is also open is unverified.

**Reload tooling.** Hot-Reload watches `main.js`/`styles.css`/`manifest.json` in plugin folders that contain `.git` or `.hotreload`, and reloads after about 750 ms of quiet ([pjeby/hot-reload](https://github.com/pjeby/hot-reload)). `obsidian plugin:reload` is now the deterministic, scriptable alternative.

**Real-host automation.**
- `obsidian-launcher` provides `launch`, `watch` (installs hot-reload and syncs local plugin changes), `install` and `download`. It accepts `--copy` for a sandboxed vault copy, `-v latest|latest-beta|earliest|x.y.z`, and plugin specs such as `id:`/`repo:`/path. It uses sandboxed config dirs and lets several versions run in parallel. Beta versions require Insider credentials ([README](https://github.com/jesse-r-s-hines/wdio-obsidian-service/blob/main/packages/obsidian-launcher/README.md)).
- `wdio-obsidian-service` adds multi-version CI, mobile emulation, Android via Appium, `executeObsidianCommand`, `resetVault` and cache dirs ([docs](https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README.html); [sample](https://github.com/jesse-r-s-hines/wdio-obsidian-service-sample-plugin)).

**Typings and mocks.**
- `obsidian-typings` covers private APIs (reverse-engineered, and must be imported explicitly so volatility stays visible) ([Fevol](https://github.com/Fevol/obsidian-typings)).
- `obsidian-test-mocks` provides in-memory implementations of all of `obsidian.d.ts` plus prototype extensions, with a Vitest setup ([mnaoumov](https://github.com/mnaoumov/obsidian-test-mocks)). The older option is `jest-environment-obsidian` ([obsidian-community](https://github.com/obsidian-community/jest-environment-obsidian)).
- Toolkits: `obsidian-dev-utils` (build/dev/lint CLI) and a Yeoman `generator-obsidian-plugin` ([dev-utils](https://github.com/mnaoumov/obsidian-dev-utils); [generator](https://github.com/mnaoumov/generator-obsidian-plugin)).
- Framework templates are mostly Svelte; `unxok/obsidian-vite` covers React/Svelte/Vue ([obsidian-vite](https://github.com/unxok/obsidian-vite)). I found no maintained Vue plus Pinia plus design-system framework comparable to this shell, which is a real differentiator.

**Review and linting.**
- `eslint-plugin-obsidianmd` has 40+ rules, for example `no-nodejs-modules`, `prefer-create-el`, `validate-manifest`, `no-sample-code` and `no-static-styles-assignment` ([obsidianmd/eslint-plugin](https://github.com/obsidianmd/eslint-plugin)).
- The 2026 Community directory scans every version, offers dashboard preview scans on any branch/tag/commit, and plans scorecards and **capability disclosures (network, filesystem, clipboard)**. The blog says "we have not set a deadline for this yet" ([Obsidian blog, 2026-05-12](https://obsidian.md/blog/future-of-plugins/)). A later report cites 2026-10-30 as the end of informational-only scans for existing plugins ([AlternativeTo](https://alternativeto.net/news/2026/5/obsidian-launches-community-hub-with-automated-plugin-reviews-and-enhanced-safety/)). Treat that date as likely but verify it.
- Community reports say the scanner also applies typescript-eslint type-checked rules. A community `obsidian-plugin-validator` runs the checks offline ([docs issue #252, 2026-07-29](https://github.com/obsidianmd/obsidian-developer-docs/issues/252)).

**Agent assets already in the ecosystem.** Kepano's `obsidian-cli` skill and `gapmiss/obsidian-plugin-skill` (progressive disclosure: a ~325-line SKILL.md plus 9 references, targeting Claude Code, Codex and Windsurf) ([gapmiss](https://github.com/gapmiss/obsidian-plugin-skill)). The Local REST API plugin exposes an MCP endpoint for *vault content*, which is useful for test-data inspection but not for plugin development ([coddingtonbear](https://github.com/coddingtonbear/obsidian-local-rest-api)).

**Pain points and what would make plugin development a joy:**
- Manual reload, fixed by CLI or hot-reload wired into `dev`.
- No headless host, handled by a sandboxed launcher plus xvfb in CI.
- Mobile untestable, addressed with `dev:mobile` or `emulateMobile` smoke tests.
- Private-API typing gaps, handled by an explicit `obsidian-typings` opt-in.
- Late discovery of review failures, fixed by a local scanner-equivalent gate.
- Personal-vault risk, avoided with sandbox-by-default.
- Opaque minified stacks, fixed by inline dev source maps.

The joy version: save a file, the plugin reloads in the sandbox in under 2 s, errors appear in the terminal with source-mapped stacks, and one command gives an agent a screenshot plus errors.

---

## 3. Agentic engineering best practices (2025–2026)

**AGENTS.md.** An open format stewarded by the Agentic AI Foundation under the Linux Foundation, used by more than 60,000 projects and supported by 20+ tools. Nested files apply, and "the closest AGENTS.md to the edited file wins". Typical sections: setup/build/test commands, code style, testing, security, PR rules ([agents.md](https://agents.md/)). Codex is trained to run the checks named in AGENTS.md before finishing ([openai/codex AGENTS.md](https://github.com/openai/codex/blob/main/AGENTS.md)). GitHub Copilot's coding agent has read AGENTS.md since 2025-08-28 ([changelog](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)).

**Evidence on length and content.** See executive summary item 4. The practical rule is the one in Anthropic's docs: for each line, ask "Would removing this cause Claude to make mistakes?" Include commands Claude can't guess, style that differs from defaults, test runners, repository etiquette, architectural decisions and environment quirks. Exclude what code reveals, standard conventions, long tutorials and file-by-file descriptions. "Bloated CLAUDE.md files cause Claude to ignore your actual instructions" ([best practices](https://code.claude.com/docs/en/best-practices)).

**Claude Code mechanics that matter for a generated project:**
- **Verification first:** "Give Claude a check it can run". Gate it with a Stop hook, `/goal`, or a verification subagent, and have Claude show evidence (command, output, screenshot) rather than assert success ([best practices](https://code.claude.com/docs/en/best-practices)).
- **Skills** load only their description until invoked. Keep SKILL.md under 500 lines with references alongside. Use `disable-model-invocation: true` for side-effecting workflows. `` !`cmd` `` injects live output, `context: fork` isolates heavy work, and skills follow the open Agent Skills standard ([skills](https://code.claude.com/docs/en/skills)).
- **Hooks** are deterministic. `PostToolUse` on `Edit|Write` runs format/lint, and a `Stop` hook runs fast tests and exits 2 to block with stderr as feedback. `PreToolUse` guards destructive commands. Configure them in `.claude/settings.json` ([hooks](https://code.claude.com/docs/en/hooks)).
- **Permissions:** allowlist safe commands (e.g. `npm run lint`), use the sandbox, and use `--allowedTools` for unattended runs. Headless use is `claude -p … --output-format json|stream-json` ([best practices](https://code.claude.com/docs/en/best-practices)).
- **Context engineering:** "the smallest possible set of high-signal tokens", just-in-time retrieval, compaction, structured notes and sub-agents ([Anthropic, 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).

**Repository properties that make agents succeed:**
1. One fast, deterministic check command with a pass/fail exit code and terse failure-only output (e.g. the Vitest `agent` reporter).
2. `--json` on every command, one result object on stdout, stable error codes with a `next` hint. The shell already does this.
3. No hidden prompts. JSON and non-TTY modes never prompt, which the shell already guarantees.
4. Small files; the shell's 400-line cap aligns with the sample plugin's 200–300 guidance.
5. Test-first loops: "write a failing test that reproduces the issue, then fix it".
6. Self-verification in the real app through screenshots, console and DOM.
7. Pitfalls to avoid: context bloat from verbose logs, flaky checks (agents "fix" flakes by editing tests), interactive prompts that hang, overlong instructions, and generated AGENTS.md content that restates code.

**Giving agents eyes.**
- Chrome DevTools MCP offers console, network, performance traces, screenshots and evaluate. It connects via `--browser-url http://127.0.0.1:9222` or `--autoConnect` (since 2025-12-11) ([Chrome blog](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session); [config](https://developer.chrome.com/docs/devtools/agents/get-started/configuration)). Community reports confirm it works against Electron CDP ports ([electron-devtools-mcp](https://github.com/holepunchto/electron-devtools-mcp)).
- Playwright MCP keeps accessibility snapshots in context. `@playwright/cli` saves artifacts to disk and installs skills (`playwright-cli install --skills`) ([Playwright coding agents](https://playwright.dev/docs/getting-started-cli)).
- For Obsidian specifically, the official CLI's `dev:*` commands are the lowest-token route.
- MCP itself went stateless in the 2026-07-28 spec revision ([MCP blog](https://blog.modelcontextprotocol.io/posts/2026-07-28/)), which makes a local stdio or HTTP adapter over the shell's operation core simpler.

---

## 4. Dual interface (CLI + GUI companion) over one operation core

**Precedents:**
- **LSP:** one server, many editors, M+N integrations.
- **Nx:** the generator `schema.json` drives both CLI validation and the Nx Console form, and the GUI shells out to `nx g --dry-run` for live preview. Nx also exposes the same workspace knowledge to agents via `nx-mcp`.
- **Angular:** schematics plus `ng mcp`.
- **Backstage:** JSON-Schema parameters → react-jsonschema-form, with a template editor that dry-runs.
- **Terraform:** `plan -out` → `show -json` → `apply <planfile>` applies *exactly* the reviewed plan ([Terraform apply](https://terraform.io/docs/commands/apply.html)).

**Principles distilled:**
1. **One registry of operations, with schemas as the contract.** Every front end (terminal, companion, MCP, VS Code tasks) is a thin adapter that validates against the same schema and calls the same handler.
2. **Always preview.** GUI previews are dry-runs of the real engine, never a reimplementation.
3. **Plan/apply with content hashes.** Apply only what was reviewed, and let the plan be serialized so a human can review what an agent planned or the other way round.
4. **Receipts:** a machine-readable outcome (applied, unchanged, conflict) per file plus the next suggested step.
5. **Capability discovery is data-only.** The GUI and agents learn what exists without executing project code.
6. **Terminal state never leaks into contracts.** Progress, cancellation and logs are separate channels.

**The repository already implements most of this.** `executeOperation(request, context)`, `help/capabilities/schema --json`, the plan → inspect → apply flow with hashes, the stable states (planned/blocked/applied/unchanged/cancelled/failed), and `CLI_HANDOFF_REQUIRED` in the v1 discovery protocol. What is missing:
- A GUI form renderer driven by `schema`.
- A transport the companion can use.
- An MCP adapter.

**Obsidian-specific constraint.** A companion that spawns `node shell.mjs` needs Node APIs, which conflicts with `no-nodejs-modules` and future capability disclosures, and forces `isDesktopOnly`. Two options:
- **Handoff mode:** the companion writes project JSON plus a saved plan request and shows a copyable command or agent prompt. It works everywhere and passes review.
- **Desktop developer mode:** an explicit opt-in that spawns the CLI with argument arrays and streams JSON results.

Ship handoff mode first. This is a design inference and has not been tested against the scanner.

---

## 5. Logging and debugging DX for Electron/Obsidian plugins

- **Attach debuggers.** Launch Obsidian with `--remote-debugging-port=9222` (optionally `--enable-debug-logging`). VS Code then attaches with `{"type":"chrome","request":"attach","port":9222,"webRoot":"${workspaceFolder}"}` ([jsade, 2025-03/04](https://jsade.github.io/posts/how-to-connect-visual-studio-code-s-debugger-to-obsidian-in-macos/)). The same port serves Chrome DevTools MCP, Playwright `connectOverCDP` and `obsidian-launcher` pass-through args. The official CLI's `dev:debug on` and `dev:cdp` provide CDP access without a relaunch.
- **Source maps.** Inline in dev and never in release, as the official sample plugin does. Breakpoints and readable stacks depend on them. The shell currently disables them everywhere (`scripts/bundling/vite-shared.mjs`: `sourcemap: false`).
- **Structured logging.** The shell's logger is strong on safety: declared catalogs, redacted metadata, correlations, and a 50-record inspection modal. It has no console or file sink by design, and debug level resets on reload. For agents and terminal streaming, add a **dev-build-only mirror** that writes each accepted record as one prefixed JSON line to `console.debug`, such as `[plugin-shell] {"code":…,"op":…,"correlation":…}`. `dev:console`, CDP log streaming and `dev:obsidian --once` can capture it without a new transport, and it inherits the existing redaction guarantees. Also add a dev-only toggle that persists the debug level for the duration of a `dev` session.
- **Error overlay.** Vite's overlay covers the browser harness. In Obsidian, show a dev-only Notice such as "Plugin error — copied diagnostics", and have `dev:obsidian` print the source-mapped stack in the terminal.
- **Capture for agents.** Collect `dev:errors` and `dev:console level=error` after each reload, plus a screenshot on failure. Bound the output: dedupe repeated errors and truncate stacks to project frames.

---

## 6. Testing DX

**A pyramid for plugins, with a time budget for each layer:**

| Layer | Tooling | Budget | When |
|---|---|---|---|
| Pure domain/application | Vitest, node env | < 5 s total | every save / Stop hook |
| Fake host (in-memory Obsidian test kit) | Vitest plus a fake vault/workspace; `obsidian-test-mocks` is prior art | < 10 s | every save (related) |
| Components | Vitest + happy-dom, or Vitest Browser Mode (stable since v4, [2025-10-22](https://vitest.dev/blog/vitest-4)) | < 30 s | pre-commit / on demand |
| Browser harness E2E | Playwright (UI mode, trace) | minutes | CI + on demand |
| Real host E2E | obsidian-launcher + Playwright CDP / wdio | minutes | CI matrix (`earliest` + `latest`), nightly beta |

**Keeping the default loop under 10 s:**
- Use Vitest projects or tags so `npm test` runs only the fast projects.
- Run `vitest related <files> --run` from hooks and `--changed origin/main` before pushing ([Vitest CLI](https://vitest.dev/guide/cli)).
- Enable Vitest 5's stable `fsModuleCache`, and follow `vitest doctor` and the `isolate: false` hint where tests are pure.
- Revisit `fileParallelism: false` by making shared state per-file.
- Keep coverage, mutation, analyzer and native runs in `verify`/CI.

**Contract tests keep the fake host honest.** Run the same behavioral spec against the in-memory kit and against real Obsidian via `test:obsidian`: "A failure in any of these contract tests implies you need to update your test doubles" ([Fowler, ContractTest](https://martinfowler.com/bliki/ContractTest.html)).

**Snapshots and visual tests.** Vitest 4+ has `toMatchScreenshot`. Use screenshots as *evidence artifacts* for agents and reviewers rather than blocking gates, because cross-OS font and antialiasing drift causes flaky failures. The repository policy already forbids casually accepting baselines.

**Fixtures.** Use vault fixtures as folders, with the owned-fixture approval model the shell already has. Reset between tests (wdio's `resetVault` shows the speed benefit of resetting rather than relaunching).

**Watch and UI.** Offer Vitest UI or trace view and Playwright UI mode as one-word commands (`shell test --ui`, `shell test:e2e --ui`).

---

## Design principles for the Plugin Shell developer experience

1. **Golden path first, depth on demand.** Five commands cover 90% of work: `new`, `dev`, `test`, `make`, `verify`. Keep everything else behind `help --all`.
2. **Safe is shortest.** The sandbox vault, reviewed plans and preserved data are defaults that need no flags. Danger needs flags.
3. **Every change is observable in under 2 s.** Save → rebuild → reload in the real host → errors in the terminal.
4. **One engine, many faces.** Terminal, companion, MCP and agents call `executeOperation` with the same schemas. No front end reimplements logic.
5. **Preview everything, apply exactly what was reviewed.** Dry-run, plan hash, receipt, and the next step printed.
6. **Machines get JSON, humans get prose.** `--json` is complete and stable. Human mode never dumps JSON and always ends with a next action.
7. **Every check is fast, deterministic, terse and pass/fail.** Failures-only output, stable codes, no flake tolerance in the default loop.
8. **Agents see what humans see.** Screenshot, console, errors and DOM are available via one command, with bounded output.
9. **Instructions are minimal and enforced mechanically.** Short AGENTS.md, skills for workflows, hooks for must-happen rules, lint/check scripts for policy.
10. **Prove parity with reality.** Fake-host tests are contract-tested against real Obsidian, and generated projects are verified per starter.
11. **Honest status.** Keep the existing strength of distinguishing planned, qualified and executed, but surface it as a concise `status` rather than front-page prose.
12. **Review-ready by default.** Generated projects pass the Obsidian community scanner locally from the first commit.

---

## Gap analysis against the current shell

| # | Area | Observation (evidence) | Gap |
|---|---|---|---|
| G1 | First run | No terminal starter picker; starters live in the browser concept and in `companion:scaffold` (PROJECT-STARTERS.md). `shell.mjs new` is being built. | Terminal time-to-first-success depends on the concept UI or JSON files |
| G2 | Human output | `node shell.mjs doctor` and `make list` print raw JSON in human mode; `help test` lists `--profile <value>` without allowed values or descriptions; no examples | Violates clig.dev help and error guidance |
| G3 | Errors | `shell.mjs statu` gives `UNKNOWN_COMMAND … Use help.`, with no did-you-mean. `doctor` does give a `Next:` line, which is good. | Partial |
| G4 | Surface area | 57 npm scripts, 38 CLI commands (including release/framework maintenance) at the same level in help | Cognitive load; no tiering |
| G5 | Inner loop | `npx vitest run`: 50.7 s, `fileParallelism: false`; Vitest suggests `isolate:false` saves about 4.8 s; no `related`/`changed` scripts | The default loop is 5x over the 10 s target |
| G6 | Real-host loop | `dev:local` builds and installs, then "reload the plugin manually" (README); no hot-reload, official CLI or launcher integration yet (`dev:obsidian` in progress) | Reload friction; no agent eyes |
| G7 | Debugging | `sourcemap: false` for all builds; no `.vscode/launch.json`; no documented `--remote-debugging-port` recipe | Minified stacks; no breakpoints |
| G8 | Logging | Logger has no console/file sink, a 50-record modal, and debug level resets on reload (LOGGING-AND-DEBUGGING.md) | Agents and terminal cannot read logs without a mirror |
| G9 | Agent files | AGENTS.md is 1,211 words, mostly maintainer policy with milestone history; CLAUDE.md imports it; `.claude/` has no settings, skills or hooks | Inflated context cost and diluted rules (Gloaguen et al.); no deterministic gates |
| G10 | Docs | 221 Markdown files; README opens with qualification/milestone status before the quick start | Onboarding cognitive load |
| G11 | Toolchain | Strict pin 24.21.0 (`.nvmrc`), and `doctor` warns on Node 22 | Friction; there is no one-line fix hint (e.g. `fnm use`/`nvm use`) |
| G12 | Review readiness | `eslint-plugin-obsidianmd` 0.4.2 is present, but there is no scanner-equivalent `check submission` (manifest, policy, type-checked lint, no-Node APIs) | Risky ahead of the reported 2026-10-30 enforcement |
| G13 | Dual interface | Discovery protocol v1 is read-only; `executeOperation` exists, but there is no MCP adapter, no schema-driven form rendering, and the companion is still a concept with simulated operations | GUI and agent parity not yet realized |
| G14 | Mobile | Desktop-only pending qualification; no emulated-mobile smoke test | Mobile regressions invisible |
| G15 | Testing | No documented contract suite that proves the in-memory kit matches real Obsidian (kit in progress) | Fake-host drift risk |

---

## Recommendations

Priority: P0 = before the first framework release, P1 = next, P2 = later. Effort: S ≤ 1 day, M ≤ 1 week, L > 1 week.

### Terminal CLI
| Rec | P | Effort | Rationale | Source |
|---|---|---|---|---|
| `new` supports `--starter <id> --id --name --yes --json`, with interactive list when TTY; prints three next commands | P0 | M | create-vite/T3 parity; time-to-first-success | [Vite](https://vite.dev/guide/), [T3](https://create.t3.gg/en/installation) |
| Human renderer for every command (no raw JSON), with a trailing `Next:` line | P0 | S | clig.dev | [clig.dev](https://clig.dev/) |
| Did-you-mean (Levenshtein over command IDs and maker IDs) in both human and JSON errors (`suggestions: []`) | P0 | S | clig.dev; agent self-correction | [clig.dev](https://clig.dev/), [Anthropic tools](https://www.anthropic.com/engineering/writing-tools-for-agents) |
| Help: 1–2 examples per command, option descriptions and enums from `schema`; tiered `help` (golden path) vs `help --all` | P0 | M | Progressive disclosure | [clig.dev](https://clig.dev/) |
| `--format concise|detailed` (or `--fields`) on status/doctor/test JSON | P1 | S | Token efficiency | [Anthropic tools](https://www.anthropic.com/engineering/writing-tools-for-agents) |
| `doctor` checks Obsidian ≥1.12 installed, CLI enabled, CDP port free, launcher cache; prints exact fix commands | P1 | M | Early failure with actionable fixes | [Obsidian CLI](https://obsidian.md/help/cli) |
| `make` prints Rails-style per-file status and Phoenix-style "paste/next" guidance; `make undo <receipt>` for unchanged generated files | P1 | M | Reversibility and a clear next step | [Rails](https://guides.rubyonrails.org/command_line.html), [Phoenix](https://hexdocs.pm/phoenix/Mix.Tasks.Phx.Gen.Live.html) |
| `check submission`: manifest, policy, `eslint-plugin-obsidianmd` + type-checked rules, no-Node APIs, bundle facts; JSON result mirrors scanner categories | P0 | M | Every-release automated review | [Obsidian blog](https://obsidian.md/blog/future-of-plugins/), [eslint-plugin](https://github.com/obsidianmd/eslint-plugin) |

### Companion plugin
| Rec | P | Effort | Rationale | Source |
|---|---|---|---|---|
| Render every operation form from `shell schema` (no hand-written forms); live dry-run preview panel | P0 | L | Nx Console/Backstage pattern; one source of truth | [Nx](https://nx.dev/docs/kb/console-generate-command), [Backstage](https://backstage.io/docs/features/software-templates/writing-templates/) |
| Handoff mode first: write `design/project.json` plus a saved request, and show "Copy command" and "Copy agent prompt"; desktop spawn mode only as explicit opt-in | P0 | M | Scanner/Node-API and disclosure constraints | [eslint-plugin](https://github.com/obsidianmd/eslint-plugin), [Obsidian blog](https://obsidian.md/blog/future-of-plugins/) |
| Status dashboard fed by `status --json` (design freshness, last verify, last receipts) | P1 | M | Shared truth across front ends | — |
| Plan review screen that shows plan hash, per-file diff and conflicts identical to `plan inspect` | P1 | M | Terraform-style apply-what-you-reviewed | [Terraform](https://terraform.io/docs/commands/apply.html) |

### Generated project
| Rec | P | Effort | Rationale | Source |
|---|---|---|---|---|
| Five-script golden path in `package.json` (`dev`, `test`, `test:obsidian`, `check`, `build`), with others namespaced | P0 | S | Cognitive load | [DevEx](https://dl.acm.org/doi/10.1145/3610285) |
| README quick start in the first 20 lines; status and qualification moved to `docs/` | P0 | S | Time-to-first-success | — |
| Dev build with inline source maps, release without; a check that release `main.js` has no `sourceMappingURL` | P0 | S | Readable stacks | [sample esbuild](https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/esbuild.config.mjs) |
| `.vscode/launch.json` "Attach to Obsidian (9222)", plus tasks for `dev`/`test` and recommended extensions (Vitest, Vue, ESLint) | P1 | S | Breakpoints out of the box | [jsade](https://jsade.github.io/posts/how-to-connect-visual-studio-code-s-debugger-to-obsidian-in-macos/) |
| Opt-in `obsidian-typings` recipe for private APIs (explicit import) | P2 | S | Typed private API, visibly volatile | [obsidian-typings](https://github.com/Fevol/obsidian-typings) |

### Testing
| Rec | P | Effort | Rationale | Source |
|---|---|---|---|---|
| Split Vitest projects: `unit` (default, under 10 s), `components`, `coverage`; enable `fsModuleCache`; evaluate `isolate:false`/parallel files; run `vitest doctor` in the framework repo | P0 | M | Feedback loop | [Vitest 5](https://vitest.dev/blog/vitest-5.html) |
| `test --related <files>` and `test --changed` wrappers; hooks use `related` | P0 | S | Sub-second targeted runs | [Vitest CLI](https://vitest.dev/guide/cli) |
| Never override reporters in generated configs without adding `'agent'` | P0 | S | Auto agent reporter is lost otherwise | [Vitest reporters](https://vitest.dev/guide/reporters) |
| Contract suite run against both the in-memory kit and real Obsidian | P1 | M | Fake-host fidelity | [Fowler](https://martinfowler.com/bliki/ContractTest.html) |
| CI matrix `earliest` (manifest `minAppVersion`) plus `latest`; nightly `latest-beta` where credentials allow; cached downloads | P1 | M | Host-version regressions | [obsidian-launcher](https://github.com/jesse-r-s-hines/wdio-obsidian-service/blob/main/packages/obsidian-launcher/README.md) |
| Mobile-emulation smoke (`dev:mobile on` or wdio `emulateMobile`) before lifting desktop-only | P2 | M | Mobile visibility | [wdio-obsidian-service](https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README.html) |

### Logging and debugging
| Rec | P | Effort | Rationale | Source |
|---|---|---|---|---|
| Dev-only structured console mirror (one prefixed JSON line per accepted record) and a dev-session-persistent debug level | P0 | S | Makes `dev:console`/CDP streaming useful; keeps redaction | [Obsidian CLI](https://obsidian.md/help/cli) |
| `dev:obsidian --once --json` returns `{build, reload, errors[], consoleErrors[], screenshot, durationMs}` with source-mapped, deduped, project-frame-only stacks | P0 | M | Agent eyes in one bounded call | [kepano skill](https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md) |
| Prefer the official CLI (`plugin:reload`, `dev:errors`) when available; fall back to launcher hot-reload and CDP when it is not, or when targeting a sandbox instance | P1 | M | Official, deterministic; single-instance caveat | [Obsidian CLI](https://obsidian.md/help/cli), [launcher README](https://github.com/jesse-r-s-hines/wdio-obsidian-service/blob/main/packages/obsidian-launcher/README.md) |
| Dev-only error Notice with "Copy diagnostics" | P2 | S | Error overlay equivalent | — |

### Agent integration (AGENTS.md, CLAUDE.md, skills, hooks, MCP)
| Rec | P | Effort | Rationale | Source |
|---|---|---|---|---|
| Generated AGENTS.md of 60–120 lines: golden commands, definition of done (`check`), architecture rules not visible in code, safety rules (sandbox vault only), links to skills/docs. CLAUDE.md = `@AGENTS.md` plus Claude-specific notes | P0 | S | Evidence on length and cost | [Gloaguen](https://arxiv.org/abs/2602.11988), [Lulla](https://arxiv.org/abs/2601.20404), [best practices](https://code.claude.com/docs/en/best-practices) |
| Skills: `make-feature`, `debug-in-obsidian` (reload → errors → screenshot → console), `write-test` (failing test first), `prepare-submission`; side-effecting ones `disable-model-invocation: true` | P0 | M | Progressive disclosure | [skills](https://code.claude.com/docs/en/skills) |
| Hooks: PostToolUse `Edit|Write` → format + `vitest related --run` (bounded); Stop → `check --fast` exit 2 on failure; PreToolUse blocks writes outside project or sandbox vault | P0 | S | Deterministic guarantees | [hooks](https://code.claude.com/docs/en/hooks) |
| `.claude/settings.json` allowlist for read-only shell commands and `npm run test|check|build`; deny publish/release by default | P1 | S | Fewer prompts, safe autonomy | [best practices](https://code.claude.com/docs/en/best-practices) |
| Reduce the framework repo's own AGENTS.md: move milestone and qualification history into docs, keep rules | P1 | S | Same evidence | [Gloaguen](https://arxiv.org/abs/2602.11988) |
| `shell mcp` (stdio) exposing `capabilities`, `status`, `make.plan`, `plan.inspect`, `dev.snapshot`, `test.run` as tools from the same schemas; applying requires a plan hash; read-only by default | P2 | M | Parity for MCP-first clients; CLI plus skills stays primary | [Nx](https://github.com/nrwl/nx-console), [Angular](https://angular.dev/ai/mcp), [Playwright CLI](https://playwright.dev/docs/getting-started-cli), [MCP 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) |
| Document Chrome DevTools MCP / `@playwright/cli` attach recipes against the dev sandbox's CDP port | P2 | S | Richer inspection when needed | [Chrome DevTools MCP](https://developer.chrome.com/docs/devtools/agents/get-started/configuration) |

---

## Proposed first-10-minutes journeys

These are *proposed* flows. Commands marked (new) do not exist yet or are in progress.

### Terminal path
```sh
# 0:00  extract framework kit, then
node shell.mjs doctor                      # Node 24.21.0? npm? Obsidian ≥1.12? CLI enabled? → exact fixes
# 0:30
node shell.mjs new                         # (new) TTY picker: 9 starters with one-line outcomes
#   non-interactive: node shell.mjs new --starter quick-capture --id quick-capture \
#                    --name "Quick Capture" --author "Me" --yes --json
#   prints: plan hash, files, then "Next: node shell.mjs install --yes"
node shell.mjs install --yes               # exact-lock npm ci
# 2:30
node shell.mjs dev                         # (in progress: dev:obsidian) sandboxed Obsidian via obsidian-launcher,
                                           # plugin installed+enabled in sandbox only, watch → reload,
                                           # structured logs + source-mapped errors streamed in terminal
# 4:00  edit src/features/capture/… → save → reload notice in <2 s; error shows file:line in terminal
npm test                                   # unit project, <10 s, failures-only under agents
# 6:00
node shell.mjs make feature bookmarks --entity bookmark --dry-run   # per-file plan + hash
node shell.mjs make feature bookmarks --entity bookmark --yes       # receipt + "Next: open Bookmarks view"
# 8:00
node shell.mjs test:obsidian --once --json # (in progress) real-host E2E summary
node shell.mjs check                       # (new) typecheck + lint + submission rules + fast tests
# 10:00 git init && commit; CI template already runs check + test:obsidian matrix
```
Agent variant: `claude` in the project → AGENTS.md names `check` as done → the agent uses the `debug-in-obsidian` skill (`node shell.mjs dev --once --json`) → the Stop hook runs `check --fast`.

### Companion path
1. **0:00 Welcome** (in the dedicated authoring vault): "Choose a starter" or "Start blank".
2. **0:30 Project Starters:** search and filter cards → **Preview** shows surfaces, included scope, remaining TODOs and synthetic-data boundary.
3. **1:30 Configure:** plugin ID, name, author, source/test folders. The form is rendered from `shell schema`, with inline validation shared with the CLI → **Review project** → confirm.
4. **3:00 Design editors:** PRD, sitemap, page/component, entities, data sources, design system. Freshness badge: "design changed since last plan".
5. **6:00 Generate:** the plan view shows the file tree with create/unchanged/conflict statuses and the plan hash, identical to `plan inspect`.
6. **7:00 Handoff:**
   - "Copy terminal commands" (`project import` → `generate --plan-out` → `plan apply <hash>` → `install` → `dev`).
   - "Copy agent prompt" (references the saved plan and AGENTS.md).
   - Desktop opt-in "Run here", which streams JSON results.
7. **9:00 Dev dashboard:** reads `status --json` and shows last verify, last dev snapshot (screenshot, errors), and next suggested step.

---

## References

- Noda, Storey, Forsgren, Greiler. "DevEx: What Actually Drives Productivity." CACM 66(11), 2023. https://dl.acm.org/doi/10.1145/3610285 ; summary https://develocity.io/a-summary-devex-what-actually-drives-productivity-by-noda-et-al-2023/
- Command Line Interface Guidelines. https://clig.dev/
- Atwood, "Falling Into The Pit of Success." https://blog.codinghorror.com/falling-into-the-pit-of-success/
- Vite guide. https://vite.dev/guide/ · Create T3 App install. https://create.t3.gg/en/installation · Astro CLI. https://docs.astro.build/en/reference/cli-reference/
- Nx Console generate. https://nx.dev/docs/kb/console-generate-command · nrwl/nx-console. https://github.com/nrwl/nx-console
- Rails command line guide. https://guides.rubyonrails.org/command_line.html · Phoenix phx.gen.live. https://hexdocs.pm/phoenix/Mix.Tasks.Phx.Gen.Live.html
- Playwright UI Mode. https://playwright.dev/docs/test-ui-mode · Trace viewer. https://playwright.dev/docs/trace-viewer · Playwright CLI for coding agents. https://playwright.dev/docs/getting-started-cli · TestCollab comparison. https://testcollab.com/blog/playwright-cli
- Vitest 4 (2025-10-22). https://vitest.dev/blog/vitest-4 · Vitest 5 (2026-09-03). https://vitest.dev/blog/vitest-5.html · Reporters. https://vitest.dev/guide/reporters · Agent reporter PR. https://github.com/vitest-dev/vitest/pull/9779 · CLI. https://vitest.dev/guide/cli
- Obsidian CLI help. https://obsidian.md/help/cli · https://obsidian.md/cli · DEV article (2026-03-06). https://dev.to/shimo4228/obsidians-official-cli-is-here-no-more-hacking-your-vault-from-the-back-door-3123
- kepano/obsidian-skills obsidian-cli skill. https://github.com/kepano/obsidian-skills/blob/main/skills/obsidian-cli/SKILL.md
- Obsidian sample plugin. https://github.com/obsidianmd/obsidian-sample-plugin · AGENTS.md. https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/AGENTS.md · esbuild config. https://raw.githubusercontent.com/obsidianmd/obsidian-sample-plugin/master/esbuild.config.mjs · Build a plugin. https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- pjeby/hot-reload. https://github.com/pjeby/hot-reload
- obsidian-launcher README. https://github.com/jesse-r-s-hines/wdio-obsidian-service/blob/main/packages/obsidian-launcher/README.md · wdio-obsidian-service. https://jesse-r-s-hines.github.io/wdio-obsidian-service/wdio-obsidian-service/README.html · sample. https://github.com/jesse-r-s-hines/wdio-obsidian-service-sample-plugin
- eslint-plugin-obsidianmd. https://github.com/obsidianmd/eslint-plugin · Obsidian "The future of plugins" (2026-05-12). https://obsidian.md/blog/future-of-plugins/ · AlternativeTo report. https://alternativeto.net/news/2026/5/obsidian-launches-community-hub-with-automated-plugin-reviews-and-enhanced-safety/ · Developer docs issue #252. https://github.com/obsidianmd/obsidian-developer-docs/issues/252
- obsidian-typings. https://github.com/Fevol/obsidian-typings · obsidian-test-mocks. https://github.com/mnaoumov/obsidian-test-mocks · jest-environment-obsidian. https://github.com/obsidian-community/jest-environment-obsidian · obsidian-dev-utils. https://github.com/mnaoumov/obsidian-dev-utils · generator-obsidian-plugin. https://github.com/mnaoumov/generator-obsidian-plugin · obsidian-vite. https://github.com/unxok/obsidian-vite · obsidian-plugin-skill. https://github.com/gapmiss/obsidian-plugin-skill · Local REST API. https://github.com/coddingtonbear/obsidian-local-rest-api
- AGENTS.md. https://agents.md/ · openai/codex AGENTS.md. https://github.com/openai/codex/blob/main/AGENTS.md · Copilot AGENTS.md support (2025-08-28). https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/
- Gloaguen et al., "Evaluating AGENTS.md" (2026-02). https://arxiv.org/abs/2602.11988 · Lulla et al., "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents" (2026-01). https://arxiv.org/abs/2601.20404
- Claude Code best practices. https://code.claude.com/docs/en/best-practices · Skills. https://code.claude.com/docs/en/skills · Hooks. https://code.claude.com/docs/en/hooks
- Anthropic, "Effective context engineering for AI agents" (2025-09-29). https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents · "Writing effective tools for agents" (2025-09-11). https://www.anthropic.com/engineering/writing-tools-for-agents
- Chrome DevTools MCP blog (2025-12-11). https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session · configuration. https://developer.chrome.com/docs/devtools/agents/get-started/configuration · electron-devtools-mcp. https://github.com/holepunchto/electron-devtools-mcp
- MCP 2026-07-28 specification. https://blog.modelcontextprotocol.io/posts/2026-07-28/
- Angular CLI MCP. https://angular.dev/ai/mcp · Backstage writing templates. https://backstage.io/docs/features/software-templates/writing-templates/ · Terraform apply. https://terraform.io/docs/commands/apply.html · LSP. https://microsoft.github.io/language-server-protocol/
- Fowler, ContractTest. https://martinfowler.com/bliki/ContractTest.html
- jsade, VS Code debugger → Obsidian (2025). https://jsade.github.io/posts/how-to-connect-visual-studio-code-s-debugger-to-obsidian-in-macos/
