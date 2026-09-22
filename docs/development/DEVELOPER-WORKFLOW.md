# Developer workflow

> **Status:** Target experience for PRD 0.4. The repository contains specifications, not working npm commands or a plugin. All commands/API references below describe the required implementation.

Start here, then read the [setup/maker contract](SETUP-AND-MAKERS.md), [entity-document recipe](ENTITY-DOCUMENTS.md), [events](../architecture/EVENT-BUS.md), [styles](../architecture/STYLES.md), and [release guide](MAINTENANCE-AND-RELEASE.md) as needed. The [PRD](../product/PRD.md) holds the complete requirements.

## 1. Obtain the template and run setup

With supported Node/npm installed, open the template directory and run:

```sh
npm run setup
```

No separate project-dependency install comes first. The Node-only bootstrap reviews identity, profile, file edits and selected downloads, runs the locked install, provisions selected tools/vault artifacts, builds/checks the chosen scope, and prints the next action. It exits instead of starting an indefinite watcher.

Git is recommended; a source download without .git still supports browser setup. Setup never installs Node itself, globally changes the machine, silently edits security preferences, publishes, or creates example Tasks in a user's vault.

```sh
npm run setup -- --dry-run
npm run --silent setup -- --id field-notes --name "Field notes" --author "Your name" --repo your-account/field-notes --profile browser --no-interaction --yes --json
```

Dry run makes no filesystem/network changes before dependencies exist. Missing noninteractive answers fail rather than hang. Repeat validates/resumes without overwriting user edits. The plugin ID is not blindly inherited from the template repository name. Current exact compatibility comes from the qualified record, not dated research numbers; setup installs that lockfile rather than upgrading it.

## 2. Generate a feature and an entity

```sh
npm run make -- --list
npm run make -- feature tasks
npm run make -- entity task --feature tasks --document
npm run dev:ui
```

An interactive make chooser and per-maker help explain inputs. The feature recipe provides a small real shell/action/fixture. The entity recipe adds typed fields/defaults/validation and a separate document mapping/template with tests. It creates source, not user notes. Select noncolliding names and inspect the plan rather than blindly rerunning a composite recipe.

Other recipes cover native views/commands/modals/settings, components/stores/use cases, typed events/listeners, CSS modules/locales, and custom makers. Use dry-run/noninteractive JSON for agents. No GNU Make, PHP, global alias, or remote boilerplate service is required.

Generated code is ordinary developer-owned source with explicit wiring. Edited files are preserved; no blanket force. A scaffold can remain explicitly unfinished but must never fake a successful business action.

## 3. Create Markdown from a Task

Define Task values once and separately choose its destination, filename, allowed frontmatter, and body. The shared DocumentCreationService then handles the safe pipeline; presentation does not call Vault or build YAML itself.

The intended call is:

```ts
const result = await documentCreationService.create({
  entity: 'task',
  values: {
    title: 'Prepare release checklist',
    due: '2026-09-30',
    tags: ['work', 'release'],
  },
  requestId: submissionId,
});
```

The form retains submissionId across a retry. The service supplies managed identity/type/schema and defaults, returns a typed receipt, and publishes documents.created only after confirmed creation. Note opening is separate. A failed open action must not imply the note was not created.

For review, prepare returns a no-write Markdown/path plan; commit uses the same values after revalidation. Invalid input, cancel-before-write, unsafe paths and collisions create no unintended note. Cancellation during an already-started write reports its actual outcome rather than deleting a successful result.

A Task note stores its structured fields in frontmatter and notes in the body. It is canonical Markdown, not a duplicate of a Task list in data.json. This does not deliver a complete Todo index, synchronization system, or automatic old-note migration. See [the definition and output example](ENTITY-DOCUMENTS.md).

## 4. Make a manual change

The manual first-change recipe adds an optional description to the original generic example item. Validate it, extend the existing use-case input/output, handle old data safely, add a labeled Vue field/locales/styles, and test success/reload/failure. Do not introduce a second writer or new infrastructure for an ordinary field.

For a note-backed entity, update its schema and explicit document projection intentionally. A new internal field must not silently appear in frontmatter. Changes to definitions do not rewrite existing notes; any update/migration is separately designed.

Most changes do not touch main.ts. New registrations go in small composition modules, and domain values stay independent of native/UI APIs.

## 5. Events and styles

