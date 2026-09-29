# Prototype registry-loss protection

This follow-through builds on the reconciled prototype review at PR #5 commit
`c385ec7ae1d065f6189ab288d0d7ef43c4d1808e`. It preserves the
[existing format and workflow](PROTOTYPES.md), including the comparison, search,
metadata and sealed-recovery improvements in [the review](PROTOTYPES-REVIEW.md).

## Finding and correction

Previously, a missing `docs/concepts/prototypes.json` was always treated as an
unmanaged project. When saved prototype folders remained, default generation
could consequently reach its standalone compiler fallback instead of refusing
an incomplete workspace.

The shell now checks for reserved per-prototype `prototype.json` manifests before
establishing an unmanaged workspace. If a manifest remains but the registry is
missing, it fails with `PROTOTYPE_REGISTRY_MISSING`. Restore the registry from a
known-good backup or version-control revision and review the workspace again.
No registry is reconstructed, no variant is selected implicitly, and no saved
project bytes are changed. Partial or corrupt manifest bytes are retained
without attempting to parse or repair them.

The check uses read-only safe-path inspection and a bounded, immediate-directory
scan. Symlinks in the concepts path or immediate entries are refused, case/path
checks remain in the existing planner, and cancellation stops the operation.
A registry that appears during the initial path inspection requires a new review.

## Compatibility boundaries

Unmanaged concept documents such as `prototype.manifest.json` remain compatible.
A generated consumer can carry `.companion/prototype-selection.json` as source
provenance without owning the original prototype library; that receipt alone
therefore does not make its local workspace managed. Explicit
`generate --input project.json` retains its documented standalone semantics.
The plural `prototypes generate` operation still requires an actual managed
workspace and active selection.

The guard detects remaining reserved manifests, not an imaginary hidden database.
If every trace of a library has been removed, no prior selection can be inferred.
Filesystem-wide or cross-process atomicity is not claimed.

## Verification for this follow-through

Eight new filesystem/adapter regression tests passed with Node 22.16.0 using
runtime type stripping. They cover lost registries, compiler-fallback refusal,
standalone generated consumers, unrelated concept documents, explicit input,
partial manifests, symlink containment and cancellation. The tests live in
`tests/tooling/companion-prototypes-workspace-integrity.checks.mjs`, so the
existing `companion-prototypes*.checks.mjs` command and registered wildcard
suite include them without changing any workflow gate.

These are targeted supplemental results, not qualification of the complete
reconciled head. The local source was recovered from the PR51 integrated archive;
the relevant workspace adapter was unchanged in the prototype review commit.
The new test file was executed directly with no name filter or skipped cases.
The repository-locked Node 24 / TypeScript 6 / Vite build, complete prototype
suite and full hosted/native qualification must be read for the final PR commit.
No global compiler substitution, threshold reduction, merge or release occurred.
