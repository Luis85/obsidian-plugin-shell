---
name: ideation-prototype
description: Step 4 of the ideation chain. Produce a clickable proof of the agreed design with the prototype maker, companion-prototype-design execution, clickdummy generation or managed prototypes, without claiming native acceptance.
---

# Ideation prototype (step 4 of 5)

Make the agreed design clickable so people can try it. Pick one route with the user; each previews before it writes. Overview: `.claude/skills/ideation-journey/references/chain.md`. Route comparison: [references/routes.md](references/routes.md).

## Inputs

- **Required:** the agreement record from `ideation-design` (brief version, `conceptBoards` outcome, empty open questions, the user's explicit agreement). If missing, go back to `ideation-design`; never set `approved: true` yourself.
- **Required:** the concept handoff (saved `design/project.json`, `brainstorms/<slug>/`, or a validated `new` request with its starter).
- **Optional:** an existing managed prototype or prepared package to version or fork.

## Preflight (read-only)

```sh
node bin/app status --json
node bin/app prototypes list --json
node bin/app prototype guide --json
```

`prototype guide` returns the interview fields and a default `input`. Also note whether a generated project exists (`node bin/app ui status --json` succeeds) and whether dependencies are installed (`status` reports `dependencies`).

## Route A: prepared prototype package (recommended)

1. Fill the guide answers from the agreed brief: title, mode, problem, audience, outcome, pages, components, journeys, non-goals, data rules, edge states, visual direction, `conceptBoards`, `boardDecisions`, accessibility, acceptance, `openQuestions: []`, `approved: true`.
2. Validate on stdin: `node bin/app prototype validate --input - --json`. It must report `ready: true`.
3. Preview `node bin/app prototype --input - --out prototypes/<slug> --json`; show the files (`design-brief.md`, `prototype-answers.json`, `prototype.preparation.json`, `execution-prompt.md`, `source/`) and `planHash`. Apply with `--apply <planHash>` only after an explicit yes.
4. Project starters (route B of `ideation-concept`) use the same discipline with the starter request: `node bin/app new validate --input - --json`, then preview `node bin/app new --input - --out projects/<slug> --json` and apply its hash. The package's `source/` is real compiler boilerplate, not a finished prototype.
5. Optional design folder from the package: preview `node bin/app design prepare --name <slug> --package prototypes/<slug> --json` and apply its hash.

## Route B: execute the prototype (companion-prototype-design sections 5–7)

Read `.claude/skills/companion-prototype-design/SKILL.md` sections 5–7, `.claude/skills/companion-prototype-design/references/execution-and-qa.md` and `.claude/skills/companion-prototype-design/references/tooling-integration.md`. Produce the complete fresh-session prompt inline, then ask its routing question (save, execute now, or leave it). Execute only on request, in an isolated workspace, with the unified tools: `npm run prototype:tools -- discover --repo <checkout>` first, then the `new`, `shell`, `build` and `browser` subcommands as that skill describes, each with its own approval. Say whether subagents actually ran. Deliver with that skill's persistence question.

## Route C: clickdummy from a saved project

1. Plan: `node bin/app generate --output-kind clickdummy --plan-out clickdummy.plan.json`, review `node bin/app plan inspect clickdummy.plan.json --json`, then after approval `node bin/app plan apply clickdummy.plan.json --yes`. For a maker-only workspace, `node bin/app sketch generate --out generated/<slug> --kind clickdummy --json` previews the same and applies its hash. An active managed variant uses `node bin/app prototypes generate --output-kind clickdummy --dry-run`.
2. Dependencies: `node bin/app install` reports what is needed; `node bin/app install --yes` runs the exact-lock install only after approval (network and lifecycle scripts).
3. Build: `node bin/app clickdummy build --dry-run`, then `node bin/app clickdummy build` (add `--replace` only to replace an earlier one on purpose).
4. Review: `node bin/app ui gallery --target clickdummy --json` captures screenshots for human review. A gallery is evidence, never a baseline or acceptance.

## Route D: feature brainstorm prototype output

For a saved project, re-run the request from `ideation-concept` with `"output": "prototype"` and a `verification` choice into a new folder: preview `node bin/app brainstorm feature --input - --out brainstorms/<slug>-prototype --json` and apply its hash. If verification was requested, `node bin/app brainstorm verify --out brainstorms/<slug>-prototype --json` shows the separate process plan; its apply may download dependencies and run scripts, so it needs its own explicit yes.

## Versions and variants

Capture a model as a managed prototype: `node bin/app prototypes create <slug> --input design/project.json --dry-run`, then apply. Iterate with `node bin/app prototypes version <slug> --version v2 --from v1 --dry-run` or `node bin/app prototypes fork <slug> --version v1 --variant main --as <variant> --dry-run`, compare with `node bin/app prototypes compare ...`, set review state with `node bin/app prototypes status <slug> --version v1 --variant main --status review --dry-run`, and choose the generator input with `node bin/app prototypes activate <slug> --version v1 --variant main --dry-run`.

## Output and handoff

- One of: `prototypes/<slug>/` package, `projects/<slug>/` starter package, executed prototype deliverable, built clickdummy plus `reports/ui-gallery/`, or a managed prototype under `docs/concepts/<slug>/`.
- Verification notes: what passed, failed, was blocked or not run, with hashes where available.
- Handoff to `ideation-boilerplate`: the package path or `companion.project.json`, the starter id, and the active variant.

## Hard rules

- Preview first; write only with `--apply <planHash>` or `plan apply <file> --yes` after an explicit yes for that exact plan. `prototype`, `sketch` and `brainstorm` have no `--yes`.
- `approved: true` comes only from the recorded agreement. `conceptBoards: requested` or open questions block preparation; resolve them in `ideation-design`.
- Inherited from `companion-prototype-design`: never claim images, subagents or checks that did not run; a folder save is not approval to commit or push.
- A clickdummy or gallery is not native Obsidian acceptance and uses synthetic data; say so whenever you show one.
- Installs and builds are process execution: separate approval, real output, no retries of uncertain writes. Most commands here prompt for permission; never work around a prompt.

## What this skill does not do

It does not create the final project skeleton, run `make` recipes, open pull requests, publish, or install plugins into a vault.

## Close: follow-up questions

End by calling the AskUserQuestion tool with these questions (in hosts without it, ask them as a numbered list), then stop and wait. Never start `ideation-boilerplate` without the user's answer.

1. Header "Next step" — "The prototype is <path, route, status>. How do you want to continue?"
   - "Continue to ideation-boilerplate (Recommended)" — turn it into a real project skeleton.
   - "Iterate on the prototype" — new version or variant, or another build.
   - "Save or share first" — ZIP or `docs/concepts/<slug>/` save, or design-folder sync.
   - "Stop here"
2. Header "Feedback" — "Did trying the prototype change the design?"
   - "No, it matches the agreement" · "Small changes (new variant)" · "Material changes (back to ideation-design)"
3. Header "Review" — "Capture a UI gallery for reviewers?"
   - "Yes, preview it" · "No"
