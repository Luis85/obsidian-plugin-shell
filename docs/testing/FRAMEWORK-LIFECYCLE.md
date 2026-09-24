# Framework lifecycle and recovery execution

Baseline: merged PR #14, clean main `9a56505`, topic branch
`codex/framework-lifecycle`. The [plan](../development/FRAMEWORK-LIFECYCLE-PLAN.md)
records three actual implementation owners and a separate cross-owner review.
The [review record](../development/FRAMEWORK-LIFECYCLE-REVIEW.md) retains concrete
findings, reproduced controls and correction scope.
The [framework guide](../development/FRAMEWORK-GUIDE.md) documents the available
developer contracts and their boundaries. Prior qualification remains bound to
`7f14292871efb07ddace131fb9b5603de4122394`: 2 verified / 55 partial / 39 not-run.
Current frozen qualification is pending in this implementation checkpoint.

## Implemented scope

- A reusable framework-free action scope and read-only permits, integrated with
  the actual Task editor and shared note update/delete preflight. Once a write
  starts, its actual durable result survives owner closure. Note projections
  retain explicit reload; sibling drafts stay independent.
- Distinct protected-storage statuses and recovery guidance, truthful uncertainty
  on subsequent blocked operations, and a presence-aware exact-JSON reader. Native
  reads use public vault APIs; all saves still use the one shared host writer.
  Legacy decoded readers retain their documented sentinel ambiguity.
- UTF-8 byte bounds on projected body and complete serialized/patched Markdown,
  including invalid-surrogate rejection and pure preview.
- Read-only resource/error observation without production test globals or mutation
  capabilities. Independent ledgers retain exact faults, loss and sequence checks.
  Native pending-recovery/delayed-progress clauses remain distinct from actual-service
  tests; see the [native record](FRAMEWORK-LIFECYCLE-NATIVE.md).
- Author-facing exports, notice/recovery capabilities, precise generated setting
  guidance and documentation supporting consumer features after example removal.

## Retained development attempts

Fresh installation used Node 24.21.0/npm 11.19.1 and
`npm ci --strict-allow-scripts`: 693 packages, zero audit vulnerabilities. Its log
is retained in `reports/framework-lifecycle/install.txt`; this does not substitute
for the separate live security gate.

A's first 13-case retained-action run had seven real guard/preflight failures and
six fixture failures from an incorrect spy API assumption. After correcting only
the fixture's call-through capture and literal codec formatting, the second run
had seven product failures and six passing post-start persistence cases. Both logs
remain. B's five initial cases reproduced character-count overflow and imprecise
storage/uncertainty state. A separate present-JSON-null regression failed before
the raw-presence correction. C's initial 40 runtime/four tooling cases passed;
the independent review then reproduced three reentrant observer cleanup failures.
Corrections and affected reruns remain separate from these original attempts.

B's first corrected 68-case run had 66 passes and two fixture expectation failures:
the expected literal preference field order differed from the canonical serializer.
The expected bytes were corrected explicitly; no serializer change was made to
obtain a pass. Native/Windows historical failures are never superseded by these
development checks.

Integrated development build, strict types, independent source lint, structural
checks and full zero-finding analyzer passed. The local type-aware ESLint attempt
was interrupted after confirming its exact owned process/parent under shared-host
memory pressure (368,644 KiB free); no unrelated process was stopped. Its receipt
and empty partial output remain, and the full check moves to prescribed hosted
verification. An initial direct security-script invocation correctly rejected the
missing npm execution context; the proper qualified `npm run check:security`
subsequently passed with zero vulnerabilities across all installed categories.

Nine native observation/report parser controls passed, including the actual
trusted adapter path, closed nested schemas, exact counters and independently
valid but rewritten checkpoint histories. The first full trusted runtime attempt
observed 384/385 passes, with one filename-guidance regression: a lone-surrogate
title also made the projected body invalid, so the new UTF-8 check hid the existing
title-field error. Preserve filename validation priority while still validating
both body and complete Markdown before persistence. The failed packet remains in
its original source session and cannot establish current acceptance.

## Qualification and remaining limits

