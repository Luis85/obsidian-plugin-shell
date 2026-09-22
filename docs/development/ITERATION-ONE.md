# Iteration 01 — working capability showcase

**Version:** 0.1.0 · **Date:** 2026-09-22. This is the first runnable slice, not completion of every PRD requirement.

## Install and open

Use Node 24.21.0/npm from the repository root:

```sh
npm run setup
```

The checked-in Node-only installer starts without node_modules, reviews its plan, installs the lockfile, builds, type-checks, runs service tests, and installs the three assets into `.dev-vault/.obsidian/plugins/plugin-shell/`. It does not create Task notes, install Node/globals, change Git identity, or enable Community plugins. Dry run is non-mutating; `--yes --no-interaction` accepts the printed plan; `--no-local` avoids native installation; `--skip-install` explicitly reuses provisioned dependencies.

Open `.dev-vault` in desktop Obsidian, enable Plugin Shell deliberately, then invoke **Open capability showcase** or its Blocks ribbon button. The manifest minimum is 1.13.7; only recorded host versions are experimentally qualified. A prebuilt candidate installs by putting main.js, manifest.json and styles.css together in a test vault's `.obsidian/plugins/plugin-shell/`.

`npm run dev:ui` serves `/harness/app/` on loopback using real presentation/application modules and synthetic browser storage. `npm run dev:local` watches and installs successful matching JS/CSS/manifest; native reload is manual. `build:local` performs a one-off build/install and `test-build` delegates to it. The installer preserves data.json, notes, unrelated plugins and security settings. Custom targets remain inside the repository boundary.

## Working scope

Overview exposes the first view and component cards. Documents validates a Task title, calendar due date and tags; prepare shows the actual Markdown/path without writing, commit creates the reviewed content, and opening is a separate follow-up. Events & feedback demonstrates the typed bus, local/native notifications, a native modal and bounded diagnostics. Preferences supports English/German, Task folder and success-notice choice through one queued writer shared with native declarative settings.

Task Markdown is canonical; data.json is not a second Task database. Failure does not falsely claim a committed file, and an opening/listener failure does not roll back an existing file. Prepared-request identity guards duplicate submission within the documented in-process scope; there is no distributed exactly-once guarantee.

Each native leaf owns its Vue app, Pinia state and cleanup. Shared application services and the typed bus belong to the plugin runtime. The current host bridge implements normalized file-open context; the broader planned native event catalog remains pending.

## Nuxt UI and styles

The exact lockfile uses @nuxt/ui 4.11.2, Vue 3.5.43, Pinia 4.0.3, Vite 8.3.0 and Tailwind CSS 4.3.3. This is plain Vue/Vite integration without the Nuxt application framework or an application router. Selected components are imported explicitly; local SVG icons need no remote service. Native settings/modal/notices stay host adapters.

Color-mode ownership stays with Obsidian. Two inspected Nuxt UI modules that produce global head/color styles are replaced by a narrow static adapter. `scripts/build/ui-adaptation.json` records their exact SHA-256 values; an unreviewed package change fails the build instead of silently bypassing the adaptation. This only qualifies the selected component subset, not every Nuxt UI facility.

Tailwind Preflight is omitted. The shared PostCSS pipeline scopes framework selectors, namespaces internal variables/keyframes and composes one stylesheet. Role variables consume Obsidian tokens. UI headings have owned typography so editor heading preferences do not accidentally control application chrome. The extracted Obsidian stylesheet is harness-only and is excluded from the three plugin assets.

`license-notices.mjs` retains bundled dependency notices in main.js, including explicit CSS/icon assets. `docs/licenses/lucide.txt` preserves Lucide and Feather notices. No font binary is bundled or needed remotely.

## Verification

```sh
npm run verify
npm run test:coverage
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

`verify` is the iteration-01 static/service/artifact/baseline gate: build, strict runtime/Vue/harness/test types, both linters, physical lines/locales, real fallow boundary coverage and negative fixtures, Vitest tests, token/artifact checks, repeated retained Node tests and harness build. Served E2E is separate. Do not call this the complete future release gate.

Coverage measures the configured domain/application/event/diagnostic/Markdown core, not every Vue/native/tooling module. Full PRD coverage thresholds are not yet enforced. `analyze` exposes broader fallow dead-code findings; only architecture is currently blocking. Complete dead-code, complexity, duplication, broader formatter/tooling and generated-repository qualification remain pending.

`npm run test:native -- --allow-download` needs obsidian-launcher 3.2.1 explicitly provisioned in `.native-runner`. Linux CI uses Xvfb. The provider enables the plugin only in its own disposable config/vault; ordinary developer setup does not change Restricted Mode. The optional provider's dependency graph is separate from the core lockfile and must be fully locked before becoming a permanent release prerequisite.

The showcase workflow has read-only repository permissions. Linux/Windows perform normal verification; Linux runs served-browser tests and trusted push/manual runs also select native smoke. No step publishes a public release. Candidate assets and evidence are retained separately from source.

## Dependency exceptions

Registry qualification rejected TypeScript 7 with the current typescript-eslint 8.70.1 peer range. TypeScript 6.0.3 is deliberately pinned, without force/legacy-peer-deps. Revisit this when compatible parser support is available; exact direct versions and lockfile remain authoritative.

The initial audit reported low-severity transitive esbuild 0.27.7 advisory GHSA-g7r4-m6w7-qqqr concerning its Windows development server. The template uses Vite and does not call esbuild.serve. This is not a vulnerability-free claim. The template maintainer should review an upstream-compatible update by 2026-10-06, without broad audit suppression or an unverified forced override.

## Remaining work

This installer uses the fixed showcase identity. Full renaming/migration/resume and `make` are not implemented, so the planned maker commands in older contract examples are not available yet. Full event/entity/notification catalogs, timer/action/queue policies, expanded Nuxt UI components, update automation, release promotion and fresh renamed-project qualification remain work packages.

The manifest is intentionally desktop-only until device acceptance exists. Native smoke proves its named cases, not complete accessibility, all themes, pop-outs, mobile or release readiness. Existing requirement IDs remain; milestone evidence does not silently mark every planned capability complete.

Read the [test record](../testing/ITERATION-ONE.md), [Nuxt UI plan](NUXT-UI-IMPLEMENTATION-PLAN.md), [test strategy](../testing/TEST-STRATEGY.md), and [PRD](../product/PRD.md).
