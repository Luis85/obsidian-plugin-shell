# Single-vault project workspace

> Product decision and concept implementation: 2026-09-24. Baseline `5d998f5de40e36e59382fa17d019c06879da02c3`. This changes the companion concept and proposed native product contract, not the installed root-template runtime. See [PRD v0.3](../../product/COMPANION-PLUGIN-PRD.md) and [verification](SINGLE-VAULT-VERIFICATION.md).

## 1. Core decision

**One Obsidian vault contains one developer project. The vault root is the project/source root.** A different project is opened as a different vault through Obsidian. There is no companion project registry, source-root picker, external attachment flow or nested project-creation directory.

The intended journey is:

1. Create an empty folder and open it as an Obsidian vault.
2. Install and enable the companion in that vault.
3. Define this project and design its requirements, entities, relationships, views, content and component variants.
4. When ready, review and prepare the template in the same root.
5. Implement through the existing CLI/editor workflow and verify the resulting plugin.

Steps 1–2 happen outside the companion. Design initialization is not template initialization. A missing Node/npm installation blocks preparation, not project definition or design. A complete design is not mandatory before every development action; the developer can iterate between design and implementation in the same project.

A plugin name, public plugin ID, project ID and vault folder name are different concepts. Renaming the display name must not rename the folder, change entity ownership, or create another project. The native project ID will be a durable unique identifier; the browser fixture uses `vault-project` within a fixed simulated vault context.

## 2. Authoring context versus runtime test context

| Context | Responsibility | Boundary |
| --- | --- | --- |
| Current authoring vault | Project brief, requirements, sitemap, components, decisions and source tree | Root comes from the actual host. The companion is installed here and remains protected. |
| `.dev-vault` within the source root | Isolated runtime testing of the generated plugin | Uses the existing contained-target installer contract. It is not a second managed project. |
| Staging/cache | Downloaded and validated qualified template bytes | Owned bounded staging, outside the authoring root until an exact additive plan is approved. |
| CLI/editor | Real source editing, setup, makers, build and verification | Existing shared tooling stays canonical and usable without the companion. |

The browser concept shows `/workspace/plugin-workspace` as its fixed authoring-root fixture. It neither detects a local path nor creates a vault. `.obsidian` is the fixture profile, **not** an assumption that every native vault uses that name. The real adapter must resolve and protect the actual host profile and retained configuration directories.

Installing the companion does not install or enable the developer's output. Deployment, test-vault opening and generated-plugin enablement remain separate deliberate actions. This change does not introduce arbitrary external-vault deployment, reload bridges, private APIs or changes to Restricted Mode.

## 3. Workspace and first-use interaction

The fresh overview reads **This vault. One project.** Its primary action is **Start designing**. Name and portable generated-plugin ID define the project; author information can wait until preparation. The chosen project record is visible through **Project record**, including a preview/export of the illustrative `Project.md`.

The sidebar keeps a non-interactive vault/project identity and these destinations: Project overview; Product requirements; Sitemap & views; Entity relationships; Component library; Blueprints; Action patterns; Prepare project; Generate; Develop; Quality; Capabilities; Release preparation; Runs & recovery. Runtime destinations explain preparation until the toolchain phase is ready. Their backend simulation actions also reject unprepared calls; hiding buttons alone is insufficient.

The existing graph experience is retained: view containers, internal screens, organizational groups, independent visual sections, editable connection captions/endpoints, reusable versioned components, per-instance content, drafts, Undo/Redo and reviewed boilerplate previews. Selecting a blueprint changes the current design rather than creating a detached project.

**Use example outline** seeds a planning-only example when no project exists. It is not a project switcher and does not fabricate completed setup, trust, build, install, native or browser evidence. Repeating it cannot replace an existing project. The six-step tour explains the single-project context, design-first order, preparation, test-vault separation and evidence/recovery without starting operations.

## 4. Native authoring records

Proposed default layout, not a claim that this concept writes native files:

