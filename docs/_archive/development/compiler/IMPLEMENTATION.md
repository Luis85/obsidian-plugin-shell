# Four-increment compiler refactor

Base: PR #5, `b66200e2f43cd0682028f0151f9bdffc853cd2bf`. Branch: `refactor/dedicated-project-compiler`. No merge, release or native-vault operation is part of this refactor.

| Increment | Delivered changes | Qualification |
| --- | --- | --- |
| 1 — Baseline | Ten emitted-product golden manifests; existing safe-writer/legacy tests retained; truthful generated README and dependency readiness | Golden comparison; install mismatch regression; existing ownership/rollback suites |
| 2 — Boundary | Dedicated domain/application/adapters; immutable template snapshot; pure emission; separate workspace planner; explicit artifact replacement; compatibility facades | Resolved architecture gate with negative fixtures; deterministic in-memory compile; source/packed parity |
| 3 — Feedback | Stable diagnostics with source pointers; independent error aggregation; CLI check/inspect/explain; versioned result extension; opt-in reports/events/debug causes; origin index and debugger fixture | Human/JSON protocol, containment, privacy, cancellation, origin and exception tests |
| 4 — Outputs and developer experience | Shared-model click-dummy output using the existing offline builder; generated plugin/browser qualifier; multi-OS CI; seeded properties, targeted mutation probes, compiler coverage and documentation | Independent install/typecheck/build/browser workflow; qualification summaries do not infer business/native acceptance |

## Local execution scope

The working copy was reconstructed from the pinned PR5 release-kit artifact because repository and npm DNS were unavailable in the execution container. Supplementary execution used Node 22.16.0 and TypeScript 5.8.3, not the repository-qualified Node/TypeScript versions. The dependency-free focused compiler tests and legacy safe-generation tests were executed; generated Vue/Vite, fast-check, and real-browser qualification require the hosted workflow with the locked dependencies. Hosted results must be read from Checks; their success is not asserted by this record.

The broad framework and plugin architecture remains under its existing policies. This extraction preserves the existing schema/model and renderer semantics; it does not claim every inherited generic row or runtime implementation has been redesigned. Phase-boundary cancellation and a representative warm compilation budget are provided; preemptive cancellation and maximum-scale benchmarking are not claimed.
