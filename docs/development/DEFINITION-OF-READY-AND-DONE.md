# Definition of Ready and Definition of Done

> Type: reference · Part of the [docs index](../README.md)

The Definition of Ready (DoR) and the Definition of Done (DoD) are deterministic,
dependency-free checks of an increment's documents. The DoR runs before
implementation; the DoD runs against the implemented diff. This page lists every
rule, how the checks choose what to check, and how to configure and run them.

- The rules, severities and parameters live in `configs/delivery/definition-of-ready.json`
  and `configs/delivery/definition-of-done.json`.
- The documents and the branch model live in `configs/delivery/delivery.json`.
- The checks are `scripts/delivery/ready.mjs` and `scripts/delivery/done.mjs`;
  `node bin/app increment check` runs the same code in-process.
- The documents themselves are described in [Increments reference](INCREMENTS-REFERENCE.md).

The tables below were generated from the two JSON files and the rule titles in
`scripts/delivery/rules-*.mjs`. `tests/tooling/delivery-rules-reference.checks.mjs`
fails when a configured rule is missing here or its severity differs.

## Severities and outcomes

| Value | Meaning |
| --- | --- |
| `error` | A `fail` blocks: the check exits 1 and the pull request check is red. |
| `warning` | A `fail` is reported as a warning; it never blocks. |
| `pass`, `fail`, `warn`, `skip` | The per-rule status in the report. `skip` means the rule does not apply to this run, for example a PullRequest rule while the Increment is checked. |

A rule with `"enabled": false` is not run. Every rule a script knows must be
listed in its JSON file with exactly its parameters; anything else fails with
`DELIVERY_CONFIG_INVALID` (exit 2).

## Definition of Ready rules

"Checks" names the document type a rule reads. DOR-01 to DOR-15 check the
Increment, DOR-16 to DOR-22 the PullRequest and Issue documents the pull request
changes, DOR-23 their links back and DOR-24 and DOR-25 the acceptance test stubs.

