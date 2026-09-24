# Framework lifecycle independent review

Three implementation agents completed a separate cross-owner review of actual
diffs and adversarial behavior: [A reviewed B](FRAMEWORK-LIFECYCLE-REVIEW-A.md),
[B reviewed C](FRAMEWORK-LIFECYCLE-REVIEW-B.md), and
[C reviewed A](FRAMEWORK-LIFECYCLE-REVIEW-C.md). Parent owns integration, authoring
contracts, consumer preservation, policies and frozen evidence.

| Finding | Correction and observed boundary |
| --- | --- |
| Retained Task actions mutate closed state and acquire persistence after awaited preflight. | Public action scopes and captured permits guard entry and preflight. Seven corrected product regressions; post-start committed/failed/uncertain outcomes stay truthful. |
| A cached result or detached DOM listener could hide missing guards. | Call-through actual composables, repository calls, frozen state and independent-entity unit tests exercise retained handles directly, including pre-cache checks and queued work. |
| Recovery test title promised live reload but initially covered only disposed reload. | Actual live reload reads saved uncertain bytes, supplies a fresh snapshot and allows a deliberate new edit; folder away/back invalidates the old permit. |
| Present JSON null and missing storage share the decoded absence sentinel. | Optional exact-JSON presence reader in store/native/browser; failing literal-null regression retained, corrected raw-byte cases pass. Legacy decoded-only ambiguity remains documented. |
| Character counts allow oversized multibyte documents. | Bounded framework-free UTF-8 scalar validation, complete serialized/patched candidate checks, exact byte boundaries and invalid Unicode tests. |
| Subsequent uncertainty was relabeled as a read failure. | Preserve uncertain effect/error, suppress further writes/facts, expose precise status/guidance, and wire generated settings to the shared error projection. |
| Async observer rejection escapes a synchronous catch. | Consume rejections without unhandled failures; runtime observation counts subscriber failures, lifecycle observation reports independently without giving observers resource capabilities. |
| Resource observers can reenter closure/replacement during acquisition or release. | Pair actual handles with successful cleanup receipts; detach prior registrations before callbacks, recheck exact ownership before acquiring successors, preserve replacement registries and outstanding failed cleanup. Multiple original red controls remain retained. |
| Final native ledgers could be recorded without validation. | Validate exact faults, sequence, loss and observer failures before detachment/reconstruction, retaining primary and cleanup errors separately. Native execution remains separately required. |
| A retained runtime observer could subscribe after unload; its first regression unsubscribed too early to prove the guard. | Reject post-disposal subscriptions and keep the attempted subscription present while emitting the control event. |
| Existing performance-parser fixtures used the older ownership report despite the new complete inventory. | First frozen CI rejected the fixture. Shared complete synthetic ownership data preserves the performance negatives and reaches their intended assertions; no validator was loosened. |
| A terminal zero-resource count could hide transient resource recreation after closure or unload. | A failing negative control reproduced acceptance of an acquire/release pair. Validate the complete later history for closed owners and reject any acquisition after plugin unload; the affected parser suite passed 15/15. |
| Removing the examples leaves intentional framework type exports without internal consumers. | Declare only the public authoring API as an analyzer entry; real negative fixtures still reject unrelated dead features and private implementation exports/types. |
| A failed native adaptation was mislabeled as a candidate-source mismatch. | Preserve the first execution/adapter failure; two red controls reproduce masking and the corrected three-case plus two real-CLI integration checks pass. Raw failure/identity receipts remain. |
| Native global require cannot import the plugin-scoped host API. | Use a separate qualification plugin's supported import and owned commands; keep its source/installed hashes separate and the candidate observer read-only. Fresh native execution remains required. |
| Inherited fresh configuration paths were outside the codebase and cleanup could overwrite errors. | Scope the launcher's public temporary-directory environment, validate returned paths, sample current resources at each launch and preserve primary plus subsequent cleanup failures without ancestor retry. |
| The contained temporary prefix made Chromium's singleton socket path too long on Linux. | Preserve the original startup failure, use a short contained `.nq/<six>` namespace, and preflight the qualified host's UTF-8 socket-path budget before launch; do not escape containment or retry the rejected path. |
| Public CDP returned no usable retained-handler selection with an unnamed node group. | Match Chromium's named-object-group contract, retain safe selection counts and all cleanup errors, and exercise the same helper through served Chromium before the next native attempt. The original ambiguous report did not record zero versus multiple listeners. |

The final C affected batch passed 34/34 tests in four files, including all sixteen
reentrancy controls; four tooling ledger negatives passed. Earlier 40/40, 49/49
and 53/53 checkpoints remain scoped to their then-current source. A's integrated
batch passed 34/34 in seven files. B's first corrected batch passed 66/68, with
two literal expected-field-order fixture errors; corrected recovery passed 4/4.
All original failures remain under `reports/framework-lifecycle`.

Parent inspected public API availability, raw-reader host paths/single-writer
ownership, permit caching/preflight/outcome semantics, exact byte assertions,
observer lifetime and native driver boundaries. Reviewed example removal retains
the generic framework, settings/observation tests and independent Experiment entity;
it removes the actual Task component regression and showcase-only native helper.
Generator and foundation templates preserve the new capabilities. Full checks and
consumer qualification are owned by the [execution record](../testing/FRAMEWORK-LIFECYCLE.md).

No review result promotes incomplete acceptance. At the initial review checkpoint,
the native UI exercised
ordinary notice expiry, modal, sibling and foreign Notice ownership; native delayed
progress, pending recovery and forced late callbacks were explicit gaps. The
subsequent agreed amendment adds the real modal-backed recovery recipe, a public-CDP
retained native callback control and same-turn delayed-progress cancellation.
Its additional source review and execution receipts belong to the current record;
the initial passing tests above do not qualify those later changes. Source
review and unit/native doubles do not substitute for those modes or release authority.
