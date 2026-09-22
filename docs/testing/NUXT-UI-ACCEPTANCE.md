# Nuxt UI acceptance and verification design

**Version:** 1.0 · **Date:** 2026-09-22 · **Owner:** template maintainer and QA  
**State:** All 34 cases below are **planned / not executed**. This document is not a passing test report.  
**Plan:** [Nuxt UI implementation plan](../development/NUXT-UI-IMPLEMENTATION-PLAN.md)  
**Research:** [Integration findings and primary sources](../research/2026-09-22-nuxt-ui-integration.md)  
**Governing policy:** [Test strategy](TEST-STRATEGY.md) and [test concept](TEST-CONCEPT.md).

## 1. Scope and traceability

These are acceptance-case IDs, not names of executable tests. The implementation plan's work-package references are labeled as packages; acceptance references in this document are labeled as cases. A work package and an acceptance case with the same numeric suffix are not interchangeable.

The existing [machine inventory](test-plan.json) continues to describe AC-01–90 and the executable baseline. This documentation change does not add pretend test files, change the inventory's count, satisfy existing acceptance, or remove the blocked release guard. During implementation, extend/version the machine inventory and validator explicitly, preserve every existing case and negative invariant, and register real suites and stable test IDs as they become executable. Planned suites must not claim passing evidence.

Each case has an owner, required modes, actual links to implemented tests, and explicit remaining gaps when transferred into the machine inventory. Partial evidence is allowed but cannot be relabeled as whole acceptance. Required modes are cumulative; an artifact inspection cannot satisfy a native interaction, and a native screenshot cannot establish an application-service invariant.

### Evidence mode vocabulary

| Mode | What it establishes |
| --- | --- |
| Static / artifact | Actual dependency, module, CSS, asset, namespace and output checks against built bytes. |
| Unit / contract | Real owned validators/adapters/policies with deterministic boundary inputs. |
| Component | Actual Vue components, real store actions where application execution is claimed, and public behavior. |
| Integrated browser | Built real-component harness and controlled host adapters, not the original specimen alone. |
| Generated repository | Real setup/maker output in a disposable differently named repository; bounded depth-one qualification. |
| Native | Exact built candidate running inside the recorded Obsidian installation and operating system. |
| Device | Exact candidate on recorded real mobile devices, OS and embedded runtime. |
| Manual accessibility | Recorded keyboard/assistive-technology assessment in a named environment. |
| Performance | Recorded workload, build, environment and measurement method; not an unqualified CI stopwatch. |

## 2. Planned acceptance matrix

All rows have status **planned / no executed evidence**. Package ownership is assigned in the implementation plan; the feature author supplies the tests, QA reviews evidence, and the maintainer owns compatibility and gate decisions.

### A. Dependencies, styles and artifact ownership

| Case | Required observable outcome | Required evidence |
| --- | --- | --- |
| NUI-01 | A cold checkout installs the qualified lockfile, prepares required generated theme aliases, and typechecks/builds an explicitly imported Nuxt UI component without cached declarations, peer overrides or a Nuxt application. Missing prerequisites fail with a truthful blocked result. | Static / artifact; generated repository |
| NUI-02 | The installed plugin entry is valid CJS; Vue/Pinia/selected UI runtime are bundled; only approved host modules remain external. No unresolved Nuxt aliases, runtime dependency downloads, unsupported chunks, or dev-server bootstrapping remains. The actual Obsidian loader opens the minimal view. | Static / artifact; native |
| NUI-03 | Tailwind and component theme prefixes agree. The bounded source graph includes used generated themes and literal class variants, excludes unrelated documents/reports, and emits required styles. Adding/removing a component or maker-generated module updates the result; stale rules do not persist through a cached build. | Static / artifact; integrated browser; generated repository |
| NUI-04 | A complete imported UI graph emits one required styles.css containing ordinary modules and compiled SFC styles, with matching JS/manifest assets and no loose imports or missing resources. A failed rebuild leaves the complete last-good installed asset set unchanged. | Static / artifact; unit / contract; integrated browser |
| NUI-05 | Production mounting, theme changes, overlays and unmounting cause no vendor stylesheet injection or host title/meta/font mutation. All required palette aliases are present in scoped static CSS. A changed vendor version/module shape invalidates the compatibility adapter instead of silently permitting injection. | Static / artifact; integrated browser; native |
| NUI-06 | Representative controls outside all plugin-owned roots have unchanged computed-style and interaction invariants before installation, after mounting, after theme changes and after disposal. Root selectors, focused links and broad vendor selectors cannot escape ownership. | Static / artifact; integrated browser; native |
| NUI-07 | Global names and at-rules are explicitly inventoried: keyframes/references, layer ordering, custom-property registrations and generated variables. Two differently named generated plugins can coexist without changing each other's animation, property or token behavior. Unknown constructs are rejected or reviewed explicitly, not silently dropped. | Static / artifact; integrated browser; generated repository |
| NUI-08 | Selected controls remain usable with representative unlayered host/theme rules: borders, backgrounds, padding, focus, disabled state and hit targets meet their declared invariants. The fix is scoped and does not rely on universal important declarations or unreviewed global layer flattening. | Integrated browser; native |
| NUI-09 | Root-level tokens, descendant utilities, portal content and SFC/CSS-Module styles resolve correctly. Ownership processing preserves identifiers, conditional rules and required cascade order, handles root selectors correctly, and does not duplicate or double-scope component styles. | Static / artifact; component; integrated browser |
| NUI-10 | Changing host light/dark mode, accent, font or supported density updates view and portal styles without losing drafts or requiring an unrelated remount. No competing preference or global theme-class mutation occurs. Undefined palette roles and stale portal tokens are detectable failures. | Component; integrated browser; native |

