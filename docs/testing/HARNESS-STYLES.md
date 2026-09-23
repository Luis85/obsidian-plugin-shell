# Obsidian harness styles and frontend evidence

> **Normative contract:** PRD 0.5, HSS-01–12; supplements HAR-01–10, E2E-01–07 and CSS-01–12.  
> **Concrete delivery:** An original CSS fixture, a standalone specimen page, a loopback server, and focused Node tests. No Vue/plugin/native-adapter runtime is implemented by these files.  
> **Related:** [Styles](../architecture/STYLES.md), [errors and notifications](../architecture/ERRORS-AND-NOTIFICATIONS.md), [review](../reviews/2026-09-22-product-review.md).

## 1. Why the host stylesheet is separate

The plugin's styles.css assumes a host that supplies tokens, typography, form controls, workspace layout, settings rows, modals and notices. A plain browser or jsdom environment does not provide those defaults. A browser harness therefore needs a declared host-style simulation as well as the real plugin stylesheet.

```text
Original harness host stylesheet
           ↓
Exact plugin stylesheet / shared compiled UI styles
           ↓
Scenario-only controls and stress overrides (explicit test mode)
```

The host simulation is not included in the released plugin. The plugin still composes its own one-file styles.css. Using both does not authorize a second harness-only copy of plugin styles.

**HSS-01 — Original, owned, versioned source.** The canonical entry is `harness/styles/obsidian.css`, composed from `obsidian/tokens.css`, `base.css`, `controls.css`, `overlays.css`, and `accessibility.css`. Its implementation is original work under the repository license. Public class/variable concepts guide the interface, but values and layouts are approximations. No Obsidian app.css, fonts, application binaries, themes, or unreviewed third-party assets are vendored or downloaded automatically.

Provide provenance, supported surfaces, fixture version, last native comparison, source references, and known limitations. A file called obsidian.css is not an official-host identity or fidelity guarantee. The current fixture has no completed native comparison; record that explicitly instead of assigning a guessed host release to it.

**HSS-02 — Scoped host contract.** A dedicated `.obsidian-harness` root enables the simulation; body is the recommended root so modal/notice portals share tokens. Use low-specificity selectors to avoid masking plugin-specific styling defects. Native global class names are simulated only under that root. Applying the CSS outside it must not restyle an unrelated page. No plugin-brand selectors or application business layout belongs in the host CSS.

The shim supplies only used host surfaces. Unknown/unmodeled APIs remain explicit gaps; do not create a permissive “anything works” fake. Add public variable coverage when a real plugin component or adapter needs it, with a fixture and ownership reference.

## 2. Required simulated surfaces

| Area | Minimum contract |
| --- | --- |
| Themes/tokens | Separate light/dark values, semantic text/background/accent/error states, type/spacing/radius/input variables. |
| Workspace | Leaf/header/content containers with realistic flex/grid shrink and overflow behavior. |
| Settings | Name/description/control row layout, headings, long-text wrapping, disabled/invalid states. |
| Controls | Inputs, textarea, select, checkbox/radio/range, buttons/primary/danger, focus and disabled states. |
| Modal | Container/backdrop/content/title/action appearance and viewport bounds. Behavior remains adapter-owned. |
| Notices | Container/message/action appearance, wrapping/stack layout; lifecycle is service/adapter-owned. |
| Menus/suggestions | Appearance for declared native adapter scenarios; keyboard/positioning require actual behavior tests. |
| Accessibility | Visible focus, hidden/screen-reader-only treatment, reduced-motion and forced-colors handling. |

**HSS-03 — CSS is not behavior.** Focus containment, Escape, inert background, keyboard menu navigation, live announcements, deduplication, timers, cancellation, and context targeting require adapters and tests. The standalone specimen uses a browser dialog and small fixture-only focus handling; it does not prove that the Obsidian Modal adapter works. The specimen's notice button is not NotificationService.

**HSS-04 — Theme and viewport matrix.** Test both themes, standard/narrow panes, long English/German text, 320/390/900/1280 CSS-pixel fixture widths, comfortable/compact controls, and reduced-motion/forced-colors modes. Include actual browser zoom/text scaling and keyboard/screen-reader/native device review when the runtime is qualified; narrow viewport testing alone is not browser zoom or mobile-host evidence.

Use normal system fonts for a dependency-free fixture; golden screenshot CI pins OS/browser/font availability. Do not redistribute font files. If host font metrics differ, record the difference rather than claiming pixel equality. Contrast and touch-target assertions apply to the selected declared values, not all user themes. [P04–P07, P10–P12]

## 3. Three evidence modes

**HSS-05 — Distinguish modes in reports.**

| Mode | What it establishes | What it does not establish |
| --- | --- | --- |
| Standalone style specimen (delivered now) | Original host CSS and specimen interactions render and can be inspected. | Real application, Vue compilation, host adapters, or native Obsidian compatibility. |
| Integrated production-component harness (pending) | Real components/services with deterministic host ports, shared policy, composed plugin styles. | Actual native host implementation, runtime-version compatibility, or device correctness. |
| Native candidate check (pending) | Exact release assets exercised inside an identified supported Obsidian host. | All third-party themes, future versions, every device, or screen readers not tested. |

