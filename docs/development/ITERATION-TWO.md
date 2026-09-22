# Iteration 02 — layout, header, dependencies and reliability

Plugin version **0.2.0**, fixed identity `plugin-shell`. This continues the four-panel Vue/Pinia/Nuxt UI showcase. It is not a Nuxt-framework migration or completion of the generator/release-platform backlog. See the [review](ITERATION-TWO-REVIEW.md), [checkpoint](ITERATION-TWO-CHECKPOINT.md) and [verification record](../testing/ITERATION-TWO.md).

## Install, update and open

The selected development toolchain is Node **24.21.0** and npm **11.19.1**, independently selected. The parser/linter floor is Node **22.13.0**, raised from 22.12.0 by ESLint 10. `package.json` declares npm >=11.19.1 and <13; npm 12.0.2 is also in the setup compatibility matrix. Do not infer the npm version from Node. Check `node --version` and `npm --version`. Prefer an actively supported Node LTS, not the historical Node 24.15.0 regression target for new installations.

From a checkout of `build/iteration-two`:

```sh
npm run setup -- --dry-run
npm run setup
```

Setup is dependency-free until its installation step. It presents the fixed-identity plan, runs reproducible `npm ci`, builds, type-checks, runs real service tests and optionally installs to `.dev-vault/.obsidian/plugins/plugin-shell/`. `--yes --no-interaction` is the explicit unattended confirmation; `--no-local` selects browser-only setup. No notes or Restricted Mode settings are modified. User registry/proxy/certificate/authentication settings are preserved. The existing EALLOWSCRIPTS repair removes only a forwarded process-level `allow-scripts` value before nested installation; it does not rewrite persistent security configuration.

Open `.dev-vault` as a separate vault in Obsidian. Deliberately enable **Plugin Shell**, then use the Blocks ribbon button or **Open capability showcase** in the command palette. Obsidian **1.13.7** is both the retained minimum and the public stable target used for this milestone. The API declarations are a separately versioned dependency (1.13.1); no host-floor increase was made.

For an installable ZIP, disable the existing plugin, extract the `plugin-shell/` directory into a test vault's `.obsidian/plugins/`, and replace **only** `main.js`, `manifest.json` and `styles.css` as a matching set. Preserve `data.json`, notes and unrelated plugin files. Re-enable the plugin. A source ZIP is not an installable plugin ZIP.

## Layout and native-header operation

All four panels share one leaf-relative scroll/content layout and aligned header/section/footer gutters. Container queries adapt navigation and Documents layout to the available leaf, not the application-window width. Gutters use aliases for 16/24/32px host spacing; text passages retain readable widths while cards and the Markdown preview can use the remaining space. Native select height, font, padding and line-height are repaired on the actual control. Long paths, localized labels and code cannot widen the page; code scrolls within its preview.

**Preferences → Hide Obsidian view header** applies immediately and persists through the canonical preference service. The same toggle exists in native **Settings → Plugin Shell**. Default is false; schema-one data without this field is read with a false default and without a migration write. Corrupt/future settings remain protected from replacement.

Only the native title row directly inside an owned `plugin-shell-showcase` leaf is hidden. The breadcrumb, workspace tabs, OS controls, Markdown views and other plugins are not targets. The plugin's **View actions** button retains the native menu plus split, move-to-new-window, close and header-toggle actions. The command palette's **Toggle Obsidian view header** remains available when the title is hidden.

`infrastructure/obsidian/view-header.ts` owns one namespaced marker and its subscriptions/observer. This is a small documented host-DOM adaptation, not a public API promise: Obsidian exposes no view-level public header-visibility setter in the qualified API. The adapter validates ownership and direct-child header structure, fails closed for unsupported structure, and restores only its owned presentation on disposal. `infrastructure/ui/host-theme.ts` rebinds to a moved view's current document; workspace ownership events trigger the rebind, and each observer/listener is view-owned.

## Reliability corrections

Prepared documents can discard unattempted previews so editing repeatedly does not exhaust the bounded request ledger. Attempted writes retain their cached outcome for deduplication. While a write is in flight or uncertain, preview/edit/reset cannot replace its path or start a blind new attempt. Inspect the shown path in the vault before deciding recovery after an uncertain write; reloading is not a safe automatic retry. A failed open/notice never changes an already-created note into a failed mutation.

Preference patches are snapshots in a serialized writer. Functional header toggles resolve against the latest committed settings, and another view's successful save merges only into clean local form fields. Subscriber rejections and native notice failures are observed independently, using redacted diagnostic codes rather than private paths/messages. Native notice failure falls back to one inline success owned by the same operation.

