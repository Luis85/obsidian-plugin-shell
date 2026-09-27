---
name: companion-prototype-design
description: >-
  Design-first discovery and fresh-session prototype prompts for
  Luis85/obsidian-plugin-shell and its companion. Use when the user wants to
  brainstorm or design a whole Obsidian plugin, a new plugin feature, or an
  improvement before implementation; wants an importable companion prototype;
  wants image-based concept boards to explore UX/UI/interaction design;
  or asks to execute an approved prototype prompt. Produces a self-contained
  HTML clickdummy, independently buildable TypeScript/Vue 3/Pinia/Nuxt UI sources,
  and the real companion project JSON when execution is authorized.
compatibility: >-
  An agent with repository read access. Execution requires the checkout's pinned
  Node/npm toolchain, an installed browser test runner, and Python 3 for ZIP
  packaging. Subagents and image-generation tools are optional capabilities;
  unavailable image tools must be disclosed. No Nuxt framework or online runtime required.
metadata:
  version: "1.2.0"
  repository: Luis85/obsidian-plugin-shell
  reference-pr: "5"
---

# Companion prototype design

Turn **an idea → a working brief → optional image-based concept boards → a shared
design → a copy-and-paste execution prompt → an importable prototype package**. A design conversation is not permission to start implementing,
replace the current companion project, write into a vault, or change production code.

## Canonical skill and Codex entrypoint

This directory is the single source of truth. The repository's
`.agents/skills/companion-prototype-design/SKILL.md` is a thin Codex adapter that
reads this file and follows these same references and scripts. Do not fork the
workflow, prompt templates, helper code or approval rules for an agent host.
Use actual host capabilities; a Claude directory name never requires launching Claude.

## Operating rules

- Support `new-plugin`, `new-feature`, and `improvement`. Keep the chosen mode explicit.
- Discuss in the user's language; preserve repository naming conventions in source.
- Read existing answers, referenced artifacts and the actual repository before asking.
- Be relentless about unresolved consequential decisions, not repetitive or exhausting.
  Ask 3–5 related, high-impact questions per round; there is no fixed round limit.
- Do not turn the interview into a questionnaire dump. Give concrete alternatives,
  recommendations and small scenario walkthroughs. Record user decisions separately
  from proposals, researched facts and assumptions.
- Do not draft the final execution prompt until the user explicitly agrees to the
  current brief and every blocking question is resolved. Accepted assumptions are
  allowed only when named, bounded and explicitly accepted. Material changes reopen
  agreement. Never manufacture approval from silence.
- Prefer the smallest coherent scope that demonstrates the agreed experience. Do not
  add dashboards, an app shell, accounts, AI, live integrations or unrelated actions.
  An editor-only request stays editor-only; contextual panels are not an app shell.
- Never confuse a clickable simulation with an implemented native capability or a
  passing business acceptance test.

## 1. Resolve the repository and compatibility contract

Read `references/repository-contract.md`. Inspect the user's current checkout and
its `AGENTS.md`/nested instructions. PR #5 is context, not an evergreen schema label.
Capture the actual branch, commit, dirty state, dependency pins and contract hashes.

With a local trusted checkout:

```sh
node <skill>/scripts/inspect-repository.mjs --repo <checkout>
```

This is static, read-only discovery, not verification. Inspect actual files listed
in its report, their transitive contract/compiler dependencies and relevant tests.
Use connected repository reads when local access is unavailable; mark all execution
checks not run. A PR description is weaker evidence than its current source.

**Required decisions:** target checkout/revision; new versus existing project; host
surfaces and entrypoints; target platform; codebase/tests roots; visual scope; actual
browser/native capabilities. Derive versions from the checkout and lockfile, never
`latest`. For feature/improvement work, obtain the complete baseline project export
and target source revision (or explicitly review a reconstructed baseline as described
in the repository contract). A detached demo must not be advertised as a safely
mergeable feature package when this baseline is unavailable.

## 2. Conduct discovery and design

Read `references/design-interview.md` and use `assets/templates/design-brief.md`
as a working record, not a form to demand all at once.