The fast Vite HMR harness may inject styles for iteration. Artifact-fidelity runs load the exact accepted plugin CSS with matching Vue scoped/module identifiers and no independently generated duplicate. The host shim remains separate in both modes. CSS-08 already requires this; HSS-05 makes the result label unambiguous.

**HSS-06 — Load order and drift checks.** Validate explicit host → plugin ordering, complete source imports, compiled SFC ownership, and no release leakage. Compare selected native and harness geometry/computed tokens/controls in a fixture vault when changing the host baseline. Store host app/installer/platform, shim version/hash, plugin CSS hash, UI build identity, viewport and theme. If native comparison is unavailable, report unverified rather than refreshing the recorded date as though comparison occurred.

Pin by verified source/build identity; a screenshot filename or a calendar date is insufficient. Updates to the shim and a plugin visual baseline must be reviewed independently so changing both cannot automatically approve a masked regression.

**HSS-07 — Negative fidelity tests.** Deliberately remove the plugin stylesheet, use a wrong SFC scope/class mapping, omit a required token/control rule, reorder a declared override, and include shim CSS in the release candidate. The appropriate checker or scenario must fail. Test a missing host stylesheet too; both host and plugin styles are load-bearing. Do not “fix” missing plugin CSS by moving its rules into the shim.

Source-level checks are helpful tripwires, not a complete CSS parser/security proof. Parse syntax with qualified tools and inspect computed browser behavior. The stylesheet specimen's checks do not supersede the future Vite composition gate.

## 4. Error-aware browser testing

**HSS-08 — Capture multiple channels.** Required integration runs observe browser page errors, console errors, missing/request-failed required assets, Vue captured errors, application normalized unexpected failures, notification-sink failures, event-listener errors, and readiness/timeouts. Attach observers before mounting. Do not consider a fallback UI or suppressed console to be an automatic pass.

A captured defect ledger lives outside the failing component subtree. Test expectations identify exact code, operation, and count; missing expected failures or additional failures both fail. Ledger overflow/dropped events fail. This is distinct from a user-facing diagnostic ring buffer that may intentionally evict old entries.

**HSS-09 — Determinism and completion.** Use scenario-scoped IDs, clock/timers, storage and operation contexts. Define a finite readiness/quiescence signal for the specific scenario. Do not wait for an always-empty network queue while a watcher is active, or hide unresolved async work with arbitrary sleeps. Notification tests assert update/dismiss/dispose state and no residual owner resources, not only screenshot appearance.

Capture sanitized test metadata before resetting state. Expected failure injection is harness-only and excluded from releases. The full pipeline must still prove that an ordinary scenario with a deliberately contained exception exits nonzero.

**HSS-10 — Fault matrix.** At minimum exercise validation; successful create; no-write failure; uncertain write; created-but-open-failed; delayed/cache-lag completion; duplicate submission; notice burst; reporter/translator/sink failure; captured render exception; async listener rejection; two-view cleanup; reload; long translations; and a missing-style negative fixture. The actual document content comes from DocumentCreationService/real serializer, not hand-authored success markup.

The standalone page deliberately does not implement those runtime scenarios. It supplies host-style surfaces on which the integrated tests will run. Its static Markdown snippet and illustrative status messages are labeled specimens.

## 5. Tooling and packaging

**HSS-11 — Script boundary.** The delivered standalone server is `scripts/harness/serve-style-fixture.mjs`. It uses Node built-ins, a loopback binding, an exact asset allowlist, non-mutating GET/HEAD routes, no-store responses, and a restrictive CSP. It serves neither arbitrary repository files nor a vault. It has explicit port/help options and closes owned connections on termination.

The focused delivered test command is:

```sh
node --test tests/harness-styles/server.test.mjs
```

The standalone visual inspection command is:

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
```

These commands exist independently of the future package.json/setup/Vite/Playwright configuration. They do not make `npm run setup`, `npm run verify`, or the full harness available. On implementation, integrate this fixture into the existing scripts and Vitest/Playwright entrypoints rather than maintain a competing permanent test stack.

Generated releases exclude all `harness/**`, fixture helpers/styles, server code, screenshots, reports and original host simulation. Production imports may reference only plugin-owned source styles. Never deploy the host shim as a user's plugin stylesheet.

**HSS-12 — Qualification and limits.** All handwritten fixture CSS/JS/scripts obey
400 code lines, tests/helpers 450, excluding comments/blanks under the owner's
iteration 03 amendment. Test serving, headers, path rejection, CSS entry/module
integrity, scope isolation, core interactive specimens and narrow rendering. Full
CSS/SFC output, notifications, errors, native APIs, host parity and device behavior
retain separate acceptance gates.

The current session's bounded results and its browser-navigation environment limitation are recorded in the product review. Passing focused fixture tests is not passing template verification, because the template runtime and toolchain do not exist yet.

## 6. Maintaining the host model

Expand the fixture only when a production component or supported host adapter needs the surface. Keep provenance current, avoid copying native styles on every host update, and compare critical surfaces against the latest supported public host during compatibility qualification. Template users should not need to maintain a theme engine just to test a form.

An optional developer-supplied host/theme snapshot can be used locally only after licensing/provenance review and explicit configuration. It is not committed, redistributed, uploaded as an artifact, or downloaded automatically. The original baseline remains useful without it.