```text
current-vault/
  Project.md                  # One canonical project descriptor and human brief
  project/
    requirements/             # PRDs and requirements with stable IDs
    views/                    # View/screen/group design entities
    entities/                 # Declared runtime entity schemas and properties
    entity-relationships/     # Source-owned semantic relationships
    entity-sections/          # Visual ER groups, not runtime folders
    components/               # Shared definitions with versioned variants
    connections/              # Typed relationships and endpoint references
    decisions/                # Architecture and product decisions
  .obsidian/                  # Actual host config may use a different name
  src/                        # Added by reviewed template preparation
  scripts/                    # Canonical standalone tooling
  manifest.json
  package.json
  package-lock.json
  .dev-vault/                 # Isolated generated-plugin runtime context
```

Project record frontmatter carries schema, stable project ID, public identity and relative authoring paths. Entity frontmatter carries explicit types, stable IDs and referenced entity IDs. Human descriptions and Markdown bodies remain editable in Obsidian. Root code and project notes belong together in version control; host-private profiles, dependencies, generated outputs, caches and the test vault must not be accidentally committed.

The native UI is a projection of these Markdown records. Plugin preferences store presentation/path preferences, not a second editable project database. Configurable authoring folders must remain within the project and outside protected/runtime directories. Absolute source roots and execution authorization must not be accepted from imported or synced notes.

Required native behavior: safe note updates preserve unrelated frontmatter and handwritten bodies; missing or duplicate descriptors, unsupported schema and ambiguous existing source produce inspect/recovery states. Reopening or moving the vault re-resolves the current root and invalidates machine approvals. Multiple leaves share project state and a single operation owner. Disabling/uninstalling the companion does not delete any authoring or source data.

The current browser implementation instead uses a schema-2 singleton and a virtual file map. The Project.md export is illustrative. It is not the native note serializer, real template manifest or an installable project.

## 5. Additive preparation, not clone-over-root

An initially empty folder is no longer empty after Obsidian/plugin installation and design. Preparation must recognize this as the normal case.

Stage the selected qualified template, inspect it and derive a finite root-relative file plan before touching the authoring root. Missing files are creates. Identical bytes are unchanged. Known owned metadata may receive a separately reviewed update only while its exact preimage matches. Other differing files, case aliases and file/directory overlaps are conflicts. There is no force-overwrite escape hatch.

Protect the actual host profiles, companion installation, Git metadata, existing notes and project design. Do not blindly overwrite `.gitignore`, README or package files merely because the template contains them. The same plan and validation contract must serve the CLI and companion. The browser's six illustrative destinations demonstrate those transitions; actual hydration must derive its manifest from a qualified artifact and retain the lockfile, license and full standalone layout.

Approval binds the current project identity, complete reviewed design, exact root-relative file states, staged artifact, resolved tools and test target. Recheck before execution and between owned stages. Changes to the plan itself cannot extend authorization. A later external edit stops subsequent changes and retains completed work. Multi-file operations require journals and ownership-aware recovery; they are not globally atomic.

Preparation updates the **same** project. It does not append a project, move a detached draft, reset requirements or remap component IDs. Repeated initialization is unavailable once prepared. Normal development and explicitly reviewed future template upgrades are different operations.

## 6. Recovery and migration

| State | User experience and preserved data |
| --- | --- |
| No project | Start designing; no toolchain prerequisite or download. |
| Planning | Reopen the same design; inspect Project.md; prepare when ready. |
| Missing tools/offline acquisition | Keep identity/design/wizard; show blocked stage and recheck. |
| Existing conflicting source | Display exact conflicts; preserve existing bytes and block approval/apply. |
| Interrupted or cancelled preparation | Retain design, project, completed stage writes and failed/cancelled run. Reinspect before resume. |
| Prepared | Continue development; never initialize another project or infer unexecuted quality scopes. |
| Invalid/future saved data | Preserve original data, block writes, expose recovery export; never silently migrate. |
| Legacy multi-project concept | Explicitly choose one valid outline. Preserve/export the complete original workspace and all unselected projects. |

