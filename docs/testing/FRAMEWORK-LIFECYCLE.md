# Framework lifecycle and recovery execution

Baseline: merged PR #14, clean main `9a56505`, topic branch
`codex/framework-lifecycle`. The [plan](../development/FRAMEWORK-LIFECYCLE-PLAN.md)
records three actual implementation owners and a separate cross-owner review.
The [review record](../development/FRAMEWORK-LIFECYCLE-REVIEW.md) retains concrete
findings, reproduced controls and correction scope.
The [framework guide](../development/FRAMEWORK-GUIDE.md) documents the available
developer contracts and their boundaries. Prior qualification remains bound to
`7f14292871efb07ddace131fb9b5603de4122394`: 2 verified / 55 partial / 39 not-run.
Current frozen qualification is pending in this implementation checkpoint.

## Implemented scope

- A reusable framework-free action scope and read-only permits, integrated with
  the actual Task editor and shared note update/delete preflight. Once a write
  starts, its actual durable result survives owner closure. Note projections
  retain explicit reload; sibling drafts stay independent.
- Distinct protected-storage statuses and recovery guidance, truthful uncertainty
  on subsequent blocked operations, and a presence-aware exact-JSON reader. Native
  reads use public vault APIs; all saves still use the one shared host writer.
  Legacy decoded readers retain their documented sentinel ambiguity.
- UTF-8 byte bounds on projected body and complete serialized/patched Markdown,
  including invalid-surrogate rejection and pure preview.
- Read-only resource/error observation without production test globals or mutation
  capabilities. Independent ledgers retain exact faults, loss and sequence checks.
  Native pending-recovery/delayed-progress clauses remain distinct from actual-service
  tests; see the [native record](FRAMEWORK-LIFECYCLE-NATIVE.md).
- Author-facing exports, notice/recovery capabilities, precise generated setting
  guidance and documentation supporting consumer features after example removal.

## Retained development attempts

Fresh installation used Node 24.21.0/npm 11.19.1 and
`npm ci --strict-allow-scripts`: 693 packages, zero audit vulnerabilities. Its log
is retained in `reports/framework-lifecycle/install.txt`; this does not substitute
for the separate live security gate.

A's first 13-case retained-action run had seven real guard/preflight failures and
six fixture failures from an incorrect spy API assumption. After correcting only
the fixture's call-through capture and literal codec formatting, the second run
had seven product failures and six passing post-start persistence cases. Both logs
remain. B's five initial cases reproduced character-count overflow and imprecise
storage/uncertainty state. A separate present-JSON-null regression failed before
the raw-presence correction. C's initial 40 runtime/four tooling cases passed;
the independent review then reproduced three reentrant observer cleanup failures.
Corrections and affected reruns remain separate from these original attempts.

B's first corrected 68-case run had 66 passes and two fixture expectation failures:
the expected literal preference field order differed from the canonical serializer.
The expected bytes were corrected explicitly; no serializer change was made to
obtain a pass. Native/Windows historical failures are never superseded by these
development checks.

Integrated development build, strict types, independent source lint, structural
checks and full zero-finding analyzer passed. The local type-aware ESLint attempt
was interrupted after confirming its exact owned process/parent under shared-host
memory pressure (368,644 KiB free); no unrelated process was stopped. Its receipt
and empty partial output remain, and the full check moves to prescribed hosted
verification. An initial direct security-script invocation correctly rejected the
missing npm execution context; the proper qualified `npm run check:security`
subsequently passed with zero vulnerabilities across all installed categories.

Nine native observation/report parser controls passed, including the actual
trusted adapter path, closed nested schemas, exact counters and independently
valid but rewritten checkpoint histories. The first full trusted runtime attempt
observed 384/385 passes, with one filename-guidance regression: a lone-surrogate
title also made the projected body invalid, so the new UTF-8 check hid the existing
title-field error. Preserve filename validation priority while still validating
both body and complete Markdown before persistence. The failed packet remains in
its original source session and cannot establish current acceptance.

## Qualification and remaining limits

The filename-guidance correction passed both affected files (7/7). The final
optional recovery demo passed 27/27 focused runtime cases and 11/11 public-CDP/
parser controls. After two measured 11-complexity notification functions were
split into cohesive resource-update/completion helpers, the affected 41-case
batch passed; a new read-only health diagnostic found no production function
above 10 cyclomatic / 15 cognitive. This diagnostic is not the complete isolated
maintainability gate. The full diagnostic's nonzero exit retains tooling/template
findings; an initial combined stdout/stderr reader failed on its warning prefix,
then a read-only extraction inspected the retained JSON without rerunning it.

The final development build and strict compiler check passed. Adding the optional
operation field to the public feedback projection fixed three compile failures in
the new actual-service consumer tests. Observer callbacks now accept ignored
return values (`unknown`) and consume promises/thenables with independent rejection
handling: ordinary Array.push sinks and asynchronous callbacks remain supported.
This corrected four strict promise-lint failures without suppressing lint rules.
Production and affected fixture lint, source/locale/architecture/presentation,
repository checks, full zero-finding analyzer and the 92-entry reviewed removal
plan passed at their recorded checkpoints; harness build passed with its retained
nonblocking chunk/plugin-timing warnings.

Browser provisioning attempts are separate prerequisite failures: the default
shared cache and then one fresh worktree-contained cache both failed at the
unchanged Playwright lock stale threshold while downloading Chromium. The latter
rejects shared-cache location alone as an explanation; it does not prove the cause.
No browser test ran in either attempt, no lock was manually removed and no threshold
was changed. Both logs remain. Served/native/full verification therefore belongs
to the prescribed fresh hosted qualification, not these local attempts.

The crosswalk adds 25 reviewed unit/partial links whose exact assertions passed in
the retained 384/385 development packet. All 96 rows/modes and 117 original links
remain unchanged. Four overbroad descriptions were independently corrected to
their actual assertion scope. The failed packet establishes zero acceptance
advancement; current full-session evidence is still required for every link.

The final evidence update must record exact full verification, producer packets,
candidate hashes, code/evidence SHAs, generated-consumer/archive results, check
status and current acceptance. Until then this record makes no current-source
acceptance advancement claim. All 96 cases/modes, baseline, separate Nuxt matrix
and blocked release remain unchanged. No publication or merge is authorized.