### B. Views, portals, feedback and real application effects

| Case | Required observable outcome | Required evidence |
| --- | --- | --- |
| NUI-11 | Two simultaneous Vue applications using the same imported UI modules have distinct view state and unique generated DOM IDs. Label, description and error references resolve inside the correct view; each app receives its intended locale/services. A separate module reload must not conceal shared state. | Component; integrated browser |
| NUI-12 | Successful, partially failed and cancelled mounts dispose only owned apps, listeners, roots, observers, timers and subscriptions. Closing one view or disabling the plugin leaves unrelated host UI intact. Late asynchronous callbacks cannot mutate disposed roots or newly opened replacement views. | Unit / contract; component; integrated browser; native |
| NUI-13 | Opening/moving a view into a pop-out uses its owning document/window for portals, events and constructors. Migration closes transient UI, preserves drafts, and rebinds/remounts deliberately. Interacting with another focused window does not redirect the original view's events or styles. | Integrated browser; native |
| NUI-14 | Dropdowns, tooltips and nested popovers render in the intended owned portal, remain aligned at scroll/zoom/pane edges, are not incorrectly clipped, and close only on the specified outside interaction. Overlay layering coexists with host menus and native dialogs without a global z-index contest. | Integrated browser; native |
| NUI-15 | Local dialogs expose accessible names/descriptions, support their specified keyboard and Escape behavior, and restore focus safely. Nested interactions and native-dialog shells avoid duplicate focus traps. Body scroll locks/inert state are applied only where intended and fully restored after normal close, failure and disposal. | Component; integrated browser; native; manual accessibility |
| NUI-16 | Two open views cannot render, dismiss, resolve or destroy each other's overlays. Declarative owner-local state is used in the default path; forbidden shared useOverlay/closeAll integration is detected. Opening a dialog results in exactly one intended overlay/provider rendering. | Static / artifact; component; integrated browser |
| NUI-17 | The actual NotificationService selects one feedback flow per operation, updates progress/terminal state correctly, distinguishes independent attempts and preserves recovery. Owner disposal clears only its own presentation. No shared Nuxt toast queue, duplicate per-view toast, or global clear operation bypasses policy. | Unit / contract; component; integrated browser; native |
| NUI-18 | Real form validation associates errors with fields, retains entered values, and invokes no write or committed event for invalid input. Preview and submit use the actual application contracts and configured destination, not a fake always-success store action. | Unit / contract; component; integrated browser |
| NUI-19 | A successful Task creation produces the expected actual Markdown/frontmatter through DocumentCreationService and preserves canonical authority. Confirmed creation remains successful when opening, a subscriber or a feedback sink subsequently fails; safe follow-up actions never recreate the document. | Unit / contract; integrated browser; native |
| NUI-20 | Controlled cancellation, double submission, close-during-write, conflict and uncertain-write interleavings yield the documented effect state. No blind create retry or duplicate note occurs. Persistent reconciliation guidance survives transient feedback failure, and late completion cannot update the wrong owner. | Unit / contract; component; integrated browser; native |
| NUI-21 | Caught Vue render/event-handler errors and notification-sink failures reach the independent test observer in the relevant development and built modes. Ordinary scenarios fail on unexpected faults even when a fallback UI appears. Expected code/scope/count, missing faults and overflow remain strictly checked. | Unit / contract; component; integrated browser |

