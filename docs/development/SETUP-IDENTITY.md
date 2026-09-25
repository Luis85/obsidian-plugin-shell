# Identity setup and resumable qualification

`npm run setup` starts without project dependencies. Its default profile is
browser-first. It reviews the chosen identity, exact file hashes, selected commands,
dependency lifecycle allowlist and excluded actions before applying anything.
Interactive setup asks for identity values and confirmation. Existing values are
defaults; unattended use requires `--yes --no-interaction` after reviewing a plan.

```sh
npm run --silent setup -- --id field-notes --name "Field Notes" --author "Your name" --repo your-account/field-notes --version 1.0.0 --profile browser --dry-run --json
npm run setup -- --id field-notes --name "Field Notes" --author "Your name" --repo your-account/field-notes --version 1.0.0 --profile browser --yes --no-interaction
```

Use qualified Node 24.21.0 and independently selected npm 11.19.1. Setup validates
its supported Node/npm range and records actual versions/platform. It launches
children using the active Node executable and active npm CLI, with argument arrays.
The existing scoped repair for forwarded npm `allow-scripts` values remains;
persistent registry, proxy, certificate, authentication and lifecycle policy remain
unchanged. `npm ci` installs the existing reviewed lock and can replace node_modules.
Setup never installs global packages or upgrades resolved dependencies.

## Metadata and namespaces

Identity consists of `id`, `name`, `description`, `author`, optional `repo` in
`owner/name` form, and an explicit stable `x.y.z` version. Portable IDs begin with
a lowercase letter and use lowercase letters, digits and separated hyphens.
Reserved Windows device names, path separators, control characters, malformed
versions and repository URLs/credentials are rejected.

An explicit identity change plans these files:

- `manifest.json`: public plugin identity; host minimum and desktop policy remain.
- `package.json`: package name/version/description/author/repository; unrelated keys remain.
- `package-lock.json`: only root name/version metadata. Resolved package entries,
  integrity values and exact dependency pins remain.
- `versions.json`: retain historical entries and add the chosen version/host floor.
- `PROJECT-IDENTITY.md`: generated identity handoff; edited existing content conflicts.

README, LICENSE, attribution and unrelated source edits are preserved. Supplying no
identity options leaves metadata byte-identical. Runtime and build ownership
derive their identity from the manifest; setup does not search/replace source
strings. The shared file-plan engine checks paths, case collisions, symlinks and
original hashes, stages complete edits, and restores only bytes still owned by the
failed operation. This is not a filesystem-wide atomic transaction.

## Profiles and machine-readable answers

The browser profile installs dependencies and runs `verify`, including build,
type/lint/boundary/analyzer, runtime/coverage, artifact and retained baseline checks.
`--provision-browser` explicitly selects the pinned Chromium download before
verification. It does not request system elevation or install system libraries.
Served E2E, live security audit, native host/device and release acceptance remain
separate, scope-labeled commands; setup never claims those unrun checks passed.

`--profile native` additionally installs the complete verified three-file candidate
into `.dev-vault/.obsidian/plugins/<id>`. There is no arbitrary vault-path option.
Open the contained vault separately and deliberately enable the selected plugin.
Setup never installs or launches Obsidian, enables plugins, changes Restricted Mode,
edits security preferences, changes permissions or publishes anything.

`--no-local` remains a browser-profile alias. `--skip-install` explicitly skips
dependency installation and requires an already provisioned toolchain; verification
still runs. `--defer-verify` skips only the verify stage for automation that runs
`npm run verify` itself afterwards; the handoff reports static checks as deferred,
the checkout is unverified until that run, and native profiles refuse it because
native installation copies verified artifacts. `--help`, `--dry-run`, `--yes` and
`--no-interaction` remain supported.

`--answers answers.json` accepts only declared data fields, for example:

```json
{
  "id": "field-notes",
  "name": "Field Notes",
  "author": "Your name",
  "repo": "your-account/field-notes",
  "version": "1.0.0",
  "profile": "browser",
  "provision-browser": false
}
```

Unknown fields, executable hooks and wrong types fail before writes. Explicit CLI
values override answers. Approval remains a CLI flag, not an executable answer-file
permission. `--json` writes one final JSON result to stdout; progress and child
output go to stderr. Use npm's `--silent` form to remove its script banner.

Dry run performs no writes, reports, directory creation, downloads, network calls
or child launches. It validates existing metadata and prints the concrete plan to
stdout even when node_modules is absent.

## Resuming after interruption or failure

The versioned `.template-state/setup.json` journal records selected stages, actual
commands/exits, identity, tool/platform and source/lock fingerprints. It stores no
environment dump or credentials. Completed metadata changes remain inspectable
when a later install or check fails; correcting the failure never requires deleting
the user's project.

```sh
npm run setup -- --resume --yes --no-interaction
```

Resume reloads the recorded public options, validates the current identity and
source/lock/tool/platform fingerprint, and checks installed dependency directories
and package metadata before reusing the install result. Verification always runs
again, so retained artifacts or an install marker cannot certify a missing binary.
Changed source, lock, platform or tool versions invalidate saved stage reuse.
Selected browser provisioning runs again because a journal cannot prove external
browser-cache availability. Native installation is reused only when installed
assets, prior accepted hashes and the current verified candidate agree.

Another setup is excluded by `.template-setup.lock`; source mutations share
`.codex-authoring.lock` with makers. Source inputs are hashed before and after the
long-running stages: concurrent edits prevent a ready result. After a killed
process, inspect the owner processes and any recovery artifacts before manually
removing a stale lock. No command automatically force-cleans a stale lock or user
files. Corrupt/future journals fail closed for inspection.

## Explicit migration of the contained installed identity

Renaming installed identity is distinct from fresh initialization. Close the
contained vault and disable both old and destination plugin IDs before migrating.
Setup checks `community-plugins.json` and never edits it.

```sh
npm run setup -- --id field-notes --name "Field Notes" --migrate-from plugin-shell --profile native --dry-run
npm run setup -- --id field-notes --name "Field Notes" --migrate-from plugin-shell --profile native --yes --no-interaction
```

The migration copies old `data.json` bytes exactly into an absent or identical
destination, then installs the verified new candidate. Corrupt/future data is
preserved, not repaired. Non-roundtripping UTF-8 is rejected before metadata changes;
its original bytes remain untouched for manual inspection. Notes, old installation, unrelated plugins and security
preferences remain unchanged. The old plugin is retained as a disabled recovery
copy; automatic deletion or activation is deliberately absent.

An occupied destination with conflicting metadata or data fails. A partial
data-copy stage can resume only with its verified migration receipt and matching
bytes. Source/destination state is checked again before migration and installation.
Runtime/browser local UI preferences are not a second durable entity store and
are not migrated; the durable plugin settings file is copied. No personal vault,
arbitrary external path, or custom host configuration directory is selected by
this bounded migration command.

If candidate promotion fails, the installer restores only files still matching its
own candidate bytes. Failed restoration or an external edit retains the stage's
last-good backups and `.shell-install-lock/recovery.json`; later installs stop
until that recovery is inspected. It never deletes the only backup to report a
clean directory.

## Evidence boundaries

`tests/tooling/setup-identity.checks.mjs` exercises the actual dependency-free CLI,
safe file plans, metadata preservation, dry run, data-only answers, rejected
collisions, rollback, journaled failures, dependency-loss detection, concurrent
source edits and contained migration. Process-boundary fixtures deliberately use
synthetic install/verification tools; they do not claim a real renamed application
build. Existing npm-policy tests still assert scoped environment behavior. The
separate renamed-repository build/verification and Windows/Linux qualification
must be recorded from their actual runs.
