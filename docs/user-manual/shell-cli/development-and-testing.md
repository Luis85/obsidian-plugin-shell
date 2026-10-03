# Development and testing

## The daily loop

Work in the generated project rather than accidentally editing the framework checkout. Inspect status, make the smallest coherent change, run focused tests, then perform the appropriate broader checks before sharing the result.

```sh
node bin/app status
node bin/app dev
node bin/app test
node bin/app check
```

`dev` is a long-running process; stop it with Ctrl-C. Its default is the non-local-install watch path. `dev --profile ui` starts the browser UI harness on loopback; `dev --profile obsidian` selects the real-Obsidian sandbox workflow. Inspect help and prerequisites before starting the native workflow. A browser harness is not a native Obsidian session.

## Add features with makers

Discover what the installed framework provides:

```sh
node bin/app make list
node bin/app make describe feature
node bin/app make feature bookmarks --entity bookmark --dry-run
```

Review a maker's generated files and then apply the same request deliberately with `--yes`, or use a saved plan. Makers share the file planner instead of bypassing overwrite protection. Their recipe-specific requirements remain authoritative; a syntactically accepted flag is not necessarily meaningful for every recipe.

Entity choices can distinguish domain-only data, note-backed Markdown documents and plugin data. `--document` selects a note-backed intent and must agree with the storage backend. Choose the persistence semantics before generating the implementation, especially when a user's editable Markdown files must remain the source of truth.

Examples for an existing `documents` feature:

```sh
node bin/app make file-extension board --feature documents --extension board --dry-run
node bin/app make context-menu inspect --feature documents --extensions md,board --dry-run
```

File-extension generation supplies a dedicated integration scaffold; it does not reserve an extension globally or establish that every interaction has been tested in Obsidian. Context-menu extension filters select applicable files. Custom maker code is a separate trust boundary: use `--trust-custom` only after reviewing the local implementation. Listing built-in capabilities must not require executing arbitrary custom code.

## Choose the right test/check

| Command | What it is for | What it does not establish |
| --- | --- | --- |
| `test` | Unit tests, or generated-project tests when that configuration is present | Every browser/native journey |
| `test --profile project` | Explicit generated-project test configuration | Framework-wide qualification |
| `test --profile browser` | Browser/Playwright tests | Native Obsidian behavior |
| `test --profile native` | Native qualification tooling | A completed end-user acceptance session by itself |
| `test --profile obsidian` | Real-Obsidian test workflow in contained vaults | Authorization to use a personal vault |
| `check` | Daily typecheck, lint and test gate with a combined result | The complete `verify` scope |
| `check --fast` | Faster feedback on the diff from `--base <ref>` (default: `origin/main` merge-base, else `HEAD`): changed-file lint, related tests, matching suites | A clean full regression run |
| `check --plan` | The gates a diff requires, with commands, reasons, estimates and CI coverage; runs nothing | Proof that any gate passed |
| `check submission` | Local review-rule checks using trusted project ESLint configuration | Acceptance by the Obsidian community review process |
| `ci --list` / `ci --job <workflow>/<job>` | Workflows and jobs from `.github/workflows`; a dry run prints the job's exact shell commands, `--execute` runs its `run:` steps locally | That the hosted CI job passes; secrets, publication and other-OS jobs are refused |
| `verify --profile project` | Generated-project verification | Framework release approval |
| `verify` | Full framework verification | Permission to publish |

A profile may require additional installed tools, browser binaries, a qualified host application or retained fixtures. A prerequisite failure means the check did not run; do not label it as passed or silently replace it with a smaller check. The native downloader requires explicit permission where supported (`OBSIDIAN_ALLOW_DOWNLOAD=1`); setting that variable is a deliberate network decision.

## Use an isolated test vault

Read configuration first:

```sh
node bin/app config get --json
node bin/app config validate
node bin/app vault prepare --dry-run
```

The configured test vault is an isolated workspace. Preparing its marker is a reviewed operation, not permission to adopt an arbitrary personal vault. After approval, build the plugin and preview installation:

```sh
node bin/app vault prepare --yes
node bin/app build
node bin/app plugin install --dry-run
```

Only after checking the destination and exact assets should you apply installation. Installing built assets does not enable the plugin. Activation, permissions and native interaction review remain separate user decisions. Do not test destructive operations against personal notes.

## Manage synthetic test data deliberately

```sh
node bin/app data plan --input test-data-manifest.json
node bin/app data reset-plan --input test-data-manifest.json
```

These preview different operations: creating/updating owned fixtures and removing/resetting owned fixtures. Read the resulting approval hash and affected inventory. `data apply` and `data reset` use their own `--apply HASH` approval mechanism; do not replace this with the general `--yes` pattern. Copy an actual returned hash, not the literal word `HASH`.

Test-data operations must stay within their owned scope. An ownership conflict is a reason to inspect what changed, not a reason to broaden deletion. Back up retained test evidence before an intentional reset.

## Interpret results, not only files

Read diagnostics and exit status. Successful source generation, successful compilation, passing unit tests, passing browser tests and completed native acceptance are separate evidence categories. Retain the exact candidate identity with the tests you ran; do not carry an older green result forward after unrelated source changes without appropriate revalidation.
