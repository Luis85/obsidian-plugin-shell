# Dedicated project compiler

> Type: reference · Part of the [docs index](../../README.md)

The compiler turns Companion JSON into artifact data. It does not install dependencies, invoke Vite, seed a vault, run tests, or publish. The shell CLI composes this compiler with a separate ownership-aware workspace planner and the existing safe writer.

## Commands

```sh
node bin/app compiler check --input my-plugin.companion.json
node bin/app compiler check --input project.json --json
node bin/app compiler inspect --input project.json --stage ir --json
node bin/app compiler inspect --input project.json --stage artifacts --output-kind clickdummy --json
node bin/app compiler explain COMPILER_REFERENCE_MISSING
node bin/app compiler check --input project.json --report-dir reports/compiler --debug
```

`check` validates without loading templates. `inspect --stage ir` explicitly returns the normalized model (which includes authored content); `--stage artifacts` loads a template snapshot and returns paths, ownership and producers, not file contents. Neither command changes project files. Reports are the only opt-in writes and are confined to new directories under `reports/compiler`.

Existing `new` and `generate` call the same compiler. The legacy `generate --input ... --vault ... --target ...` JSON protocol, reviewed hash and explicit `--apply` remain. `--target` still means a folder. Use **`--output-kind clickdummy`** to select browser output:

```sh
node bin/app generate --input project.json --vault /absolute/existing/workspace --target prototype --output-kind clickdummy
# Review that output; repeat the same command with --apply <reviewed-plan-hash>.
```

`new` retains its existing plugin output. For an already configured generated project, `node bin/app generate --output-kind clickdummy` uses the accepted design and existing ownership rules.

## Readiness, dependencies and verification

Every output records `design/compiler-readiness.json`. Generation success means artifacts were emitted, **not** that they were built or tested. Bundle/typecheck/tests start as `not-run`; requirement acceptance is `not-inferred`.

The compiler compares exact direct dependency declarations with the lockfile root and installed-package entries in that lockfile. New external dependencies yield `resolution-required`. The explicit shell `install` operation checks the current manifests again and refuses to run `npm ci` on that mismatch. Review the packages, run `npm install` explicitly to resolve them, review the lockfile, then run `npm ci` and verification. Compilation never accesses a registry or approves lifecycle scripts.

In a click-dummy workspace run `npm run typecheck:clickdummy`, then `npm run build:clickdummy`. This reuses the shipped prototype Vite/static-UI/CSS/license builder and writes a self-contained `clickdummy.html`. Existing files require an explicit `--replace`. A successful build is still not browser acceptance.

## Compatibility and guarantees

The shared authoring contract accepts only Companion project schema 6, including routes and journeys; schema 1–5 input fails with a schema diagnostic and is never migrated. The checked-in concept is schema 6 too; it embeds no project and is not an input of the compiler. See [post-MVP integration](POST-MVP-INTEGRATION.md), the [integrated review](../../_archive/product/PR5-PRODUCT-REVIEW.md) and [current evidence](../../_archive/testing/PR5-REVIEW-EVIDENCE.md). The existing visual IR is reused, not duplicated. Operation request/result schemas are not the complete public project-v6 schema; that discovery/parity gap remains tracked in the improvement plan. Independent reference errors carry original JSON pointers; errors detected by the contract validator identify the input document and may name its root instead of inventing a source location.

Compilation uses immutable snapshot data. Fingerprints bind compiler version, input bytes, template fingerprint, output kind, paths, ownership and artifact content. Telemetry clocks/run IDs are excluded. These fingerprints are not approvals or signatures. The workspace plan separately binds existing target bytes and the local ownership receipt. Apply reconstructs/checks the reviewed state through the existing file-plan engine.

No implicit deletion, dependency installation, Git operation, live provider call or plugin activation occurs. Edited extensions are preserved under the pre-existing ownership policy; conflicting generated changes stop apply. The writer uses guarded per-file writes and rollback, **not a filesystem-wide atomic transaction**.

See [architecture](ARCHITECTURE.md), [diagnostics and debugging](DIAGNOSTICS.md), [qualification and extension](TESTING.md), and the [refactor delivery record](../../_archive/development/compiler/IMPLEMENTATION.md).
