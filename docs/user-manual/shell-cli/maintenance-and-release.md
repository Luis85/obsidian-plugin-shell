# Maintenance and release

## Configuration and identity

```sh
node bin/app config get --json
node bin/app config explain
node bin/app config validate
node bin/app config set --input proposed-config.json --dry-run
```

Configuration updates are reviewed plans. The inspected implementation reads `shell.config.json`, with generated `manifest.json` authoritative for established identity after generation. Use `config explain` and diagnostics to resolve conflicts. Editing one file to make a check green without reconciling the others can make the next import or build inconsistent.

Keep local environment paths and private test-vault data out of published examples. Configuration documentation should explain why a setting is chosen; the generated command reference owns the accepted command flags.

## Framework integrity and replacement

```sh
node bin/app framework status --json
node bin/app framework upgrade --from ../extracted-replacement-kit --dry-run
```

`framework status` inspects the pinned kit and its file integrity. Checksums are not publisher signatures. Source checkouts and compiled kits are different distributions; a missing kit manifest in a source checkout is not evidence that an installed kit is corrupt.

Upgrade only from a reviewed replacement kit. The upgrade planner guards incompatible removals, edited launchers, reused versions with changed contents and downgrades. Preserve consumer edits and follow an explicit migration when required. Upgrading framework files, regenerating consumer source and changing dependencies are separate decisions; do not describe one successful step as completion of all three.

## Package a developer kit locally

This is a maintainer operation from a clean framework authoring checkout, not a configured consumer project:

```sh
node bin/app framework pack --out ./plugin-framework.zip --dry-run
node bin/app framework pack --out ./plugin-framework.zip --yes
```

The packer compiles CLI TypeScript and creates an integrity inventory. It refuses unsafe/protected destinations and replacement of a different existing archive. Creating this ZIP does not upload it or authorize a release.

Build the manual from the same source candidate before packaging. The inspected distribution includes the documentation tree in `.framework/template/docs/`; the separate manual workflow also produces a readable handbook and HTML artifact. Do not claim that a separately built website automatically becomes a top-level ZIP asset, or that an unbuilt generated reference is already in the kit. Check the actual archive inventory as part of release qualification.

## Prepare, inspect and rehearse a release

Create release notes describing the candidate's actual changes, migration needs and unresolved limitations. Then preview source version changes:

```sh
node bin/app release prepare --version 1.0.0 --notes-file notes.md --dry-run
node bin/app release check
```

After the approved preparation changes are committed, rehearse a fixed candidate using the real commit SHA and intended version. Consult `help release rehearse` for the installed invocation. The rehearsal may execute project tools and produce local evidence; it does not by itself promote the candidate publicly.

The guarded release executor accepts a reviewed operation document. A dry run can inspect the requested mode without proving candidate eligibility:

```sh
node bin/app release operate --input release-operation.json --dry-run
```

Do not substitute `--yes` for release authorization. Candidate writes require the executor's separate `--execute` and `--authorize` digest workflow. A command without `--execute` can perform remote discovery; absence of publication is not necessarily absence of network activity.

## Release checklist

Confirm the exact candidate identity, appropriate test evidence, dependency/lock consistency, built-asset inventory, manual generation and link checks, upgrade/migration notes, and remaining acceptance limitations. Review authorization separately. No manual command grants permission to merge PRs, tag, publish a release, activate a plugin or modify a user's personal vault.

Archive evidence with its source identity. Older test results must remain attributed to the version that produced them. Native companion acceptance and framework shipment are separate product decisions even when they share the same repository.
