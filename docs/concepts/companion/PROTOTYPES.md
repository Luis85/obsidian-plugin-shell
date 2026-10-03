---
type: feature-guide
id: WB-PROTOTYPES
status: implemented-pending-hosted-verification
product: Workbench
feature: manage-maintain-prototypes
baseline_pr: 5
---
# Manage and maintain prototypes

Explore different solutions inside one project without changing the design used by the boilerplate generator. A prototype contains named versions; each version contains complete saved variants. Sitemap A and sitemap B can therefore have independent pages, routes, journeys, interactions, component definitions, data-source declarations and mock-data recipes.

The project ID remains shared. A prototype version such as `v1` or `v2` is a design checkpoint, **not** the application's release version or a Git branch. Display names and variant hypotheses describe the experiment; portable, immutable slugs determine paths.

## Open the feature

With the repository's qualified locked toolchain installed, run `npm run companion:build`, then open `reports/companion-mvp/companion-journey-lens.html`. Import or create a project and select **Manage prototypes** in the sidebar. Do not edit the retained v5 `docs/concepts/companion/index.html` fixture.

**New prototype** captures the entire working design as version `v1`, variant `main`, status `draft`. **Fork variant** copies a saved variant; it never aliases the original. **Open in editors** replaces the working design after confirmation but does not activate the variant. **Save working design here** explicitly updates the selected editable draft. Save current work before opening another snapshot; the confirmation does not automatically capture unsaved work.

For the sitemap A/B use case: capture A, fork `sitemap-b`, open B in the editors, modify its sitemap, return to Manage prototypes, select B and save the working design there. Both saved solutions remain available. Approve and activate A or B separately when deciding which should generate source.

## Status and generation rules

| Status | Saved content | Generator use |
| --- | --- | --- |
| `draft` | Editable when its version is unsealed and prototype unarchived. | Not selected. |
| `review` | Read-only; return to draft for changes. | Not selected. |
| `approved` | Read-only; eligible for explicit activation. | Not selected until activated. |
| `active` | Read-only pinned snapshot. | The single default generation source for the project. |
| `archived` | Retained; restore to draft before further review. | Never selected. |

Activating an approved variant changes the previous active variant to approved. Deactivation clears the selection; managed generation then fails closed. Selection in the browser, opening an editor, saving a draft, creating a version and restoring an archive never implicitly activate anything. Approval is a design decision, not evidence of build quality, native acceptance or release authorization.

**Seal version** freezes saved content and variant membership. Lifecycle statuses may still change; a seal is not an approval. **New version** deep-copies every variant from the selected version as new drafts, leaving the original checkpoint and active selection unchanged. Active prototypes cannot be archived until another variant is activated or the selection is deactivated. Archival retains files; there is deliberately no destructive delete action.

## Compare, find and maintain saved solutions

**Compare design** compares the selected complete snapshot with the current working copy or another saved prototype/version/variant. It includes all project fields, not just surface counts. Arrays are compared by position, so a reorder can appear as several changes. The preview shows at most 100 changed values or branches and 180 characters per value, with an explicit omitted count. Comparing never edits or activates a variant.

Search the library by name, slug, version label, description or hypothesis; combine it with the status filter. A selection outside the results remains selected and is explicitly identified. Clear filters to reveal all variants. Filtering does not reorder persisted arrays or choose a different generator source.

**Edit prototype details** changes its title/description. **Edit version label** changes an unsealed version's display label. Folder slugs and saved project contents do not change. Sealed version labels are also protected against replacement through import. Form input remains available after validation failure; leaving an unsubmitted form requires confirmation.

## Restore a saved solution without losing the previous draft

Select an editable target draft, choose **Compare design**, and select a different saved reference. **Restore reference into selected draft** first preserves the entire previous draft as a sealed `recovery-N` version, then replaces the target's saved project document. Review and confirm the action. The target's name and hypothesis remain; its snapshot revision advances. The current working editor and active generator selection stay unchanged.

Open the restored draft explicitly to continue in the editors. To undo a restore, compare with its recovery checkpoint and restore that saved reference; this retains another checkpoint rather than destroying history. A sealed/archived target, active/non-draft target, duplicate recovery ID, identical source or exceeded limit rejects the complete change. Recovery must fit within the existing workspace limits.

## Files and interoperability

```text
docs/concepts/
  prototypes.json                         # project registry + single active selection
  <prototype-name>/
    prototype.json                        # metadata, versions, variants, snapshot hashes
    versions/<version>/variants/<variant>/
      project.json                        # complete ordinary authoring project JSON
```

The registry and workspace use format version 1, independently of authoring project JSON v6. The single-file workspace bundle embeds all snapshots; its `active` property is either `null` or `{ "prototypeId": "exploration", "versionId": "v1", "variantId": "main" }`. Each variant records its ID, display name, hypothesis, status, snapshot revision and complete project document. The directory form replaces each embedded document with its derived `path` and SHA-256 digest. It does not introduce a second page/entity schema.

The browser has no real vault access. It stores the library in the **existing project session**, exports workspace JSON for the shell, and offers **Export folders ZIP** with these exact paths. ZIP export requires Web Crypto. **Export active project** downloads only the pinned ordinary project JSON. Active-project filenames include the prototype/version/variant identifiers to distinguish exported alternatives. The existing starter-generation handoff also uses the active saved snapshot; ordinary project backup still exports the working copy. A workspace import preserves the working copy; explicitly open a saved variant to replace it.

To persist a browser workspace safely, use `prototypes import`. Extracting its folder ZIP is a manual filesystem operation outside the shell's guarded plan workflow; do not overwrite an existing managed workspace by blindly extracting over it. Complete exported project JSON can also be consumed through the existing explicit `--input` compiler workflow.

## Shell workflow

