# Nuxt UI implementation plan

**Version:** 1.0 · **Date:** 2026-09-22 · **Owner:** template maintainer  
**Decision:** Nuxt UI is the selected UI foundation for the planned Vue presentation layer.  
**Execution state:** Planned; no Nuxt UI runtime, build configuration, dependency installation, or native qualification is delivered by this document.  
**Baseline inspected:** `810618a2a404e91430b1cc5e7794ed746baca541`  
**Read with:** [research and primary sources](../research/2026-09-22-nuxt-ui-integration.md), [acceptance matrix](../testing/NUXT-UI-ACCEPTANCE.md), [PRD](../product/PRD.md).

## 1. Outcome and scope

A developer obtains the template, runs the existing planned Node-only guided setup, generates a feature, and develops an Obsidian-native-feeling interface with Nuxt UI. The generated plugin uses Vue 3, Pinia, TypeScript, Vite, Tailwind CSS and Nuxt UI without a Nuxt application, remote runtime assets, or a development server in the installed plugin.

The resulting plugin ships matching `main.js`, `manifest.json`, and one complete `styles.css`. It coexists with Obsidian, community themes, other plugins, multiple views and pop-out windows. Application services, Markdown persistence, event semantics and feedback policy remain independent of the UI library.

This is an implementation of the selected Nuxt UI route, not a renewed comparison of libraries. A `nuxt-ui` generation profile may identify the chosen configuration, but no runtime framework switch or parallel library implementation is required. Existing browser/native provisioning profiles remain orthogonal.

### Existing contracts and precedence

Preserve CSS-01–12, HSS-01–12, ARC/LIF, ERR/NTF, DOC, SETUP/MAKE, QLT, TST and release requirements. The selection supersedes only the earlier framework-neutral choice in STYLES CSS-07; it does **not** permit a global reset or weaken styling ownership. The implementation change must reconcile that wording and the current PRD's stack/status links explicitly.

The current repository has no complete package/lockfile, Vite pipeline, Vue plugin, or real-component harness. Do not introduce placeholder scripts claiming those exist. Reuse the original specimen and baseline verification as scoped regression assets, not as proof of this integration. The deliberately blocked release guard stays blocked until its real replacement is implemented and accepted.

## 2. Decisions to implement

| ID | Decision | Reason / research trace |
| --- | --- | --- |
| D01 | Use `@nuxt/ui/vite` and qualified Vue runtime integration; not the Nuxt JavaScript module entry. | Research R01: official plain-Vue route and generated aliases. |
| D02 | Disable router and automatic color-mode integration; prefer explicit imports. | R02: host owns navigation/theme; generated dependencies remain visible. |
| D03 | Omit global Preflight; use plugin-specific utility identity plus owned-root CSS containment. | R03: prefix and `isolate` do not isolate all CSS. |
| D04 | Replace runtime vendor color injection with static scoped palette output through a small qualified adapter. | R04: `colorMode: false` does not stop injected styles. |
| D05 | Each view owns a Vue app, Pinia instance, root/portal context, unique ID prefix and disposables. | R05–R07 and existing LIF/ARC contracts. |
| D06 | Use declarative local overlays initially; disable each UApp's automatic toaster. | R05: upstream toast/overlay state can be shared between apps. |
| D07 | Keep NotificationService authoritative; Nuxt UI is a sink, not a second policy engine. | Existing ERR/NTF contracts; R05/R12. |
| D08 | Bundle a finite local icon set and all required assets; no runtime font/icon/CDN downloads. | R09 and existing CSS-04. |
| D09 | Share source processing with the harness and separately test the exact candidate stylesheet. | R10 and existing HSS/CSS fidelity requirements. |
| D10 | Qualify supported native/device targets explicitly; never infer them from browser success. | R06/R11 and TST evidence policy. |

The proposed compatibility adapter is not a verified upstream feature. Its exact implementation is chosen by the early spike below and cannot be waved through as configuration-only work.

## 3. Architecture and ownership

```text
Obsidian Plugin / ItemView / Settings / Modal
                 |
       host-specific mount adapter
       owner document + root + lifecycle
                 |
       Vue app + per-view Pinia
       PluginUiProvider / UApp
                 |
       Nuxt UI presentation components
                 |
       existing application contracts
                 |
       domain + persistence/event ports
```