### C. Offline behavior, accessibility and harness fidelity

| Case | Required observable outcome | Required evidence |
| --- | --- | --- |
| NUI-22 | Default library icons, application icons, TypeScript metadata icons and the finite dynamic set render offline. Unknown names use a local fallback. Tests detect attempted Iconify/CDN calls as failures, even when blocked requests do not visibly damage the page. | Static / artifact; integrated browser; native |
| NUI-23 | Packaged styles, images, masks and fonts resolve without external requests or unshipped assets. Required license/provenance notices remain available. Harness CSS, test adapters and development-only code are absent from the candidate. Runtime assets are not inferred to be safe from package names alone. | Static / artifact; integrated browser; native |
| NUI-24 | A narrow pane inside a wide desktop window remains usable independently of viewport breakpoints. Long labels, validation, tables/lists, dialogs and notifications do not hide critical actions. Zoom, touch targets and virtual-keyboard constraints are exercised at the supported layouts. | Integrated browser; native; device |
| NUI-25 | Keyboard navigation, focus visibility, associated validation, live announcements and persistent recovery work in the declared environment. Long translations, locale/direction, date-only input, reduced motion and forced colors are covered. Automated results do not substitute for required screen-reader/native assessment. | Component; integrated browser; manual accessibility; native |
| NUI-26 | Development uses shared processing, while the fidelity scenario loads the exact candidate styles.css and matching component identifiers without a second plugin stylesheet masking omissions. Host shim provenance stays separate. Evidence records matching CSS/JS/manifest hashes and actual mode. | Static / artifact; integrated browser |
| NUI-27 | Deliberately missing host/plugin/component CSS, wrong identifiers, escaped selectors, runtime injection, shared feedback and an unexpected caught error each make the relevant positive gate fail for the intended reason. Restoring correct inputs passes that invariant; no baseline is automatically accepted. | Static / artifact; integrated browser; unit / contract |

### D. Generation, maintenance and final qualification

| Case | Required observable outcome | Required evidence |
| --- | --- | --- |
| NUI-28 | Setup starts without node_modules; dry-run/help have no writes/downloads. Reviewed setup installs only the qualified lock, assigns a valid plugin-specific CSS identity, preserves unrelated content and distinguishes browser/native provisioning. Failed or cancelled stages report their actual partial state safely. | Unit / contract; generated repository |
| NUI-29 | View/component/feature/modal/style makers generate explicit imports, real integration, owned provider/style behavior, locales and meaningful tests. Identical reruns are safe, collisions preserve edits, example removal removes its wiring/styles, and differently named output builds. Qualification has a finite depth-one boundary and creates no user notes. | Unit / contract; generated repository |
| NUI-30 | Existing line limits, strict types, architecture, lint/fallow and dependency boundaries apply to all new adapters and generated source. Inner layers do not import UI/host modules; prohibited shared UI services and broad suppression workarounds are detected through real configured tools and negative fixtures. | Static / artifact; generated repository |
| NUI-31 | The exact candidate loads in the recorded supported public Obsidian app/installer and operating system. Commands, settings, native Notice/Modal boundaries, split views, pop-outs, reload and disable/re-enable are exercised with the selected themes. Browser specimen results cannot fill missing native evidence. | Native |
| NUI-32 | Each claimed mobile target is exercised in actual Obsidian on recorded iOS/Android hardware, OS and embedded runtime. Layout, touch, virtual keyboard, focus, icons and relevant CSS features work. A Playwright WebKit result or Tailwind minimum browser version is not a device-compatibility result. | Device |
| NUI-33 | CSS/JS size, first-open behavior, representative list interaction and repeated mount/dispose resource counts are measured against declared budgets and controlled workloads. Results identify environment and method; no noisy shared-CI duration is mislabeled as a qualified performance guarantee. Budget changes require review. | Static / artifact; performance; native |
| NUI-34 | Fresh repeated runs preserve exact required test accounting without hidden retries; missing/skipped/malformed evidence fails. Dependency/adapter/source changes invalidate prior evidence and trigger relevant negative controls. Native/device/artifact identities bind the accepted candidate; preparation cannot publish or bypass the current release guard. | Unit / contract; static / artifact; integrated browser; generated repository; native; device |