`prototypes` is a plural command group, distinct from the existing singular `prototype` maker. Run from the project root or pass `--root`. All changes and generation are plan operations: without approval they preview; `--plan-out` saves a reviewed plan and `plan apply` rechecks it. No prototype command installs dependencies, builds, enables plugins or publishes anything.

```sh
# Import the full workspace exported by the browser; preview and save a plan.
node bin/app prototypes import --input design-lab.prototypes.json --plan-out prototypes-import.plan.json
node bin/app plan apply prototypes-import.plan.json --yes
node bin/app prototypes list --json

# Alternatively capture an ordinary project export, then fork a saved variant.
node bin/app prototypes create exploration --input project-a.json --name "Solution exploration" --yes
node bin/app prototypes fork exploration --version v1 --variant main --as sitemap-b --name "Sitemap B" --yes
node bin/app prototypes save exploration --version v1 --variant sitemap-b --input project-b.json --yes

# Approve and activate A. Both steps remain explicit.
node bin/app prototypes status exploration --version v1 --variant main --status approved --yes
node bin/app prototypes activate exploration --version v1 --variant main --yes

# Adopt the exact active source, then generate the configured project in place.
node bin/app prototypes adopt --yes
node bin/app prototypes generate --plan-out generation.plan.json
node bin/app plan apply generation.plan.json --yes

# Create an immutable checkpoint, then continue in an editable new version.
node bin/app prototypes seal exploration --version v1 --yes
node bin/app prototypes version exploration --from v1 --version v2 --yes
node bin/app prototypes export --out prototypes-review.json --yes
```

`details` updates a draft variant's display name/hypothesis. `archive` and `restore` manage whole prototypes; `status --status archived` archives one inactive variant. `deactivate` clears generation selection. `help prototypes <command>` and `capabilities --json` expose every registered operation.

Default `generate` honors an existing prototype registry. An explicit `generate --input design/project.json` compiles the imported design without consulting the registry. `prototypes generate` always requires an active managed source that is also the adopted canonical design, and does not offer that bypass. Both generate in place inside an extracted, verified kit.

For **in-place generation**, review `prototypes adopt` first. It imports the active snapshot through the existing project/configuration conflict workflow; generation refuses to proceed while canonical `design/project.json` differs from that saved snapshot. Inspect any reported configuration conflicts and choose the appropriate explicit resolution. Changing the application's canonical identity or folder settings is not hidden inside activation.

Generated output receives `.companion/prototype-selection.json`, recording the selected prototype/version/variant, workspace and snapshot revisions, snapshot path and SHA-256. This is provenance, not verification evidence. Existing compiler ownership receipts and conflict checks remain intact. A reviewed generation plan is bound to the registry, manifests and saved snapshots: changing activation or source data makes it stale.

### Comparison, metadata and recovery from the shell

```sh
# Read only: compare complete saved A/B documents.
node bin/app prototypes compare exploration --version v1 --variant main --with-variant sitemap-b --json

# Labels do not rename folders or activate a variant.
node bin/app prototypes prototype-details exploration --name "Product alternatives" --description "Compare navigation approaches" --yes
node bin/app prototypes version-details exploration --version v2 --label "Next iteration" --yes

# Restore saved v1/main into editable v2/sitemap-b with a sealed recovery version.
node bin/app prototypes restore-snapshot exploration --version v2 --variant sitemap-b --from-version v1 --from-variant main --recovery-version recovery-1 --plan-out restore.plan.json
node bin/app plan apply restore.plan.json --yes
```

Comparison accepts optional `--with-prototype` and `--with-version`; omitted values use the selected prototype/version. Restore accepts optional `--from-prototype`; its source version/variant and new recovery version are explicit. This is different from `prototypes restore`, which only unarchives a whole prototype. All mutating commands retain reviewed-plan and stale-plan checks.

## Protection and limits

All snapshots must belong to the same project ID. Saved prototypes pin the browser project's ID; changing its name/description remains possible. Importing an ordinary working project preserves the library; importing a different project into that vault is blocked rather than discarding it.

Unknown schema versions, unsafe JSON, duplicate IDs, multiple active variants, mismatched hashes, wrong project IDs and unsafe paths are rejected. Filesystem operations retain the shell's symlink/path containment and reviewed-write protections. A conflicting or unowned file is never silently replaced. Bundle import cannot remove records, unseal checkpoints, roll back revisions or overwrite protected saved content. Export both diverged copies and reconcile through new drafts/versions when an import is rejected.

The transport supports at most 40 prototypes, 40 versions per prototype, 40 variants per version and 200 total snapshots, within a 32 MB workspace budget and the existing 4 MB individual project/file limit. Browser persistence additionally retains its existing 5,000,000-character session ceiling. Large libraries can therefore fit the shell but not the browser session. Quota preflight rejects oversized writes without losing the previous workspace; uncertain persistence failures retain the previous in-memory copy and block further edits until recovery. These limits are not multi-user database guarantees or cross-process transactions.

## Implementation and verification boundaries

The shared typed domain lives in `scripts/companion/prototypes/`; shell adapters are `bin/adapters/framework/prototype*.ts`. The maintained browser editor and trusted host bridge are composed into the current build, leaving v5 fixtures unchanged. Test recipes are registered in `tests/suites.json` and the existing companion workflow.

See [verification record](PROTOTYPES-VERIFICATION.md) for executed checks and outstanding hosted evidence. This increment implements browser authoring plus shell persistence/generation. It does **not** convert the companion into a natively accepted Obsidian plugin, add real vault writes to the browser, merge variants automatically, or mark the broader PR #5 MVP complete.

See [implementation comparison and polishing review](PROTOTYPES-REVIEW.md) for the alternate-package assessment and the changes made without a schema fork.