One typed bus per runtime, scoped subscriber/publisher facades, post-success facts, and explicit cleanup. Late views query canonical state and then observe changes. Do not turn a service call requiring a result into an event command. Native host events enter through the supported bridge with startup replay/nullable/file-folder guards.

For document creation, raw host entry-created and canonical documents.created are not two Task creations. Handle invalidation deliberately and do not rely on a cache being current when the write returns. Subscriber failures cannot roll back a completed write.

Author small CSS modules and component-owned styles, never generated output:

```text
ordered CSS source + compiled Vue SFC styles → dist/styles.css
```

Style makers wire the file into the correct graph. Native roots need their namespace/tokens. Task forms reuse the existing composition. The browser development path shares sources; artifact-fidelity checks use the actual candidate stylesheet with matching component identifiers.

```sh
npm run styles:check
npm run events:check
npm run entities:check
```

These checks complement normal verification; they do not create user content. Catalogs are derived from registrations, not competing manually maintained schemas.

## 6. Main commands

| Command | Purpose |
| --- | --- |
| setup | Guided install/configuration/readiness and safe resume. |
| make -- <kind> | Reviewable integrated scaffolds. |
| dev:ui | Real-component browser HMR without Obsidian. |
| dev:local | Successful complete JS/CSS/manifest builds installed into the approved vault. |
| verify | Complete ordinary checks after explicit provisioning. |
| release:prepare -- --version X.Y.Z | Metadata preparation, not publication. |
| help / doctor | Safe discovery and prerequisite diagnosis. |

Use targeted tests and verify:fast during edits, then verify before handoff. No silent tool downloads/watchers inside verification. test:setup is the focused provisioning operation reused by setup. Native-sensitive work additionally runs test:obsidian or the documented manual procedure.

## 7. Native development

Default installation is .dev-vault/.obsidian/plugins/<plugin-id>/ inside the repository. Open that vault and make any required Community-plugin enabling decision yourself. Never test against important personal notes by default.

Local builds preserve data.json, existing notes, unrelated plugins/configuration/security. Failed JS/CSS builds retain the last good matching set. Repository-root-vault mode is explicit and uses the same safeguards, not an inferred .obsidian folder.

Optional official CLI operations validate the fixture vault/capabilities. Missing CLI gives a manual fallback; browser work stays independent. Synthetic document tests are permitted only inside the declared disposable test vault, not as unsolicited startup data.

## 8. Harness and recovery

A declared URL can choose scenario/locale/theme/seed, for example `/?scenario=storage-failure&locale=de&theme=dark&seed=42`. Cover normal and failure flows, lifecycle/multiple views, real events, exact styles, and actual emitted Markdown—not only a happy-path screenshot.

| Failure | Required recovery |
| --- | --- |
| Bootstrap/install/provisioning failure | Identify prerequisite/stage, preserve edits, resume still-valid steps, no unpinned install fallback. |
| Non-TTY missing input | Explicit missing keys, no prompt hang. |
| Maker conflict/unreachable code | Show affected paths/registration; preserve edits and repair real wiring, not suppress fallow. |
| Duplicate events/leaked listeners | Inspect runtime/bridge/view ownership and startup behavior. |
| Missing styles | Check graph/SFC identifiers/native namespace/current artifact hashes; no second runtime stylesheet. |
| Invalid entity or future schema | Validate/preserve; do not override properties or rewrite existing notes. |
| Document path/conflict/uncertain write | Fail safely or reconcile the known candidate; no overwrite/blind new-filename retry. |
| Note created but opening/indexing fails | Accurate follow-up status, no duplicate creation. |
| Host/browser unavailable | Explain provisioning and report not run. |
| Port conflict | Reject unrelated process or explicitly choose another port. |
| Release permission failure | Explain least required permission, not an unrestricted token. |

The runner owns its server/readiness and current artifact identity. Golden screenshots change only after review. Browser fakes and native/device tests prove different scopes.

## 9. Remove examples, hand off, release

Removal covers feature/entity definitions, registrations, event/catalog entries, style imports, fixtures/tests/locales while preserving shared infrastructure. Test both the generic plugin-data example and Task-note recipe removal; no retained duplicate authority or hidden analyzer exception.

A handoff names actual changes/commands/results/artifacts, compatibility/schema impact and untested scope. Generated volume and mock success do not establish functionality.

Use the [maintenance/release guide](MAINTENANCE-AND-RELEASE.md) for reviewed updates, fixed-commit candidates, exact native acceptance and explicit promotion. Directory approval is separate from GitHub release creation.
