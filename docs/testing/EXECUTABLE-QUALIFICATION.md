# Executable qualification record

Frozen code: `fd59c80195dee549ddbaaa23c28a06c091b18274`, branch `codex/executable-qualification`, development
version 0.4.0. [PR #10](https://github.com/Luis85/obsidian-plugin-shell/pull/10).
The evidence-only documentation commit follows this code checkpoint. Main remains
on integration commit `2d4087e93289a21d797fab4cd641ecde6cf16a82`.

The milestone implements trusted structured evidence, full production
maintainability gates, owned-resource checks and native reference measurements.
It does not complete the entire template or authorize release operations.

## Fixed candidate and actual checks

[Candidate qualification](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35905384551) performed a fresh strict installation
with Node 24.21.0/npm 11.19.1, complete `verify`, and one accepted production build.
Later browser/native/size checks used the retained bytes without rebuilding.
The [candidate audit](evidence/executable-qualification-candidate.json) records
packet/report hashes and verification of raw receipts, coverage denominators,
scope and source identities.

| Scope | Executed result |
| --- | --- |
| Tooling, Linux | 169 cases: 165 passed, four exact Windows-only skips; no failures. Skips never establish acceptance links. |
| Runtime | 310 tests in 53 files; three fresh producer executions with identical semantic inventories and no retries. |
| Coverage | All 97 production inputs; 99.46% lines, 97.43% statements, 97.52% functions, 94.93% branches. Both existing coverage gates pass. |
| Strict business scope | All 41 domain/application/features inputs; 99.91% lines, 97.92% statements, 98.87% functions, 96.40% branches. Unchanged stricter floors pass. |
| Maintainability | 801 production functions, zero above 10 cyclomatic/15 cognitive. 33 duplicated lines / 4,393 eligible lines = 0.751195%, below 3%; 50-token/5-line minimums. |
| Vue aggregate scope | Four actual template aggregates remain separately reported. They are not qualified as source functions; script/name impersonations fail. |
| Legacy baseline | 52 cases in each of three executions. Original 96-row plan and blocked release profile retained. |
| Served Chromium | 33 scenarios passed, no skip/failure/retry. |
| Native Linux | Three fresh 31-check sessions, plus a separate performance session; zero renderer errors/cleanup failures in the qualified run. |
| Security | Live all-category audit passed with zero vulnerabilities. Nested ESLint 9 support remains a separate upstream exception. |
| Acceptance reconciliation | Ten passing producer packets; AC-03 verified in both required modes, 14 partial, 81 not run. All 96 rows retained; release blocked. |

The meaningful native Items checks cover trimmed/invalid labels, stable-ID rename,
cancelled/confirmed deletion, independent drafts, exact saved state/write counts,
serialized preferences/entities and post-restart queries with zero writes.
Controlled native-view save pauses/rejections are explicitly adapter faults, not
native disk-failure evidence. Four deterministic resource tests include twenty
real-view cycles, native adapter EventRef wiring, a usable sibling and late work.

## Retained assets and serializer measurement

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 586834 | `d2f069ec4b4352b9794f9907a6b9988ee42c57359785a8fc8c81e4bdadd330ef` |
| styles.css | 88547 | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | 280 | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

The unchanged 1 MiB JS and 100 KiB CSS budgets pass. JS gzip/Brotli sizes are
174669/150287 bytes; CSS is 11702/9964 bytes. Compression is a read-only diagnostic.
The matching accepted build graph contains 72 YAML module entries with a total
rendered length of 171883. This is tree-shaken module attribution, not an additive
allocation of minified/compressed bytes or a counterfactual saving from removal.

These three asset hashes match the earlier 79d6688/456b49a/ef4fc41/8a350b1 packets.
Source/protocol records remain distinct. Earlier Windows execution is reused only
at the explicitly verified asset level; it is not relabeled as a new source run.
No font binaries were found in the inspected retained evidence and source/plugin
archives. Complete artifacts and failure attempts remain in ignored local reports
and linked CI artifacts; hosted retention is seven days.

## Windows controlled reference and retained failure

[Curated Windows measurements](evidence/executable-qualification-windows.json)
retain all 132 raw samples from both attempts, with exact report/driver hashes.
The runtime candidate is `79d668858612b0d631094f04306c6818e8fe066b`; the diagnostic
driver is `456b49a1f76174671aaca5b5a0d216a15e7d92c2` plus separately hashed read-only
observers. No accepted asset was rebuilt.

The controlled comparison ran on Windows 10.0.26200 x64, Intel i5-1135G7, about
8 GiB RAM, Obsidian app/installer 1.13.7, launcher 3.2.1, Electron 43.3.0 and
Chrome 150.0.7871.212, at 1023 × 800 and DPR 2. The user paused other work; a known
unrelated performance task was left untouched and allowed to finish. Preflight
recorded no known competing heavy job, 18% background CPU and 1,820,240 KiB free
RAM. This states the actual environment, not automatic process isolation.

Three retained warmups and 30 measured samples per metric use renderer monotonic
time and nearest-rank p95. Initialization excludes host startup. Readiness waits
for the real 100-item projection, exact labels, idle state and two animation frames.

| Windows attempt | Initialization p95 | 100-item readiness p95 | Native outcome |
| --- | ---: | ---: | --- |
| Shared-load advisory | 17.80 ms | 126.30 ms | 22 checkpoints, then light-theme failure; cold restart not reached |
| Controlled reference comparison | 22.70 ms | 146.70 ms | 31 checkpoints, zero renderer errors, cleanup complete, zero restart query writes |

Both timing results are below the proposed 200/500 ms reference budgets. No raw
sample or outlier was discarded. Heavy theme/foreground observers began only
after performance measurement. Linux shared-runner timings remain advisory and
are recorded separately in the candidate audit.

The initial Windows failure shows the real Appearance selector reverting to Dark
while host configuration stayed `obsidian`. The passing comparison records the
normal change handler, host config/CSS events and replacement of the select node;
its independent foreground sampler did not establish an OS-focus cause. Neither
that comparison nor later stock passes explains or erases the historical Windows
failure. The first candidate also had one Linux native session with three captured
`illegal access` renderer errors during pop-out closure; their cause remains open.
No source fix, relaxed control or longer native assertion timeout is claimed.

## Generated consumer and literal archive

The [consumer audit](evidence/executable-qualification-consumer.json) identifies
its independent source/asset hashes and actual workflow. Atlas Notes 1.0.0 starts
from a fresh checkout, edits its Bookmarks entity, adds a local Reminder maker,
event/listener and plugin-data Rating, then verifies and serves the result. Reviewed
example removal preserves the edited feature, followed by a distinct Reading
feature and complete verification/evidence production.

The audited [consumer push run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35905384396)
starts directly at `fd59c80195dee549ddbaaa23c28a06c091b18274`; its generated and
edited inputs have separately recorded modified-content digests. The audit checks
79 raw receipts and 1,903 per-input metric receipts. Its final consumer passes
293 tests in 64 files, all
103 production inputs and the independent business floors. Final production clone
measurement is 2.9280286%, below the unchanged 3% gate. The edited Bookmarks hash
remains `ba9b3f20d82192311eb7b409a36ef65037ac07a45fdaa87900f6d8dbff51fced`
through editing, removal, Reading extension and the retained source.

The literal archive proves absent Git discovery, adopts Archive Notes 1.0.0,
performs fresh strict installation and complete setup verification, and produces
actual runtime/artifact packets with `kind: archive` and null Git revision.
It passes 310 tests in 53 files and all 97 production inputs. Its artifact hashes
are retained; archive asset bytes were not separately uploaded. No archive-native
or current consumer-native acceptance is inferred. Removed example links remain
visible as unobserved rather than being promoted by unrelated consumer tests.

All checks on this frozen code passed, including the separate
[PR consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35905390436),
both showcase/baseline platforms and all four Windows/Linux combinations in the
[setup matrix](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35905390355).
The qualified toolchain is Node 24.21.0/npm 11.19.1; the alternate matrix uses
Node 24.15.0/npm 12.0.2. Windows setup jobs completed in 15m49s and 16m01s.

Final evidence-only validation passed repository checks (seven workflows, nine
stylesheets, 74 Markdown files and 330 local links), JSON parsing and whitespace
checks. The complete execution-input digest still matches the frozen candidate:
`f398573afaba453fc6e22946532fbb6346844b0683b8621119964c10106494ec`.

## Corrections, failed attempts and remaining scope

The [independent review record](../development/EXECUTABLE-QUALIFICATION-REVIEW.md)
covers three implementation workers and cross-owner review. Concrete corrections
include inconsistent/omitted report data, real Fallow template-name impersonation,
clone denominator/totals, semantic repetition drift, Git/archive identity,
projection getter reads, native write observation/cleanup, generator complexity,
archive-generated-output classification and consumer-independent parser fixtures.
Every numerical quality threshold remains unchanged.

Failed local source-limit fixture runs, the pre-fix projection regression,
79d6688 generator/native runs, 456b49a archive failure, ef4fc41 removed-fixture
failure and 8a350b1 Windows setup job cancellations remain recorded. The Windows
matrix exhausted its aggregate 15-minute job cap after successful checks; its
budget is 20 minutes now. Per-test, native, producer and performance bounds were
not increased, and no tests or diagnostics were suppressed.

Full template acceptance, unresolved host errors, broader template-aggregate policy,
manual screen readers, physical devices, macOS/third-party themes, repository
administration, supported dependency-graph closure and authorized public release
operations remain separate. Reports and integrity hashes are not signatures or
publication credentials. Main stays clean; no merge, tag or publication occurred.
