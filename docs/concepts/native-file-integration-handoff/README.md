# Native file-integration source handoff

**Use the active shell for new plugins. Use this handoff only to inspect or
reconstruct the separately preserved alternative.** Nothing here migrates the
alternative into the current runtime.

| | Active shell, from PR #34 | Preserved alternative, PR #50 |
| --- | --- | --- |
| File editor starter | `custom-file-view` | `custom-file-editor` |
| File-menu starter | `context-menu` | `file-context-menu` |
| File-type maker | `file-extension` | `file-type` |
| Native configuration | Current versioned namespace | Incompatible historical declaration shape |
| Starting point | Current project checkout | Reconstructed historical workspace |

The [active integration guide](../../development/native-file-integrations.md)
is the starting point for production-facing work. **Do not copy `source/` over
current root files or import its native JSON into the active shell.** Adoption
would require an explicit schema/code migration and independent qualification.

## What is retained

`source/` contains all **48 byte-identical source files** from the alternative
`native-file-extension-starters.zip` delivered on September 27, 2026, including
both JSON starters, domain/application code, Obsidian adapters, compiler/maker
integration, tests, documentation and the generated companion HTML. The 49th
original change is a historical deletion in `MANIFEST.json`.

No conversation ZIP or patch transfer is required. The manifest and source tree
remain frozen; review/polish changes apply to the recovery tooling, documentation
and verification around them, not to the provenance of the archived code.

## Verify, preview, then reconstruct

Python **3.12+** is required. Verification needs neither Git nor npm. Reconstruction
and planning additionally require **Git 2.45+**, the recorded baseline commit and
all of its tree/blob objects locally. A full clone is convenient, but unrelated
history is not required. The helper never fetches missing objects or installs tools.

Run from the repository root; quote paths containing spaces. On Windows, use
`python` instead of `python3` when that is the installed interpreter command.

```sh
# Read-only verification of the manifest and all 48 source files.
python3 docs/concepts/native-file-integration-handoff/restore.py --check

# Inspect the complete reconstruction without creating the destination.
python3 docs/concepts/native-file-integration-handoff/restore.py --plan --out ../native-file-alternative --json

# Explicitly create that NEW directory outside this checkout.
python3 docs/concepts/native-file-integration-handoff/restore.py --out ../native-file-alternative --json

cd ../native-file-alternative
python3 scripts/concepts/build-companion.py --check
```

No arguments is equivalent to `--check`. `--json` produces exactly one JSON result
or diagnostic for a check, plan or restore; progress does not pollute stdout.
`--help` displays human-readable usage. Error results exit nonzero and never
advertise completed reconstruction. Ctrl+C reports `HANDOFF_CANCELLED` with exit
code 130; it does not delete partial output.

Planning validates the entire baseline and overlay, not just the requested path.
Its `reconstructedTree`, file count and byte count describe the planned output.
A plan does not create a destination or modify the checkout; Git process output
uses temporary operating-system scratch files. A later restore verifies its inputs
again and captures immutable bytes; it does not trust a previously printed plan.

## Safety and completion

The helper reads raw, hash-verified Git objects. Local `export-ignore`,
`export-subst`, replacement refs, worktree edits, checkout line-ending conversion
and inherited `GIT_*` variables cannot silently alter the reconstructed baseline.
Git cannot lazily download missing objects; subprocesses are noninteractive and
bounded to 60 seconds. Snapshot limits are 10,000 files, 16 MiB per file and
128 MiB total. The baseline tree is independently recomputed before any destination
is reserved.

Source files are captured and verified once; later source edits cannot become
unverified output. Source symlinks, directory links, junctions, hard links, special
files, unsafe paths and case/path collisions are rejected. Overlay add/modify/delete
preconditions are checked against the baseline. The historical deletion is applied
by omitting that file from the new output, never by deleting a current-checkout file.

