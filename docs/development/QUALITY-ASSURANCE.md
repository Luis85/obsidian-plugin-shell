# Additional source assurance

These checks supplement the full coverage, compiler, architecture, official
Obsidian lint, artifact, browser and native gates. They have deliberately stated
scope and positive/negative fixtures; passing them is not full release acceptance.

Fallow explicitly excludes only the three generated install files
`dist/main.js`, `dist/styles.css` and `dist/manifest.json`. These were already
outside its maintained-source graph through built-in defaults; naming them avoids
an ambiguous default-ignore diagnostic in literal Git-free archives. The complete
artifact gate independently verifies that exact file set, hashes, ownership and
budgets. Additional source inside `dist` still produces a blocking diagnostic.
The real transported-archive regression checks valid inputs, unreachable maintained
source, an extra `dist` source file, and restored controls. The template maintainer
must review these exact names if the artifact layout changes; no maintained source
directory or unknown analyzer diagnostic is suppressed.

The analyzer and architecture checks share `scripts/quality/fallow-contract.mjs`,
the one reviewed Fallow version and report-schema contract. Each run must be the
qualified version and carry Fallow's enforced `error-severity-findings` and
`parse-error` gate verdicts; every enforced verdict must agree with the process
exit code. `.fallowrc.json` sets `failOnParseError`, so a source file the parser
could not read fails instead of silently shrinking the reachability graph, and
enables `deprecated-exports-in-use` as `error`, so an export marked `@deprecated`
cannot keep reachable consumers. The `[ANALYZER-CONTRACT]` negative control runs
the real analyzer against a consumed deprecated export, an unparsable file and a
config without the parse gate. A dependency update that changes the version or a
schema must revise this contract after reviewing the installed output contract.

The Oxlint gate receives a complete explicit inventory of `src` JS/TS/Vue paths.
This prevents an archive under an ignored parent from silently checking no files.
Empty input and symlinks fail; actual ignored-parent positive/negative controls
run the same binary with denied warnings. This broadens checked inputs and changes
no lint rule. Vue/ESLint and architecture retain their independent gates.

