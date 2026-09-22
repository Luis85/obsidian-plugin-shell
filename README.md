# Obsidian Plugin Shell

**Current:** PRD 0.7 plus implemented style/token fixtures and scoped verification. The Vue plugin, npm setup/makers, native services, full build and release automation remain pending.

**Selected UI direction:** Nuxt UI with Tailwind CSS through the plain Vue/Vite integration, not the Nuxt application framework. The [implementation plan](docs/development/NUXT-UI-IMPLEMENTATION-PLAN.md) defines ten planned work packages, host-safe CSS/runtime adapters and explicit acceptance gates. This is a researched implementation direction, not an installed or verified integration.

## Run the current baseline

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node scripts/styles/check-tokens.mjs
node scripts/testing/verify-baseline.mjs --repeat 3 --json
```

The default fixture uses the owner-supplied **real, reduced Obsidian stylesheet** from Renovation Planner, not the old approximate palette. The original simulator remains at `/harness/style-fixture/simulated.html`. Both are clearly labeled specimens, not a running Obsidian app.

## Native tokens, not a second theme

`src/styles/index.css` imports 38 `--plugin-shell-*` aliases on `.plugin-shell`. They consume host colors, spacing, fonts, borders, radiuses, icons, and layers. No base palette or theme defaults are copied into production CSS. Direct native variables remain usable.

The reference includes **133 reviewed documented names** and a separate **968-name extracted inventory**. These are distinct scopes, not a claim that all retained variables are public API. New aliases reject deprecated RGB/HSL helpers and misspelled/missing targets.

The vendor archive decodes to the exact supplied Git blob and includes the original header. The server repairs one documented comment terminator for runtime parsing; it alters no style declarations. Unknown source app version, reduced coverage and upstream rights remain explicit. No font files are included. The archive and host adapter are harness-only, never plugin-release CSS.

## Documentation

| Document | Purpose |
| --- | --- |
| [Nuxt UI implementation plan](docs/development/NUXT-UI-IMPLEMENTATION-PLAN.md) | Selected architecture, prerequisites, target files, dependencies, ten work packages and review gates. |
| [Nuxt UI research](docs/research/2026-09-22-nuxt-ui-integration.md) | Primary-source findings, release/source identities, runtime-style and shared-state risks. |
| [Nuxt UI acceptance matrix](docs/testing/NUXT-UI-ACCEPTANCE.md) | 34 planned cases and concrete verification designs; not executed evidence or part of the current 96-case inventory. |
| [Native token/style integration](docs/design/OBSIDIAN-TOKENS.md) | Token usage, provenance, profiles, runtime repair, verification and extension rules. |
| [Current PRD](docs/product/PRD.md) | Requirements and 96 acceptance cases, preserving prior scope. |
| [Developer workflow](docs/development/DEVELOPER-WORKFLOW.md) | Intended setup/maker/first-change path. |
| [Test strategy](docs/testing/TEST-STRATEGY.md) / [test concept](docs/testing/TEST-CONCEPT.md) | Risk, deterministic execution, evidence modes and remaining scope. |
| [Latest verification](docs/testing/2026-09-22-token-verification.md) | Actual tests, failures fixed, environment limits. |
| [Harness styles](harness/styles/README.md) | Current executable specimen routes and boundaries. |
| [Agent instructions](AGENTS.md) | Shared contributor rules. |

The planned complete template still uses Vite, Vitest, Oxlint, fallow, TypeScript, Vue 3, Pinia, Obsidian ESLint; guided `npm run setup`; `make` scaffolding; typed events; entity Markdown creation; shared errors/notifications; and exact-candidate releases. Current Node commands are a limited bridge, not a replacement for that qualified toolchain.

Latest public/stable Obsidian remains the policy, with reviewed exact dependency updates. A snapshot's floor marker is not proof of the app version. Native/mobile, full Vite artifact exclusion, and current-host visual comparison remain separate acceptance work.

[License](LICENSE). Third-party extracted CSS retains its original provenance/rights and is not relicensed by this file.
