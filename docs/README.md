# Documentation

This is the home of the repository's documentation. Workbench is a reusable
Obsidian plugin shell with a CLI (`node bin/app`), a browser authoring concept and
a dedicated compiler that turns Companion project JSON into independent generated
projects; the [root README](../README.md) introduces it and [AGENTS.md](../AGENTS.md)
holds the binding repository rules. The current documents below are sorted by the
[Diataxis](https://diataxis.fr/) framework: **tutorials** teach by doing,
**how-to guides** solve one task, **reference** pages state facts and contracts,
and **explanation** pages give background and reasons. Plans, backlogs, workspaces
and the archive sit outside those four types and are listed separately. Paths are
stable on purpose (code, tests and templates link to them), so a page's type is
shown by this index and by a `Type:` line under its title, not by its folder.

## Tutorials

| Page | What you learn |
| --- | --- |
| [Getting started](user-manual/shell-cli/getting-started.md) | Create your first plugin from a starter or an extracted framework kit, then run and check it. |
| [Build a feature](development/BUILD-A-FEATURE.md) | Add a business feature step by step: entity, document recipe, registration, view and tests. |
| [Your first increment](development/FIRST-INCREMENT.md) | Plan an increment with `node bin/app increment new`, refine it in a kick-off draft pull request until the Definition of Ready passes, deliver it through a stacked change pull request and close it with the Definition of Done. |

## How-to guides

**Work on this framework checkout**

| Page | Task |
| --- | --- |
| [Developer guide](../DEVELOPER_GUIDE.md) | Check the requirements, set up the checkout, then run the everyday workflows for improving or extending the plugin, CLI and generator. |

**Develop a plugin on the shell**

| Page | Task |
| --- | --- |
| [Add commands and ribbon icons](development/COMMANDS-AND-RIBBON.md) | Declare feature commands and ribbon actions through the bootstrap command registry. |
| [Logging and debugging](development/LOGGING-AND-DEBUGGING.md) | Use `services.logger`, typed log catalogs and the debug commands. |
| [Remove optional examples](development/EXAMPLE-REMOVAL.md) | Review and apply removal of the showcase, Task, Project and Items examples. |
| [Native file extensions and context menus](development/native-file-integrations.md) | Generate a custom file view or file context-menu plugin. |
| [Setup: npm install-script policy](development/SETUP-TROUBLESHOOTING.md) | Resolve `EALLOWSCRIPTS` and other setup install-script errors. |
| [Setup inside an extracted kit](development/EXTRACTED-KIT-SETUP.md) | Run `node bin/app setup` in a locally packed framework kit. |
| [Choose GitHub, Azure DevOps or no hosting platform](development/HOSTING-PLATFORMS.md) | `--hosting` for `new`, `setup` and `npm run setup`, `hosting show\|set`, and the read-only `doctor` check of `az`. |
| [Local and cloud sessions](development/CLOUD-AND-LOCAL-SESSIONS.md) | Take a project from a local checkout to a ready cloud agent session. |
| [Data-driven wizards and forms](development/WIZARDS-AND-FORMS.md) | Add or change a guided CLI process or reusable form in `configs/wizards` and `configs/forms`. |
| [Data-driven business processes](development/BUSINESS-PROCESSES.md) | Manage processes, their steps, business rules and docs; check, document, run and simulate them. |
| [Learning paths](development/LEARNING-PATHS.md) | Follow or write a step-by-step course for `node bin/app learn` in `configs/learning`, including the idea-to-prototype course with Claude Design. |
| [Manage risks](development/RISK-MANAGEMENT.md) | Keep a risk register as typed Markdown notes with `node bin/app risk`: model, note format, checks and the generated register. |
| [Manage learnings](development/LEARNINGS.md) | Keep lessons learned as typed Markdown notes with `node bin/app learning`: lifecycle, note format, checks, review and the generated register. |
| [Browser test workflows](development/TEST-WORKFLOWS.md) | Define Playwright journeys for projects and prototypes as JSON, run them headless, keep generated docs notes and export specs with `node bin/app workflow`. |
| [Release items and release candidates](development/RELEASE-CANDIDATES.md) | Release items, candidate folders per version, freezing, docs regeneration and the path to release approval. |
| [Typed-note collections](development/NOTE-COLLECTIONS.md) | Engine API and the steps to add a collection (a JSON definition, a settings path, forms/wizards and a command root). |
| [Generate fake data](development/FAKE-DATA.md) | Generate seeded sample notes, Bases tables and reusable generation configs with `node bin/app fake-data`. |
| [Data-driven forms in the plugin runtime](development/RUNTIME-FORMS.md) | Render a JSON form inside the plugin from `src/features/<feature>/forms` and receive validated values. |
| [Shell CLI user manual](user-manual/shell-cli/index.md) | Task pages for design-to-project, daily development, automation, maintenance and troubleshooting. |

**Design, prototype and generate**

| Page | Task |
| --- | --- |
| [Adopt an existing project](development/ADOPT-EXISTING-PROJECT.md) | Analyze an existing project and write a reviewed plan for adding Workbench. |
| [Claude Design folders](development/CLAUDE-DESIGN-HANDOFF.md) | Prepare, sync and hand off per-prototype design folders under `docs/design/<prototype>/`. |
| [Design-first prototype tooling](development/PROTOTYPE-TOOLING.md) | Run the prototype-design skill and its helpers. |
| [Reviewed concept intake](development/CONCEPT-INTAKE.md) | Import project, feature and improvement concepts as data, then generate. |
| [JSON to an offline clickdummy](development/COMPANION-CLICKDUMMY.md) | Build a generated browser clickdummy from project JSON. |
| [Saved design system to Nuxt UI stylesheet](development/DESIGN-SYSTEM-STYLES.md) | Author design tokens and compile them into scoped styles. |
| [Journey Lens in generated plugins](development/JOURNEY-LENS-NATIVE.md) | Declare and wire the Journey Lens editor in a generated native plugin. |
| [Optional Storybook](development/OPTIONAL-STORYBOOK.md) | Switch on the isolated Storybook workspace and generated stories. |
| [UI review gallery](development/UI-REVIEW-GALLERY.md) | Capture and index browser screenshots for human review. |
| [Project setup handout](project-setup/HANDOUT.md) | Run the product-trio meeting that turns PRDs into a prototype brief. |

**Deliver and release**

| Page | Task |
| --- | --- |
| [Deliver a change](development/DELIVER-A-CHANGE.md) | Branch, open a draft pull request, pass the Dev and Integration tiers and merge a green pull request. |
| [Manage increments](development/MANAGE-INCREMENTS.md) | Change statuses, scope and criteria, track issues, change and sync published pull requests, resolve sync conflicts, recover from uncertain writes and use Azure DevOps. |
| [Cut and publish a release](development/CUT-AND-PUBLISH-A-RELEASE.md) | Cut `release/X.Y.Z`, watch the Release tier, fix forward, publish and recover. |
| [Developer workflow](development/DEVELOPER-WORKFLOW.md) | The daily loop: setup, a first feature change, feedback, events, styles and verification. |
| [Maintenance operations](development/MAINTENANCE-OPERATIONS.md) | Run freshness discovery and review dependency updates. |
| [Release rehearsal](development/RELEASE-REHEARSAL.md) | Rehearse a fixed candidate offline (manual tool). |
| [Release execution](development/RELEASE-EXECUTION.md) | Operate a retained candidate packet with explicit authorization (manual tool). |

**Test and qualify**

| Page | Task |
| --- | --- |
| [Obsidian test kit](testing/OBSIDIAN-TEST-KIT.md) | Write Vitest tests against the in-memory `obsidian` double. |
| [Real-Obsidian dev loop and E2E](testing/OBSIDIAN-DEV-LOOP.md) | Run the plugin in a contained real Obsidian vault and its E2E tests. |
| [Performance and ownership qualification](testing/PERFORMANCE-QUALIFICATION.md) | Follow the measurement protocol for cleanup, timing and asset sizes. |
| [Compiler qualification and extension](development/compiler/TESTING.md) | Run and extend the compiler gates, golden baseline and property tests. |

**Optional tooling**

| Page | Task |
| --- | --- |
| [Hindsight developer memory](development/HINDSIGHT.md) | Opt in to keyless local project memory and use `node bin/app memory`. |
| [Reviewed project knowledge](memory/README.md) | Write and seed reviewed Git-backed decision records. |
| [Project-local MCP](development/LOCAL-MCP.md) | Expose the CLI to coding agents through the opt-in local MCP server. |
| [Support reports and measurements](development/LOCAL-SUPPORT-AND-MEASUREMENTS.md) | Produce a local support report and authoring measurements. |
| [Airship integration](tooling/AIRSHIP.md) | Use the source-backed browser preview in generated projects. |
| [Obsidian CLI adapter](tooling/OBSIDIAN-CLI.md) | Use the narrow adapter over the official Obsidian CLI. |

## Reference

**Runtime and authoring API**

| Page | Facts |
| --- | --- |
| [Authoring tools](development/AUTHORING-TOOLS.md) | Maker catalog, recipes, bounds and `entities:catalog`. |
| [Plugin-data entities](development/PLUGIN-DATA-ENTITIES.md) | `definePluginDataFeature`, the shared `PluginDataStore` and its write semantics. |
| [Data-driven forms in the plugin runtime](development/RUNTIME-FORMS.md) | `defineForm`, the `DataForm` component, supported kinds, rejected CLI-only constructs and value semantics. |
| [Modal and notice services](development/MODALS-AND-NOTICES.md) | `services.modals` and `services.notices` APIs. |
| [Runtime events and owned notifications](development/RUNTIME-SERVICES.md) | Native observations, notification timing, queues and recovery actions. |
| [Setup and identity](development/SETUP-IDENTITY.md) | `npm run setup` profiles, identity flags, resume and data migration. |
| [Maintainability measurement](development/MAINTAINABILITY.md) | Fallow-based metrics, report layout and retained-result validation. |
| [Typed event bus](architecture/EVENT-BUS.md) | EVT-01–16 contract, descriptors, `events:catalog` and `events:check`. |
| [DocumentCreationService](architecture/DOCUMENT-CREATION.md) | DOC-01–20 contract for entity-driven note creation. |
| [Error handling and notifications](architecture/ERRORS-AND-NOTIFICATIONS.md) | ERR-07–18 and NTF-01–12 contract. |
| [Modular CSS and composed styles.css](architecture/STYLES.md) | CSS-01–12 contract for the shared style pipeline. |
| [Obsidian tokens](design/OBSIDIAN-TOKENS.md) | Native host tokens, aliases and the pinned fixture ([`obsidian-tokens.json`](design/obsidian-tokens.json)). |

**CLI, compiler and generated projects**

| Page | Facts |
| --- | --- |
| [Framework CLI](development/FRAMEWORK-CLI.md) | `node bin/app` commands: `new`, setup, check gate, kit/ZIP workflow. |
| [Generated command reference](user-manual/shell-cli/generated/reference.md) | Command syntax generated from the CLI catalog; [diagnostics](user-manual/shell-cli/generated/diagnostics.md) too. |
| [Data-only operation protocol](development/OPERATION-PROTOCOL.md) | Capability discovery and the request/result operation protocol. |
| [Companion project compiler](development/COMPANION-GENERATOR.md) | Generator journey, supported contracts and generated-project contents. |
| [Dedicated compiler](development/compiler/README.md) | Compiler commands and boundaries; [diagnostics](development/compiler/DIAGNOSTICS.md) lists every code. |
| [Companion project JSON](development/COMPANION-PROJECT-JSON.md) | How the shell accepts a saved schema 6 authoring definition. |
| [Public Companion project contract](development/COMPANION-PROJECT-SCHEMA.md) | Project schema 6 discovery and validation commands. |
| [Companion sitemap core](development/COMPANION-SITEMAP-CORE.md) | Framework-free sitemap model and its read-only CLI integration. |
| [Focused sitemap authoring](development/AUTHORING-EXPERIENCE.md) | Focus, arrange and position behavior of the sitemap editor. |
| [Companion starters](development/COMPANION-STARTERS.md) | Golden starter, feature showcase and their sources of truth. |
| [JSON-defined project starters](development/JSON-STARTERS.md) | Starter contract v1 and `configs/starters/`. |
| [Selected generation](development/SCOPED-GENERATION.md) | `generate --scope` for features, pages and components. |
| [Declarative actions](development/GENERATOR-DECLARATIVE-ACTIONS.md) | Action declarations and native note generation. |
| [Providers and relationships](development/GENERATOR-PROVIDERS-AND-RELATIONSHIPS.md) | Declaration-to-code mapping for providers, relationships and test data. |
| [Generated project plugins](development/GENERATED-PROJECT-PLUGINS.md) | The plugin system emitted into generated applications. |
| [Workbench plugins](development/WORKBENCH-PLUGINS.md) | The SDK for extending Workbench itself ([`plugins/`](../plugins/README.md)). |
| [UI implementation status](development/UI-STATUS.md) | What `node bin/app ui status` reads and reports. |

**Testing and evidence**

| Page | Facts |
| --- | --- |
| [Test suites](testing/TEST-SUITES.md) | Every suite, its command, runner, prerequisites and workflows; how to add a test. |
| [Executable evidence](testing/EXECUTABLE-EVIDENCE.md) | Evidence adapters and the [acceptance crosswalk](testing/acceptance-crosswalk.json). |
| [Legacy test plan and baseline](testing/TEST-CONCEPT.md) | The [`test-plan.json`](testing/test-plan.json) contract, `verify-baseline` command and evidence identity. |

**Delivery and CI**

| Page | Facts |
| --- | --- |
| [GitHub Actions workflows](development/WORKFLOWS.md) | Every workflow's tier, triggers, jobs, permissions, artifacts, required checks and the repository policy. |
| [Increments reference](development/INCREMENTS-REFERENCE.md) | Increment, PullRequest and Issue documents, statuses and transitions, edit locks, branches, the sync record, error codes and JSON results of `increment`, `pr` and `issue`. |
| [Definition of Ready and Done](development/DEFINITION-OF-READY-AND-DONE.md) | Every DOR and DOD rule with its severity, kind-aware gate selection, exemptions, acceptance stubs, configuration and workflows. |
| [Quality assurance](development/QUALITY-ASSURANCE.md) | Source assurance checks, `npm run verify` steps and reports, and the self-review guard rules. |
| [Maintenance and release contract](development/MAINTENANCE-AND-RELEASE.md) | Dependency, freshness and release requirements (normative). |
| [Release operation plans](development/RELEASE-OPERATION-PLANS.md) | The offline draft/promotion plan input and output contract. |

**Product requirements**

| Page | Facts |
| --- | --- |
| [Framework PRD](product/PRD.md) | Reusable Obsidian shell requirements and acceptance IDs. |
| [Authoring and native-plugin PRD](product/COMPANION-PLUGIN-PRD.md) | Workbench authoring scope and native conversion requirements. |
| [MVP PRD: JSON to clickdummy](prds/MVP-JSON-TO-CLICKDUMMY.md) | Bounded end-to-end MVP obligations. |
| [MVP-QR-01 boilerplate quality](product/MVP-BOILERPLATE-QUALITY.md) | Mandatory operational boilerplate quality requirement. |
| [Design constraints](../DESIGN-CONSTRAINTS.md) | Cross-product constraint register with stable DC IDs. |
| [Specification 0.7](product/SPECIFICATION-0.7.md) and [baseline 0.4](product/BASELINE-0.4.md) | Retained earlier requirement versions that later PRDs still cite. |

## Explanation

| Page | Background |
| --- | --- |
| [Product vision](product/PRODUCT-VISION.md) | Why Workbench exists, for whom, and what success means. |
| [Product principles](product/PRODUCT-PRINCIPLES.md) | Decision rules behind declarative authoring, documentation and quality. |
| [Delivery strategy](product/DELIVERY-STRATEGY.md) | Why the framework ships before the companion conversion. |
| [Product and delivery overview](../SHELL-FIRST-OVERVIEW.md) | How the authoring experience, CLI, compiler and shell fit together. |
| [Framework guide](development/FRAMEWORK-GUIDE.md) | The reusable developer API and the path from feature to qualification. |
| [Delivery pipeline](development/DELIVERY-PIPELINE.md) | Why checks tighten from draft to ready to release, how the tiers gate, and why publish merges before it tags. |
| [Repository layout](development/REPOSITORY-LAYOUT.md) | What each top-level folder owns and the dependency direction between them. |
| [Presentation concerns](development/PRESENTATION-STRUCTURE.md) | Why Vue markup, composables, stores and context are separated. |
| [Entity-backed Markdown documents](development/ENTITY-DOCUMENTS.md) | The full entity-to-Markdown contract and its design. |
| [Guided setup and makers](development/SETUP-AND-MAKERS.md) | The complete target for setup and maker tooling. |
| [Companion handoff](development/COMPANION-HANDOFF.md) | One artifact, two front ends: terminal and companion. |
| [Companion on the shell](architecture/COMPANION-ON-SHELL.md) | Proposed architecture: the companion as a shell consumer. |
| [Companion threat model](security/COMPANION-THREAT-MODEL.md) | Trust boundaries, assets and the test map. |
| [Compiler architecture](development/compiler/ARCHITECTURE.md) | Compiler layering and dependency direction. |
| [Compiler integration after PR28](development/compiler/POST-MVP-INTEGRATION.md) | How the compiler became the single pipeline. |
| [Test strategy](testing/TEST-STRATEGY.md) | The testing approach and the normative TST-01–16 rules. |
| [Harness styles](testing/HARNESS-STYLES.md) | Why the host stylesheet is separate and what frontend evidence means. |
| [Milestone context](development/MILESTONE-CONTEXT.md) | How the recent milestones relate; links into historical records. |
| [Upstream lint dependency exception](development/ITERATION-TWO-DEPENDENCY-EXCEPTION.md) | The unresolved nested ESLint 9 support criterion (normative). |
| [Moment advisory exception](development/MOMENT-ADVISORY-EXCEPTION.md) | The open `moment` advisory through the Obsidian API package and why `check:security` still fails. |
| [Hindsight and Git/GitHub](development/HINDSIGHT-GIT-GITHUB.md) | Research and decisions behind the optional memory integration. |

## Delivery and CI

Work moves from idea to release through progressive tiers: a draft pull request
runs the fast Dev tier, marking it ready runs the Integration tier, and a
`release/X.Y.Z` branch runs the Release tier before an owner-dispatched Publish.
Start with the [delivery pipeline](development/DELIVERY-PIPELINE.md) explanation,
then [deliver a change](development/DELIVER-A-CHANGE.md) or
[cut and publish a release](development/CUT-AND-PUBLISH-A-RELEASE.md); the
[workflow reference](development/WORKFLOWS.md) lists every workflow. Work is
planned as increments (`node bin/app increment`, `pr`, `issue`): start with
[your first increment](development/FIRST-INCREMENT.md); the checks are in
[Definition of Ready and Done](development/DEFINITION-OF-READY-AND-DONE.md). Changes are
recorded in [`CHANGELOG.md`](../CHANGELOG.md) (Keep a Changelog) at the repository root.

## Plans and backlog (not Diataxis)

These record intended work and acceptance; they are not implementation evidence.

- [Product documentation map](product/README.md): how vision, requirements, plans and evidence relate.
- Product plans: [MVP improvement plan](product/MVP-IMPROVEMENT-PLAN.md), [MVP vision acceptance](product/MVP-VISION-ACCEPTANCE.md), [companion improvement plan](product/COMPANION-IMPROVEMENT-PLAN.md).
- [Published distribution plan](development/PUBLISHED-DISTRIBUTION-PLAN.md): shipping Workbench without cloning this repository.
- [PRDs](prds/README.md), including the [MVP implementation plan](prds/MVP-IMPLEMENTATION-PLAN.md).
- [Requirements](requirements/README.md): typed MVP PBIs, governance, traceability and progress.
- [Delivery tasks](tasks/README.md): shell, concept, companion and publication tasks.
- [Research](research/README.md): new research notes.

## Workspaces

- [`concepts/`](concepts/): companion concept and prototype workspaces with their own code and tests, for example the [authoring concept](concepts/companion/README.md) (the schema 6 build base of `npm run companion:build`), the [sitemap editor](concepts/sitemap-editor/README.md), [Jev Studio](concepts/jev-prompt-editor/README.md) and the [concept intake example](concepts/concept-intake-example/README.md).
- [`design/`](design/): per-prototype Claude Design folders (`docs/design/<prototype>/`) and the Obsidian token catalog.
- [`memory/`](memory/README.md): reviewed decision records for optional project memory.
- [`licenses/`](licenses/): retained third-party license texts and their provenance.

Docs next to the code: [`src/features`](../src/features/README.md),
[`plugins`](../plugins/README.md), [`scripts`](../scripts/README.md),
[`harness/styles`](../harness/styles/README.md) and the CLI guides in
[`bin/`](../bin/README.md) (for example [project starters](../bin/PROJECT-STARTERS.md)).

## Skills

Claude Code skills live in [`.claude/skills/`](../.claude/skills/) with thin Codex
adapters in `.agents/skills/`. This index is framework-only: generated projects do not
receive it and carry their own skill set.

- [Ideation skill chain](../.claude/skills/ideation-journey/references/chain.md): six chained skills from a brainstorm to a prototype boilerplate (`ideation-journey`, `-brainstorm`, `-concept`, `-design`, `-prototype`, `-boilerplate`), handing off to `increment-handoff` and then `feature-delivery`.
- [Increment handoff](../.claude/skills/increment-handoff/SKILL.md): plan one increment with `node bin/app increment new` and refine it with the user, in its kick-off pull request, until the Definition of Ready passes; split or escalate to ideation when it is not just under-specified.
- [Feature delivery](../.claude/skills/feature-delivery/SKILL.md): plan change pull requests stacked on the increment branch with `node bin/app pr new`, keep them through the Dev tier, pass the Definition of Done, prepare them for the Integration tier and merge them green on request.
- [Release](../.claude/skills/release/SKILL.md): choose the version, dispatch the cut, follow the Release tier, publish on explicit request and verify the result.
- [Self-review](../.claude/skills/self-review/SKILL.md): check a change against AGENTS.md and run the real gates before handover.
- [Adopt an existing project](../.claude/skills/adopt-existing-project/SKILL.md): write an adoption plan for an existing project.
- [Companion prototype design](../.claude/skills/companion-prototype-design/SKILL.md): design-first discovery and prototype prompts (framework only).
- [Project memory](../.claude/skills/project-memory/SKILL.md): use optional Hindsight without silent opt-in.

## Archive

Historical plans, reviews, iteration and execution records, dated research and
retained evidence live in [`_archive/`](_archive/README.md). They are not
maintained and not normative unless a current page links them as such.

## How to write docs here

- **One type per page.** Decide whether the page teaches (tutorial), solves a task
  (how-to), states facts (reference) or explains (explanation), and keep it to that.
  Link to the other types instead of mixing them in. Add the page to the matching
  section above and put a `> Type: <type> · Part of the [docs index](...)` line
  under its title.
- **Where new pages go.** Runtime and CLI guides go in `development/`, contracts
  in `architecture/`, testing pages in `testing/`, optional tools in `tooling/`,
  requirements in `product/` or `prds/`, and research notes in `research/`. Most
  pages under `architecture/`, `development/`, `testing/`, `tooling/`, `security/`,
  `design/`, `project-setup/` and `user-manual/` ship to generated projects as
  framework reference; plans, records and maintainer pages do not. The exact rule
  is `bin/compiler/emitters/framework-scope.ts`.
- **Status headers only when needed.** Add a status line only for a page whose
  authority is limited (a proposed contract, a plan, a retained target). Describe
  the current state, not the iteration or pull request that produced it.
- **Archive instead of deleting.** When a page becomes a historical record, move
  it under `_archive/` with `git mv` and follow the
  [archive checklist](_archive/README.md#archiving-a-document).
- **Keep links working.** Paths are referenced by code, tests and templates; do not
  move a current page. Run `npm run check:repository` for the README, AGENTS.md
  and CHANGELOG links.
