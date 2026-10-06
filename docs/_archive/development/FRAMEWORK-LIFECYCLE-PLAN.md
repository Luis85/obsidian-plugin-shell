# Framework lifecycle and recovery increment

Live baseline, 2026-09-24: PR #14 is merged at `e0ddd845b32ecbe7a419575330a20ee328a065bd`;
all eleven reported head checks passed. Clean main was fast-forwarded to
`9a56505`. Work is isolated in `.worktrees/framework-lifecycle`, branch
`codex/framework-lifecycle`, from origin/main. No `.codex/` exists. Preserve all
earlier worktrees, assets, reports and failed attempts, including the explicitly
protected cleanup-masking directory. Historical acceptance is 2 verified,
55 partial and 39 not-run; changed inputs require fresh qualification.

The owner also requires a usable template/framework for rapid plugin iteration.
Corrections therefore expose small reusable authoring contracts, demonstrate
their use in real consumers and document safe extension boundaries. This is not
a broad platform, migration, dependency or release project.

Review amendment: A reproduced an additional boundary gap: decoded JSON null is
indistinguishable from the legacy absence sentinel. Parent and B agreed an additive
optional exact-text `SettingsStorage.read(): Promise<string | null>` before the
correction. Native/public vault and browser adapters implement it; the store parses
present text and protects present null as corrupt. The canonical writer remains
unchanged. Legacy decoded-only consumers keep their explicitly limited convention.
The corresponding failed regression and native-adapter boundary controls must be
retained. Parent owns adapters/ports, B owns store parsing and reconstruction tests.

Native closure amendment, agreed before further edits: absence of an existing UI
caller is not itself an unavailable environment prerequisite. Add a small optional
showcase recipe demonstrating a real confirmation modal, delayed progress and a
recovery action whose side-effect-free availability awaits that existing modal
outcome and checks an action permit. C owns the composable, binding and focused
tests; parent owns locale/template/ownership integration. Native qualification
retains the actual native Notice listener through public CDP APIs, invokes it while
the modal is unresolved and after owner closure, and measures exact independent
resource/fault receipts. A separate same-renderer-turn start/close control verifies
that delayed progress never acquires a late sink. No production test global or
mutation capability is exposed through observation. B reviews this bounded
addition before candidate freezing. Earlier pre-demo native gaps remain historical.

## Selected clauses and demonstrated gaps

| Cases / required modes | Actual source finding and closure criteria |
| --- | --- |
| AC-05/62/66: unit, browser-integrated | Task editor `run` checks busy, not liveness; `edit` has no guard. Shared repository rechecks runtime disposal after awaited preflight but cannot see initiating-owner closure. Retain actual composable handles; prove no acquisition before mutation, exact outcomes after storage begins, unchanged disposed state, sibling drafts and explicit note reload. Add read-only operation permits, never cancellation of an already-started write. |
| AC-07: unit, browser-integrated | Store collapses malformed/future/load failure/uncertain-save into one blocked boolean. Existing saved-byte reconstruction, opaque records and failure suppression have assertions. Add precise observable status/guidance while preserving original values, zero initialization writes and uncertainty lockout. Native adapter classification must reflect observed API behavior; unknown read failures cannot be advertised as absent/corrupt. DAT-02 migration remains separate. |
| AC-05/62, DOC-18: unit, browser-integrated | Creation and Markdown reader use UTF-16 length although document contract requires byte budgets. Add bounded framework-free UTF-8 validation, ASCII/multibyte/exact boundaries/invalid Unicode and full candidate revalidation before write. Preview remains pure. |
| AC-11/46: unit, browser-integrated | Preserve actual persistence facts, independent owners and runtime isolation. Broaden only observed assertions; no inferred refresh of the explicitly reloaded note projection. |
| AC-71: component, browser-integrated, native | Native diagnostic snapshot is a bounded production buffer, not independent caught-error evidence. Existing production UI does not register recovery actions. Add read-only observation at real resource/action/error boundaries; component tests qualify pending availability. Native experiment covers actual reachable public UI and foreign Notice. Any native action clause that cannot be exercised on exact accepted assets remains explicit, never substituted by a separately rebuilt fixture. |

## Agreed contracts and exclusive ownership

- Parent owns framework-free `ActionScope`/`OperationPermit`, authoring exports,
  shared repository permit integration, ports/bootstrap, locales/settings guidance,
  configuration/workflows, ownership hashes, crosswalk, docs, source freezing and delivery.
  A permit exposes only `active(): boolean`; an owner can capture, invalidate and
  dispose its scope. Repository update/delete check it at entry and after preflight;
  once storage starts its real result survives closure.
- A owns `use-task-repository.ts`, retained-action component regressions and their
  dedicated fixture. Capture real composable handles with call-through interception;
  assert frozen state and storage calls so deduplication cannot hide a missing guard.
- B owns `plugin-data-store.ts`, `preference-service.ts`, `domain/utf8.ts`,
  `document-service.ts`, `infrastructure/markdown.ts`, precise-recovery and document
  byte-boundary tests. Read-only status is unloaded/absent/ready/corrupt/future/
  inaccessible/uncertain. Preserve compatible failure keys where possible; uncertainty
  must remain effect uncertain. No historical schemas or automatic migrations.
- C owns narrow resource observer implementation, notification/modal instrumentation,
  observer tests, native driver helper and native investigation record. Agree exact
  observation type before parent wires ports/bootstrap. Observation conveys safe
  metadata only, no publisher, mutation, recovery or service capability. Failed
  cleanup must not look like successful resource release; independent faults retain
  exact codes/counts and loss/overflow counters.

Three implementation agents first inspect, then implement these agreed boundaries.
Separate review wave: A reviews B, B reviews C, C reviews A. Parent reviews actual
integration and generated-consumer preservation. Reproduce findings, correct them,
and retain all red/diagnostic/fixture attempts separately from product results.

## Commands, experiments and delivery

Use Node 24.21.0/npm 11.19.1, fresh exact-lock strict installation. Serialize heavy
commands. Run focused positive/negative tests, strict types/source/architecture/
presentation/catalog/analyzer gates, complete `npm run verify`, trusted runtime and
served-browser producers, live all-category security. Generated consumer, edited
feature preservation, reviewed removal and literal archive are affected and required.

Before native work check available memory/processes; never stop unrelated work.
Use explicitly provisioned isolated codebase-contained vault/config and frozen
candidate bytes. One selected native ownership experiment measures actual handles,
sibling and foreign Notice retention, owner close/unload, late callbacks and an
independent fault ledger before reconstruction. Preserve its first failure and
analyze before any further experiment. Existing timeline/receipt tooling suffices
for the four distinct historical Windows Appearance, Linux pop-out, Windows coverage
timeout and archive EBUSY classes. A later pass proves none of their causes.

Freeze corrected executable/policy inputs and retain candidate provenance/hashes;
hosted read-only qualification may perform the heavy full-source/consumer/native
flows. Every current crosswalk link must match an observed trusted assertion.
Retain all 96 cases/modes, baseline, Nuxt matrix and blocked release. Separate later
evidence-only commits; push and open/attach a reviewable PR, inspect checks, report
code/evidence identities and precise remaining scope, then ask the owner for the
next step. No merge, tag, publication or permission change is authorized.
