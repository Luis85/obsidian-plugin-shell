# Tooling integration verification — v1.1.0

Date: 2026-09-27. This supersedes the original archive receipt only for the integration
work described here. Hosted CI of the follow-up commit is separate, not assumed green.

## Source provenance and environment

PR #27 starting head: `6959bed72acfb80445124d29c049d8baa8fb5fc5`.
PR #5 base: `6178b1025336941ad6fb10eae4e26930622363f9`.
Authenticated GitHub reads verified actual shell, compiler, distribution and build APIs.
Direct Git DNS was unavailable. The executable local integration reference came from
PR #27's authenticated framework CI artifact 10930598859, workflow run 36317139263.
Outer artifact SHA-256: `480a9f9e2b72e467e83cbb91d396d874eb3fa0aeeba8e4248bbed5269a2339fe`.
Its recorded CI merge checkout was `398e71fb679eaedb6bf26b236e76b676b54b1134`.

The extracted framework template is distribution-adapted source, not a complete Git
checkout. Maintainer-only concept assets are omitted. package.json was restored from
the authenticated original before editing; only explicit edited paths are committed.
The local reference Git commit is not claimed to be the upstream source SHA.
Environment: Linux, Node 22.16.0 with native type stripping, npm 10.9.2, Python 3.13.5.
The qualified Node 24.21.0/npm 11.19.1/lockfile build remains the hosted workflow's job.

## Executed checks

`NODE_OPTIONS=--experimental-strip-types node scripts/testing/suites.mjs prototypes prototypes:python --json`
ran through the **existing repository suite runner**:

- Node: 43 tests, **42 passed**, zero failed, **one skipped** because locked Vite/stack
  dependencies are not installed locally. The real-build test remains in CI.
- Python: **26 passed**, zero failed. Package fixtures are explicitly synthetic.
- Real source CLI discovery, project/style inspection, maker discovery and process
  preview behavior passed without running a dependency install or native host.
- Actual `new --starter blank` plan/apply created a fresh generated workspace. The canonical Claude skill and thin Codex entrypoint
  were included byte-for-byte with extension ownership. A stale hash was refused;
  real regeneration preserved edits to both entrypoints.
- Actual archive assembly preserved the skill's exact bytes and inventory. On this
  dependency-free host the assembler used an explicit **non-executable test compiler**;
  this is packaging evidence, not successful TypeScript compilation or a runnable new ZIP.
- Real concept saving used the same Python package scanner and shell file-plan engine.
  No-write preview, explicit approval, source-changed stale rejection, exact-byte apply,
  traversal rejection and refusal to replace an existing concept passed.
- Codex entrypoint resolution, single-source delegation, missing/orphan/tampered
  adapter rejection and exclusion of unrelated `.agents` settings passed.
- Existing suite inventory check and source line-limit/locale checks passed.

The tests also cover rejection of native/release requests hidden in saved plans, stricter operation flags, explicit process/install authority,
source/compiled API selection, single-file output constraints, actual stack module
requirements, native import refusal, scoped mount markers, unlisted/tampered inventory,
file safety, exact embedded JSON, and all original helper regression behavior.

## Remaining scopes

Locally unrun: actual pinned Vite compilation, framework/generator TypeScript checking,
full npm lint/analyzer/coverage, exact-artifact browser journeys, companion UI round-trip,
native Obsidian acceptance, actual Codex/Claude invocation and live multi-agent evaluation. The new build test explicitly
reports unavailable dependencies; a planned process and a synthetic bundle are never
reported as a built product. Every bespoke prototype must run its own applicable checks.

No dependency versions, project JSON schemas, generator approval rules, release authority,
source-line limits, coverage floors, host-style guards or global analyzer exclusions were
changed. No merge, release or personal-vault operation is authorized by this integration.