The browser moves from `shell-workbench-concept-v1` to the separate `shell-workbench-single-vault-v2` key. Merely opening it does not overwrite the legacy key. Recovery copies one chosen design into a new planning-only singleton bound to the current fixture root. Old absolute locations, approvals, trust, build/install counters, generated source previews and execution results are not adopted. A missing/invalid identity is explained rather than guessed. Existing schema-2 records cannot supply a different root.

The old-key export preserves raw bytes and may contain private paths/notes. The new recovery export covers committed in-memory concept state, not unsubmitted form drafts. Observed browser storage conflicts block writes, but localStorage compare/write is not an atomic multi-window lock. Native transactions and durable draft restoration require their own implementation/evidence.

## 7. Implemented versus still required

| Implemented in this PR's concept | Native implementation backlog |
| --- | --- |
| Singleton state, current-vault identity, no launcher/switcher | Host-root/config adapter; real single-descriptor discovery and duplicate detection |
| Design-first identity form, same-project blueprint/editor integration, Project.md preview | Entity/DocumentCreationService-backed Markdown persistence and safe external-edit reconciliation |
| Additive review simulation, exact snapshots, conflict rejection, same-project preparation | Qualified artifact staging/hydration with shared file plans, locks and negative filesystem tests |
| Interrupted/cancelled resume, one-outline legacy recovery | Durable migration/journals, machine-local trust, shared operations across native leaves |
| Existing graph/PRD/component regressions plus dedicated single-vault suite | Actual CLI parity, native Windows/macOS/Linux integration, accessible host/device qualification |

The root template's runtime, dependency pins, lockfile and installer safety boundary are unchanged by this concept iteration. No personal vault is accessed and no plugin is published or enabled by these tests.

## 8. Required native acceptance packages

**SV-01 — Define and resume.** Start with a fixture containing only native host/companion files. Without Node, create one descriptor, author requirements/views and reopen. Prove stable IDs and no second initialization from another leaf.

**SV-02 — Preserve a populated authoring vault.** Include manually edited notes/frontmatter, a custom config profile and an existing Git repository. Dry-run and apply a staged artifact. Assert exact preservation of unrelated files, no companion replacement, no profile/security writes and unchanged lock resolutions.

**SV-03 — Reject stale or unsafe preparation.** Exercise case aliases, links/reparse points, path/file conflicts, tampered/oversized archives, changed preimages, concurrent CLI operations and mid-run external edits. Retain safe owned recovery artifacts; never approve an edited plan implicitly.

**SV-04 — Verify isolated runtime and independent development.** Install only a complete accepted candidate into the contained test vault. Require manual enablement and real named native evidence. Stop companion-owned operations on unload; prove CLI build/generation still works after companion removal.

**SV-05 — Recover without data loss.** Test interrupted writes, moved vaults, unknown schemas, duplicate descriptors and legacy imports. Preserve unselected/invalid source, do not sync trust, and do not silently discard drafts.

## 9. Primary platform references

The product choices above are decisions, not platform mandates. Reviewed on 2026-09-24:

- [Obsidian: Manage vaults](https://help.obsidian.md/manage-vaults) — opening an existing folder as a vault and using the host vault switcher.
- [Obsidian: Configuration folder](https://help.obsidian.md/Files+and+folders/Configuration+folder) — `.obsidian` is the default, with alternate retained profiles possible.
- [Obsidian developer: Vault](https://docs.obsidian.md/Plugins/Vault) — visible-note API versus hidden-folder adapter access; safe content updates and rechecking asynchronous preconditions with `Vault.process`.

The [earlier research](../../research/2026-09-23-companion-plugin.md) remains historical context. Its external-source default and multi-project launcher no longer define this product.

## 8. Semantic model and variants

The [semantic-layer contract](SEMANTIC-LAYER.md) extends Design with the entity relationship editor, native-compatible properties, visual sections and generator mappings. The developer project remains singular; business entities describe records in the plugin being built. Component variants share definitions and use explicit versioned upgrades.
