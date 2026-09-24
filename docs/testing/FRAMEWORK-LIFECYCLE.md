# Framework lifecycle and recovery execution

Baseline: merged PR #14, clean main `9a56505`, topic branch
`codex/framework-lifecycle`. The [plan](../development/FRAMEWORK-LIFECYCLE-PLAN.md)
records three actual implementation owners and a separate cross-owner review.
The [review record](../development/FRAMEWORK-LIFECYCLE-REVIEW.md) retains concrete
findings, reproduced controls and correction scope.
The [framework guide](../development/FRAMEWORK-GUIDE.md) documents the available
developer contracts and their boundaries. Prior qualification remains bound to
`7f14292871efb07ddace131fb9b5603de4122394`: 2 verified / 55 partial / 39 not-run.
Final qualified code/policy is
`17d0f5bbea700612762b2a8c1eb467b9d66c8d95`: **2 verified / 55 partial / 39 not-run**,
with **151/151 links observed** and no whole-row promotion. The
[candidate audit](evidence/framework-lifecycle-candidate.json) and
[retained-attempt index](evidence/framework-lifecycle-attempts.json) preserve exact
provenance and scope. The earlier 1c20f7b qualification below remains a distinct
147-link checkpoint; documentation updates after 17d0f5b are evidence-only.
The separately identified [consumer audit](evidence/framework-lifecycle-consumer.json)
qualifies all five generated-consumer/archive stages on that same final code head.

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

Frozen `d8826fd3bf6a58ac06c171f8cf508ceab28dc48a`, candidate run
[36010839664](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36010839664),
passed the complete offline rehearsal, three runtime repetitions, separate coverage,
served-browser qualification and native-provider provisioning. Its first native
producer failed before connecting to a renderer or executing any check: Chromium
reported `Socket path too long` for the 133-byte singleton socket pathname beneath
the contained temporary directory. No further native session or performance run
started. The one prelaunch sample recorded 15,331,536,896 free bytes of
16,765,378,560 total bytes and four available processors; it does not imply idle
conditions. The separate witness source and installed hashes matched, cleanup
reported no further error, and the failed scratch directory was preserved.

Artifact 10812998302 is retained with SHA-256
`28a097386387eb8df6057c02f530028162ec19c246772b5b9f4e7e2e6de19156`.
The retained offline candidate record hashes to
`1bcede111179aeef655c8ef689ee8363edfaebbe7042d93c9a0fe7316c4ecbfe`;
all three asset bytes match d4c8c5 exactly. Asset equality does not reuse earlier
source/policy qualification. The complete d882 session remains failed.

The bounded next experiment shortens the dedicated contained temporary namespace
and preflights the platform's socket-path budget. It keeps all candidate asset
bytes and the original resource experiment unchanged, retains earlier scratch
directories, and must stop on its first native failure for analysis. It will not
fall back to OS-temp configuration, a symlink alias or an unrelated host vault.
The short-path correction passed 13 focused tests, including the real overlong
contained-directory wrapper control under an explicit tooling-only Linux platform
argument, exact UTF-8 boundaries, environment restoration, lock reuse and original
failed-attempt retention. Production driver calls use the actual platform by
default. Full source/analyzer/repository checks passed; these local controls do not
claim a successful Linux kernel socket or native host launch.

Frozen `a5c4aac191c61a6f868ec39bc3431ab661111d0d`, candidate run
[36014645907](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36014645907),
passed offline verification, runtime 398×3, coverage and 47 served-browser cases.
Tooling reported 208 passes and four designated platform skips. The short-path
experiment reached Obsidian 1.13.7 (Chrome 150.0.7871.212 / Electron 43.3.0): nine
native checks completed, including real same-turn delayed-progress cancellation.
It then failed with `NATIVE_RECOVERY_HANDLER_AMBIGUOUS` before pending availability
or retained-handler replay. No subsequent session or performance run started.
The independent resource history retained 16 records, with no faults, lost events
or sequence gaps; this interrupted history does not prove owner-close/unload cleanup.