The presentation layer may import Nuxt UI directly. Do not wrap every button or field solely to hide the library. Introduce wrappers only for actual shared host behavior: provider ownership, dialogs, navigation, form feedback, and notification presentation. Obsidian-specific classes and APIs remain in infrastructure/bootstrap adapters, not generic components or inner layers.

### Proposed file responsibilities

These are target paths, not files already available. Align feature subfolders with the base implementation rather than duplicate it.

```text
scripts/build/
  vite-shared.mjs             shared configuration factory; thin root configs
  nuxt-ui.mjs                 options, source roots, identity and icon inputs
  nuxt-ui-compat.mjs          guarded vendor-runtime resolution adapter
  css-ownership.mjs           parser-based containment and global-name policy
scripts/quality/
  check-ui-boundaries.mjs     forbidden global UI service / inner-layer imports
  check-styles.mjs            existing planned stylesheet gate, extended
src/bootstrap/
  mount-plugin-ui.ts          compose app, services, provider, disposal
src/infrastructure/obsidian/ui/
  ui-root.ts                 create owned roots in the correct document
  theme-context.ts           host theme/window context and rebinding
  navigation-adapter.ts      host-safe links; no browser history ownership
src/infrastructure/ui/
  static-colors-plugin.ts    deliberate replacement for vendor color injector
src/presentation/ui/
  PluginUiProvider.vue       UApp configuration and owner-local context
  PluginDialog.vue           only shared dialog/host interaction policy
  feedback/                  controlled sink; no duplicate application service
src/styles/
  index.css                  one ordered entry
  vendor/nuxt-ui.css          build-time imports and Tailwind directives
  vendor/static-colors.css   complete required palette aliases
  obsidian-tokens.css         semantic bridge on every owned root
  host-adapter.css            narrowly scoped compatibility/base rules
harness/                     original shim + real component scenarios
scripts/make/                existing planned makers and local templates
```

Keep implementation files within 400 code lines, tests/helpers within 450, and
`main.ts` within 100. Exclude comments and blank lines under the owner's iteration
03 amendment, counting all SFC regions together. Do not create empty files for
every possible component. Generated CSS is output, not manually edited source;
its size budget remains separate.

## 4. Build and runtime integration contract

### 4.1 Dependency qualification

Start qualification with the researched Nuxt UI **4.11.2** release, then recheck current compatible stable releases when implementation begins. Record exact Node/npm, Obsidian API, Vue/compiler, Pinia, Vite/plugin-vue, Nuxt UI, Tailwind, TypeScript/vue-tsc, Vitest, browser tools and any direct Reka/icon/parser packages. Pin one compatible graph and commit its real lockfile. No unsupported peer overrides, floating verification versions, or invented latest-version matrix.

Inspect the installed npm distribution, not just Git source. Capture package integrity and the actual paths/hashes of any vendor module the compatibility adapter intercepts. Review dependency licenses and transitive runtime/build boundaries. If code imports a Reka primitive directly, declare it directly and qualify the resolved version instead of relying on accidental hoisting.

### 4.2 UI options

The following is the intended options shape, **not a complete runnable Obsidian configuration**:

```ts
ui({
  router: false,
  colorMode: false,
  autoImport: false,
  components: false,
  theme: {
    prefix: cssUtilityPrefix,
    colors: ['primary', 'success', 'info', 'warning', 'error'],
  },
  icon: {
    clientBundle: { icons: bundledIconNames },
  },
})
```

The shared factory supplies validated values, repository root and supported generated-type paths. Keep `error` when using form validation. Register Vue compilation once; Nuxt UI already brings the Tailwind Vite plugin. Do not add a second processing instance. Keep optional content/prose/editor integrations off until a feature needs and qualifies them. Avoid `theme.unstyled` as an isolation shortcut: it also removes structural classes.

Explicit imports must resolve to the Vue-specific component implementations. Prove this from a cold build/typecheck; the inspected release has a fix in this area. Generate required theme aliases before dependent typechecking; use a finite preparation/build step and record its outputs. Do not solve alias errors with broad `any`, missing-module declarations, a cached local build, or an extra Nuxt installation.

### 4.3 Static colors and scoped CSS