`npm run build` now stages JS/CSS/manifest together and promotes the complete directory only after success. A compilation or missing-output failure leaves the previous `dist/` intact. `npm run dev` rebuilds without installing; `npm run dev:local` serializes rebuilds and installs only successful complete candidates. Installation stages a snapshot of the validated asset bytes and preserves user data. Build/install lock directories prevent overlapping writers; after an interrupted process, remove a stale lock only after confirming its owning process is no longer running. Failed rollback preserves the backup for recovery instead of deleting it.

## Dependency decision and security boundary

ESLint **9.39.5 → 10.11.0** removes the unsupported direct lint release. Supported parent updates/deduplication also remove nested ESLint 9. Actual TypeScript type-aware, Obsidian and Vue negative probes must fail under the new parser/rules, so an install alone is not qualification.

The selected Nuxt UI/Vue/Pinia/Vite/Vitest/Oxlint/fallow/TypeScript stack remains pinned at its existing mutually compatible stable versions. TypeScript **6.0.3** remains deliberate: the current typescript-eslint peer range does not support TypeScript 7. There is no `--force` or `--legacy-peer-deps` bypass.

The original graph contained vulnerable esbuild **0.27.7** via `@nuxt/ui → @nuxt/fonts → fontless@0.2.1`. Supported parents still use fontless's ^0.27.0 range. This iteration uses the narrow override `fontless@0.2.1 → esbuild@0.28.2`, not a global forced upgrade. The inspected fontless code uses esbuild's CSS `transform`, not its server. The retained offline qualification runs that actual transform and verifies reviewed source hashes; strict installation verifies narrowly approved `esbuild@0.28.2` and `vue-demi@0.14.10` hooks. `fsevents` remains denied. The override must be removed once a supported parent resolves the advisory naturally.

The two Nuxt UI 4.11.2 runtime-style replacements were re-reviewed and their guards remain unchanged, not blindly rehashed. They replace global color/head injection with static scoped roles. No Preflight, remote icons/fonts, application-owned color mode or host CSS enters the production artifact. The bundle contains dependency notices and only one composed `styles.css`.

`npm run check:dependencies` is deterministic and offline-capable. `npm run check:security` separately runs **both** `npm audit --json` and ordinary **`npm audit`**, with all installed categories and severities. It fails on advisories, invalid output, network/registry failure or inconsistent exit codes; infrastructure errors are not clean audits. A clean advisory database result is not proof of overall application security.

Primary sources reviewed on 2026-09-22: [ESLint support policy](https://eslint.org/version-support/), [ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0), [typescript-eslint dependency policy](https://typescript-eslint.io/users/dependency-versions/), [esbuild advisory GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), [npm configuration](https://docs.npmjs.com/cli/v11/using-npm/config/), [Node releases](https://nodejs.org/en/download), [Obsidian public release feed](https://github.com/obsidianmd/obsidian-releases/blob/master/desktop-releases.json), and the exact npm registry metadata/source files preserved in the evidence. Electron UI-scale tests use its [webFrame API](https://www.electronjs.org/docs/latest/api/web-frame).

## Verification and analyzer ownership

```sh
npm run verify
npm run test:coverage
npm run test:coverage:production
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
npm run check:security
```

Native qualification additionally requires the isolated `obsidian-launcher@3.2.1` provider in `.native-runner` and explicit `npm run test:native -- --allow-download`. Never aim it at a personal vault. CI provisions the provider only after successful candidate gates; no stale candidate is used after a failed build. No build runs after native acceptance of the distributed assets.

The full fallow report is now blocking, alongside architecture. Build implementation moved from `scripts/build/` to `scripts/bundling/` because fallow's default generated-build exclusion otherwise hid handwritten build code. Dynamic test/stylesheet/virtual-module entrypoints are declared explicitly, not ignored wholesale. Only host-supplied `obsidian` is exempted from deployment-dependency classification. Two exact unresolved CSS specifiers are supplied by the verified host-fixture middleware/vendor pipeline. Native `PluginSettingTab` callbacks are declared as framework-invoked members. Policy-pack analysis is explicitly off because no pack is configured; no false policy-enforcement claim is made. Unused exports were removed. Negative fixtures prove dead-code, boundary and actual lint failures.

Core coverage now gates at 95% lines and 90% statements/functions/branches. Whole-production coverage is separately measured without inheriting a selected-core threshold. It includes native adapters, composition and all Vue SFCs even when uncovered. It does not yet satisfy the complete product's production coverage target. Existing baseline acceptance IDs remain unchanged; a passed iteration is not a public-release approval.

## Remaining bounded scope

The full maker/identity-migration wizard, expanded entity/event/notification catalogs, broader Nuxt UI component and third-party-theme qualification, complete production coverage targets, mobile and public-release promotion remain separate work. Platform claims must follow the final test record; Windows setup/build is not automatically Windows-native UI evidence.
