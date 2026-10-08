# Increment handoff: what each section needs

The handoff is `docs/increments/<slug>.md`, created from `configs/delivery/increment-handoff.template.md`. The configured rule set (`configs/delivery/definition-of-ready.json`) is authoritative; this page explains what a reviewer and the check expect, with examples. When the two disagree, the check and its report win: report the difference instead of working around it.

## Frontmatter

`type: Increment`, `id` equal to the slug, `title`, `owner`, `size` (`S`, `M` or `L`), `status` and `e2e` (`none`, `optional` or `required`) are required; `refs` (the PRD, PBI, task or issue the increment comes from) is optional. `pullRequests`, `issues`, `branch` and `base` are written by `node bin/app increment new` and `pr new`; never edit them by hand, and do not edit the generated `## Issues` and `## Pull requests` lists either. `status` moves through `node bin/app increment status`; the checks decide readiness. Every `refs` entry must resolve to a real path or id. All keys: `docs/development/INCREMENTS-REFERENCE.md`.

## Sections

| Section | Needs | Good | Bad |
| --- | --- | --- | --- |
| Summary | One or two sentences: what changes, for whom. | "Adds a Definition of Ready check that blocks draft pull requests without a complete handoff." | "Improvements to delivery." |
| Outcome | The observable result after merge, from the user's or maintainer's side. | "A maintainer sees on the draft pull request which handoff sections are missing and what to ask next." | "Better quality." |
| Scope | "In scope" and a non-empty "Out of scope" list. Out of scope names the nearby things a reader could assume are included. | "Out of scope: generated projects; enforcing the check as required (owner setting)." | "Out of scope: none." |
| Acceptance criteria | A checklist `- [ ] AC-1: ...` with unique ids, each independently testable, each naming its evidence. Within the size budget. | see below | "Works as expected." |
| Affected areas | Repository paths or globs that exist, or new files under allowed roots. | `tooling/delivery/`, `tests/tooling/`, `docs/development/WORKFLOWS.md` | "The backend." |
| Test plan | Real suite names from `tests/suites.json`, the gates that apply (`node bin/app check --plan` lists them), and new test files. "No test change — reason" only when that is true. | "Suite `quality`; new `tests/tooling/<behavior>.checks.mjs`; gates from `check --plan`." | "Add tests." |
| Docs impact | Each target path with its Diataxis type (tutorial, how-to guide, reference, explanation), or "None — reason". | "`docs/development/<GUIDE>.md` (how-to guide): new section on refinement." | "Update docs." |
| Changelog | One line `Added: ...`, `Changed: ...`, `Fixed: ...` (or another Keep a Changelog heading), or "None — reason". | "Added: Definition of Ready check for draft pull requests." | "Changelog: yes." |
| Risks and rollback | What could go wrong and how to undo it. | "Risk: false failures on edited bodies. Rollback: revert the workflow commit; the check is not required yet." | "None." without reason |
| Dependencies | Other pull requests, owner settings, external prerequisites, or "None". | "Needs the owner to add the check as required after merge." | — |
| Open questions | "None" when ready. A question that remains is a reason not to start. | "None" | "Which suite? TBD" |
| Completion record | Absent before implementation. The Definition of Done generates it. Do not write it by hand. | — | A hand-written evidence table before any code exists. |

Placeholders fail the check: `TBD`, `TODO`, angle-bracket fillers such as `<path>`, lorem text and template prompts left in place.

## Acceptance criteria that can be tested

Each criterion states one observable behavior, its condition and where its evidence will live. `node bin/app increment ac add` creates a pending acceptance test stub per criterion (`tests/acceptance/<slug>/ac-<n>.checks.mjs`) and sets it as the evidence; the Definition of Ready requires a stub or test evidence per criterion, and the Definition of Done requires the stubs implemented and every criterion checked with evidence that exists.

Good:

```markdown
- [ ] AC-1: Given a handoff without an "Out of scope" list, the DoR check exits 1 and names the missing section. Evidence: tests/tooling/<behavior>.checks.mjs
- [ ] AC-2: A refinement brief lists at least one question per failing rule. Evidence: tests/tooling/<behavior>.checks.mjs
- [ ] AC-3: The how-to guide explains the refinement session. Evidence: docs/development/<GUIDE>.md
```

The angle-bracket paths above are illustrations for this page; in a real handoff they must be the actual file names, or the placeholder rule fails.

Bad, and why:

- "AC-1: The check is fast." No threshold, no measurement, no evidence.
- "AC-2: Handle all errors." Not one behavior; not testable as written.
- "AC-3: Code is clean." A quality gate, not an acceptance criterion; the gates already cover it.
- "AC-4: Users like it." Needs a named review step and its record, or it belongs in Outcome.

## Size

`size` sets a budget on the number of acceptance criteria and affected areas (configured in `configs/delivery/`). When the budget fails, split the increment instead of raising the size: one handoff per coherent review unit, each with its own outcome and criteria, ordered by dependency.
