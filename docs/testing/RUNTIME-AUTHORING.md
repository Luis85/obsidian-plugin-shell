# Runtime authoring qualification

Integration base: `386353f5ef3bc6ec94d19057bef159e4efa6e7a1`, branch
`build/runtime-authoring`. PR #8 remained open at baseline; none of its release
execution implementation is included. Development version remains 0.4.0, host
floor 1.13.7, desktop-only. Publication is not authorized.

The [requirement inventory](runtime-authoring-plan.json),
[implementation plan](../development/RUNTIME-AUTHORING-PLAN.md) and
[independent review](../development/RUNTIME-AUTHORING-REVIEW.md) define this
milestone's scope. Historical evidence is not qualification of changed source.

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

The [Windows diagnosis](RUNTIME-AUTHORING-NATIVE.md) used retained historical PR #8
bytes. Its one instrumented full session passed 24 checks, but did not reproduce
or explain the earlier failure. It is not native acceptance of this changed
runtime-authoring candidate. The original failure and fixture-readiness attempt
remain preserved independently.

No macOS, physical mobile, third-party-theme, manual screen-reader, public-release
or directory-listing qualification is implied. The legacy 96-case plan and its
blocked release profile remain unchanged; case-specific new evidence is listed
in this milestone's separate inventory.
