# Full-project JSON, self-project and folder settings

> Current composition increment: [Layout, tokens, slots, revisions, scenarios and complete self-project](COMPOSITION.md). [Verification scope](COMPOSITION-VERIFICATION.md). Earlier increment-specific version/count statements below retain their historical scope.
**2026-09-24 · Concept extension with a real read-only shell entrypoint.**

The HTML prototype contains a loadable **Plugin Companion** project. It uses the same editors, persistence, import review and JSON contract as a user-authored project; it is not a separate hardcoded presentation or a second active project. The existing simpler example and blank-project entry remain available.

## Use the companion self-project

Open `index.html` and choose **Load companion project**. Review the proposed project and explicitly confirm. For an existing project, the dialog names the replacement, offers **Export current project**, and requires the same confirmation. The model contains:

| Authored area | Included example |
| --- | --- |
| Identity and purpose | Plugin Companion, `plugin-companion`, version 0.1.0, design-to-shell outcome |
| Surfaces | 24: workbench, 19 internal screens including Storymaps overview/detail, Preferences, and three transfer/handoff dialogs |
| Requirements | 5 PRDs and 30 mapped requirements covering discovery, structure, composition, test-data/handoff and operational safeguards |
| Components | 54 retained definitions: 44 starter contracts and 10 project-owned companion components, with content and default/compact variants |
| Domain | 11 entities and 7 relationships |
| Source and test data | One proposed native-vault port, three declared read operations/usages, and three deterministic test recipes |
| Storymaps | One editable map with two activities, three steps, five stories, two releases and PRD/sitemap/requirement links |
| Design System | Host-friendly font roles, typography, spacing, sizes, radii, paired colors and guidelines |
| Notes | Shell-first implementation boundary and explicit read-only v1 scope |

This is an authored concept model, **not an exhaustive reverse-engineering of every implementation function**. Requirements are design-mapped, not marked implemented. Source ports describe proposed native behavior; no live vault access occurs. The model does not fabricate passed builds, test execution, publication, trust or installation.

The standalone [companion-project.json](companion-project.json) is generated from this same seed. Browser tests assert full-document equality so the built-in project and example file cannot drift unnoticed.

## Export and import

**Overview → Export project JSON**, **Preferences → Export project JSON**, or the command palette opens the full JSON preview/download. Export includes every saved authoring subsystem, project notes and folder settings. Raw recovery snapshots, transient sessions and the older blueprint-only handoff remain distinct.

**Import project JSON** accepts a local JSON file or pasted JSON. File selection is the preferred route for large pretty-printed exports. Review shows identity, counts, configured folders and outstanding design findings before explicit replacement. Malformed models and unsupported formats fail before mutation. Incomplete but structurally valid designs remain drafts rather than being forced into a false ready state.

Import/export is a semantic round trip: object formatting may be normalized on browser export, but saved authored fields retain their values. In contrast, the shell's v1 stdout is an exact byte return of its input file, including whitespace. Nothing executes inside the JSON.

## Format compatibility

New exports use full-project `schemaVersion: 3` with `design.schema: 3`, including optional `design.storymaps` and `design.detailDesigns` collections (each subsystem schema 1). V2 projects remain importable without detail documents. Detail data concealed in a v1/v2 envelope is rejected. See [Detail editors](DETAIL-EDITORS.md) for owner references, instance contracts, limits and generator boundaries. V1 projects without storymaps remain importable and start with an empty collection. Storymaps hidden in a v1 envelope and unsupported versions fail before mutation. Saved maps and unresolved external references survive the reviewed JSON round trip; viewports, selection and drafts do not travel. See [Storymaps](STORYMAPS.md) for the model and editing rules.

## Settings and shell handoff

Open **Preferences → Configure project folders**. Defaults are `src` for code and `tests` for tests. Save both as separate portable paths relative to the future project target. Changes are persisted and included in JSON; invalid or overlapping folders are rejected.

**Prepare → Project JSON → shell** explains the invocation:

```sh
npm run --silent companion:generate -- --input "plugin-companion.companion.json" --vault "/path/to/vault" --target "plugins/companion"
```

The script validates the envelope and vault-contained target, then prints the original JSON. It does not generate boilerplate yet. Changing these folders does not relocate the existing shell, alter its build configuration, or change the older illustrative scaffold previews. Those remain separate from this new versioned handoff.

Read the [canonical contract, CLI reference and safety boundary](../../development/COMPANION-PROJECT-JSON.md) for all field definitions, default/path rules, excluded state and reproduction commands.

## Interaction safeguards

The importer has a review-before-replace flow, explicit acknowledgement, current-project export, stale-review/storage checks and rollback after save failure. It refuses replacement during active operations and does not silently discard an edited Project.md. Late completion of a closed or superseded file selection is ignored. Confirmation controls do not masquerade as unsaved content; editing the JSON invalidates the candidate without rebuilding a large textarea on each keystroke. Folder drafts retain the existing keep/discard protection.

A first version is not a migration/import-merge engine, native companion conversion, publication package or full boilerplate compiler. Keep shell qualification first and native conversion/publication behind their existing gates.