First frozen source `5d94a143d24449fc8ed13724cc8a4ee611af95f6` was pushed in
[PR #15](https://github.com/Luis85/obsidian-plugin-shell/pull/15). Its
[candidate run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36003179773)
stopped during the actual tooling producer: 192 cases, 187 passed, four designated
Linux platform skips and one failed performance-parser fixture. That existing
fixture constructed the older native report shape while using the current check
inventory, so the stricter ownership validator correctly rejected it before the
intended performance assertions. Runtime/coverage/browser/native qualification
stages were skipped; no accepted candidate or acceptance advancement is claimed.
The first consumer and compatibility runs encountered the same fixture failure.
Both baseline jobs passed; the candidate's live all-category security audit passed.

The failed artifact is preserved locally and matches GitHub artifact 10808988302,
SHA-256 `4c9330b6da99c8ba18a52879fee52e13a8564c9e1746bde529fe3ca440a99b71`
(188 entries, no font-named files). A shared explicit synthetic ownership fixture
now supplies the complete schema to both parser suites, retaining every original
performance negative. The exact failing test was reproduced locally and corrected.

A separate negative control reproduced a validator gap: a closed owner's late
acquire/release pair could return the terminal resource count to zero. Check the
entire later history for revoked owners, and reject any acquisition after plugin
unload. Controls distinguish transient acquisition before unload from sibling/new
owner acquisition after unload. The corrected combined parser suite passed 15/15,
and the full analyzer/source checks passed. These are protocol/parser corrections,
not evidence that a native runtime actually resurrected UI.

The filename-guidance correction passed both affected files (7/7). The final
optional recovery demo passed 27/27 focused runtime cases and 11/11 public-CDP/
parser controls. After two measured 11-complexity notification functions were
split into cohesive resource-update/completion helpers, the affected 41-case
batch passed; a new read-only health diagnostic found no production function
above 10 cyclomatic / 15 cognitive. This diagnostic is not the complete isolated
maintainability gate. The full diagnostic's nonzero exit retains tooling/template
findings; an initial combined stdout/stderr reader failed on its warning prefix,
then a read-only extraction inspected the retained JSON without rerunning it.

The final development build and strict compiler check passed. Adding the optional
operation field to the public feedback projection fixed three compile failures in
the new actual-service consumer tests. Observer callbacks now accept ignored
return values (`unknown`) and consume promises/thenables with independent rejection
handling: ordinary Array.push sinks and asynchronous callbacks remain supported.
This corrected four strict promise-lint failures without suppressing lint rules.
Production and affected fixture lint, source/locale/architecture/presentation,
repository checks, full zero-finding analyzer and the 92-entry reviewed removal
plan passed at their recorded checkpoints; harness build passed with its retained
nonblocking chunk/plugin-timing warnings.

Browser provisioning attempts are separate prerequisite failures: the default
shared cache and then one fresh worktree-contained cache both failed at the
unchanged Playwright lock stale threshold while downloading Chromium. The latter
rejects shared-cache location alone as an explanation; it does not prove the cause.
No browser test ran in either attempt, no lock was manually removed and no threshold
was changed. Both logs remain. Served/native/full verification therefore belongs
to the prescribed fresh hosted qualification, not these local attempts.

The crosswalk adds 25 reviewed unit/partial links whose exact assertions passed in
the retained 384/385 development packet. All 96 rows/modes and 117 original links
remain unchanged. Four overbroad descriptions were independently corrected to
their actual assertion scope. The failed packet establishes zero acceptance
advancement; current full-session evidence is still required for every link.

The final evidence update must record exact full verification, producer packets,
candidate hashes, code/evidence SHAs, generated-consumer/archive results, check
status and current acceptance. Until then this record makes no current-source
acceptance advancement claim. All 96 cases/modes, baseline, separate Nuxt matrix
and blocked release remain unchanged. No publication or merge is authorized.

## Second frozen attempt and demonstrated corrections

Source `d4c8c5fe4cde4211fb3f12ad07f70460f63d52ee` completed all 23 offline
verification stages, 398 runtime cases in each of three fresh processes, a separate
398-case production coverage producer, 47 served-browser cases and the live security
gate. The actual tooling producer reported 190 passes and four designated Linux
platform skips. An independent read-only audit matched all 593 source files to Git,
rehash-checked all 26 raw receipts from eight registered attempts, and checked 12
maintainability reports plus 414 per-input receipts. All 103 production inputs and
47 selected-core inputs met coverage floors; 863 production functions had no gate
findings, with duplication 33/4740 (0.6962%). These completed stages do not make
the complete candidate session pass.

The cancellation request for [run 36005818649](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36005818649)
raced with native startup. Obsidian 1.13.7 **did launch**, and eight native checks
completed before the foreign-notice fixture failed: renderer-global
`window.require('obsidian')` could not resolve the plugin API. The failed raw report
has the correct candidate source SHA. The wrapper subsequently replaced its adapter
failure with `EVIDENCE_CANDIDATE_SOURCE` because there was no adapted result. Preserve
both original outputs; the correction preserves the first execution/adapter failure
and retains source/asset identities for further inspection. Three focused controls
include two reproduced red cases before correction. None of these report/parser
controls is native execution evidence.

The inherited launcher used a fresh OS-temporary configuration outside the codebase.
That did not meet this increment's explicit containment requirement. Subsequent
launches scope the public launcher's temporary-directory environment to a fresh
canonical contained run directory, restore the environment after the awaited call,
and validate the actual returned vault/configuration paths. Fresh resource snapshots
are taken immediately before each initial/restart launch. Windows load averages
are explicitly unavailable; samples are shared-runner diagnostics, not an idle-host
or performance-budget qualification. Failed attempts retain scratch state; cleanup
preserves the first error and all later cleanup errors and does not recursively
remove an ancestor after a configuration cleanup failure.

The foreign-notice correction installs a separate, owned qualification fixture
plugin in the isolated vault. Its public plugin module imports Obsidian normally;
its own commands create, update and dismiss its own persistent Notice. Its source
and installed hashes are recorded separately from candidate assets. The candidate's
runtime observation remains read-only and no production test global is introduced.

The failed candidate artifact is retained as GitHub artifact 10811171175, SHA-256
`aac8c10a5a10789137ebed1409eb2337c2208d3adb8f38bbe159f4b2a8681da9`.
Its failed full-session reconciliation grants **0 verified / 0 partial / 96 not-run**;
this failed-attempt result does not replace the historical qualified **2 / 55 / 39**.
Five additional partial links record actual passing served/component recovery
assertions from that source; all 96 required-mode sets and historical links remain.

[Consumer run 36005818876](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36005818876)
passed its initial, edited-feature and literal Git-free archive verification stages,
then failed after reviewed removal because three intentional public type exports
had no remaining example consumers. Declare only `src/features/api.ts` as a public
analyzer entry, retaining developer contracts in the empty foundation. A real
checker regression accepts that API and still rejects an unrelated feature file,
private implementation export and private type. No implementation directory is
excluded. The failed consumer artifact 10810968011 is retained with SHA-256
`53293ff81a44bdb49fd430b63e40f60170fad71a18f08dffb7f182691e92a8cd`.
Fresh qualification of the corrected executable/policy inputs remains required.

The correction checkpoint passed 29 serialized native-isolation/receipt/parser/
fixture tests, the existing performance-fixture integration, two real evidence-CLI
controls, full source/analyzer/repository checks and the 103-input production lint
gate. The 94-entry removal dry run includes both new foreign-fixture files. The
foundation failed-attempt test first failed because it expected scratch deletion;
its updated assertions require two distinct preserved scratch directories, original
report/log bytes, no provider and no launch samples. That corrected real-driver
pre-provisioning test passes; no local host was launched.

Frozen `d6649938a47ab569171ff40f509cb54609df4ba4`, candidate run
[36009968062](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36009968062),
stopped at tooling: 210 cases, 205 passes, four expected platform skips and one
`ANALYZER-ARCHIVE` failure. Its fixture packaged the executable-source inventory but
omitted separately hashed evidence-policy JSON. The new explicit policy URL in a
parser test made that missing archive dependency visible to Fallow. Package both
policy files explicitly and assert their original/extracted byte parity; do not
hide the dependency with an opaque path or ignore. The existing negative archive
checks remain. Both consumer runs found the same failure during initial setup;
all later candidate browser/native stages were skipped. Live security passed.
Artifact 10811754621 retains SHA-256
`fe0b2e89980d810ad47b118e703f40f1dde75ec9a90954e65b6d50adbf628557`.
This source has no accepted candidate or acceptance promotion.
The exact archive failure was reproduced locally. The corrected focused archive
test passed with all ten command receipts and both original negative probes;
`archive-policy-red-01.txt` and `archive-policy-green-01.txt` remain retained.
