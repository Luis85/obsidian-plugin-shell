# Error handling and notifications

> **Normative contract:** PRD 0.5; extends ERR-01–06 and LOG-01–06 with ERR-07–18 and NTF-01–12.  
> **Implementation status:** Specified, not a running plugin service. The stylesheet specimen is not its implementation.  
> **Sources:** [Review research](../research/2026-09-22-reliability-harness-review.md), P01–P12.

## 1. One outcome, one feedback owner

The developer should not write a different catch/notice/logging pattern in every command, component, settings callback, event subscriber, or maker-generated action. Reuse one failure model and presentation policy, with native and harness adapters.

```text
Application operation → typed outcome / normalized unexpected failure
                                     ↓
                       UI feedback coordinator
                      ↙              ↓              ↘
                field/view      Notice adapter     redacted diagnostics
                 feedback       or harness fake     and test observer
```

Domain/application code does not instantiate Notice, know the active window, translate text, or write into component state. Services return results; explicit presentation/application boundaries decide how to show them. The logger is not a notification system, and the event bus is not an error-handling dependency.

### Developer-facing surfaces

| Surface | Responsibility |
| --- | --- |
| `ErrorService` | Normalize unknown boundary failures, preserve stable category/code/effect facts, provide safe diagnostic context. |
| `NotificationService` | Present a validated localized notification specification through a scoped sink; update/dismiss owned handles. |
| Small UI feedback helper | Interpret the operation result, route field issues or recovery state, coordinate optional progress, and avoid double reporting. |
| Native/harness sinks | Adapt the same notification contract to real Obsidian or simulated DOM. |
| Error/notification observer | Read-only test evidence for captured failures and notification lifetimes; no production test globals. |

Names describe contracts, not a mandate for five frameworks or independently stateful classes. A cohesive factory plus a few pure functions is sufficient. Share types/policy and vary adapters; do not duplicate a production policy in the harness.

## 2. Failure and operation semantics

**ERR-07 — Canonical failure model.** Use a closed category/code catalog covering validation, cancellation-before-write, conflict, unavailable capability, permission/storage failure, stale input/plan, uncertain write, and unexpected defect. An unexpected cause starts as `unknown`. Carry operation/correlation identity, recoverability, and effect state; do not expose raw exception text as UI content. Cataloged messages use checked locale keys and field-addressable issues.

Effect state is distinct from severity: `not-started`, `not-committed`, `committed`, or `uncertain`. A timeout, AbortError, or closed modal does not prove that a host write did not happen. The existing DocumentCreationService receipt/result remains authoritative; do not introduce a second conflicting status model.

**ERR-08 — Boundaries, not blanket catches.** Install narrow wrappers for native callbacks, startup/teardown, document writes, async subscriptions, and Vue app boundaries. Catch where there is a useful response or conversion; do not hide programming errors under defaults, return success after a failure, or catch every pure domain function. An intentionally caught user validation result is not an unexpected defect.

**ERR-09 — Preserve committed outcomes.** `documents.created` listener failure, cache lag, navigation failure, notice rendering failure, and diagnostic-export failure cannot turn a confirmed create into a failed create. Return/show created-with-follow-up-problem and offer the failed follow-up only. A UI may retry opening the returned path, not rerun creation.

**ERR-10 — Retry is a capability, not a severity rule.** Only expose a retry action when the operation defines safe retry/idempotency. Reuse the original document request ID for the same submission. An uncertain write exposes reconciliation/check-destination guidance; no automatic suffix/new-ID retry. A retry has a single-flight guard, revalidates stale inputs, and cannot act on a disposed owner. No generic exponential-retry framework is required.

**ERR-11 — Cancellation and pending work.** Before mutation starts, cancel is a normal result without an error notice. After mutation starts, preserve pending/uncertain/committed truth even if the owner closes. Abort only operations that support it. Guard late view updates; do not delete a created note to manufacture cancellation. Maintain recoverable operation information at the appropriate runtime scope without retaining the entire closed component tree.

**ERR-12 — Vue containment.** Configure an error boundary for each mounted Vue app and focused component boundaries where useful. Vue's error hooks have documented scope and propagation behavior; returning false from `onErrorCaptured` can stop propagation. A boundary that contains a defect must still record it to the observer. Its fallback UI must not render the same crashing subtree indefinitely. Reset/reload is explicit, cancels obsolete subscriptions, and does not silently discard unsaved drafts. [P01, P02]

Do not attach broad production `window.onerror`/`unhandledrejection` handlers that suppress errors from Obsidian/other plugins. Production code observes its own promises and scopes. Harness capture may listen globally within its isolated page, without calling preventDefault to hide failures. An error from a different realm is not guaranteed to satisfy `instanceof Error`. [P03]

**ERR-13 — Reporting cannot recurse.** Normalize once per originating failure/operation and retain a safe stable report identity across rethrows/wrapping. Do not mutate foreign Error objects or deduplicate by raw user text. A logger/translation/sink failure uses a minimal bounded fallback containing stable codes, not its own recursive notification/event. If notification delivery fails, the owning recovery UI and diagnostic observer still expose that fact.

