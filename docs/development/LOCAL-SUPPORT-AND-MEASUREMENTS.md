# Local support reports and authoring measurements

These commands use the same CLI catalog and typed operation dispatcher as other shell commands. Neither executes imported project code, installs dependencies, launches Obsidian, sends telemetry or writes files. Redirecting stdout is an explicit action performed by the invoking shell.

## Share a minimal support report

```sh
node shell.mjs support report --json
```

The versioned report includes framework distribution/version, selected Node version, actual Node/platform/architecture, dependency presence, design freshness, outstanding acceptance count and a finite set of diagnostic codes. Native and release readiness are explicitly not inferred.

The report is constructed from an allowlist, not from a regex-redacted copy of a full log. It omits project identity, paths, authored content, input hashes, raw errors, diagnostic messages and credentials. Unknown diagnostic codes become `OTHER`. Corrupt or unreadable inputs return a generic `SUPPORT_UNAVAILABLE` response, not the filesystem error containing the private path. Nothing is uploaded automatically. Review the report locally before sharing it.

Ordinary `doctor`, `compiler inspect --stage ir`, recovery exports, generated project JSON and Jev resolved requests/traces have different disclosure boundaries: they can include authored or sensitive data. Do not assume the support report's guarantees apply to those artifacts.

## Measure actual model operations

```sh
node shell.mjs project measure --input project.json --samples 10 --dry-run --json
node shell.mjs project measure --input project.json --samples 10 --json
```

Input may be `-` for bounded UTF-8 JSON on stdin. Three to thirty measured samples are supported. Each of four operations records one cold sample, three warmups and every measured sample: import/validation/migration, JSON export, hierarchy projection and an arrangement proposal. Samples use `performance.now`; median/p95 are nearest-rank observations and no slow result is discarded. The collector yields between samples so cancellation can stop the sequence. A failed warmup, invalid clock, missing/nonfinite sample or cancelled run cannot become passing evidence.

The result binds the exact input bytes by SHA-256 and includes counts and environment metadata, but not project content. **This input fingerprint is intentionally absent from the support report.** Heap observations are not isolated, forced-GC measurements or leak proof. The command excludes disk I/O timing, UI interaction/rendering, native lifecycle, dependency installation and generated builds. Budgets remain `not-established` until separately agreed; a completed measurement is not qualification.

Use both representative complex projects and bounded size fixtures. A sixty-surface project with no components can be cheaper than a twenty-eight-surface self-project with many visual definitions. Surface count alone is not a workload model. Record exact bytes, toolchain and all raw observations when comparing changes.

## Recovery by outcome

| Outcome | Safe next action |
| --- | --- |
| Dependencies missing | Review the intended project and lockfile, then explicitly install. A report does not approve scripts. |
| Design changed since generation | Inspect a fresh generation plan; preserve edited consumer files and review conflicts. |
| Stale approval | Reinspect current bytes and obtain a new approval; never force the old plan. |
| Known unchanged save failure | Correct the cause and retry deliberately with the draft retained. |
| Uncertain durable write | Preserve the current evidence and resolve ownership/storage before reload or another write. Do not retry blindly. |
| Unsupported/future/corrupt data | Keep the original file and recovery copy. A support failure must not reset it. |

See the [threat model](../security/COMPANION-THREAT-MODEL.md), [authoring guide](AUTHORING-EXPERIENCE.md) and [execution record](../testing/PR5-IMPROVEMENT-EXECUTION.md).
