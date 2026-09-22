# Research: Nuxt UI in an Obsidian plugin

**Researched:** 2026-09-22  
**Repository baseline:** `810618a2a404e91430b1cc5e7794ed746baca541`  
**Decision:** Adopt Nuxt UI for the planned Vue presentation layer; do not adopt the Nuxt application framework.  
**Implementation:** [Nuxt UI implementation plan](../development/NUXT-UI-IMPLEMENTATION-PLAN.md)  
**Verification design:** [Nuxt UI acceptance matrix](../testing/NUXT-UI-ACCEPTANCE.md)

## 1. Executive finding

Nuxt UI supports plain Vue applications through its Vite integration. It is a viable foundation for this template, but its default website setup is **not host-safe out of the box**. The work is an embedded-application integration, not simply a dependency installation. The integration must address emitted CSS, runtime-generated styles, module-level state, multiple documents, and host-owned interaction. [S01–S09]

The important additional finding is that `colorMode: false` does **not** disable Nuxt UI's runtime color stylesheet. The inspected Vue plugin installs the color plugin, which writes document-level theme rules. A static-color compatibility adapter is therefore an explicit implementation prerequisite under this repository's one-packaged-stylesheet contract. [S04, S05]

No plugin build, npm dependency installation, browser integration experiment, or native/device test was performed for this research. Source inspection establishes implementation facts and risks; it does not establish that the proposed adapter already works.

## 2. Method and version identity

The research combines official documentation, tagged upstream source, GitHub release metadata, and the repository's actual specifications. Community summaries were not used as authority for technical decisions.

GitHub's live release API reported **Nuxt UI v4.11.2**, published **2026-09-22 at 10:57:12 UTC**, as the latest non-prerelease at inspection. Its annotated tag resolves to commit `bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6`. A cached web rendering of `/releases/latest` still showed v4.10.0; the live API and resolved tag take precedence. v4.11.2 is a **research candidate**, not an installed or qualified dependency. [S01]

The release includes fixes relevant to this template: explicit Vue component imports, propagation of link-handler errors, keyboard-accessible table selection, and duplicate toast click callbacks. These are reasons to test the exact selected release, not reasons to assume those paths are proven in Obsidian. [S01]

Key inspected source identities:

| Source at v4.11.2 | Git blob SHA |
| --- | --- |
| Vue installation guide | `f6541f80702749f52977cc5c36c1befaa06110e7` |
| `src/runtime/index.css` | `212c1efe9f61ca63cf25bc06f3687f325738083d` |
| `src/plugins/plugins.ts` | `b674fe6813462a2e1875d4e81d2f432a24ae0626` |
| `src/runtime/plugins/colors.ts` | `93e5242bc92c1383ef419c9b5c563496deda4d98` |
| `src/runtime/vue/stubs/base.ts` | `93df4ee9dfc91cc62e9e4ad24a47d440b59c43c1` |
| `src/runtime/composables/useOverlay.ts` | `7b40702f746415c0cfdcf78522ee6fd48434ff2e` |
| `src/runtime/components/App.vue` | `d9d629dfe9b07c39b363a97f379c14fe5119b86a` |

Git source blobs are not npm tarball integrity hashes. Qualification must inspect the actual installed distribution and record its lockfile integrity, resolved module paths, tool versions, and resulting assets.

## 3. Fit with the existing repository

The inspected baseline has a style specimen and dependency-free verification tooling. The Vue plugin runtime, package/lockfile, Vite build, full component harness, setup/makers, and application services remain specified rather than implemented. The plan must start with those prerequisites, not pretend to edit an existing `vite.config.ts` or mounted Vue app.

The existing contracts already require one composed `styles.css`, separate harness CSS, explicit source ownership, per-view Vue/Pinia lifetime, canonical notification ownership, and exact-candidate verification. These remain binding. Choosing Nuxt UI refines the former framework-neutral choice; it does not relax CSS-01–12, lifecycle, data safety, or testing requirements.