**ERR-14 — Redaction before storage.** Store only approved fields before they enter buffers, notices, JSON reports, or exports. Reject arbitrary object serialization, dangerous getters/prototypes, circular graphs, and unbounded causes. Raw causes can remain transient local references only where justified; exports never include raw note bodies, titles, paths, form values, access tokens, or stacks containing such data. User-visible content/path previews are intentional UI data, not automatically safe diagnostics.

**ERR-15 — Every swallowed defect is observable in tests.** Browser `pageerror` and console listeners are insufficient when Vue/application boundaries deliberately catch exceptions. The harness exposes a read-only error ledger outside the failing component scope. It records normalized unexpected failures even if production logging is disabled, deduplicated, or the fallback renders successfully. A dropped/overflowed record is itself a test failure; log-buffer limits cannot make a broken test green. [P01, P10]

Each negative scenario declares exact expected codes, operation scope, and occurrence counts. Assert all expected failures occurred and no unexpected extras occurred. No generic “ignore errors in negative tests” switch. A deliberately injected contained render exception must make an ordinary scenario fail, proving this channel works.

**ERR-16 — Extension and generation.** Makers reuse the result catalog and feedback helper; they do not scaffold arbitrary `catch { new Notice(...) }` blocks. A developer can add a localized code or recovery mapping through an explicit registry with type/locale tests, without changing host sinks. Error codes are nonlocalized stable identifiers; UI copy may change without breaking tests keyed to the code.

**ERR-17 — Safe degraded mode.** A local-preference failure can fall back to memory with an accurate one-time warning. Corrupt/future durable data remains protected; related mutating actions are unavailable with a reason. Startup failure cleans up partial ownership, exposes one understandable status, and leaves unrelated plugins/views alone. No generic reset-to-default or clear-vault recovery action.

**ERR-18 — Required qualification.** Test non-Error throws, cross-realm/host failures, circular causes, reporter failure, translation failure, boundary recursion, duplicate catches, rejected listeners, actual effect states, stale retries, view disposal, and the captured-defect ledger. Verify no network reporting and no prohibited user content in exported diagnostics.

## 3. Notification policy

**NTF-01 — A specification, not a raw exception.** Notification requests contain a checked message key/parameters, semantic kind (`info`, `success`, `warning`, `error`, `progress`), operation ID, owner scope, lifetime policy, and optional approved action IDs. They do not accept arbitrary HTML, serialized exception objects, or executable code received from events/documents. Resolve action implementations through the owner's explicit action registry.

`show` returns an idempotent owned handle with `update` and `dismiss`; repeated terminal updates cannot revive a dismissed/disposed handle. There is no mandatory end-user notification inbox, persistent history, operating-system notification permission, telemetry, or second global store.

**NTF-02 — Surface selection.** Use the least disruptive surface that keeps the outcome understandable:

| Situation | Primary surface | Avoid |
| --- | --- | --- |
| Field validation | Persistent associated field text and an appropriate error summary/focus target | One toast per invalid field |
| Background or command failure without a visible owner | One concise native notice plus a discoverable safe detail/recovery path | Silent console-only failure |
| Recoverable form/write failure | Owning form/view banner that preserves inputs; optional single notice when owner is no longer visible | Closing/resetting the form automatically |
| Uncertain mutation | Persistent owning/runtime recovery state explaining uncertainty | Generic Retry create button |
| Progress | Existing button/status area, or one updating notice for a long background operation | A new toast for every event/percentage |
| Success | Existing changed UI is often sufficient; optional concise notice | A toast for every settings keystroke |
| Created but open failed | Created result plus Retry open | Failed-create message |
| Cancel before write | Normal return to prior state | Error severity |
| Destructive confirmation | Explicit modal confirmation before the action | Confirmation represented only by a transient toast |

This table defines product choices, not properties automatically supplied by Obsidian Notice.

**NTF-03 — Ownership across views/windows.** Key handles by plugin instance, operation and owner, not a global singleton. One initiating action owns its success/error feedback; subscribers refreshing two views must not each emit the same notice. Native sinks use supported APIs and actual available window behavior. If Notice cannot be targeted to a particular pop-out through the public API, provide recovery in the owning view and document the native notice limitation; do not patch private managers to promise unsupported targeting.

Closing a view disposes view-owned progress and actions; confirmed mutation outcomes may move to a bounded runtime-level summary when that is the only way to preserve necessary feedback. Unload dismisses only the plugin's own handles. Never sweep the host notice container or affect another plugin's notifications.

**NTF-04 — Deduplication and bounds.** Same operation/kind/owner updates the existing message. Separate user attempts remain distinct. Background repeats may be coalesced by stable code/category, never raw title/path/text. Initial policy: at most three visible transient notices per plugin and ten queued transient requests, with a single overflow summary. Recovery state is retained in its owner; it is not silently dropped by toast overflow. These are tunable proposed defaults with tests, not host limits.

Notification deduplication does not erase error-ledger evidence. Progress completion replaces progress once, not progress plus success plus observer-created success.