Cover problem/outcome; people and jobs; existing experience; scope/non-goals;
information architecture; end-to-end journeys; page/component contracts; data and
business rules; interaction/state transitions; failures and recovery; visual language;
accessibility; responsive/host behavior; scenarios; acceptance; and integration.

For new plugins establish identity and the minimum complete plugin journey. For new
features establish where they join existing navigation, data and shared components.
For improvements establish observable before/after problems and behaviors that must
not regress. Read the baseline rather than asking the user to repeat it.

Research current or unfamiliar constraints using primary sources when needed. Record
what the evidence supports and what remains a design decision. After brainstorming,
offer the visual exploration checkpoint below; do not silently skip it or substitute
a picture for interaction or import contracts.

After each round: summarize the decisions, flag contradictions, and ask only the next
highest-value questions. Track stable IDs for journeys, surfaces, components, rules,
scenarios and acceptance cases. Keep a decision/gap log and shared vocabulary.

## 3. Offer concept boards and iterate on visual design

Once brainstorming yields a coherent working brief, and before final design agreement
or the prototype prompt, ask once:
**“Shall I generate a few concept boards to explore the UX, UI and interaction design,
or proceed directly to the prototype prompt?”**
Honor an already explicit request to create boards or skip them without asking again.
The offer is required; creating images is optional and needs the user's choice.
Read `references/concept-boards.md` and use `assets/templates/concept-board.md`.

If accepted, use an actually available image-generation tool to create 2–3 distinct
candidate directions by default, grounded in the brief, host constraints and real
component vocabulary. Show actual generated images, not only image prompts or textual
boards. Do not implement code yet. With no image tool or a failed generation, disclose
that state and offer a usable image prompt or a direct continuation; never claim images
exist. Follow host image-tool turn rules; collect feedback on the next turn when needed.

Invite the user to iterate, select a direction, combine named elements, or proceed to
the prototype prompt. Preserve board IDs/revisions, the keep/change/reject decisions,
and the selected direction in the brief. Resolve conflicts in mixed directions. Repeat
visual exploration only while useful or requested; a skip is not a blocking design gap.
Material scope/interaction changes reopen the relevant questions and agreement.

Before handoff, translate accepted visuals into explicit layout, component, responsive,
state/action and accessibility rules. Keep rejected alternatives out of implementation.
Board selection is not permission to execute the prototype or persist repository files.

## 4. Obtain design agreement

Play back a coherent walkthrough with the brief version, mode, user/outcome, in/out
scope, surfaces, key interactions, data, visual direction, edge states, simulations,
integration plan and observable acceptance criteria. Include the concept-board outcome
(skipped, selected, or unavailable with an accepted fallback), exact selected revisions
and any reconciled visual decisions. State the remaining questions.

Ask: **“Does this describe the prototype we should build, or what should change?”**
Only an explicit agreement with no blocking gaps moves to prompt generation. Record
agreement in the conversation; persist it only under separately authorized file writes.
Agreement on the concept does not approve target code changes or CLI apply operations.
An explicit request to proceed to the prototype prompt can also confirm the current
brief when it clearly accepts that brief and no blocking gaps remain; do not reconfirm
an already supplied agreement. A request to iterate is never treated as approval.

## 5. Produce the fresh-session prompt, inline

Read `assets/templates/execution-prompt.md` and replace every placeholder with the
approved design and inspected repository facts. The template is a construction aid,
not the deliverable. Output the **complete bespoke prompt in one copyable fenced
block**, even when also supplying a file. No “as discussed,” hidden attachments,
unexpanded variables, or requirements that exist only in the prior chat.

Include the exact approved brief, source location/revision and drift policy, baseline
requirements, architecture, artifact paths, import contract, scoped write authority,
subagent work packages, quality gates, failure reporting and final delivery behavior.
Describe both machine-representable features and source-owned extension seams. Require
real Vue components, not HTML with Vue-like class names. Include concrete acceptance
journeys and negative scenarios, not just “follow best practices.”

