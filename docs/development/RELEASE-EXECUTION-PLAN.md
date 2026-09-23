# Release execution milestone

Baseline: main/origin/main `386353f5ef3bc6ec94d19057bef159e4efa6e7a1`, confirmed
PR #4 merged on 2026-09-23. Main is clean; maintained edits belong only to
`.worktrees/release-operations`, branch `build/release-operations`. No `.codex/`
instructions exist. PR #5 is an independent proposal; dependency PRs #6/#7 are
review inputs, not authorization to merge them.

## Selection and acceptance

The existing source implements identity/setup/resume, the maker catalog, reviewed
example removal, shared plugin-data persistence, version preparation and retained
candidate planning. Historical pending descriptions are not evidence of missing
code. The [readiness ledger](TEMPLATE-READINESS-LEDGER.md) maps the retained
requirements and all legacy acceptance blockers without promoting their status.

The selected concern is release execution from an already qualified retained
candidate. It must discover authenticated current remote state, verify source
ancestry and tag identity, create only drafts, upload only missing matching assets,
and promote only a complete reviewed candidate with source/hash-bound native
records. Execution requires a separately supplied explicit authorization bound to
the repository, mode, source, version and all retained bytes. The default remains
read-only. No rebuild, asset clobber, automatic retry of an uncertain write, tag
movement, permission change or automatic publication is allowed.

Acceptance includes first/subsequent versions, partial uploads, explicit rerun
reconciliation, uncertain outcomes, existing tags/public releases, altered bytes,
API failures and missing acceptance. Synthetic transport evidence remains distinct
from a real remote release. This session does not authorize real draft creation,
uploads, tags, publication, listing, merging or repository administration.

## Ownership and dependency order

| Package | Owner | Files / acceptance |
| --- | --- | --- |
| Requirement inventory | requirements_inventory agent | `TEMPLATE-READINESS-LEDGER.md`; all legacy blockers, actual-source inventory, upstream dependency review |
| Operation engine | release_executor agent | New `scripts/release/execute.mjs` and execution tests/helper; immutable packet, explicit consent, fresh-state reconciliation, bounded failure |
| GitHub transport | remote_adapter agent | New `scripts/release/github-remote.mjs` and remote tests/helper; argument-array API, pagination, default-branch ancestry, tag peeling and explicit writes |
| Integration | Parent | CLI, command/help/analyzer inventories, workflow triggers, operational docs, source status and acceptance record |
| Independent review | Separate agent wave | Actual diff and adversarial execution/transport review; implementation owners fix findings before qualification |

Engine and adapter owners agree their interface before implementation. Shared
registries, package metadata, workflows and documentation are parent-owned. Agents
do not commit or run heavy builds. Parent serializes install/build/type-aware
lint/coverage on this RAM-limited Windows host. Bounded targeted tests can run
independently. Independent reviewers must not review their own implementation.

## Verification and delivery

1. Revalidate preserved Node 24.21.0 and npm 11.19.1; strict fresh lockfile install.
2. Run targeted release execution/transport/planner/candidate tests and CLI
   negatives. Run repository/source/analyzer gates with no weakened thresholds.
3. Update read-only qualification workflow triggers for this topic; use hosted
   CI for full `verify`, complete production inventory/floors, served browser,
   live all-category security and contained native tests.
4. Qualify a distinct generated consumer through setup, feature creation,
   preservation of customized source, example removal and a subsequent feature;
   verify complete source, coverage and served behavior. Retain source-archive
   and safe-plan negative evidence from actual executed tests/workflows.
5. Freeze a code commit; the candidate workflow runs `release:rehearse` once to
   build/verify/retain its five-file packet. All subsequent host checks use those
   bytes. Preserve failures and record source, asset hashes and scope. Evidence-only
   documentation can follow without claiming a new candidate.
6. Commit imperative changes, push topic, open/attach a reviewable PR and inspect
   checks. Deliver exact results, commits, candidate hashes and remaining scope;
   ask the owner for the next step after delivery.

Real remote publication/first-release qualification, physical devices, macOS,
manual screen readers and nested ESLint upstream support remain explicit limits
unless separately evidenced. Local locking and remote refresh are not a GitHub
cross-client transaction or cryptographic attestation.