Artifact 10814174196 is retained with SHA-256
`d1e7e84271aca6adaae9e83e9936cb1d7de5bd6d5784b379a0e16e13da0717f6`.
All 602 source files and 26 raw receipts across eight attempts were independently
checked; failed-session acceptance remains suppressed. The original report did not
retain listener counts, so it does not establish zero versus multiple listeners.

The [matching Chromium implementation](https://raw.githubusercontent.com/chromium/chromium/150.0.7871.212/third_party/blink/renderer/core/inspector/inspector_dom_debugger_agent.cc)
exposes handler references only when the queried node belongs to a named object
group. The driver omitted that group. Correct the public-CDP contract with a unique
group, release the group and connection on every path, preserve primary and cleanup
errors, and report safe listener counts on further selection failure. A source-matched
protocol double reproduced the old failure. The next bounded experiment also uses
the same helper in the served recovery test, preserving its original `onclick`
retention assertion; served Chromium remains distinct from native Obsidian evidence.
The grouped protocol/parser controls passed 15/15; strict type checking, targeted
served-test lint, source/analyzer/repository checks and the 95-entry removal plan
passed. The lint process briefly left about 200 MiB free memory but completed
naturally with exit 0 before an attempted guarded stop; no process was terminated.
The new declaration file is removed together with the optional native helper and
recovery demonstration. The corrected browser/native paths still require fresh CI.

## First complete frozen qualification

[Candidate run 36019321164](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36019321164)
passed at `1c20f7ba00f997953d2c4dcfd252c4e6edba04ff`. The independent audit matched
all 603 archive files to Git blobs, all 10 registered packets and 32 raw receipts,
and the exact CI acceptance report. Qualified Node 24.21.0/npm 11.19.1 installed the
committed lock through strict policy; all 23 verify stages passed. Tooling had 210
passes and four designated Linux platform skips. Runtime passed 398 cases in each
of three fresh processes; separate production coverage also ran 398 cases, and
served Chromium passed 47 cases including the real grouped-CDP recovery helper.
The 52-case legacy baseline passed in all three repetitions; release remains blocked.

All 103 production and 47 selected-core coverage inputs met their unchanged gates.
Independent maintainability validation rehashed 12 raw metric reports and 424
per-input receipts: 863 production functions had no function-gate findings, with
33/4740 duplicated lines (0.6962%). These records establish the defined gates, not
universal maintainability or supported dependency peers. Live all-category security
passed with zero vulnerabilities; the retained nested ESLint support exception stays.

Three fresh native sessions passed all 37 checks against identical candidate and
installed asset hashes. A separate shared-runner performance session also completed
the protocol and retained all 66 samples: p95 initialization 16.8 ms and item
readiness 103.9 ms. These are advisory shared-runner measurements, not idle-reference
or Windows budgets. Eight prelaunch resource snapshots and each foreign fixture's
source, installed and report-copied bytes matched. Each run used two independent
experiment ledgers (Items and resources) with eight checkpoints, for 32 checkpoint
snapshots across four runs. These are not 32 independent observation channels.

The native ledgers retained exact expected faults, zero loss/gaps/observer failures,
real owner-close/unload cleanup and unchanged late-handler replay. Native action
calls were two while availability was pending and one after closure. The Items
write rejection remains a controlled adapter inside the host, not a native disk
failure. No renderer or cleanup failures were captured. Each complete host log still
contains two GPU-process fatal messages and two host-labelled ignored ENOENT config
messages, spanning initial and cold launches. Those messages remain preserved;
passing UI assertions do not make stderr empty or explain historical host failures.

Artifact 10816019245 has SHA-256
`4bddaeefd6330148d070232f5a03bec13f5c240e756f0d9c1aff16a044800974`.
The retained candidate, installed native files and packaged plugin match:

| Asset | SHA-256 |
| --- | --- |
| main.js | `ef43606fc3b4e208e6cc2a2f0c3e6efd9439a3d6b8d1d5cca1f4c69483a3bac9` |
| manifest.json | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |
| styles.css | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |

Both d8826fd and a5c4aac consumer checkpoints independently passed all five full
verification stages: renamed setup, edited Bookmarks, literal Git-free archive,
reviewed removal and a new Reading feature. Their production source and asset bytes
match, while Git trees and execution inputs differ; neither run substitutes for the
other. The 1c20f7b direct consumer also completed all five stages: 398 setup, 411
edited-feature, 398 archive, 331 foundation and 339 Reading tests, each in both
coverage runs. Served stages passed 47/2/2 cases. Its audit verified six packets,
19 raw receipts, 60 metric and 2129 per-input receipts, all 44 uploaded source files,
all ten new demonstration removals and nine unchanged generic tests that executed.
Bookmarks remained byte-identical through Reading. Artifact 10817810533 has SHA-256
`08819a3fe27b6787d177618e3f9bea83af21706adfce0edf80e85e279c0d0a8b`.
No consumer native-host qualification is inferred from these browser flows.

The four new native links are observed partial assertions for AC-71. Together with
the 30 unit/component/browser additions, they strengthen AC-05/07/11/46/62/66/71
without promoting any whole row. All 96 rows/modes, 117 historical links, the Nuxt
matrix and blocked release are retained. The final crosswalk policy must be frozen
and requalified; this successful earlier source is not relabelled as that execution.

The final freeze also corrects a demonstrated CI-trigger gap: the prior blanket
documentation exclusion skipped the crosswalk, native check catalog, baseline plan
and design-token JSON even though they are execution inputs. Ordered include/exclude
paths now re-include those four files while narrative/evidence-only documents retain
their existing lighter checks. The focused trigger regression failed on the original
filter and passed after correction, including hidden executable configuration and
negative narrative paths. Pattern ordering follows the [GitHub workflow contract](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore).
Only this qualification trigger and its regression change executable inputs beyond
1c20f7b; implementation source remains identical. Static checks preserve all 96
mode sets, every exact historical link and the blocked release, with 34 new partial
links and no execution evidence supplied to that static validation.

## Final code/policy qualification

[Run 36023921226](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36023921226)
completed successfully on `17d0f5bbea700612762b2a8c1eb467b9d66c8d95`. A fresh exact-lock
strict installation and all 23 verify stages passed. Independent review matched
all 604 archived source files to Git and revalidated every one of the 10 registered
packets and 32 raw receipts. The final counts are tooling 211 passed plus four
designated platform skips, runtime 398×3, separate coverage 398, browser 47, and
native 37×3. The 52-case historical baseline passed three times. No retry or failed
packet was discarded from the final session; earlier failed sessions remain separate.

All 103 production and 47 core inputs met the unchanged coverage floors, including
the independent business scopes. Twelve metric reports and 425 per-input receipts
validated 863 production functions and 0.6962% duplication. Live security passed
with zero vulnerabilities across all categories. The nested ESLint support exception
remains unresolved; audit success is not dependency support.

The final native audit retained three distinct original sessions and a separate
performance run, with all 37 checks in each. Every source/installed witness hash,
all eight prelaunch snapshots and both independent experiment ledgers per run were
validated. The exact controlled Items write fault remains separate from native disk
I/O. Resource ledgers have zero faults, losses, gaps and observer failures; late
handler calls leave the closed state unchanged. No renderer or cleanup failures
were captured. Full host logs still retain their GPU-fatal and host-ignored ENOENT
messages. Advisory shared-runner p95 is 9.90 ms initialization and 121.70 ms item
readiness, from all 66 retained samples; no reference/device budget is qualified.

Final artifact 10818418842 has SHA-256
`7c5c84546d43a856a3cf229dee9a62b8f571c626b878b4b83ce48b1dcd6a98a3`.
Candidate record SHA-256 is
`4b6f9b6ddb072db3af4f18c67e7429e1835b260a4a5ecb2081771ee5a51df41d`.
The three actual asset hashes in the preceding table remain identical and were
rechecked against retained, installed and packaged bytes. Source-input digest is
`f7cf32445072e59622021c778b42024f2bec7b5a6344ff67f6168d2e4144b642`;
execution-policy digest is
`7354f171144d51542161a3e2505d650ccfca25386a35f58199fd0532c8b451b9`.

Exact acceptance recomputation matches the retained CI report: previous and current
**2 verified / 55 partial / 39 not-run**, AC-03 and AC-06 verified, all 151 links
observed. The 34 added partial links strengthen AC-05/07/11/46/62/66/71. None is
promoted merely because its suite passes. All 96 required-mode sets, every exact
historical link, the separate Nuxt matrix and the blocked release remain.

Remaining groups overlap: E (existing assertions/current evidence) 89 rows;
A (missing complete assertions/mode binding) 91; I (implementation) 5;
Q (native/manual/environment qualification) 32; X (external/owner prerequisites) 10.
Implementation gaps include ordered migrations, complete locale behavior, retained
event-envelope requirements and release/listing surfaces. Environment work includes
reference timing, secondary-window/partial-startup coverage, screen readers and
physical devices. External work includes supported dependencies and separately
authorized publication/listing. These counts describe remaining acceptance clauses,
not missing source files or a release authorization.

Historical observations stay distinct: the earliest Windows Appearance control was
Light with a dark main view; a later failure showed Dark; Linux illegal-access
errors were received during pop-out closure; Windows UI-03-04 coverage timeout and
archive EBUSY remain separate unresolved facts. Driver receipt time is not renderer
throw time, observation ends at CDP disconnect, and EBUSY proves neither a prior
timeout nor an orphan. Current Windows source checks and Linux served-browser checks
are not fixed-byte Windows native qualification, and later Linux passes do not
explain historical causes.

## Final consumer and next increment

[Consumer run 36023921215](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36023921215)
passed all five stages on the final code head. Setup/edited/archive/foundation/Reading
runtime counts were 398/411/398/331/339, each in both coverage runs; served stages
passed 47/2/2 cases. The final consumer has 108 production inputs and 339 tests in
74 files; the literal archive has 103 inputs and 398 tests in 69 files, with its
Git-free identity retained. The new qualification-trigger assertion ran in every
verification stage. Six packets, 19 raw receipts, 60 metric and 2134 per-input
receipts plus 44 uploaded source files were independently checked.

The exact edited Bookmarks hash
`ba9b3f20d82192311eb7b409a36ef65037ac07a45fdaa87900f6d8dbff51fced`
survived reviewed removal and the Reading extension. All ten added demonstration
files were removed; nine generic framework tests remained byte-identical and
executed. The 95-entry removal inventory preserves consumer files. Artifact
10820165690 has SHA-256
`2ea06776f75025f696035f21a395fdbbc179ef6cf1fef4801a95bef7990de3bd`.
Different Git/execution identities and equal production-source/asset bytes are
reported separately; all checkpoints executed independently. No consumer native
host, archive browser or physical-device qualification is inferred.

Recommended order for the next owner-selected increment:

1. Audit complete clauses for the strengthened lifecycle/recovery rows, particularly
   partial startup and secondary-window ownership, before promoting whole extents.
2. Select a bounded implementation gap: ordered migrations, complete locale
   behavior or retained event-envelope metadata; avoid a broad platform rewrite.
3. Provision candidate-bound Windows/reference and manual accessibility/device
   experiments with preserved first failures and explicit observation boundaries.
4. Review upstream dependency support and remaining release/listing requirements;
   publication, permissions and promotion still require separate owner authorization.

All twelve code-head checks passed: candidate, both consumer runs, both baseline
platforms, both showcase platforms, four installer-compatibility combinations and
the security check. Main remains clean on `9a56505ee3af90583d5e057774705078d6e99aff`;
PR #15 remains open on `codex/framework-lifecycle`. Exact executable and policy byte
parity was checked before the evidence-only documentation update, and repository
link/workflow/style validation passed. The separate evidence commit is identified
in the PR and delivery; no earlier execution is relabelled as that commit.
No merge, tag, release upload, publication, listing or permissions change was made.
