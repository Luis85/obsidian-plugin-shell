# Stage detection

Read-only signals and the stage they suggest. Check from the bottom up and stop at the first stage whose signals are present and whose handoff the user confirms. Signals are hints: a file's presence never means it was reviewed or approved.

| Stage | Signals (any) | Recommend |
| --- | --- | --- |
| 7. Handoff Ready | a `docs/increments/<slug>.md` handoff (`type: increment-handoff`) for the current work, and `node scripts/delivery/ready.mjs --handoff docs/increments/<slug>.md --json` exits 0 | `feature-delivery` (draft PR with the handoff, then the Definition of Done before ready) |
| 6. Handoff drafted, not Ready | the same handoff, but the check exits 1; its report lists failing rules and a refinement brief | `increment-handoff` (refinement session); its brief may route back to `ideation-brainstorm` or `ideation-concept` |
| 5. Skeleton exists | `node bin/app status --json` reports a configuration and `generated: true`; `node bin/app ui status --json` succeeds; a `projects/<slug>/source/` package or a separate project folder created by `new` | `increment-handoff` after `self-review`, then `feature-delivery`; `ideation-boilerplate` to add makers or regenerate |
| 4. Prototype exists | `prototypes/<slug>/prototype-answers.json` with `approved: true`; a managed prototype in `node bin/app prototypes list --json`; a built `clickdummy.html`; a `docs/concepts/<slug>/` prototype save | `ideation-boilerplate` |
| 3. Design agreed | the user confirms an agreed brief; `node bin/app design status --json` lists a `current` folder; `node bin/app handout validate --json` returns `ready: true` | `ideation-prototype` |
| 2. Concept defined | `brainstorms/<slug>/feature.definition.json`; a validated `new` request (starter plus interview, still `approved: false`); a candidate project that passes `node bin/app project validate` | `ideation-design` |
| 1. PRD drafted | a Markdown file in `paths.prds` (default `docs/prds`) whose frontmatter has `type: prd`, `id` and `title` | `ideation-concept` |
| 0. Idea only | none of the above | `ideation-brainstorm` |

## Reading the signals

- `status --json`: `data.configuration` null and `next: "setup"` means the folder is not a configured project. The Workbench checkout itself reports this; it is the framework, not the user's project.
- `design/project.json` (or `paths.project`) present means a saved project: feature brainstorming (`node bin/app brainstorm context --json`) works. Absent means `BRAINSTORM_PROJECT_REQUIRED`; route new projects to a PRD and starter choice.
- `design status`: `current`, `stale`, `source-missing` or `unmanaged` per folder. `stale` means `node bin/app design sync --name <slug>` is due inside `ideation-design`.
- `handout validate`: `blocked` with `HANDOUT_REQUIRED_OPEN` is normal before a product-trio meeting. `executionAuthorized` is always `false`; readiness is never permission.
- `ready.mjs`: exit 0 Ready, 1 not ready (a stage signal, not an error to fix here), 2 usage or configuration error. Without `--write` it is read-only. A handoff on another branch or for another change is not a signal for this one; ask. Missing `scripts/delivery/` (generated projects today) means no handoff stage: route straight to `feature-delivery`.
- `memory status`: `NOT_ENABLED` means continue without memory. Do not suggest setup unless the user asks; the `project-memory` skill owns that.

## Mixed or unusual states

- A prototype without a PRD: offer to back-fill the PRD (`ideation-brainstorm`) or continue as is; record the gap.
- Several candidate slugs: list them with paths and modification times and ask which one is current.
- A dirty Git tree: report `git status` output; do not stash, reset or commit.
- An existing non-Workbench project: hand off to `adopt-existing-project`.