| Rule | Title | Severity | Checks | Passes when |
| --- | --- | --- | --- | --- |
| DOR-01 | Handoff present and unique | error | Increment | Exactly one Increment is selected (see [Which documents are checked](#which-documents-are-checked)). |
| DOR-02 | Frontmatter valid | error | Increment | The required keys are present with valid values, the id equals the file name and no unknown key appears (`allowUnknownKeys`). |
| DOR-03 | Required sections present and non-empty | error | Increment | Every section of `handoff.sections` exists with at least `minWords` words. |
| DOR-04 | No placeholders | error | Increment | No `TBD`, `TODO`, `FIXME`, `XXX`, lorem ipsum or `<placeholder>` text is left outside comments. |
| DOR-05 | Acceptance criteria | error | Increment | Between `min` and `max` criteria, each `- [ ] AC-n: text` with a unique id. |
| DOR-06 | Scope bounded | error | Increment | `### In scope` and `### Out of scope` both list at least one item. |
| DOR-07 | Open questions resolved | error | Increment | `## Open questions` starts with `None`. |
| DOR-08 | Affected areas exist | error | Increment | Each backticked path or glob matches a file, or a new file sits under an allowed root (`newFileRoots`). |
| DOR-09 | Test plan names real suites and gates | error | Increment | The test plan names suites from `tests/suites.json`, gate commands, new test files, or "No test change — reason". |
| DOR-10 | Docs impact typed | error | Increment | Each docs target carries a Diataxis type (tutorial, how-to, reference, explanation), or the section says "None — reason". |
| DOR-11 | Changelog entry valid | error | Increment | Each line is `- Added: …` (or Changed, Deprecated, Removed, Fixed, Security), or "None — reason". |
| DOR-12 | Size budget | error | Increment | Criteria and affected areas stay within the `sizes` budget of the increment's size (S, M or L). |
| DOR-13 | References resolve | error | Increment | Every `refs` entry and wikilink resolves to a file, an id under `idRoots`, or an external `#123` or https reference. |
| DOR-14 | E2E decision for UI areas | warning | Increment | When an affected area is a UI root, the test plan has an `E2E:` line explaining the `e2e` decision. |
| DOR-15 | Status reflects readiness | warning | Increment | The status is not New, Refining or Cancelled; informational only. |
| DOR-16 | Document frontmatter valid | error | PullRequest, Issue | The required keys are present, values are valid and criteria ids look like `AC-n`. |
| DOR-17 | Document listed by its increment | error | PullRequest, Issue | `increment:` names an existing Increment that lists the document id. |
| DOR-18 | Branches follow the increment | error | PullRequest | A kick-off has head `increment/{id}` and base `main`; a change has base `increment/{id}` and its own head. |
| DOR-19 | Pull request tasks listed | error | PullRequest | At least `min` tasks, each `- [ ] T-n: text` with a unique id. |
| DOR-20 | Pull request scope bounded | error | PullRequest | The pull request's `### In scope` and `### Out of scope` both list items. |
| DOR-21 | Criteria exist in the increment | error | PullRequest, Issue | `delivers: [AC-n]` (and Issue criteria `AC-n`) name criteria of the Increment; an Issue's own criteria are `IC-n`. |
| DOR-22 | Document links resolve | error | PullRequest, Issue | Wikilinks resolve and listed issue or pull request ids exist (or are `#123` or https references). |
| DOR-23 | Increment documents in sync | error | Increment | The Increment's `pullRequests` and `issues` lists match the documents that name it. |
| DOR-24 | Acceptance stubs present | error | Increment | Every criterion has its acceptance test stub, or an existing test as evidence. |
| DOR-25 | No orphan acceptance stubs | warning | Increment | Every stub in the acceptance folder belongs to a criterion. |

## Definition of Done rules

The Definition of Done is kind-aware. "Runs on" says which pull requests a rule
checks: **increment** is the kick-off (the increment branch into `main`) and any
other pull request that carries an Increment; **change** is a pull request into
the increment branch, checked against its PullRequest document; **both** is
every pull request.

| Rule | Title | Severity | Runs on | Passes when |
| --- | --- | --- | --- | --- |
| DOD-01 | Definition of Ready still passes | error | both | Every DoR error rule still passes on the final documents. |
| DOD-02 | Acceptance criteria checked with evidence | error | increment | Every criterion is ticked and names an existing file after `Evidence:`. |
| DOD-03 | Code changes come with tests | error | both | Changed source files (`sourceRoots`) come with changed test files (`testRoots`), or the test plan says "No test change — reason". |
| DOD-04 | Changelog updated | error | both | A user-facing change (`userFacingRoots`) adds the Changelog lines to `## [Unreleased]` of `CHANGELOG.md`. |
| DOD-05 | Docs impact delivered and typed | error | both | Every Docs impact target changed in the diff and carries a `> Type:` marker. |
| DOD-06 | New docs pages indexed | error | both | Every new docs page is listed in `docs/README.md` under the heading of its type. |
| DOD-07 | No forbidden additions | error | both | Added lines contain no `TODO`/`FIXME` in source, no `console.log(` in the plugin runtime and no focused test (`.only(`). |
| DOD-08 | Affected areas cover the diff | warning | both | Every changed file matches an affected area (`CHANGELOG.md` and `docs/README.md` always count). |
| DOD-09 | Increment status done | error | increment | The Increment's status is Done. |
| DOD-10 | E2E label matches the decision | error | both | With `e2e: required` the pull request carries the `e2e` label (read from `PR_LABELS`; a local run without it warns). |
| DOD-11 | Completion record present | warning | increment | The Increment has its generated `## Completion record`. |
| DOD-12 | PullRequest document of this change | error | change | Exactly one PullRequest document of the Increment has this base and head, and its kind is `change`. |
| DOD-13 | Pull request tasks done | error | change | Every task of that document is ticked. |
| DOD-14 | Delivered criteria checked with evidence | error | change | Every criterion in `delivers` is ticked in the Increment with existing evidence. |
| DOD-15 | Increment still in progress | error | change | The Increment is In progress (a change never completes the increment). |
| DOD-16 | Pull request completion record present | warning | change | The PullRequest document has its generated `## Completion record`. |
| DOD-17 | Increment pull requests and issues closed | error | increment | Every other pull request of the increment is Merged or Closed and every issue Done or Cancelled; the kick-off itself is not counted. |
| DOD-18 | Acceptance stubs implemented | error | both | The stubs in scope (every criterion on the kick-off, `delivers` on a change) have no pending marker and are the criteria's evidence. |

## Which documents are checked

Both scripts select one Increment, then decide the kind of pull request from its
branches.

1. **The Increment.** `--handoff <path>` wins. Otherwise a `Handoff: <path>` line
   in the pull request body (`DELIVERY_PR_BODY`; `node bin/app pr publish` writes
   it into every published body), else the one Increment the diff changes, else the
   Increment named by `increment:` in a changed PullRequest or Issue document.
2. **The kind.** From `DELIVERY_BASE_REF` and `DELIVERY_HEAD_REF` (in CI the pull
   request branches; locally `--base` and the current branch), matched against
   `branches` in `delivery.json`:

| Base | Head | Kind | Definition of Done |
| --- | --- | --- | --- |
| `increment/{id}` | any, normally `pr/{increment}/{pr}` | change | The PullRequest document with this head and base: its tasks, its delivered criteria, the increment still In progress. |
| `main` | `increment/{id}` | kick-off | The whole Increment: every criterion, status Done, every other pull request and issue closed. |
| `main` | any other branch | increment | The whole Increment, as for the kick-off. |

The Definition of Ready checks the Increment on every kind, and the PullRequest
and Issue documents the diff changes.

## Exemptions

Pull requests whose head starts with a prefix in `exemptions.branches`
(`release/`, `dependabot/`) or whose author is in `exemptions.actors`
(`dependabot[bot]`) pass both checks with a notice. Release pull requests use the
release template; `release.yml` reports both check names for them after "Release
result".

## Acceptance test stubs

Every acceptance criterion gets a generated, pending test stub at
`acceptance.pattern` (`tests/acceptance/{increment}/{ac}.checks.mjs`, for example
`tests/acceptance/export-notes/ac-1.checks.mjs`) from
`configs/delivery/acceptance-stub.template.md`. The stub names the criterion, links
the Increment and holds one pending `test.todo(...)`. The criterion's `Evidence:`
defaults to the stub path.

- **Created by** `node bin/app increment new` and `increment ac add` (in their
  reviewed plans), `node scripts/delivery/ready.mjs --write`, or
  `node scripts/delivery/acceptance.mjs stubs --increment <id> --write`. Stubs are
  never overwritten; a stub without a criterion is reported as an orphan (DOR-25).
- **Definition of Ready:** every criterion has a stub or other test evidence (DOR-24).
- **Definition of Done:** the stubs in scope contain assertions
  (`acceptance.assertionPattern`) and no pending marker (`acceptance.pendingPattern`),
  and they are the criteria's evidence (DOD-18).

**The pending-marker exception.** The self-review guard normally rejects an added
pending test. It allows one only when all of these hold: the line matches
`acceptance.pendingPattern` and has no focus or skip call, the file is a generated
stub (`ac-<n>…`) directly inside the acceptance folder of an Increment, and that
Increment's status is still in `acceptance.pendingStatuses` (New, Refining, Ready,
In progress). Anywhere else, or once the Increment is Done, a pending marker stays a
finding. A missing or invalid delivery configuration allows nothing
(`scripts/delivery/acceptance-guard.mjs`).

## Run the checks

| Purpose | Command |
| --- | --- |
| Ready check of one Increment, from the CLI | `node bin/app increment check <id>` (exit 1 with the refinement brief when not ready) |
| Done check of one Increment, from the CLI | `node bin/app increment check <id> --gate done --base <ref>` |
| Plan the Done outputs through a reviewed plan | `node bin/app increment complete <id> --dry-run` |
| Ready check of the current branch | `node scripts/delivery/ready.mjs --base origin/main` |
| Done check of the current branch | `node scripts/delivery/done.mjs --base origin/main` |

The scripts exit 0 when the rules pass or the pull request is exempt, 1 when they
do not pass, and 2 on a usage, configuration or base error. `--json` prints the
report, `--summary <file>` appends the Markdown report (CI uses
`$GITHUB_STEP_SUMMARY`), and `--out <dir>` writes generated files to a folder
instead of the checkout.

`increment check` names its Increment explicitly, so DOR-01 always selects it, and reports the gate's
`refinement` brief: the questions per failed rule and the skills that answer them
(`refinement.skills` in `delivery.json`). Without `scripts/delivery`, a
`delivery.json` or a commit to diff against, `increment check` falls back to a
structural Ready check and the Done gate is unavailable
(`INCREMENT_GATES_UNAVAILABLE`). `increment status <id> Ready` runs the same
Ready check without DOR-01 and DOR-15 and refuses with `INCREMENT_NOT_READY`.

## Generated outputs (`--write`)

Without `--write` both scripts are read-only.

- `ready.mjs --write` adds missing section scaffolds from the template and one
  acceptance stub per criterion. It never overwrites authored text; scaffolds are
  not answers.
- `done.mjs --write` writes the `## Completion record` (on a change pull request,
  into its PullRequest document): the changed files by affected area, the
  criterion-to-evidence table and the gates from `node bin/app check --plan`
  (skipped with `--no-plan`). It also adds the missing `## [Unreleased]` entries
  from the Changelog lines, the `docs/README.md` rows for new pages and, for the
  increment kind, `status: Done`.
- `node bin/app increment complete <id>` plans the same outputs through a reviewed
  file plan and refuses while a rule other than the generated ones fails. It also
  refuses while a change pull request is New, Draft or Ready, or when the kick-off
  is Closed (`INCREMENT_OPEN_PULL_REQUESTS`). The kick-off itself may still be open:
  it merges the increment branch into the base after the increment is Done.

In CI both checks are read-only: the generated files go to the job summary and an
artifact, to be applied locally with `--write`.

## Configure

Change the files under `configs/delivery/` through a reviewed pull request; it is
an owner decision, never a way to turn a red check green.

| File | Holds |
| --- | --- |
| `delivery.json` | Folders and globs of the Increment, PullRequest and Issue documents, their statuses, required and optional keys and sections, the branch patterns, the acceptance stub layout, exemptions, size budgets and the refinement skills. |
| `definition-of-ready.json`, `definition-of-done.json` | Per rule: `severity` (`error` or `warning`), `enabled` and its `params`. |
| `increment-handoff.template.md` | The Increment template that `increment new`, `ready.mjs --write` and `increment.mjs new` render. |
| `acceptance-stub.template.md` | The acceptance test stub template. |

The document folders follow `paths.increments`, `paths.pullRequests` and
`paths.issues` in `configs/user-settings.json`; `node bin/app settings migrate`
moves them and rewrites the globs in `delivery.json` in the same reviewed plan.
When the globs and the settings differ, read commands warn and write commands
refuse with `DELIVERY_PATHS_DRIFT`.

## Workflows

In the framework repository two dependency-free workflows run the checks on every
pull request, drafts included for the Ready check. They are part of the
maintainer pipeline; generated projects do not receive them.

| Workflow | Check name | Runs on | Command |
| --- | --- | --- | --- |
| `.github/workflows/definition-of-ready.yml` | Definition of Ready | `opened`, `synchronize`, `reopened`, `edited`, `ready_for_review`, drafts included | `node scripts/delivery/ready.mjs --base origin/<base>` |
| `.github/workflows/definition-of-done.yml` | Definition of Done | the same plus `labeled`, `unlabeled`; skips drafts | `node scripts/delivery/done.mjs --base origin/<base>` |

Both skip `release/*` heads and have no branch filter, so pull requests into an
increment branch run them too. Branch protection on `main` requires "Dev checks",
"Definition of Ready", "CI result" and "Definition of Done"; see
[GitHub Actions workflows](WORKFLOWS.md#required-checks).

## Related

- How the checks fit the whole flow: [Your first increment](FIRST-INCREMENT.md).
- Requirement-level readiness and done criteria of the framework backlog:
  [governance §5](../requirements/GOVERNANCE.md#5-quality-review-dor-and-dod) and
  the [delivery tasks](../tasks/README.md).