The compiler input uses separate Tailwind theme/utility imports with the same prefix and no Preflight. `@nuxt/ui` remains a CSS import. Select the precise `@source` paths against the actual generated theme location and imported component graph; default source discovery must not accidentally scan all docs, reports, maker text and unrelated dependencies.

Implement one parser-based pipeline, shared by development and production, in this order: resolve imports/generate themes and utilities; compile SFC styles; apply the qualified ownership transform at an observed supported hook; minify/extract; validate final output. The exact hook/order is an NUI-01 spike result, not an assumed Vite/PostCSS ordering. A final build-only rewrite that leaves harness HMR uncontained is not sufficient.

Contain root/theme selectors and ordinary vendor selectors within the stable plugin root and owned overlay roots. Account for rules applying to the root itself as well as descendants; a naive `root selector` prepend loses root declarations. Preserve Vue scope identifiers, conditional at-rules, pseudo-elements, specificity and required source order. Do not double-process styles that were already scoped.

Inventory `@property`, keyframes, animation references, layer ordering and global custom-property names. Namespace globals consistently where feasible; an unavoidable shared identifier needs an explicit reviewed invariant/allowlist and cross-plugin tests. Do not assume utility prefixes rename every internal `--tw-*` or every Nuxt `--ui-*` variable. Do not rewrite JavaScript-owned Reka variable names blindly. Unknown output constructs fail the gate rather than being silently deleted.

For static colors, intercept only the exact qualified runtime color module through a guarded build resolution adapter and substitute a small local Vue plugin that intentionally performs no color injection. Provide the required palette aliases and semantic roles in compiled owned CSS instead. Record the replacement reason, package version, installed-module hash and module-graph assertion. This is not a stub for missing business behavior: it deliberately removes a vendor side effect that the static stylesheet replaces.

A documented upstream opt-out is preferable if verified during qualification. Otherwise the targeted adaptation must fail on unknown versions/shapes. Do not edit node_modules after installation, intercept `document.createElement`, strip foreign head tags after they appear, or globally rewrite `#imports`. Audit the remaining head plugin and selected components; replace additional behavior only through a separately justified narrow adapter if necessary.

The production check must observe DOM/head mutations while mounting, changing themes, opening overlays and unloading. No runtime style injection may bypass `styles.css`. Vite development HMR is an explicitly separate mode, not a production exception. Fonts, title/meta tags and body/html classes are host-owned.

### 4.4 Artifact shape

Configure the selected Vite version for one CJS `main.js` and one `styles.css` (`cssCodeSplit: false` and the qualified library CSS filename). Keep Vue/Pinia/UI bundled; externalize `obsidian` and only approved host-provided modules. Resolve generated aliases, environment constants and dynamic imports at build time. Do not guess Rollup versus Rolldown option names before the Vite version is selected.

No unresolved Nuxt aliases, browser-history bootstrapping, runtime CSS imports, test adapters, CDN URLs, or unshipped asset chunks may remain. Inline approved local assets for the existing three-file contract. Preserve required license attribution. Deploy the matching JS/CSS/manifest set atomically at the installer level already specified, preserving last-good assets when a build fails.

## 5. Theme, interaction and feedback contract

Use a stable root such as `[data-plugin-ui="<plugin-id>"]` on views, owned native subtrees and portal containers. Setup generates a separate valid Tailwind prefix from plugin identity; it must not blindly use a hyphenated manifest ID. Test two differently named generated plugins together. Runtime mount IDs are distinct from CSS identity.

The semantic bridge maps surface/text/border/accent/font/spacing/radius to Obsidian variables on **every** root. At minimum cover normal, muted, highlighted and inverted text; primary/secondary/elevated surfaces; neutral/active borders; accent, success, warning and error; disabled/focus/selection states. Full palette aliases must remain defined where component themes require them. Inspect emitted names and test computed styles, rather than assuming one `--ui-primary` override covers every variant.

Host light/dark state controls variants; either compile a host-class variant or mirror it only onto owned roots through the document adapter. Never toggle the host's classes. CSS-variable changes should flow through without remounting; theme/stylesheet or document-context changes must not preserve stale snapshots. Native dialogs and body-level portal roots may inherit differently from a pane, so verify the semantic context at both locations.

Each mount receives a unique Vue `idPrefix`, explicit service context and controlled locale/direction. Resolve the actual owner document/window; use supported host migration handling. On migration, close transient overlays, preserve draft state, dispose document-specific listeners and remount/rebind deliberately. Do not assume a DOM node changing documents updates closures inside a third-party component.

