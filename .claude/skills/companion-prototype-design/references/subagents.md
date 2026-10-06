# Subagent execution and coordination

Use subagents only when the environment exposes actual delegation tools. Otherwise
execute these work packages sequentially. Do not simulate concurrency or invent agent
reports. A lead agent remains accountable for the final coherent build and evidence.

| Work package | Owns | Reads / returns |
| --- | --- | --- |
| Contract discovery | Read-only inspection report and compatibility risks | Exact repository/baseline paths, hashes, validator APIs |
| Model and fixtures | Canonical design JSON, fixtures, requirements traceability | Approved brief; validated IDs and data/source contracts |
| UI implementation | Allocated SFCs, composables, per-view stores, browser harness | Frozen model, real generated paths, selected design direction |
| Integration/build | Build pipeline, scoped styling, extension seams, package manifest | Compiler plan/receipt, runtime pins, complete source tree |
| Independent QA | Tests/evidence, issues and reproduction steps | Agreed acceptance + exact built bytes; not summaries alone |

Run discovery before model decisions. Freeze IDs, component contracts, state/action
semantics, dependencies and shared styling before parallel UI work. Use disjoint files
or isolated worktrees. Only the lead owns shared package/lock/config/schema/style
changes. Model changes that affect another worker require a coordinated rebase and
revalidation; workers may not silently diverge.

Each assignment must state: goal; allowed files; forbidden writes; exact input refs;
acceptance cases; command budget/scope; expected returned file paths and diffs; executed
commands and statuses; unresolved limitations. No worker may publish/install/merge,
change protected files, loosen checks, or claim tests run elsewhere as their own.

QA is independent of implementation where possible. It should actively try invalid
input, error recovery, offline loading, dirty-state navigation, unmount/reopen, stale
reads, and baseline preservation. Lead reconciles findings, reruns integration checks,
and reports remaining gaps rather than averaging worker confidence.