Relevant repository authorities: [PRD](../product/PRD.md), [styles](../architecture/STYLES.md), [setup/makers](../development/SETUP-AND-MAKERS.md), [errors/notifications](../architecture/ERRORS-AND-NOTIFICATIONS.md), [test strategy](../testing/TEST-STRATEGY.md), and [test concept](../testing/TEST-CONCEPT.md).

## 4. Findings and integration consequences

### R01 — Use the Vue integration, not a Nuxt application

The official integration exposes `@nuxt/ui/vite`, the generated `@nuxt/ui/vue-plugin`, and Vue component imports. The Vite plugin handles Nuxt compatibility imports and generated themes; importing the package's main JavaScript entry is not a substitute. Its implementation already installs Tailwind's Vite integration. [S02, S03, S10]

**Consequence:** Retain the normal Obsidian entrypoint and CJS artifact. Bundle Vue, Pinia, and selected UI runtime dependencies. Keep the Obsidian API external. Do not ship Nuxt, a development server, SSR routes, or a second Tailwind processing instance. `@nuxt/ui` in a CSS import is distinct from the package's JavaScript entry.

### R02 — Disable website-level routing and theme control

The Vue guide documents `router: false`, `colorMode: false`, `autoImport: false`, `components: false`, and `theme.prefix`. Component-name `prefix` and Tailwind `theme.prefix` are different settings. [S02]

**Consequence:** Use explicit component/composable imports, no browser-history router, and no competing theme preference. Obsidian remains the source of theme and navigation state. A future internal router would need a separately qualified memory-history adapter, not copied `createWebHistory()` examples.

Generated theme aliases still exist with explicit imports. Clean-checkout generation must precede type checking where those aliases are needed; do not add catch-all ambient declarations to hide missing generated types.

### R03 — Preflight, utility prefixes, and CSS isolation are different

Tailwind documents separate theme and utility imports to omit Preflight, with `prefix(...)` on both. Nuxt UI still ships its own global rules, including `:root`, `:host`, `.dark`, and focused-link styling. A prefix therefore does not contain the entire stylesheet. [S06, S11]

Tailwind's `isolate` utility sets CSS stacking isolation. It is **not** a selector sandbox and does not stop CSS from affecting another plugin. [S12]

**Consequence:** Use a plugin-identity prefix plus explicit owned roots. Parse and inspect the fully processed CSS; scope applicable vendor selectors and relocate vendor root variables to owned roots. Supply narrowly scoped base styles that selected components need after removing Preflight. Do not globally reset Obsidian.

### R04 — Runtime color injection bypasses a CSS-only scoping solution

The generated Vue plugin imports the color plugin independently of the conditional color-mode plugin. The color plugin builds `:root`/`:host`/`.light`/`.dark` rules, uses `useHead`, and has an SPA branch that creates a style element through global `document`. The head adapter installs an Unhead instance when none is present. [S04, S05, S07]

**Consequence:** A build-only transform of `styles.css` is insufficient. Qualify a narrowly scoped, version-guarded replacement of the runtime color plugin and provide its required palette aliases through static scoped CSS. Audit remaining head behavior and prove that production mounting adds no stylesheet, font, title, or metadata mutation. Prefer a documented upstream static/disable facility should one become available; none was verified in the inspected integration.

This proposed replacement is a compatibility technique to validate, **not an advertised Nuxt UI option**. Do not invent `disableGlobalStyles` for this version, patch global DOM methods, erase foreign styles after insertion, or silently fork the library.

### R05 — Multiple Vue apps do not imply isolated Nuxt UI services

The Vue shim stores `useState` values in a module-level object. `useOverlay` is exported through `createSharedComposable`. The inspected `UApp` always renders an overlay provider, while its toaster can be disabled with `toaster: null`. `useToast` uses the shared state path. [S08, S09, S13, S14]

**Consequence:** Start with declarative owner-local overlays and the existing NotificationService. Disable the automatic toaster on each view's `UApp`. Do not expose `useToast().clear()` or `useOverlay().closeAll()` as view cleanup. Merely wrapping these calls or adding an owner ID does not isolate their storage or providers.

Nuxt UI remains usable for forms, panels, local dialogs, and feedback presentation. A controlled owner-local toast viewport can use primitives behind the notification adapter; an actual multi-view test must establish its isolation. Native notices remain available for host-global feedback.