Carry accepted concept-board decisions inline, with board IDs/revisions, image access
instructions and hashes only when actual bytes are available. Text must fully describe
the selected UX/UI/interactions without relying on a previous session's image IDs.
Mark unavailable images honestly; do not reopen the optional board stage during approved
execution unless the user requests it or consequential design drift requires a decision.

If a long original artifact is indispensable, identify its exact path, hash and how
the executor obtains it; keep enough design detail inline to understand the task.
Attach access-dependent baselines or give precise access instructions. The prompt must
not pretend a private repository or unavailable baseline is accessible.

Then ask one routing question:
**“Save this prompt as `docs/concepts/<slug>-prototype-prompt.md`, execute it now,
or leave it here?”** The user can choose both save and execute.

Save only after authorization, without overwriting an existing file. An execution
request authorizes an isolated build workspace, not automatic repository persistence,
commit, push, plugin installation, or replacement of the companion's live project.

## 6. Execute only when requested

Read `references/execution-and-qa.md`, `references/artifact-contract.md`, and
`references/subagents.md`. Also apply `references/vue-typescript-quality.md`.
Delegate independent work when actual subagent tools exist;
otherwise run the same work packages sequentially and say which method was used.
Never claim subagents ran when they did not.

Default implementation direction:

1. Construct/update a complete companion project using the actual authoring model.
2. Validate it and plan generation with the actual shell compiler.
3. Review/apply the exact plan into a disposable workspace outside the framework.
4. Extend the generated shell at its real extension seams. Reuse its build/style
   pipeline and pinned dependency graph; implement an isolated browser harness.
5. Build the HTML **from those same Vue/TypeScript sources**, not a separate mock.
6. Exercise real behavior, offline operation and companion import/export. Qualify
   source integration and report any generator/custom-adapter limitations.
7. Deliver the HTML, sources, authoring JSON, traceability and evidence together.

Read `references/tooling-integration.md` and `scripts/README.md` first. Prefer the
unified `npm run prototype:tools --` entrypoint and the actual live shell capability catalog.
Reuse shell new/import/generate/makers/styles/fixtures/checks instead of writing parallel
tools. Source generation and dependency installation require separate explicit authority.

```sh
npm run prototype:tools -- discover --repo <checkout>
npm run prototype:tools -- new --repo <checkout> --out <source> --input <project.json>
# After exact plan review, repeat with --execute --apply <planHash>.
npm run prototype:tools -- shell --repo <source> --execute -- check
npm run prototype:tools -- build --repo <source> --entry harness/prototype/main.ts --project <project.json> --out <prototype.html> --title <title> --execute
npm run prototype:tools -- browser --root <package-root>
```

The build adapter runs real workspace Vite with the shell's shared config, hash-guarded
Nuxt UI adaptation, scoped CSS and license notices. It then calls the single-file
assembler. No additional dependency or alternate UI pipeline is installed. Compilation
is not type checking or acceptance; run applicable existing gates and actual browser
journeys. The low-level assembler remains available only for already compiled output.
For source-only bootstrap, adapt `assets/templates/browser-entry.ts.tmpl`; do not import
native modules into the browser entry or fake required typed service injections.

`companion.project.json` must be accepted by the real importer/compiler. Never invent
an alternative import schema. Keep prototype metadata, source inventories and change
sets in separate files. Do not insert them into the closed companion envelope.

## 7. Deliver and offer persistence

Provide an actual link/attachment for `prototype.html` and the source package in the
same response. Also expose `companion.project.json` and verification/integration notes.
Use verified artifact paths, never guessed download links. Distinguish passed, failed,
blocked and not-run checks; include tested revision and artifact hashes.

Then ask one combined routing question:
**“Would you like the complete prototype as a downloadable ZIP, saved under
`docs/concepts/<slug>/`, both, or neither?”**

When the user already requested a ZIP or repository save, perform that authorized
choice and ask only about the remaining choice. Do not ask again for supplied answers.
A folder save is not approval to commit or push. Show the exact destination and refuse
collisions, symlinks, path traversal, secrets and unrelated file replacement. Do not
change repository-wide exclusions or quality thresholds just to hide prototype code.