## 3. Concrete verification designs

### 3.1 CSS ownership and host sentinels

Use real compiled CSS and representative real components. Place host-like buttons, inputs, anchors, headings and a simulated second-plugin root outside the plugin namespace. Capture selected computed-style invariants and keyboard behavior before and after attaching the candidate CSS, mounting views, switching themes and disposing them. Include root-level and teleported components; do not test only descendants in a single contained card.

Use a CSS parser for final selector/at-rule analysis. The negative control deliberately introduces one escaped selector with a known visible effect and verifies that the actual gate rejects it. Include layered and unlayered host rules to distinguish outgoing contamination from incoming host interference. A root prefix is not proof of global identifier isolation.

### 3.2 Runtime head and network observation

Attach observation before importing/mounting the runtime under test, not after initial injection. Record additions, removals and mutations of style/link/title/meta elements and host class changes, including transient elements removed later. Tie the observer to the relevant owner documents and also watch the main document during pop-out scenarios, because an incorrect global document reference could mutate the wrong window.

The production scenario permits no stylesheet insertion merely because the final styles look correct. Development HMR is a separately labeled mode. Observe attempted network requests in addition to blocking external origins. A blocked Iconify request, remote font request or unexpected stylesheet fetch is a defect, not successful offline operation. Use only synthetic fixture content in retained traces.

### 3.3 Two-app and cross-document isolation

Mount both views in the same browser/module context with different owner IDs and separate Pinia instances. Keep them mounted concurrently; do not reset modules or use independent pages as the sole isolation test. Open a local dialog and issue feedback in one, then interact with and close the other. Assert DOM counts, owner destinations, action results, focus and residual resources.

A separate same-module test captures the known upstream shared-service risk. The approved default path must not use that storage. Static import checks supplement actual behavior and account for re-exports/helpers. Browser tests model another document where useful, but final migration/focus/scroll behavior must also execute in an actual Obsidian pop-out.

### 3.4 Controlled asynchronous application behavior

Use real application services with explicit clock/ID providers and deferred writer/subscriber barriers. Freeze only behavior that depends on time; wait for meaningful readiness or observable state, not arbitrary sleep. Check persisted Markdown independently of the service receipt and the toast.

Exercise cancellation before mutation, owner closure while a write is pending, double-submit, confirmed create with failed follow-up, and uncertain write reconciliation. Verify the existing file remains intact on conflict and that retries target safe follow-up actions. Component tests claiming application execution must not use Pinia's default stubbed actions.

### 3.5 Accessibility and responsive layout

Constrain the actual pane element independently of the browser viewport. Use long English/German strings and selected locale/direction scenarios, focus traversal, reduced motion and forced colors. Verify that error IDs and accessible names remain correct with duplicate forms in two apps. Date-only input checks run under UTC, Europe/Berlin transition dates and a negative-offset timezone without converting calendar dates into accidental timestamps.

Keep automated accessibility and screenshot assertions separate from manual screen-reader results. Record assistive technology, browser/host, OS, candidate and observed interaction. A screenshot cannot prove live-region delivery or correct focus handling.

### 3.6 Setup, makers and adapter upgrades

Generate only into disposable repositories with explicit different identities, including names that require a valid Tailwind prefix different from the manifest ID. Record hashes of preexisting files around collision/cancel/failure tests. Build actual generated output, remove the example through its defined workflow, and confirm that residual imports/styles disappear.

For adapter qualification, intentionally change the expected vendor version/hash or module shape and verify a clear build failure. Do not accept a replacement merely because a resolver function was called: inspect the actual module graph and exercise the production side effect. On every qualified upgrade, re-run CSS/head/two-app/portal/offline and relevant native/device cases. Generated-repository verification cannot recursively launch itself.

## 4. Required handoff record

Each implemented package reports: source commit and uncommitted-input status; dependency lock and adapter module identities; exact commands/exits; executed stable test IDs; repetitions/retries; evidence mode; JS/CSS/manifest hashes; host/browser/device versions; actual outcomes; retained trace/report locations; and remaining gaps.

No report is supplied by this planning document. Source inspection, manually reviewed documentation and the existing Node specimen baseline do not constitute Nuxt UI implementation evidence. Mark each acceptance case not-run, partial, failed, blocked or verified according to its actual required evidence, keeping test execution rate, acceptance completion and code coverage separate.