Use `UApp` with an explicit element portal and `toaster: null`. The default overlay provider remains present, so forbid unqualified shared `useOverlay` calls, including indirect helper calls. Prefer local `v-model:open` dialogs/popovers. Avoid stacking a native modal and a second modal focus trap for the same interaction. No `closeAll`/global toast clearing during one view's disposal.

NotificationService decides deduplication, progress/terminal updates, ownership and recovery. Host-global feedback may use the native Notice sink. View feedback uses inline components or a controlled owner-local viewport. If using UToast directly, qualify its required provider, state and timers; do not quietly restore UToaster's shared queue. Store safe action descriptors in the existing policy layer, not closures retaining disposed views.

Keep validation associated with fields and essential recovery persistent. A successful note write remains successful when opening, subscriber notification, or a UI sink fails. Reconciliation for uncertain writes stays in the application service; no generic toast retry is allowed to create another file.

## 6. Sequenced work packages

All packages below are **planned**. Each implementation change includes its own tests; NUI-07 consolidates integration evidence rather than postponing testing until the end. Acceptance IDs refer to the companion matrix, not tests already registered or passing.

### NUI-00 — Qualify prerequisites and capture the decision

**Depends on:** base WP-00/01; starts the Nuxt work. **Owner:** maintainer/build engineer.

Qualify the real dependency graph; implement only the base shell/tooling needed for the spike; reconcile PRD/STYLES/agent entry links; choose the supported host/device target policy; preserve the current release guard. Prepare generated aliases and exact import checks. Review how the test-plan validator will admit the Nuxt acceptance extension while preserving all AC-01–90 and negative checks.

**Outputs:** real lock/tool matrix, finite preparation commands, build/runtime dependency boundary, planned Nuxt suite registration design. Do not invent test files for planned suites. **Acceptance:** NUI-01, NUI-30, NUI-34.

**Exit:** a fresh checkout can install the selected locked prerequisites and resolve a minimal explicit component import. Missing registry/system/browser prerequisites are blocked, not passed.

### NUI-01 — Prove the embedded-host integration

**Depends on:** NUI-00. **Owner:** frontend/build engineer with QA.

Build a small actual Vue scenario with Button, Input, SelectMenu, Tooltip and a declarative Modal; mount two instances. Inspect the stock integration's emitted CSS, head mutations and shared state. Implement the smallest static-color/ownership adaptation; establish the real Vite hook order. Produce the CJS candidate and perform an initial real-Obsidian smoke check, including a pop-out, before expanding the component set.

**Outputs:** reproducible scenario, installed-module identities, compatibility adapter decision, module/CSS graph inspection, separate browser/native findings. **Acceptance:** NUI-02, NUI-05, NUI-06, NUI-11, NUI-13, NUI-16.

**Exit / stop rule:** no Nuxt server/runtime requirement; required styling works without production injection; views remain independent; owning-window behavior has explicit evidence. An unresolved host/global conflict blocks promotion. The spike does not waive later device/accessibility/data cases.

### NUI-02 — Complete the shared CSS and static-token pipeline

**Depends on:** NUI-01. **Owner:** build/frontend engineer.

Implement scoped vendor imports, palette generation, root handling, valid prefix generation, global-name inventory, source detection, conditional rules and SFC extraction. Extend existing `styles:check`; test negative controls and removal of stale rules. Ensure development/HMR and production use the same containment logic. Prove one self-contained stylesheet and matching scope IDs.

**Outputs:** `scripts/build` modules, real style source files, actual CSS parser checks and fixtures, artifact inventory. **Acceptance:** NUI-03–09, NUI-23.

**Exit:** ordered full-graph output is repeatable and outside-root controls remain unchanged; minification, source removal and failed-build installation paths are covered. Preserve the proposed 100 KiB CSS target unless an explicit reviewed budget change is justified by measurements.

### NUI-03 — Implement owner-local provider and lifecycle

**Depends on:** NUI-01; coordinate root policy with NUI-02. **Owner:** host-integration engineer.

Implement mount/provider/root ownership, per-view Pinia, unique IDs, owner-document portals, safe navigation and error-boundary wiring. Test failed/partial mounts as well as normal close. Implement migration handling and disposal of listeners, portals, observers, timers and pending interaction results. Never detach unrelated leaves or clear another owner's resources.

