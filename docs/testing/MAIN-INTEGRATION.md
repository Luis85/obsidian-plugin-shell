# Main integration and dependency review

The owner merged [PR #8](https://github.com/Luis85/obsidian-plugin-shell/pull/8)
as `a624e28972f42d7865692c9b4aee4e6bc8c7e010` on 2026-09-23. Main was clean and
fast-forwarded. PR #9 is updated on its existing branch; no history rewrite,
release publication, tag or permission change is involved.

## Conflict resolution

| Conflict | Resolution |
| --- | --- |
| Candidate workflow | Retain explicit release-operations and runtime-authoring triggers and the existing evidence-only exclusions |
| Consumer workflow | Keep distinct Atlas Notes identity and the broader event/listener/plugin-data recipe sequence; perform the overlapping consumer edit/custom maker exactly once |
| PRD | Retain both runtime-authoring and release-execution requirements; update the current integration wording |
| Package scripts | Retain both event catalog/check commands and `release:operate` |
| Example ownership | Recompute only the merged README's reviewed SHA-256; keep complete Items/example ownership and the combined foundation README |

The PR #8 merge does not change production TS/Vue/styles or the dependency lockfile.
The newly available readiness ledger now reflects the actual event and item
implementations without promoting every legacy acceptance row.

Local targeted release/planner/CLI/remote and example-removal checks passed **54/54**.
Repository policy, event catalog/checker, reviewed removal dry run, release help
and whitespace/conflict checks passed. The full integrated source is qualified
separately; prior retained asset evidence remains bound to
`a7dacca2cecc9ed7edde39b475a4caac65d8af4e` and is not relabeled as this merge.

PR #8's reports, assets and native provider/cache were preserved in the main
checkout under `.qualification/release-operations-merged-a624e28/`, with a handoff
and a 1,019-file evidence hash inventory. Its historical Windows failure hash
remains `175b8d74554478d5fc1885ce3a03880ce17062390e263e6e7245dd110aac0a72`.
The old worktree and normally merged local branch were then removed.

## Dependabot decisions

[PR #6](https://github.com/Luis85/obsidian-plugin-shell/pull/6) changes Node
declarations to 26.6.1, Undici declarations to 8.9.0, and records six bundled
optional Tailwind WASM entries. The runtime stays Node 24.21.0/npm 11.19.1;
new declaration APIs must not be inferred to exist on that runtime. The owner
requested merging compatible dependency updates. The branch was refreshed
against current main to `d4fdda1099ec7e6f098c462e874468af299862dc`. All ten refreshed
checks passed, including the exact Node 24.21.0/npm 11.19.1 Windows/Linux matrix,
showcase and full generated-consumer qualification. The exact checked head was
merged as `525ee264abf5f532e10592ea5d5f694e3c658abe`; main was fast-forwarded and
that dependency change was integrated into PR #9. This deliberately accepts the
declaration update for the tested code; it neither upgrades Node nor qualifies
unexercised Node 26 APIs. [Refreshed consumer run](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35875932657).

[PR #7](https://github.com/Luis85/obsidian-plugin-shell/pull/7) remains blocked.
Fresh registry metadata reports `typescript-eslint` and its parser at 8.70.1,
with TypeScript peers `>=4.8.4 <6.1.0`. Its real qualified Linux/Windows setup
checks fail with `ERESOLVE`. TypeScript 7 also changes the programmatic compiler
API used by this repository's source/registry/catalog tooling. The
[official TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
identifies the stable API transition as later work. Keep TypeScript 6.0.3 until
the parser and tooling can migrate together with strict installation and real
negative controls. No force/legacy-peer-deps override, test suppression or silent
runtime upgrade is an acceptable merge resolution.

This is independent of the existing nested ESLint 9 support exception.
