# PR #5: reconcile the updated main branch

## Inputs and boundary

Reconcile `docs/companion-plugin-prd` at
`d985a68bb256981625ee61fadcf1de468b5ff969` with main at
`9a48b65660d6bbd66bac9aff2cb73627e1f38211`. The former includes the concurrent
product-audit delivery and its cleanup; the latter includes the merged framework
lifecycle work from PR #15. The repair commit retains those exact heads as first
and second parents. Updating the PR branch is not merging or closing PR #5.

No force push, native companion conversion, release, tag, publication or
permission change is part of this repair. The separate SH-015 handoff is not
imported, and no task state or qualification gate is promoted.

## Resolution decisions

- Retain main's current runtime, harness, package/lockfile, manifests, native
  tooling, workflows and qualification evidence. No lifecycle implementation is
  replaced by the older copy on the concept branch.
- Retain the root README and complete example-ownership manifest from main
  byte-for-byte. All 95 ownership entries, registrations and templates remain
  unchanged. No revised README preimage or weakened removal guard is introduced.
- Preserve the shell-first planning overview in
  [SHELL-FIRST-OVERVIEW.md](../../SHELL-FIRST-OVERVIEW.md), linked from the parent
  PRD and delivery strategy. The root README remains the current operational
  guide; the original TEMPLATE-GUIDE archive remains historical. Shell-first
  delivery order, the concept boundary and all 44 task files are retained.
- Combine the explicit public authoring API entry with the exact concept analyzer
  inventory. Keep both the public-API negative controls and the concept boundary
  tests. No analyzer threshold or coverage floor changes.
- Retain main's framework requirement and add the companion/semantic-design
  sections to the parent PRD. Maintainability documentation retains both the
  public API entry explanation and the bounded concept-Python classification.
- Keep both `.nq/` and `/.test-vault/` exclusions. This does not rename the shell's
  `.dev-vault` default or modify any vault.

The audit's concept subtree is preserved from the actual final branch, not
recreated from a prior HTML snapshot:

| Subtree | Preserved Git object |
| --- | --- |
| `docs/concepts` | `66defef4aec51308a3d1e341b3933360800042b7` |
| `scripts/concepts` | `7e4b5f5197c2668aea613890435192351c721e50` |
| `tests/concepts` | `bd98f916b15e22127619a17372b8d16f25e5b5a4` |
| `docs/tasks` | `9865b04ffc1e06bd48dafea6da18e5416621cd84` |

The audit's temporary delivery files were removed by its own cleanup commit;
this reconciliation preserves their absence rather than restoring stale helpers.

## Supplemental local verification

Environment: Linux, Node 22.16.0/npm 10.9.2, preinstalled TypeScript 5.8.3 exposed
only to a disposable checkout. This is not the repository-qualified
Node 24.21.0/npm 11.19.1/TypeScript 6.0.3 toolchain. No package or lockfile was
changed for local execution. Review was sequential, not independent.

The focused candidate combines the exact framework code snapshot
`17d0f5bbea700612762b2a8c1eb467b9d66c8d95` with the pre-audit concept and the
resolutions above. Comparison with actual main found only eight later
qualification/evidence-document changes; the final Git tree retains those main
objects unchanged. The concurrently delivered audit subtrees were then retained
by exact Git object identity. Therefore the following local results are not
claimed as a full execution of the final integrated source tree.

| Check | Actual result |
| --- | --- |
| README/removal/file-plan/archive/source tests | 29 passed, two existing Windows-only skips, zero failures |
| Main ownership preconditions | All 95 entries match, including 11 expected-absent paths |
| Actual removal in a disposable Git-free source copy | 96 writes, all 762 files outside the plan preserved, identical rerun writes zero |
| Wrong planning-README hash and edits before/after preview | Rejected with source preservation |
| Source-size and translation parity | Passed: 527 inputs, 202 translated keys in the focused local candidate |
| Relative document link targets | 69 targets resolve; no anchor-validation claim |
| Test-data kit before the concurrent audit | 27 passed; test-kit implementation was not changed by this reconciliation |
| Pre-audit concept assembly/tamper checks | 10 passed; not relabeled as final-audit execution |
| Standard repository check | Failed locally because installed `yaml` is absent |
| Concept/public-API analyzer tests | Five failed with the `fallow` executable absent; these are not passes |

```sh
node --test tests/tooling/readme-ownership.checks.mjs tests/tooling/example-removal.checks.mjs tests/tooling/file-plan.checks.mjs tests/tooling/archive-command.checks.mjs tests/verification/source.test.mjs
node scripts/quality/check-source.mjs
node --test tests/tooling/test-data-*.checks.mjs
python tests/concepts/companion-assembly.test.py
python scripts/concepts/build-companion.py --check
node scripts/quality/check-repository.mjs
node --test tests/tooling/companion-boundaries.checks.mjs tests/tooling/public-api-analysis.checks.mjs
```

Full pinned-toolchain verification, generated consumers, the final audit's browser
suites, native/platform/security qualification and independent review must be
read from their own exact-source runs. Historical audit/browser counts are not
added to these local results. Pending CI is not a pass.

An earlier candidate proposed a changed README preimage, but its source upload
was blocked before a commit or ref update. That proposal was discarded. This
repair instead retains main's README and ownership manifest without changes;
it does not retry that metadata change through another transport.

The containing commit is the final repair source identity. Consult the current
PR checks for its hosted result. Conflict resolution does not establish
conversion or publication readiness.