**Outputs:** actual mount/provider/document adapter and lifecycle contracts. **Acceptance:** NUI-11–16, with caught-error follow-through in NUI-21.

**Exit:** two views plus native settings/modal subtrees can coexist; closing/reopening/migrating one does not damage another or retain callbacks into disposed UI.

### NUI-04 — Bridge themes, icons and component conventions

**Depends on:** NUI-02/03. **Owner:** frontend engineer and accessibility reviewer.

Map Obsidian semantic tokens, fonts, density, focus and responsive pane behavior. Bundle library-default and application icons, including names from TypeScript metadata. Implement local unknown-icon fallback. Qualify Button, Input/Textarea, FormField/Form, SelectMenu, Checkbox/Switch, Alert, Badge, Tooltip, DropdownMenu, local Modal and the selected table/list usage before advertising them as supported examples.

**Outputs:** token bridge, finite component/icon inventory, light/dark and long-text scenarios. **Acceptance:** NUI-10, NUI-22, NUI-24, NUI-25.

**Exit:** live theme/accent/font changes work in roots and portals without draft loss; a narrow pane within a wide desktop window is usable. No whole-dashboard template or marketing/editor component bundle is added without a use case.

### NUI-05 — Connect notifications, errors and dialogs

**Depends on:** NUI-03/04 and base error/notification contracts. **Owner:** application/frontend engineer.

Route feedback through the real NotificationService. Implement controlled local presentation and native fallback, progress replacement, deduplication, persistent recovery, safe retry actions and per-owner cleanup. Keep shared Nuxt toast/overlay composables out of the default path. Exercise failing sinks and Vue event/render failures through the independent observer.

**Outputs:** real feedback sink integration, declarative dialog conventions, deterministic lifecycle/failure tests. **Acceptance:** NUI-15–17, NUI-20, NUI-21.

**Exit:** one operation produces one policy-selected feedback flow, another view is unaffected, and caught faults still fail ordinary tests. A UI exception cannot convert a confirmed write into a retryable create failure.

### NUI-06 — Deliver the real example vertical slice

**Depends on:** NUI-04/05 and base DocumentCreationService/settings/event packages. **Owner:** feature engineer.

Implement the existing example/Task flow using real application actions: empty/loading/error/populated states, accessible entry/editing of supported inputs, prepare/preview, explicit create, persistent validation and truthful completion. Use Markdown as the Task authority and existing settings paths. Do not invent a second Task database or claim a mock writer establishes native persistence.

**Outputs:** real Nuxt UI feature, Markdown fixtures, integration tests, removable example wiring. **Acceptance:** NUI-18–20, NUI-24, NUI-25.

**Exit:** the defined native action creates exactly the intended document or reports the real failure/effect state; close/cancel/double-submit/uncertain-write cases preserve user data. The UI-only spike must remain labeled until these services exist.

### NUI-07 — Integrate harness, verification and failure controls

**Depends on:** prior packages; tests accumulate throughout. **Owner:** QA/build engineer.

Reuse the original host shim separately from plugin CSS. Add real-component and exact-candidate modes, independent fault capture, network observation and production-head checks. Implement/register the acceptance extension with real tests and required evidence modes; preserve strict existing inventory validation. Include deliberate missing CSS, wrong scope ID, escaped selector, shared feedback, runtime injection and unexpected caught-error controls.

**Outputs:** actual Vitest/Playwright projects, extended machine-plan schema/validator tests, finite scenarios and source/hash-bound reports. **Acceptance:** NUI-26, NUI-27, NUI-34 plus accumulated cases.

**Exit:** required tests execute without skip/todo/hidden retries, negative controls fail for the intended reason, and specimen/integrated/native/device evidence cannot substitute for each other.

### NUI-08 — Integrate setup and makers

**Depends on:** NUI-02–07 and base WP-07. **Owner:** developer-experience/tooling engineer.

Keep `npm run setup` dependency-free at startup. Its review identifies the selected Nuxt UI stack, locked installation, CSS identity, downloads and selected checks. Update owned identity references safely; no dependency re-resolution during rename. Extend existing component/view/feature/modal/style makers with explicit imports, provider usage, locales, style ownership and meaningful tests. Preserve native modal/setting semantics rather than mechanically replace their host boundaries.