An existing destination, including an empty directory or dangling link, is refused.
The new root is private where the operating system supports it. Files use exclusive
creation. The writer checks directory identities and rejects injected links or files;
it never replaces an existing file or automatically cleans up a failed destination.
After writing, it verifies every file's bytes and, on POSIX, its executable mode.

A successful output has **`.native-handoff-receipt.json` and no
`.native-handoff-incomplete` marker**, and the command exits zero. The portable
receipt records baseline, source and reconstruction identities without machine-local
paths. Its reconstructed tree excludes the receipt itself. It proves the recovered
bytes, **not dependency, runtime, browser, native-host or release qualification**.

Failure after reservation leaves partial output for inspection. Do not build it or
retry into it. Resolve the cause and choose a different new destination. Use a
trusted parent directory and do not edit the output while recovery is running:
these checks are not an operating-system sandbox against a hostile process running
as the same user, and the entire directory is not published as one atomic operation.

## Diagnostics

| Code | Meaning and next step |
| --- | --- |
| `HANDOFF_MANIFEST_MISMATCH`, `HANDOFF_SOURCE_MISMATCH`, `HANDOFF_INVENTORY_MISMATCH` | Restore the exact manifest/source from this PR. Do not update hashes to bless an accidental edit. |
| `HANDOFF_GIT_UNAVAILABLE`, `HANDOFF_GIT_TIMEOUT` | Check Git 2.45+, repository health and local baseline availability. Obtain missing history explicitly before retrying. |
| `HANDOFF_LINK_OR_TYPE`, `HANDOFF_PATH_INVALID`, `HANDOFF_PATH_COLLISION` | Use regular source files and a portable, unambiguous path. Do not route recovery through source links. |
| `HANDOFF_OUTPUT_EXISTS`, `HANDOFF_OUTPUT_INSIDE_CHECKOUT` | Choose a new directory outside this checkout. |
| `HANDOFF_WRITE_FAILED`, `HANDOFF_OUTPUT_CHANGED` | Inspect the retained partial output, permissions and disk space; use a new destination after correcting the cause. |

## Build and qualification boundaries

The original companion HTML is **3,407,968 bytes**, SHA-256
`3fb223d500b19bfd42b35828b9ddd0a2189ce3f04da1b56c58ec5f0ee458ca30`.
The source subtree is `c0f6b4be694d15717ba7688382223b7b7ac175d7`; baseline
commit is `24bde52e33b2d6e212b71d86e1b1ae045a8153d6`.

In the restored workspace, `python3 scripts/concepts/build-companion.py` rebuilds
changed concept source. Plugin builds require that workspace's exact Node/npm and
explicit lockfile installation. Read its
[recovered integration guide](source/docs/development/NATIVE-FILE-INTEGRATIONS.md).
The helper never launches Obsidian, changes a vault, enables a plugin or publishes.

The archive is text/JSON boilerplate, not a finished graphical editor. Closing an
unsaved draft discards it. Four authored acceptance TODOs per alternative starter,
draft recovery and real Obsidian/mobile acceptance remain unresolved. The original
September 27 runtime/browser/coverage counts are historical, overlapping local
results, not fresh acceptance of this handoff.

## Maintainer checks

```sh
node scripts/testing/suites.mjs native-handoff
node --test tests/tooling/project-generator-native-handoff.checks.mjs
python3 docs/concepts/native-file-integration-handoff/restore.py --check --json
```

`native-handoff` is opt-in and requires Python; it is not added to default consumer
setup. Its missing sources in a distributed kit report **not-run**, not a pass.
The handoff, its regression and its workflow are excluded from generated projects
and CLI kits. The real compiler template-loader test also checks that the active
native source and starters remain included.

The read-only workflow runs Linux, Windows and macOS recovery checks, including
real Git fixtures, failure injection and exact historical reconstruction. Symbolic-
link tests may explicitly skip only when Windows lacks the required privilege;
other failures are not converted to skips. See [review and evidence](REVIEW.md) for
findings, executed checks and remaining qualification limits.