Tailwind class detection uses `source(none)` with the existing explicit presentation
and generated Nuxt UI source roots. This bounds generated utility discovery to
actual frontend inputs and avoids scanning archive caches or unrelated examples.
It does not change lint, test or coverage inventories. The mechanism follows
[Tailwind's explicit-source contract](https://tailwindcss.com/docs/detecting-classes-in-source-files#disabling-automatic-detection).

Preview loads emitted harness assets without invoking Nuxt's generation plugins;
build/dev retain their guarded shared pipeline. An actual config-contract test
prevents preview from rewriting generated build inputs or scanning source caches.

The stylesheet pipeline uses the dedicated exact scope class `ps--<plugin-id>`
for repeated selectors, and `ph--<plugin-id>` for the native content container.
The double hyphens are outside the valid ID grammar, keeping these marker categories
disjoint from retained root IDs and each other. Readable `data-plugin-ui` markers
remain; variable/keyframe namespaces and hash guards are unchanged. Negative
controls reject foreign, suffix and sibling selectors, while actual renamed
consumer artifacts remain subject to the 160 KiB stylesheet limit.

**Stylesheet budget change (owner-reviewed, 2026-09-27).** The CSS limit in `check-artifacts.mjs` and the performance
report rose from 100 KiB to 160 KiB, a deviation from NFR-04's 100 KiB target. Nuxt UI `experimental.componentDetection`
scans the whole repository for `U<Name>` tokens, so the companion's Nuxt UI catalog v1, its tests and `docs/`
prototypes select component themes the plugin never renders. Measured on `6178b10`: 34 detected components,
153,647 B (14 components used by `src` would build about 94 KB; all 118 components 264.51 kB). Scoping detection to
`src` was tried and rejected: Nuxt UI writes its generated templates under its root, and many owned-source walkers
assume `src/` holds only owned source. New component mentions anywhere in the repository, including `docs/`, can
still grow the stylesheet.

`npm run check:test-quality` parses every TypeScript file in `tests/runtime` and
`tests/e2e` with the installed TypeScript AST. It rejects focused/skipped/todo/
conditional declarations from imported Vitest/Playwright test, suite, describe and
it bindings, including named aliases, namespace imports and literal property
access. String/comment examples do not trigger it. It does not claim whole-program
alias analysis of custom test factories. Node tooling tests have separate explicit
platform-provisioning skips and remain outside this runtime/E2E declaration policy.

The existing ESLint configuration now applies type-aware promise handling to
runtime tests, browser tests and harness TypeScript. Run
`node node_modules/eslint/bin/eslint.js tests/runtime tests/e2e harness/app --max-warnings 0`.
It uses `no-floating-promises` and `no-misused-promises` through the real project
types, so browser operations are checked as promises rather than by guessing method
names. Deliberately unused fixture parameters may begin with `_`; other unused
variables and arguments remain errors. Existing runtime Obsidian rules remain.
The negative control runs actual ESLint with the repository config against a
missing Playwright `await`; the corrected operation passes.

`npm run check:repository` inventories current `.github/workflows` YAML, owned
`src/styles/**/*.css` and root README/AGENTS/changelog (their links into `docs/` must resolve). Markdown under
`docs/` is not walked: `docs/` is a design working directory outside the repository quality gates.
Its YAML parser rejects malformed or duplicate mappings. The repository policy
requires job/step structure, full action SHA pins, explicit read-only permissions,
checkout without persisted credentials and environment-based handling of untrusted
inputs instead of direct shell interpolation. This is a focused repository policy,
not a substitute for the complete GitHub Actions schema or actionlint. A job may
call a repository-local reusable workflow (`uses: ./.github/workflows/<name>.yml`)
only when that file exists and declares `on.workflow_call`, and never with
`secrets: inherit`. The owner-requested, scoped release allowance
(`scripts/quality/workflow-policy.mjs`) lets only `release-cut.yml` and
`publish.yml` grant job write scopes: both must be `workflow_dispatch`-only, keep
read-only top-level permissions, and every write job must target the protected
`release` environment. Every other workflow, including `starter-distribution.yml`,
stays read-only.

Delivery tiers: `dev.yml` ("Dev checks") runs on every pull-request event,
drafts included. The Integration tier is every other pull-request workflow; its
jobs skip draft pull requests and `release/*` heads, and three-OS matrices run
Linux only. `release.yml` (pushes to `release/**`, manual) verifies the release
metadata and calls every pull-request workflow with `tier: release` (every matrix
leg) plus `candidate-qualification.yml`; "Release result" aggregates them.

Current workflows (read-only unless stated):

- `dev.yml` (every pull-request event): `bin/app check --fast` against the base
  branch, suite registration, repository policy, changelog structure and the
  advisory self-review guard.
- `ci.yml` (ready pull requests, `main`, manual, called by `release.yml`):
  dependency-free `baseline` on Linux/Windows; `showcase` guided setup + `verify`
  (Windows on pull requests, plus Linux served e2e on pushes and releases); three
  parallel template-authoring journeys (`renamed-feature`, `source-archive`,
  `example-removal`); the blocking `self-review` guard on pull requests. On pull
  requests, manual runs and releases only: `framework-cli` (Linux; every OS in the
  release tier), `real-obsidian`, `generated-companion` and three grouped
  `starter` jobs. "CI result" aggregates every gate job.
- `release.yml`, `release-cut.yml` and `publish.yml`: the release tier, the
  owner-dispatched cut of `release/X.Y.Z` from `main`, and the owner-dispatched
  publication behind the `release` environment (the only write-scoped jobs).
- `setup-compatibility.yml` (setup/toolchain input changes): Node 24.15.0 +
  npm 12.0.2 and Node 24.21.0 + npm 11.19.1 on Linux/Windows with the real npm
  install-policy fixture.
- `companion-concept-verification.yml` (concept input changes): concept
  assembly, test data, visual editors and browser suites. Kept separate because
  the framework kit excludes it.
- `candidate-qualification.yml` (`main` pushes touching execution inputs,
  manual): fixed-source rehearsal, repeated runtime suites, both coverage scopes,
  served browser, three native sessions, timing samples and the live audit.
- `release-rehearsal.yml` (manual only): rehearsal of a reviewed default-branch
  commit and version; it cannot publish or tag.
- `maintenance-status.yml` (weekly, manual): version and action-pin discovery.

Owned CSS is parsed with the already selected PostCSS and selector parser. Empty
declarations and selectors without an owned class or plugin attribute fail. This
checks source syntax and obvious broad selectors; token roles and complete final
host containment remain independently checked after the production CSS pipeline.
It does not validate every CSS property's grammar or replace Stylelint. Extracted
vendor CSS remains under its existing hash/provenance gate, not this source scan.

Markdown checks balanced fenced blocks and existence of inline local file links,
excluding code examples. It rejects escaping the repository. Reference-link
definitions, heading anchors, spelling and full Markdown syntax are outside this
small offline check; no CSpell/TypeDoc completeness claim is made. Test fixtures
prove malformed workflow, unpinned action, write permission, missing await, focused
test, invalid CSS, broad selector, incomplete fence and missing local target are
detected alongside valid controls.

See the [quality adoption plan](../_archive/development/TYPESCRIPT-QUALITY-TOOLS-PLAN.md) for the full
remaining work, including external security/dependency-review scanners and broader
style/documentation tooling. These local checks do not activate external services,
alter permissions or certify those unprovisioned scanners.

## `npm run verify`: steps, partial runs and reports

`npm run verify` runs the explicit step table in `scripts/quality/verify-steps.mjs`
(ids, order, commands and genuine `needs` dependencies; `--list` prints it). The
default is fail-fast: the first failing step stops the run and every later step is
reported `not-run`. Options after `--`:

| Option | Behavior |
| --- | --- |
| `--keep-going` | After a failure keep running every independent step. A step whose dependency failed, or was itself skipped for that reason, is `skipped` with `dependency <id> did not pass`. |
| `--only a,b` | Runs only those ids **plus their transitive dependencies** (auto-included, listed under `data.selection.addedDependencies`). Other steps get no outcome and are listed under `data.selection.unselected`. |
| `--skip a,b` | Reports those ids `skipped` (`excluded by --skip`). A user skip does not block dependents; you accept responsibility for the missing input, for example an existing build. |
| `--list` | Prints ids, commands and dependencies (honoring `--only`/`--skip`) without executing or writing reports. |
| `--json` | Prints only the versioned result on stdout; child output goes to stderr. |
| `--report-dir <dir>` | Report location, default `reports/verify`. CI uses it to keep each rerun's report. |

Unknown ids or options exit 2 and list the valid ids. A green `--only`/`--skip`
run reports `data.complete: false` and a `PARTIAL_RUN` diagnostic: it is never a
complete verify verdict, and the default success sentence is printed only for a
complete run. The tooling suites remain one `tooling` step that runs every group
even after a group failure, then fails listing them.

The result has the same envelope as `node bin/app check --json`:
`protocolVersion`, `command: "verify"`, `status` (`ok`, `failed`, `cancelled`),
`data` and `diagnostics` (a failure carries a `next:` rerun hint). `data.steps[]`
holds `id`, `command`, `status` (`passed|failed|skipped|not-run`), `durationMs`,
`exitCode`, `reason` (failed, skipped and not-run steps) and, for failed steps only,
an ANSI-stripped `outputTail` of at most 60 lines/6000 characters. `data.summary`
counts the statuses and total duration. Every run, including a failed or partial
one, writes `<report-dir>/summary.json` (the same JSON) and `summary.md` (a table of
step, status, duration and the first failing lines, plus the output tail of each
failure). When `GITHUB_STEP_SUMMARY` is set, the Markdown is also appended there, so
CI shows the verdict without opening logs. `reports/` is gitignored and CI already
uploads it. A report that cannot be written warns on stderr and never changes the
verdict.

## Self-review before handover

`.github/pull_request_template.md` structures every pull request: summary, change
type, the gate commands each marked "result pasted" or "not run" with a reason,
evidence paths, a UI/UX checklist (human-review evidence, never acceptance),
threshold/ignore changes, untested scope and an explicit statement that the PR
authorizes no release or publication. `.github/CODEOWNERS` routes the quality
configuration, lint and test configuration, `tests/suites.json`, workflows,
`package.json`, lockfile and agent instructions to the maintainer.

The flow, also written for agents in `.claude/skills/self-review/SKILL.md`
(mirrored for Codex in `.agents/skills/self-review/SKILL.md`):

1. `node bin/app check --plan --base origin/main`, then `node bin/app check`,
   `npm run verify -- --json` and the relevant `node scripts/testing/suites.mjs <suite>`
   runs; browser and native runs only when provisioned.
2. `npm run check:self-review [-- --base <ref>] [--json] [--warn-only]`.
3. An adversarial re-read of the diff against `AGENTS.md`, then the template
   filled with real output and the untested scope.

`scripts/quality/self-review.mjs` compares the working tree (including untracked
files) with the merge-base of `HEAD` and `origin/main`, falling back to `main` and
`origin/HEAD`, or with `--base`. It parses the unified diff and inspects only added
lines (plus removed lines where a deletion loosens a gate). Findings print as
`[RULE] file:line message` and exit 1; `--warn-only` reports without failing, `--json`
emits `{status, base, files, violations[]}`, and an unresolvable base or bad usage
exits 2. Rules:

| Rule | Flags |
| --- | --- |
| `SR-QUALITY-CONFIG` | any change to `configs/quality/**`, the threshold floors or a Fallow rc file |
| `SR-COVERAGE-THRESHOLD` | threshold literals or exclusions added to, or wiring removed from, a Vitest config |
| `SR-LINT-CONFIG` | lint rules turned off, downgraded or ignored, or severities removed, in `configs/lint/**` |
| `SR-LINT-DISABLE`, `SR-TS-SUPPRESSION`, `SR-COVERAGE-IGNORE`, `SR-ANALYZER-IGNORE` | suppression comments added |
| `SR-UNSAFE-CAST` | casts to the catch-all type or through the unknown type (comment-only lines are skipped) |
| `SR-SCREENSHOT-BASELINE` | screenshot or snapshot assertions in tests, and added snapshot baseline files |
| `SR-UNCLASSIFIED-TEST` | added or moved test files that `tests/suites.json` does not classify exactly once (shares the suite manifest checker) |
| `SR-FOCUSED-TEST` | focused, skipped, fixme or todo tests outside fixtures and generated files |
| `SR-LINE-LIMIT` | changed files over the code-line limits (shares `sourceInputs` with `check:source`) |
| `SR-RETIRED-LAUNCHER` | references to the retired root launchers (a changelog entry is exempt) |

The guard is a diff heuristic with stated scope: it neither replaces the full gates
nor proves a change correct. A flagged line that is genuinely justified needs an
owner-approved note in the pull request; the guard has no inline waiver, so
loosening is never silent. Fixtures in `tests/tooling/agent-self-review*.checks.mjs`
run each rule against real temporary Git repositories, including a clean change, and
prove that removed and context lines never trigger findings.