**Outputs:** safe setup plan edits, local maker templates, actual generated-repository tests and workflow documentation. **Acceptance:** NUI-28–30.

**Exit:** a differently named generated plugin builds and verifies; two generated identities coexist; repeated/cancelled/conflicting generation preserves prior files. Qualification remains depth-one and finite. No source-generation operation creates user notes.

### NUI-09 — Qualify native, device, performance and handoff

**Depends on:** NUI-07/08 and base release/maintenance work. **Owner:** maintainer with native/device QA.

Test exact candidate assets in the supported Obsidian versions/themes, main/split/pop-out windows and declared mobile devices. Measure bundle/CSS size, first-open behavior, representative list interaction and repeated mount/dispose resources. Verify fresh installation and upgrade rehearsal. Document adapter version guards, supported component set, remaining limitations and dependency-update regressions.

**Outputs:** source/lock/asset-bound native/device evidence, measured budgets, final docs and maintained compatibility checklist. **Acceptance:** NUI-31–34; all other required cases satisfied.

**Exit:** no critical/high-risk unresolved integration defect, no invented environment result, and no silent budget/gate changes. Release preparation consumes the accepted assets; publication remains a separate authorized action.

## 7. Dependency order and review checkpoints

```text
base WP-00/01 -> NUI-00 -> NUI-01 -> NUI-02 + NUI-03
                                      -> NUI-04 -> NUI-05 -> NUI-06
                       tests throughout -> NUI-07 -> NUI-08 -> NUI-09
```

NUI-06 also needs the base application/document services; NUI-08 needs the safe setup/maker engine. Do not hide those dependencies inside frontend estimates. NUI-02 and NUI-03 can progress in parallel only after root/portal/adapter contracts are agreed; shared configuration and namespace files need one coordinating owner.

Review checkpoints: **G0** dependency/bootstrap qualification; **G1** embedded-host spike; **G2** build/style/lifecycle contracts; **G3** real Task/feedback slice; **G4** generated-repository verification; **G5** exact native/device candidate. A checkpoint's success covers its named scope only.

## 8. Risks and fallback boundaries

| Risk | Mitigation / decision boundary |
| --- | --- |
| Vendor injector/alias changes on upgrade | Exact version/module identity guard, module-graph checks and production-head negative control; block unknown shapes. |
| Shared upstream state reaches multiple UApps | Declarative local overlays and controlled sinks; import boundaries and same-module two-app tests. |
| Layer/scoping complexity grows beyond a small adapter | Capture failing computed-style cases; revise the narrow strategy in review before extending the component set. No blanket reset/important/fork. |
| Pop-out focus/scroll helpers use main-window globals | Early native spike, document migration tests and native host-dialog shell where appropriate; record unsupported paths rather than claim compatibility. |
| Tailwind detection misses generated or dynamic classes | Explicit bounded source roots, complete literal variants, maker/removal tests and build inspection. |
| Icons/fonts request external resources | Local finite inventory, fallback, all-request observation and no-network production scenario. |
| UI dependency inflates artifacts | Measure cold build and example-removal deltas; remove unused features/aliases; budget changes require review. |
| Harness masks host defects | Exact candidate CSS, separately identifiable shim, missing-style controls, unrelated host sentinels and native qualification. |
| UI success hides write/error failures | Real service/Markdown assertions and independent error ledger; preserve effect-aware recovery. |

Do not abandon the chosen Nuxt UI route merely because the stock configuration fails. Resolve the measured boundary through the documented adapter or appropriate native host shell. If a required target still fails, keep that target blocked and record the defect; do not advertise support or silently change the product contract.

## 9. Completion and evidence

The [34-case acceptance matrix](../testing/NUXT-UI-ACCEPTANCE.md) defines the planned scenarios and required evidence. Its rows are not passing tests and do not change today's AC-01–90 machine inventory by themselves. Implementation must explicitly extend/version the inventory and validator while preserving its original invariants.

All future npm commands named by the existing specs remain pending until their actual implementations exist. Extend those commands instead of creating a competing Nuxt-only verification stack. Each handoff records changed files, actual commands/exits, test IDs, candidate hashes, environment, remaining gaps and adapter decisions. Do not label source review, a green specimen, or this documentation commit as a working Nuxt UI integration.
