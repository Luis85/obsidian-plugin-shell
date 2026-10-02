# PR #16: template-authoring CI repair

## Failure and correction

The original planning head was `2cadc495d5989760b09f257289b33e9d7c356e70`.
[Template authoring run 36004205714](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/36004205714)
failed at **Remove reviewed examples while preserving the consumer feature**;
the other four PR workflows completed successfully. The failed run is retained,
not retried or relabeled as a pass.

The planning change replaced the root README but retained the previous README's
reviewed SHA-256 in `scripts/examples/ownership.json`. The original source artifact
was reconstructed to its exact Git tree, `85cb73db5a720344a2015c60de9e37061bcbee3d`.
Running its actual removal CLI reproduced `EXAMPLES_EDITED_FILES: README.md`.
The ownership guard correctly rejected an unrecognized preimage before writes.

Only the README entry's reviewed preimage changes:

- Previous: `fe8e007649c3c98fc4ca3d4b6e273f7f9b9d9e44ea62c32d4c9a369c7d773bd3`.
- Reviewed planning README: `952bc04dedfe753933c795d2bf648eeacce94b0111158b47f97870dcb5537d53`.

The replacement template, removal/planning implementation, edited-file rejection,
stale-plan checks, registration protection and all other ownership entries are
unchanged. This is a reviewed metadata correction, not permission to replace a
consumer-edited README. The original guide remains byte-identical in
[TEMPLATE-GUIDE.md](../../TEMPLATE-GUIDE.md).

## Resolve the stacked-base conflict without dropping requirements

The repair has the original planning head as its first parent and current concept
head `a27dc75102ea2832e723fe66abdca6bf4e67eff5` as its second parent. This is a
branch-local reconciliation; PR #5, main and the implementation PR are not merged
or updated. The reconciled base was independently reconstructed to its exact Git
tree, `4f700669e61e477a166aa7568f7a6bad25dc835e`.

Retain all 44 task files and their planned states. Retain the shell-first PRD and
its complete original requirements archive. Preserve the incoming Test Data and
Design System extension in the [current PRD](../product/COMPANION-PLUGIN-PRD.md),
including its linked contracts. Its concept target selection does not silently
rename the shell installer's `.dev-vault` default. No implementation task or
conversion/publication gate is promoted.

Compared with that current concept base, runtime source, manifests, package and
lockfile bytes, workflows, quality thresholds and concept assets are unchanged.
The only non-documentation changes are the single reviewed ownership hash and
three README-focused regression tests.

## Executed local verification

Environment: Linux, Node 22.16.0, npm 10.9.2, preinstalled TypeScript 5.8.3.
The compiler was made available only in the disposable checkout; no package,
lockfile, global installation or dependency policy was changed. This is
**supplemental evidence**, not qualification with the repository-selected
Node 24.21.0/npm 11.19.1/TypeScript 6.0.3 toolchain.

| Check | Result |
| --- | --- |
| Original source removal preview | Expected failure, README preimage rejected, no apply |
| Repaired source removal preview | Passed, read-only plan returned |
| README, removal and file-plan tests | 21 passed; two existing Windows-only cases skipped; zero failures |
| Actual complete source copied to a disposable Git-free directory | Old hash, user edits and post-preview edits rejected with exact source preservation |
| Actual apply in that disposable directory | 79 file changes; all 698 non-plan files preserved; exact foundation README |
| Second apply | Passed with zero writes |
| Code-line and locale check | Passed: 473 inputs; 191 matching translated keys |
| Standard repository check | Blocked locally: the pinned `yaml` dependency is not installed |

Commands run against the reconciled candidate:

```sh
node scripts/examples/cli.mjs --dry-run --json
node --test tests/tooling/readme-ownership.checks.mjs tests/tooling/example-removal.checks.mjs tests/tooling/file-plan.checks.mjs
node scripts/quality/check-source.mjs
node scripts/quality/check-repository.mjs
```

The new tests cover preview-only behavior, exact reviewed replacement, identical
reruns, a README edited before planning, and an edit after preview. They exercise
the real planner/writer in temporary directories. Existing tests still cover
consumer registrations, comments, symlink redirects and recovery.

Review was a separate sequential pass, not independent review. New-head hosted
CI and its complete generated-consumer qualification must be checked separately;
these local results do not imply full CI, native, security or release acceptance.
The containing commit is the source identity for this repair record.
