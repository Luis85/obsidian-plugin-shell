# Windows extracted-kit replay repair

PR5 head f43f389d0eaa80752b9f9079757eb57ef1a65dd6 was tested with main
12b692cde7b7f84446373aec363d42f11a9daa4a as merge 2f1421526954d7b9c918886a566f3dca01d00c00.
Core CI 36433383988 / Windows CLI job 108965011000 and setup-policy
36433384229 / Windows npm 11 job 108965010249 both exceeded the unchanged
300000 ms extracted-kit test deadline. They reached 312150 ms and 314646 ms.
Installation, build and earlier contracts passed. This was not an npm approval failure.

## Repair

Independent template reads, plan inspections, apply preflight reads and kit hash reads use a bounded
pool of eight operations. Results keep input order; on failure no new work starts
and all launched work settles before rejection. Every kit verification still opens
every file and checks its ancestors, current length and hash. No mtime cache,
partial inventory, skipped command or test-timeout increase is introduced.

Apply still checks every preimage, including unchanged files, before writing. Only
actual changes receive before/after staging files. Destination writes and rollback
remain serial with the existing per-write rechecks, exclusive create, shared lock
and recovery ownership. This removes redundant backup writes on unchanged replays.
Planning also captures caller-owned inputs before its first await.

The optional Storybook override matrix now has its own fresh compiled/extracted-kit
journey, using the same full Companion input and custom folders. Every previous
assertion is retained. Both journeys retain 300000 ms deadlines and the 120000 ms
per-child bound. This separates unrelated repeated generation matrices rather than
letting new optional tools consume the original core onboarding deadline.

## Local evidence

Node 22.16.0 execution is supplementary to the locked Node 24 / TypeScript 6 CI.
The complete file-plan suite passed 11 cases; its two existing Windows-only cases
remain skipped on Linux. Three selected kit manifest/archive/current-byte tests
passed. The two new staging/input-capture tests fail against the original module.
Source limits and suite ownership passed. No dependency or policy versions changed.
Fresh Windows kit replay and complete current-head CI are required; local runtime
erasure is not a TypeScript check or native acceptance. Historical failures remain
failed; they are not replaced with the later passing contract tests.

The first supplementary monolithic replay, after only the initial read/staging
optimization, still exceeded its deadline and was cancelled. That failed attempt
is retained. A local snapshot observation changed from about 4332 ms to 2031 ms
after bounded template reads; it is not a Windows performance qualification.