### R06 — Portal destination is configurable, but window behavior needs proof

`UApp.portal` accepts an `HTMLElement`, and the default is `body`. Passing an actual owned element avoids ambiguous selector lookup, but does not prove every nested component or third-party focus/scroll helper uses the correct document. [S13]

Obsidian documents separate globals and constructors for each pop-out window, and provides owning-document/window helpers and migration handling. [S15]

**Consequence:** Resolve roots from the view's owning document, never from whichever window is currently focused. Rebind or deliberately remount on document migration, preserving drafts through view state. Test focus restoration, outside-click detection, nested portals, body scroll locks, and native dialog coexistence. Do not assume that a portal target alone fixes cross-window behavior.

### R07 — Unique IDs matter across independent applications

Vue documents `app.config.idPrefix` for IDs produced by `useId()`. [S16]

**Consequence:** Assign a unique prefix per mounted view/dialog and test actual label/control/description references across two views. Keep runtime instance identity separate from the stable CSS prefix generated from the plugin identity. Tests inject deterministic instance IDs rather than depend on random production IDs.

### R08 — Host CSS can override layered utility styles

The CSS cascade places normal unlayered author declarations above normal declarations in named layers, before specificity is compared. [S17]

**Consequence:** Test both outgoing leakage and incoming host/theme interference. More-specific utility selectors alone are not a solution to layer precedence. Start with small unlayered, owned host-adapter rules and component theme adjustments; record any broader cascade intervention as a reviewed decision. Do not globally flatten all layers or enable blanket important utilities to make a specimen look correct.

Global identifiers also need an inventory: layer names, animation names, custom-property registrations, and referenced assets are not contained merely by prepending a root selector. Their actual emitted shape must be checked against the pinned compiler.

### R09 — Offline icons require a complete bounded icon inventory

The Vue icon integration supports local collections and explicit client bundling. Default library icons can be bundled when their collection is installed; application icons need explicit enumeration or qualified scanning. The documented default scan misses `.ts`/`.js`, and dynamic names require an explicit finite set. Missing collections or unknown runtime icons can use the Iconify API. [S18]

**Consequence:** Install only required local collections, enumerate navigation/status/maker icons, and provide a local fallback for unknown names. Test with external requests blocked, observing attempted requests as well as final pixels. Installing an icon collection alone is not a proof of complete offline operation.

### R10 — One stylesheet remains compatible with Vite

Vite documents library builds with CSS output and `build.lib.cssFileName`; the complete imported component graph matters. [S19]

**Consequence:** Keep one Vite-owned source pipeline for plugin and harness, using one required `styles.css`. Static vendor color aliases, Tailwind output, ordinary CSS modules, and compiled SFC styles must converge into that artifact. The native candidate cannot contain unresolved aliases, loose CSS imports, missing assets, or harness CSS.

Do not copy a configuration intended for publishing a Vue library that externalizes Vue: Obsidian is not required to provide the plugin's Vue runtime. Qualify CJS and explicit environment constants against the selected Vite version rather than assuming current Rollup/Rolldown option names.

### R11 — Tailwind compatibility does not certify Obsidian mobile

Tailwind's documented v4 core baseline includes Chrome 111, Safari 16.4, and Firefox 128. Newer optional CSS features can have higher requirements. [S20]

**Consequence:** Record the actual supported Obsidian installer/Electron and mobile WebView/device versions. Vite's JavaScript target cannot polyfill missing CSS behavior. Browser WebKit tests are useful, but are not an iOS Obsidian result. Unsupported target behavior blocks that compatibility claim.

### R12 — Component accessibility and data reliability need application tests

The integration must preserve the repository's existing validation, feedback, and actual Markdown-write semantics. Test projects and request interception are supported by the intended Vitest/Playwright stack, but neither tool makes a mocked success equivalent to a native write. [S21, S22]

**Consequence:** Qualify a small component set with real application actions, keyboard behavior, translated labels, date-only fields, error observation, and controlled asynchronous writes. Keep persistent recovery outside expiring toasts. Preserve the test strategy's separate execution, acceptance, and coverage metrics.

