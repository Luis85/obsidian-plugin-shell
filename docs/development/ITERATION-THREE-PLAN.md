# Iteration 03 — entity and repository foundation

Status: implementation and review completed; executed qualification is recorded
separately in [the test record](../testing/ITERATION-THREE.md). Original base: merged
iteration 02, `8ea6e93`. This iteration follows the owner's request to make entity CRUD and
document creation reusable template capabilities, with Task as an example.

Upstream was refreshed to `307e3fd` (PR #2) during implementation. Its TypeScript
quality-tool research/adoption documents are retained; proposed packages remain
proposals unless explicitly implemented and qualified here. The owner's later
code-line policy supersedes earlier physical-line wording.

The owner also confirmed minimal Vue bindings with behavior in TypeScript
composables/stores. All SFCs live under presentation/components; TS context/types
and state have separate directories. Preserve rendered behavior and enforce the
concern boundary with parser-backed positive/negative checks.

Final owner additions make native integration explicit: dedicated modal and notice
services, structured logging/debugging, and a clear command/ribbon registration
entry point. Each has an application contract, host/browser boundary where needed,
ownership/failure tests, and a feature-author guide. Commands share single-flight
execution with their ribbon entries; modal cancellation never implies write
failure, and debug/reporting failures cannot change a committed operation.

## Outcome and scope

Provide small typed entity definitions, separate optional document recipes, and
an entity-bound Markdown repository with create/read/list/update/delete. Prove
reuse with Task and Project (including number/boolean fields), without changing
the generic infrastructure for either example. Markdown stays canonical;
`data.json` remains preferences. Preserve existing schema-one Task notes.

This deliberately extends the retained baseline's create-only scope and its
exclusion of a generic repository hierarchy. It does not introduce an ORM,
query language, automatic migration, synchronization engine or whole-vault index.
Storage is a framework-free port. The first durable implementation is Markdown;
a plugin-data entity backend remains a separate decision/work package.

Owner's subsequent conventions: executable test/workflow filenames describe their
behavior, not the iteration. Historical guides/evidence retain iteration names.
Source budgets now count nonblank code lines, excluding comments across complete
SFCs; physical counts remain diagnostic. Keep 400 source/450 test/100 main limits
and prove correct comment/literal handling with dependency-free gate fixtures.

**Template-first clarification:** Plugin authors work in `src/features/<name>`
through a small author-facing API. Entities/document recipes stay together with
their feature; a single explicit bootstrap registration creates typed repositories
and owns their disposal. Adding a third feature must require no changes to generic
services, host adapters or main.ts. Verify this path with real CRUD and compiler
checks; do not leave authors constructing low-level dependency lists.

## Ordered work and ownership

The owner subsequently approved all three additional planned capability groups:

- **Author tooling:** safe note-feature/entity scaffolding, explicit registration,
  generated contract tests/fixtures, and executable entity catalog/check commands.
- **Identity setup:** dependency-free reviewed identity plans, lockfile-root-only
  metadata edits, browser/native profiles, validated resume journal and explicit
  contained installed-data migration. Runtime/DOM/CSS namespaces follow identity.
- **Runtime services:** owned normalized host-event bridge, notification progress
  delay/lifetime/queue policies, validated recovery actions, locale refresh and
  independent observation. No generic mutation retry or global notification store.

Dedicated subagents implement these concurrently. Setup and makers share one safe
file-plan engine and lock rather than independently mutating project files. The
orchestrator owns identity composition/CSS integration, the fresh generated-project
workflow, package commands, current docs, cross-review and final qualification.
Full UI/custom maker catalog and release promotion remain explicit future scope;
the implemented commands must describe their actual supported recipes.

1. **Foundation audit (orchestrator and specialist reviewers).** Confirm merged
   base, inspect requirements/current graph, establish toolchain and baseline.
   Main remains clean; changes live in `.worktrees/iteration-three`.
2. **Entity/document/repository contracts (architecture implementer).** Own
   domain/application definitions, ports, events, codec and their contract tests.
   Separate UI text parsing from entity values. Preserve create preview identity,
   failure effects and post-persistence facts. Publish storage contracts before
   adapter implementation begins.
3. **Storage integration (adapter implementer).** Own native/browser storage,
   adapter tests and composition wiring, coordinated against fixed contracts.
   Enforce actual host config-directory containment; use coordinated revision
   checks for updates and reversible trash for explicit deletes.
4. **Coverage foundation (quality implementer).** Own coverage configs,
   native/composition/component tests, inventory/gate fixtures and verification
   integration. Tests execute actual services/actions and real components;
   host API test doubles establish adapter contracts, not native qualification.
5. **Template experience and documentation (orchestrator).** Integrate a usable
   CRUD example, describe the short extension path, reconcile stale doc status,
   preserve pending requirements, and maintain a separate iteration inventory.
6. **Independent comprehensive review.** Cross-review architecture, data safety,
   coverage integrity, API ergonomics and template fit. Record findings and fixes.
7. **Improvement and polish.** Fix review findings, simplify awkward extension
   paths, improve copy/error recovery, rerun affected and full required gates.
8. **Delivery.** Commit, push and open a PR with exact evidence and limitations.
   Do not merge or publish. Ask the owner for the next step after opening the PR.

Delegation uses the session's capable coding/reasoning model for implementation
and separate reviewer contexts; model names alone are not a quality gate. Shared
contracts/configuration have one owner, with review after integration.

## Safety and compatibility decisions

- Definitions validate unknown inputs and preserve absent versus false/zero.
- Document mapping is explicit; managed keys cannot be supplied by form input.
- Preview is read-only; commit writes exactly the reviewed complete document.
- Read/list never repair or rewrite notes. Invalid/future owned records are
  explicit failures. Existing Task IDs, paths and creation times remain stable.
- Updates require the last-read revision and preserve handwritten body and
  unrelated frontmatter. Stale snapshots cannot overwrite current content.
- Delete requires an explicit action and revision check, using reversible trash.
  Host trash has no assumed cross-process compare-and-delete transaction; document
  the residual external-writer race rather than promise atomic deletion.
- Uncertain writes cannot be blindly retried. A follow-up event/open/notice
  failure does not relabel an already committed write.
- Approved folder boundaries and the actual host config directory apply to every
  CRUD operation. Domain/application do not import host/framework APIs.

## Acceptance gates

Production TS/Vue coverage includes every input (including untouched files):
90% lines/statements/functions and 85% branches. Domain/application/features independently
meet 95% lines/statements/functions and 90% branches. Retain existing selected-core
floors and missing-input negative probes. No exclusion or threshold weakening.

Contract tests cover exact bytes, two different entities, invalid schemas/fields,
falsy defaults, old notes, no-write previews, duplicate requests, concurrent and
stale edits, manual changes, unknown properties/body preservation, corrupt/future
data, containment, storage faults, uncertainty, events and disposal. Real-component
tests and served flows prove application integration separately from coverage.

Run qualified Node 24.21.0/npm 11.19.1 with exact lockfile, `npm run verify`, both
coverage commands, served E2E and live all-category security audit. Record actual
results and artifact hashes. Native testing requires the approved isolated host
fixture; no personal vault or global installs. Existing lint dependency support
exception remains open unless supported upstream changes actually resolve it.

Full setup identity migration, general makers, example removal automation,
expanded host events/notification policies, mobile/device qualification and public
release readiness remain pending. Iteration tests do not promote the retained
legacy acceptance inventory wholesale.