**NTF-05 — Timing.** Avoid progress flashes: an optional initial 300 ms display delay is cancelable when work completes early. Initial optional informational/success lifetime is six seconds; work remains visible in the normal UI. Essential errors/recovery/actions are not available only behind an expiring timer. Keep them persistent or reproduce them in an accessible persistent owner surface. Support disabling routine success notices, not hiding critical recovery. No timer is evidence that a task was completed. [P04, P05, P06]

The native adapter must not assume `setMessage` resets Notice's duration. An implementation using host auto-dismiss delegates its actual behavior explicitly; an implementation owning timers uses a suitable persistent native notice and tested owner timers. Never operate two competing timers unknowingly. Screen-reader/focus/hover timing must be verified for the selected native API, or use a persistent alternative.

**NTF-06 — Accessibility and interaction.** Routine dynamic status uses a polite status region; urgent actionable error announcement uses alert sparingly. Do not give every banner and notice assertive semantics, announce the same message twice, or put static showcase text in an unsolicited live region. Alerts do not steal focus. Modal confirmation has real focus containment, an accessible name, Escape/cancel behavior as appropriate, and focus return; CSS or aria-modal alone does not implement modality. [P04–P07]

Required actions remain keyboard reachable with clear labels and visible focus. Disabled/unavailable controls explain why. Do not encode severity only by color. Test narrow reflow, long translations, forced colors, reduced motion, and meaningful text/control contrast. Screen-reader announcements require actual manual/native review; automated role assertions are not equivalent.

**NTF-07 — Native Notice adapter.** Use the public `Notice` constructor, `setMessage`, and `hide`. The inspected constructor takes a string or DocumentFragment and an optional duration; duration zero is persistent until dismissed. Semantic severity, queuing, progress, and actions are template policies, not invented Notice constructor options. [P08, P09]

Create safe text/owned elements for a DocumentFragment and localize all controls. Use public element references only where available in the declared host baseline. Do not depend on private lifecycle callbacks, scrape unrelated notices, insert raw HTML, or assign global CSS. Put any owned CSS in the composed plugin stylesheet, not in the host shim.

**NTF-08 — Harness adapter fidelity.** Browser and native sinks implement the same handle/state contract. The harness renders semantic host-like DOM under the harness root and uses the separate original host stylesheet. It models only supported behaviors and declares omissions. Tests must distinguish Notice adapter behavior from a static gallery's demo buttons. The gallery shipped with this revision is a styling specimen, not this adapter.

**NTF-09 — Localized safe copy.** Message parameters are typed and bounded. User-provided titles or values are plain text, not code/markup. Avoid including them in default high-level errors; detailed owner UI may show necessary context safely. Describe what happened, what was saved, and the relevant next action. Keep stable error/report IDs separate from localized prose. Changing locale updates visible template-owned messages through the selected supported handle path or explicitly documented refresh behavior.

**NTF-10 — Single-flight recovery.** Actions cannot execute twice from double clicks. Retry/open/details handlers use their original safe context, validate it still applies, and handle their own errors without creating recursion. Once the underlying entity/path changes, stale actions are disabled or revalidated. Dismissal only hides feedback; it never cancels a write, marks a problem resolved, deletes a document, or mutates canonical state.

**NTF-11 — Observer contract.** Tests can inspect notification IDs, kind/code, operation/owner, show/update/dismiss/drop lifecycle, and safe timing metadata, not raw sensitive payloads. Use injected clock/timer control and explicit flush/quiescence, not sleeps. Verify zero orphan timers/actions/listeners after reset, view close, and runtime unload. A stuck timer or missing terminal progress state fails even if the screenshot looks correct.

**NTF-12 — End-to-end scenarios.** Exercise inline invalid input; progress completion before/after delay; failure with retained draft; uncertain write without unsafe retry; committed-write/open failure; duplicate reporting across two leaves; notification burst; dismissal; stale recovery action; translation/redaction failures; modal focus; captured Vue defect; native Notice capability limitations; and teardown. All runtime claims require real services/native evidence, not the standalone stylesheet specimen.

## 4. Integration with existing services

DocumentCreationService keeps its create/prepare/commit and request-ID contracts. The UI maps its precise outcome; no service-core change per notification surface. `documents.created` updates projections; it is not a second success-notification request. Host create observations are not proof that the initiating call committed or that metadata indexing finished.

The typed event bus catches listener failures through its injected error sink. That sink does not publish an error event back onto the same bus. Error boundaries, notifications, and diagnostics are independently disposable and retain no whole component or vault objects after use.

Setup/makers reuse failure categories and safe reporting vocabulary where sensible, but bootstrap code cannot import Vue, Obsidian, a bundled runtime error service, or a not-yet-installed library. Its Node-only reporter remains small and produces CLI outcomes, not browser notifications.

## 5. Scope and delivery

The required feature is a small reliable baseline, not a notification center product. No automatic telemetry, OS push, persistent inbox, network retries, distributed tracing, or support-ticket upload is introduced. The runtime implementation and its tests remain pending after this specification/stylesheet iteration.
