---
name: companion-prototype-design
description: >-
  Design-first discovery and fresh-session prototype prompts for
  Luis85/obsidian-plugin-shell and its companion. Use when the user wants to
  brainstorm or design a whole Obsidian plugin, a new plugin feature, or an
  improvement before implementation; wants an importable companion prototype;
  or asks to execute an approved prototype prompt. Produces a self-contained
  HTML clickdummy, independently buildable TypeScript/Vue 3/Pinia/Nuxt UI sources,
  and the real companion project JSON when execution is authorized.
compatibility: >-
  An agent with repository read access. Execution requires the checkout's pinned
  Node/npm toolchain, an installed browser test runner, and Python 3 for ZIP
  packaging. Subagents are optional. No Nuxt framework or online runtime required.
metadata:
  version: "1.0.0"
  repository: Luis85/obsidian-plugin-shell
  reference-pr: "5"
---

# Companion prototype design

Turn **an idea → a shared design → a copy-and-paste execution prompt → an importable
prototype package**. A design conversation is not permission to start implementing,
replace the current companion project, write into a vault, or change production code.

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
what the evidence supports and what remains a design decision. Offer visual directions
only when they help resolve a decision. Use available image/design tools for requested
visuals, but do not substitute a picture for interaction or import contracts.

After each round: summarize the decisions, flag contradictions, and ask only the next
highest-value questions. Track stable IDs for journeys, surfaces, components, rules,
scenarios and acceptance cases. Keep a decision/gap log and shared vocabulary.

## 3. Obtain design agreement

Play back a coherent walkthrough with the brief version, mode, user/outcome, in/out
scope, surfaces, key interactions, data, visual direction, edge states, simulations,
integration plan and observable acceptance criteria. State the remaining questions.

Ask: **“Does this describe the prototype we should build, or what should change?”**
Only an explicit agreement with no blocking gaps moves to prompt generation. Record
agreement in the conversation; persist it only under separately authorized file writes.
Agreement on the concept does not approve target code changes or CLI apply operations.

## 4. Produce the fresh-session prompt, inline

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

## 5. Execute only when requested

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

Use these helpers where applicable; read `scripts/README.md` before running them:

```sh
node <skill>/scripts/validate-project.mjs --repo <checkout> --input <project.json>
node <skill>/scripts/build-single-file.mjs --js <compiled-iife.js> --css <scoped.css> --project <project.json> --out <prototype.html> --title <title>
node <skill>/scripts/check-offline.mjs --html <prototype.html>
node <skill>/scripts/verify-browser.mjs --root <package-root>
python <skill>/scripts/pack-concept.py --root <package-root> --output <new.zip>
```

The HTML assembler is **not** a Vue compiler. First build one classic IIFE plus CSS
with the repository's reviewed Vue/Vite pipeline; no chunks, imports or runtime CDN.
Its offline check is a conservative static check, not a browser or security audit.
The validator runs the real read-only reader and generator plan; it does not apply.

`companion.project.json` must be accepted by the real importer/compiler. Never invent
an alternative import schema. Keep prototype metadata, source inventories and change
sets in separate files. Do not insert them into the closed companion envelope.

## 6. Deliver and offer persistence

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
