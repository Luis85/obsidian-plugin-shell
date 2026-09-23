# Executable qualification record

Implementation baseline: `2d4087e93289a21d797fab4cd641ecde6cf16a82`.
Branch: `codex/executable-qualification`; development version 0.4.0.
The [plan](../development/EXECUTABLE-QUALIFICATION-PLAN.md) defines ownership,
contracts and acceptance. This record is being completed from actual executions;
no final frozen candidate is qualified yet.

## Provisioning and preliminary execution

Windows x64, Node 24.21.0/npm 11.19.1. A fresh canonical
`npm ci --strict-allow-scripts` installed 693 packages from the unchanged lockfile.
An earlier install used `--ignore-scripts` and is retained as provisioning only;
it is not the canonical qualification installation. The nested ESLint 9 support
exception remains independent of npm's zero-vulnerability install summary.

The first production build and `vue-tsc --noEmit` passed during implementation.
The build retains a hash-bound YAML module attribution report outside `dist`.
These are preliminary changing-source checks, not an accepted fixed candidate.

The complete runtime run passed **309 tests in 53 files** after the production
refactors. Strict types and source ESLint passed. Production coverage then passed
all **97 inputs** at 99.46% lines, 97.43% statements, 97.52% functions and 94.93%
branches; the separate stricter business-layer floors also passed. Four new
resource scenarios include two twenty-cycle loops, late committed work and late
uncertain failure with a surviving sibling. Real host APIs in the wiring scenario
are explicitly doubled, not relabeled as native execution.

The live all-category `scripts/security/audit.mjs` passed with zero vulnerabilities.
Source limits, locale parity, repository policy and reviewed removal dry run passed.
The focused evidence adapter/CLI controls passed nine cases, followed by the
additional actual hung-child timeout control; a deliberately faulty real Vitest
run remains failed in its retained session. Three performance/asset tooling
controls passed, including actual CLI rejection of oversized and empty assets.

The actual served Chromium suite passed **33/33** scenarios with retries disabled.
The complete analyzer passed with zero findings after retaining the dynamic
reporter's exact entry point and sharing the existing dependency-free hash helper.
Independent review corrections and their actual negative controls are recorded in
the [review record](../development/EXECUTABLE-QUALIFICATION-REVIEW.md).

The first complete `verify` attempt passed 162/163 tooling cases with one explicit
Windows file-symlink capability skip, static checks, the full maintainability gate,
both coverage gates, tokens and artifacts. It then failed SRC-02 in each retained
baseline repetition: the isolated source-limit fixture did not copy the new shared
hash helper. The failed report remains under `reports/verification/` and the full
log under `reports/qualification/verify-first.log`. After correcting the fixture,
all **52 × 3** baseline cases passed; `Release blocked` remains.

A later focused source regression demonstrated a repeated-getter validation error
introduced by the document refactor. The corrected complete Documents/Items files
passed **16/16**, strict types and affected typed lint passed, and the strengthened
Items served scenarios passed **2/2** against a fresh harness build. Items now load
saved state in independent services and reload the browser after all three CRUD
mutations. Only AC-03's audited links gained whole extent; a current candidate
must still execute both required modes. Final frozen-source CI qualification is
separate from these cumulative local corrections.

## Scope distinctions

The original 96-case plan and blocked release profile are retained unchanged.
Framework/unit/component, served browser, synthetic host boundary, actual native,
artifact and generated-consumer results have distinct modes. Partial links do
not complete a case. Hash validation is integrity checking, not proof of honest
execution or release authorization.

Performance retains raw warmups and samples with explicit start/finish conditions.
Shared CI timing is advisory; reference budget results require a declared controlled
environment. Resource assertions and data-safety controls remain blocking.

The historical Windows theme failure remains unexplained; later stock passes do
not erase it. Device, macOS, third-party themes, manual screen readers, repository
administration and public release operations remain unqualified.
