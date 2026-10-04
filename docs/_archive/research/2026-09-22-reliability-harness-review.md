# Research: reliable feedback and an honest host-style harness

**Date:** 2026-09-22. **Scope:** Primary documentation, current repository reads, and the bounded original stylesheet specimen. Exact implementation decisions and proposed defaults are distinguished from upstream capabilities.

## Findings applied

| Finding | Source | Applied change |
| --- | --- | --- |
| Vue exposes app error handling and component error-capture hooks; local containment can stop further propagation. | P01–P02 | Observe captured defects independently of global browser errors, and avoid recursive fallback rendering. |
| Global unhandled-rejection events are not a replacement for owned promise handling. | P03 | No suppressing global production handler in the shared Obsidian process; isolated harness observers supplement owned handling. |
| Accessible status updates should be programmatically identifiable without requiring focus changes. | P04 | Polite status for routine updates, focused field guidance for validation, intentional announcement ownership. |
| Alerts should not steal focus, disappear too quickly, or interrupt continually. | P05–P06 | Persistent essential recovery, bounded optional transient notices, no toast for each field/event. |
| Modal interaction requires focus behavior and an actually modal background, not only ARIA/CSS. | P07 | Native adapter acceptance and explicit specimen limitations; fixture-only focus loop added after a failed smoke assertion. |
| Notice accepts a message and optional duration; zero duration stays until dismissed. | P08–P09 | Wrap native APIs rather than invent severity/action/queue constructor options; model timer and targeting limitations. |
| Browser errors and visual screenshots are separate evidence. | P10–P11 | Check browser, captured-service, notification and asset channels; tie visuals to actual source/style identity. |
| CSS import composition and Vue scoping need real processing, not duplicated style copies. | P12 | Original host simulation precedes actual plugin CSS; preserve the existing compiled plugin stylesheet contract. |

Notification queue limits, six-second optional success notices, delayed progress, error taxonomy, recovery actions, and operation ownership are template design policies. They are not claimed to be upstream Obsidian defaults or guarantees.

## Repository observation

The read baseline was `c62303e1d60a77b1496ed06f7142e1952dcf78c0`. Its sixteen tracked text files contained no executable plugin/toolchain/harness. PRD section 11 already required typed failures and quiet diagnostics, and section 12 already required a separate host shim. The missing pieces were precise shared notification semantics, a concrete original stylesheet, and evidence that a handled defect cannot be silently hidden from tests.

No security audit of nonexistent runtime code is claimed. The [product review](../reviews/2026-09-22-product-review.md) distinguishes contract changes, fixture fixes, and pending runtime work.

## Primary sources

| Ref | Source | Verified topic |
| --- | --- | --- |
| P01 | [Vue application API](https://vuejs.org/api/application.html#app-config-errorhandler) | Application error-handler scope and production/development differences. |
| P02 | [Vue lifecycle error capture](https://vuejs.org/api/composition-api-lifecycle.html#onerrorcaptured) | Component containment/propagation behavior and fallback risks. |
| P03 | [MDN unhandledrejection](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) | Promise failure observation and event behavior. |
| P04 | [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) | Accessible non-focus-taking updates. |
| P05 | [W3C Alert pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) | Focus, expiry and interruption considerations. |
| P06 | [W3C Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html) | Time-sensitive content/recovery considerations. |
| P07 | [W3C Modal Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Focus containment, naming, keyboard and return behavior. |
| P08 | [Official Notice documentation source](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/TypeScript%20API/Notice.md) | Public Notice surface; inspected blob `edd32145195cb675da2999906d7d83606312b23b`. |
| P09 | [Official Notice constructor source](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Reference/TypeScript%20API/Notice/(constructor).md) | String/DocumentFragment, milliseconds, zero-duration behavior; blob `f566e26a8be134355696e1c2b543955b2ec8c1ca`. |
| P10 | [Playwright Page API](https://playwright.dev/docs/api/class-page) | Browser errors, console and page-level observation. |
| P11 | [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) and [accessibility testing](https://playwright.dev/docs/accessibility-testing) | Environment-sensitive screenshots and limitations of automated accessibility checks. |
| P12 | [Vite CSS features](https://vite.dev/guide/features#css) and [Vue SFC CSS](https://vuejs.org/api/sfc-css-features.html) | Import processing, scoped selectors and real compilation requirements. |

Additional primary guidance consulted: [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), and [MDN forced colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors). These inform the declared fixture matrix, not a claim of comprehensive accessibility conformance.

## Evidence and licensing boundary

The host stylesheet is original repository code, not a copy or extraction of Obsidian app.css. It approximates public semantic interfaces without claiming official colors/metrics. No proprietary stylesheet or font is redistributed. No completed native comparison is recorded.

The bounded fixture was checked with Node tests, CSS parsing and Chromium inline rendering. Administrator policy blocked browser navigation to the loopback server; the HTTP server was tested separately with Node. Full integrated Vite/Vue/native/device behavior remains unverified. See the review for exact versions, commands, fixes and limitations.
