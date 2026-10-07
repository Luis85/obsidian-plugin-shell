# Diagnostics and debugging

> Type: reference · Part of the [docs index](../../README.md)

The shell retains result `protocolVersion: 1`. Compiler diagnostic fields are additive: code, severity, phase, message, help, retryable, source and related locations. There is no English-message parsing for native compiler errors. Known legacy validator prefixes are adapted at the boundary; unexpected errors become `COMPILER_INTERNAL`.

Diagnostics name original source JSON pointers where known. Migrated-only locations are explicitly marked `normalized`. They are sorted deterministically and capped at 100 with an explicit truncation diagnostic. `retryable: false` never authorizes a file change; no proposed repair is automatically applied.

Human diagnostics neutralize control sequences. JSON mode writes one final document to stdout; progress belongs on stderr. Reports require an explicit `--report-dir reports/compiler` and use a new run-ID directory:

- `summary.json`: compiler/output identity, readiness, fingerprint, duration and counts.
- `diagnostics.json`: actionable failures and warnings; no complete project document.
- `events.ndjson`: ordered phase transitions and elapsed times.

`--debug` requires a report directory and adds bounded error/cause stacks in `debug.json`. Debug stacks can contain local paths or authored values: review before sharing. Normal reports avoid dumping the raw input, but diagnostic labels can themselves contain authored text. Reports are local, not telemetry sent to a service.

For breakpoints, open `compiler.code-workspace` in this folder or run:

```sh
node --inspect-brk --experimental-strip-types tooling/compiler/debug-fixture.mjs
```

Set a breakpoint in `application/pipeline.ts`, the frontend or a specific emitter. The fixture uses analysis only. To inspect emitted source, use `compiler inspect --stage artifacts` or call `compileProject` with a captured template snapshot in a test.

`design/compiler-origins.json` maps emitted visual artifacts and `data-design-node` line markers back to normalized page/component and element JSON pointers. Existing Vite development source maps handle bundle → generated source; this origin index supplies generated source → design. Files without reliable mappings are left unmapped rather than assigned guessed locations.

## Diagnostic catalog

The catalog below is checked against `domain/diagnostics.ts` by the documentation test.

### `COMPILER_JSON_INVALID`

Supply a complete UTF-8 project JSON document; check its syntax.

### `COMPILER_INPUT_LIMIT`

Reduce the input to the supported 4 MB project limit.

### `COMPILER_SCHEMA_INVALID`

Correct the named contract violation and run compiler check again.

### `COMPILER_REFERENCE_MISSING`

Choose an existing target or explicitly remove the reference.

### `COMPILER_DUPLICATE_ID`

Assign a unique identity; update references deliberately.

### `COMPILER_PATH_COLLISION`

Give artifacts distinct portable paths or declare an intentional replacement.

### `COMPILER_TEMPLATE_INVALID`

Restore the trusted framework template; do not modify the project to conceal a template defect.

### `COMPILER_DEPENDENCY_RESOLUTION_REQUIRED`

Review the declared packages, run npm install explicitly, then verify the lockfile before npm ci.

### `COMPILER_ADAPTER_REQUIRED`

Implement the external adapter; its placeholder is not a completed interaction.

### `COMPILER_CANCELLED`

The operation was cancelled. Re-run only after reviewing the current workspace.

### `COMPILER_DIAGNOSTICS_TRUNCATED`

Repair the reported errors and rerun to inspect remaining diagnostics.

### `COMPILER_REPORT_FAILED`

Choose a new contained reports/compiler destination; do not retry file writes blindly.

### `COMPILER_INTERNAL`

Retain the debug report and report a compiler defect; do not edit the project spec blindly.