## 5. Recommended boundary

Use Nuxt UI as the selected presentation foundation, a small Obsidian integration layer for host-specific concerns, and unchanged application/domain contracts. Keep native settings, commands, Notice, and Modal capabilities available where they serve the host contract; using Nuxt UI does not require replacing every native control.

The first technical gate must demonstrate: selected components build into the plugin artifact; required colors exist without runtime stylesheet injection; two mounts do not share visible feedback; overlays use the owning document; unrelated host UI remains unchanged. Failure is a recorded integration blocker, not permission to relax the template contract.

## 6. Primary source register

Accessed 2026-09-22. Nuxt source links use the resolved release commit where available. Documentation URLs are living sources; recheck them during dependency qualification.

- **S01 — Release identity:** [v4.11.2 release](https://github.com/nuxt/ui/releases/tag/v4.11.2), [live latest-release API](https://api.github.com/repos/nuxt/ui/releases/latest), [resolved annotated tag](https://api.github.com/repos/nuxt/ui/git/tags/2ade12150775bdddda40a1635bc6c7551f0f4c3d).
- **S02 — Plain Vue installation/options:** [official guide](https://ui.nuxt.com/docs/getting-started/installation/vue), [tagged source](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/docs/content/docs/1.getting-started/2.installation/2.vue.md). The published guide's markdown content type was not readable through one web retrieval route; repository source supplied the content.
- **S03 — Vite integration and Tailwind registration:** [Nuxt UI unplugin](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/unplugin.ts).
- **S04 — Generated runtime plugin composition:** [plugins.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/plugins/plugins.ts).
- **S05 — Runtime color stylesheet:** [colors.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/plugins/colors.ts).
- **S06 — Vendor CSS roots and variants:** [runtime/index.css](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/index.css).
- **S07 — Vue document-head adapter:** [head.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/vue/plugins/head.ts).
- **S08 — Vue state and color-mode shim:** [base.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/vue/stubs/base.ts).
- **S09 — Shared overlay composable:** [useOverlay.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/composables/useOverlay.ts).
- **S10 — Compatibility import rewriting:** [nuxt-environment.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/plugins/nuxt-environment.ts).
- **S11 — Preflight and separate prefixed imports:** [Tailwind Preflight](https://tailwindcss.com/docs/preflight).
- **S12 — Stacking isolation only:** [Tailwind isolation](https://tailwindcss.com/docs/isolation).
- **S13 — App provider, portal and toaster:** [App.vue](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/components/App.vue).
- **S14 — Toast state/queue behavior:** [useToast.ts](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/src/runtime/composables/useToast.ts).
- **S15 — Obsidian owning windows:** [Support pop-out windows](https://docs.obsidian.md/plugins/guides/pop-out-windows).
- **S16 — Vue lifecycle, error handler and ID prefix:** [Application API](https://vuejs.org/api/application).
- **S17 — Normative cascade-layer ordering:** [CSS Cascading and Inheritance Level 5](https://drafts.csswg.org/css-cascade-5/#layer-order).
- **S18 — Local Vue icon bundling:** [official integration source](https://github.com/nuxt/ui/blob/bab8c5af30dd4e6cb14d42144e82b9c8863d2cc6/docs/content/docs/1.getting-started/6.integrations/1.icons/2.vue.md).
- **S19 — Library/CSS output:** [Vite production builds](https://vite.dev/guide/build).
- **S20 — CSS/browser baseline and SFC styles:** [Tailwind compatibility](https://tailwindcss.com/docs/compatibility).
- **S21 — Test separation:** [Vitest test projects](https://vitest.dev/guide/projects.html).
- **S22 — Network observation/interception:** [Playwright network](https://playwright.dev/docs/network).
- **S23 — Native semantic styling:** [Obsidian about styling](https://docs.obsidian.md/Reference/CSS%20variables/About%20styling), [HTML elements and plugin styles.css](https://docs.obsidian.md/Plugins/User%20interface/HTML%20elements).
- **S24 — Source scanning and static class names:** [Tailwind detecting classes](https://tailwindcss.com/docs/detecting-classes-in-source-files).
