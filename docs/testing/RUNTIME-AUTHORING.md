# Runtime authoring qualification

Integration base: `386353f5ef3bc6ec94d19057bef159e4efa6e7a1`, branch
`build/runtime-authoring`. PR #8 remained open at baseline; none of its release
execution implementation is included. Development version remains 0.4.0, host
floor 1.13.7, desktop-only. Publication is not authorized.

The [requirement inventory](runtime-authoring-plan.json),
[implementation plan](../development/RUNTIME-AUTHORING-PLAN.md) and
[independent review](../development/RUNTIME-AUTHORING-REVIEW.md) define this
milestone's scope. Historical evidence is not qualification of changed source.

## Frozen candidate and hosted qualification

Qualified code: `a7dacca2cecc9ed7edde39b475a4caac65d8af4e`,
[PR #9](https://github.com/Luis85/obsidian-plugin-shell/pull/9). The final evidence
commit follows this frozen source and does not rebuild or alter retained assets.
[Candidate qualification 35869168964](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35869168964)
passed the actual fixed-source `release:rehearse` command with fresh strict install,
complete `verify`, one production build and retained assets. Later checks consumed
those same bytes. The packet's original offline qualification scope remains
immutable; browser and native reports provide separate evidence.

| Scope | Actual result |
| --- | --- |
| Linux tooling | 116 cases: 112 passed, four explicit Windows-only skips, zero failures |
| Runtime | 305 tests in 52 files; three additional fresh processes each passed 305, without retries |
| Production coverage | All 97 inputs; 99.49% lines, 97.39% statements, 97.34% functions, 94.91% branches |
| Domain/application/features | All 41 inputs; 99.910% lines, 97.837% statements, 98.741% functions, 96.361% branches |
| Served Chromium | 33 passed; zero failures, skipped, flaky or retried cases |
| Linux native | Three fresh sessions, each 24 checks, zero renderer errors and matching installed/cold-restart assets |
| Windows native | One fresh session, 24 checks, zero renderer errors; exact same CI-built assets, no rebuild |
| Legacy baseline | 52 cases in each of three runs; its independent release status remains blocked |
| Security | Live all-category audit: zero vulnerabilities; upstream support exception remains separate |

All unchanged coverage floors, strict types, both linters, complete analyzer,
architecture/presentation/source/repository gates, catalogs, tokens, artifacts and
harness build passed. The [independent packet audit](evidence/runtime-authoring-candidate.json)
reran read-only retained validation, matched all 471 source ZIP files against Git
blobs and all 97 production inputs against coverage, and matched native asset
bindings. It found no font binaries in 325 retained files or 474 ZIP entries.
An audit of retained evidence is not another test execution.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| main.js | 585511 | `5265eb5cd301cd1c3448bf5bc4f59eec18bdfb2fd2762177a05b1948fd0c69bc` |
| styles.css | 88547 | `3a09390ad8f4570c6b9947bd0c9231075ae5357dbf14ade4387bc5d7ac8316e7` |
| manifest.json | 280 | `84c725b25a67053a3ca5652b0111270ba5e3b3d4ff7f06f870352a2ff2018380` |

`candidate.json`: `fc1ae7d424e62b1b063e0a2c85d7a2bc43661ab35290a4ced002139f1ba6dafc`.
Installable ZIP: `6613298407555c39a9fae749032e52489dee8279628a0d7997c6d559862dd127`.
Hosted source ZIP: `c1a2a6ec03e2441b6fec0dd133fb31f57c6e2481e471b8fd41b0ac7a09720605`.
The lockfile remains `a4b3b8c22434a1bf89a71fc9d8c4f3a67885b3bb7ef6429b396838236be38b45`.

## Independently named consumer

[Template authoring 35869175978](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35869175978)
passed a fresh Atlas Notes 1.0.0 setup, Bookmarks generation and a consumer edit
reducing its title maximum to 100, a local Reminder maker/command, a plugin-data
Rating entity and an actual generated event/listener. Complete verification and
served checks passed before removal, after reviewed example removal, and after
generating Reading on the remaining foundation. The separate
[push-triggered run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35869169122)
also passed this sequence.

Runtime totals were 318 before removal, 284 afterward and 292 after Reading.
The final consumer covers all 103 production inputs at 99.45% lines, 97.57%
statements, 97.65% functions and 95.36% branches, with the independent business
gate unchanged and passed. Both final served foundation scenarios passed without
skip/failure/retry. The edited Bookmarks source remained exactly
`ba9b3f20d82192311eb7b409a36ef65037ac07a45fdaa87900f6d8dbff51fced` across removal.
The [consumer audit](evidence/runtime-authoring-consumer.json) identifies its
separate assets and actual scope. No current consumer-native acceptance is claimed.

Both Windows/Linux showcase and baseline jobs and all four setup-policy matrix
jobs passed for the code candidate. Node 24.15.0/npm 12.0.2 is a separately tested
setup-policy case; the selected candidate toolchain remains 24.21.0/11.19.1.

## Local pre-candidate execution

A fresh strict `npm ci --strict-allow-scripts` on Windows used Node 24.21.0 and
npm 11.19.1 and installed 693 packages from the unchanged exact lockfile. The
live `scripts/security/audit.mjs` passed with zero vulnerabilities across all
installed dependency categories. The nested ESLint 9 support exception remains
separate and unresolved.

Initial implementation checks passed the production build and then strict
`vue-tsc --noEmit` after correcting narrow publisher forwarding and test callers.
Nine real-service/component item cases passed, including committed bytes/write
counts, two-view drafts, invalid/stale/uncertain states and lifecycle. The complete
runtime run then passed **305 tests in 52 files**. All **97 production inputs** are
represented in the coverage inventory: lines 99.493%, statements 97.394%, functions
97.349%, branches 94.913%. Independent domain/application/features coverage is
99.910% lines, 97.837% statements, 98.741% functions and 96.361% branches. All
unchanged floors passed.
Selected-core coverage also passed all 305 tests: lines 99.838%, statements
97.859%, functions 98.861% and branches 96.286%.

Strict types, source/runtime-test/harness ESLint, Oxlint, full zero-finding analyzer,
architecture, presentation, source limits, locales, repository policy, entity/event
catalogs, tokens and artifacts passed. The retained baseline passed 52 tests in
each of three runs; its separate release guard remains blocked. Production and
harness builds passed. These are local pre-candidate results, not a retained
fixed-source release packet.

Served Chromium **153.0.8010.12** passed **33/33** scenarios with retries disabled,
including item invalid/pending/two-view/rename/delete/reload/recovery, responsive
rendering, real-component accessibility and owner cleanup. The first served run
passed 32 and failed one cleanup assertion whose baseline preceded the primary
view's deliberate lazy subscription acquisition. The corrected test compares
equivalent initialized lifetimes, adds navigation stability and retains exact
cleanup checks. That failed run is preserved in
`reports/runtime-authoring/e2e-first/`; no screenshot baseline was accepted.

Initial full verification retained a failed event-checker control: 113 tooling
cases passed, one Windows file-symlink case was unavailable and one negative
fixture failed because its edit was a no-op after formatting. Real junction,
case-alias and 8.3 tests passed. The corrected mutation asserts changed bytes;
actual compiler/checker controls then passed 2/2, including widened/erased rights,
duplicates, invalid references and schema/catalog drift. Real event-bus tests
passed 11/11. The complete first-attempt log remains in
`reports/runtime-authoring/verify-first.txt`; intermediate lint/analyzer failures
and their corrected runs are also retained. No suppression or threshold changed.

## Candidate attempts and consumer correction

Initial code commit `9b0be67f8562be552621cebf3c58bf20e997afed` opened
[PR #9](https://github.com/Luis85/obsidian-plugin-shell/pull/9). Its hosted
[candidate run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35868195957)
passed the fixed-source rehearsal's complete `verify`, repeated runtime processes
and both coverage runs before later qualification stages. It is superseded by the
consumer correction and is not the final accepted candidate.

The [consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35868195894)
failed because isolated maker fixtures copied a consumer's event registry without
the referenced custom feature source. The fixture also depended on removable
showcase source. Test-owned registries and empty example catalogs correct both
dependencies. The strengthened nested regression creates a custom event/listener,
runs production reviewed removal against synthetic ownership, then exercises the
actual compiler, production bus and catalog in a fresh fixture. All 15 focused
maker checks passed, with exact consumer-source preservation and independent
review. The failed hosted log remains retained locally and at the linked run.

## Native scope

The current candidate's [Windows report](evidence/runtime-authoring-windows.json)
passed all 24 unchanged native-driver checks in one fresh session, using the three
CI-retained assets above. App and installer were 1.13.7, launcher 3.2.1, Electron
43.3.0 and Chrome 150.0.7871.212. Complete-directory copy promotion retained the
earlier local Windows build separately; no build occurred after accepting CI bytes.
Installed and cold-restart hashes matched, and cleanup reported no failure.
Raw report SHA-256 is
`e1ca65ac964f2b1da9a8d3eee6827cb97e33f6344a21368aceb978ece81684cd`.

The stock native driver covers shell/host lifecycle, notes, themes, native
dialogs/preferences, split panes, pop-outs and restart. It does not separately
exercise item-specific CRUD in a real host; the new item workflow has real-service,
component and served-browser evidence. Do not equate these scopes.

The [Windows diagnosis](RUNTIME-AUTHORING-NATIVE.md) used retained historical PR #8
bytes. Its one instrumented full session passed 24 checks, but did not reproduce
or explain the earlier failure. It is not native acceptance of this changed
runtime-authoring candidate. The original failure and fixture-readiness attempt
remain preserved independently.

## Literal source archive

A fresh local ZIP of `a7dacca` hashes to
`44f6d344d3f4b41d92a108fbe5d09109b939a24ee2ed6fb67f4bec01e023b13e`.
After extraction under `.qualification/archive-a7dacca`, a Git ceiling proved
ancestor discovery failed with exit 128. Dependency-free setup then adopted
Archive Notes 1.0.0, freshly installed exact dependencies with the qualified
Node/npm and strict-allow-scripts enabled, and passed complete `verify`.
Its [archive evidence](evidence/runtime-authoring-archive.json) records 116 Windows
tooling cases (115 passed, one unavailable file-symlink case), 305 runtime tests,
all 97 production inputs and separate identity-specific assets. Browser/native
provisioning was not selected for this archive; no such acceptance is inferred.

An earlier `9b0be67` archive probe applied reviewed removal and passed compiler
checks through ancestor dependency lookup, but its runtime attempt failed before
tests because a local dependency junction could not be provisioned. That attempt
is preserved; the fresh `a7dacca` archive install/full verification supersedes its
limited execution, without treating the failed runtime attempt as a pass.

Local retained evidence: `reports/ci-a7dacca/`, `reports/consumer-a7dacca/`,
`reports/runtime-authoring/`, `reports/native/` and the contained archive folders.
Hosted artifacts have seven-day retention; committed hashes and compact evidence
remain durable. No font binaries are committed or included in evidence exports.

No macOS, physical mobile, third-party-theme, manual screen-reader, public-release
or directory-listing qualification is implied. The legacy 96-case plan and its
blocked release profile remain unchanged; case-specific new evidence is listed
in this milestone's separate inventory.
