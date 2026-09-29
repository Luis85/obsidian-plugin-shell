# Troubleshooting

## Start with evidence

Record the command with secrets removed, working directory, framework/Node/npm versions, exit status and diagnostics. Use `version --json`, `status`, `doctor`, and the command's help. State whether this is a source checkout, extracted kit or generated project. Do not post private vault content, credentials or unreviewed debug output.

## Common situations

| Symptom | Check | Safe next step |
| --- | --- | --- |
| Unknown command/option | Installed `help --all` and specific help; separate memory dispatcher | Use the suggested supported spelling; do not infer a flag from another command |
| A value was not accepted | Separated `--name value`, quotes, no duplicate flags | Correct syntax; keep structured request fields as data |
| Invalid plugin ID | Lowercase letters/digits/hyphens; prohibited `obsidian`/`plugin` fragments | Choose a valid stable ID, e.g. `folio-tools` |
| No project detected | Current directory and selected launcher | Change to the intended project or supply reviewed `--root` |
| Setup/import identity conflict | `config explain`, current manifest, imported identity | Choose the intended authority and review the new plan |
| Plan changed or application blocked | Changed input/templates/configuration/target files | Preserve work, inspect differences, generate and approve a fresh plan |
| Generation would overwrite edits | Ownership metadata and target diff | Keep the edits and reconcile ownership/extension points deliberately |
| Dependency resolution required | Declared packages and exact lockfile | Review dependency changes; resolve deliberately, review lock, then run exact-lock install |
| A test profile cannot run | Required tools, test configuration and host prerequisites | Report “not run”; satisfy prerequisites before claiming evidence |
| Clickdummy builds but an action is inert | Pending business adapters/acceptance obligations | Implement and test the behavior; do not relabel the scaffold as complete |
| Kit status fails in a source checkout | Whether `.framework/kit.json` is expected in this distribution | Use the correct environment; do not manufacture an integrity manifest |
| Release command asks for authorization | Reviewed candidate and release operation document | Obtain the separate authorization; `--yes` cannot replace it |
| Memory setup is unavailable | Optional integration version/platform/provider prerequisites | Use `memory --help` and `HINDSIGHT.md`; keep default project operation independent |

## Compiler diagnostics

```sh
node shell.mjs compiler explain COMPILER_REFERENCE_MISSING
node shell.mjs compiler check --input design/project.json --json
```

Use the generated **Compiler diagnostics** page for the current stable codes and recovery hints. Syntax errors, missing references, duplicate IDs, path collisions, template defects and unresolved dependencies have different causes. Do not “repair” a template defect by arbitrarily editing user design data.

When needed, retain a report in a new contained `reports/compiler` destination and explicitly request bounded debugging. Review it before sharing. If diagnostics are truncated, fix the reported problems and rerun inspection to expose the remainder rather than assuming the omitted problems are harmless.

## Interrupted or partially applied operations

Do not repeat a write reflexively after a timeout, cancellation or output-limit error. Inspect current files, bounded recovery data and the indicated recovery path. Preserve both user work and diagnostic evidence. A failure can leave a need for manual reconciliation; it is not proof that nothing happened, nor proof that rollback completed.

For a long-running development process, Ctrl-C requests cancellation. For a release or remote write, first determine what the remote system actually accepted before considering another execution. Never use repeated execution as a substitute for understanding a failed receipt.

## Documentation problems

`MANUAL_CONTRACT` means source metadata is incomplete or inconsistent: add the missing summary, usage/example, option description or group membership at its authoritative source. `MANUAL_STALE` means the generated files differ; regenerate from the same trusted checkout. `MANUAL_UNOWNED_FILE` means authored content was placed in the generated directory; move it alongside the handbook, do not delete it to silence the error.

Unsafe-path errors mean generation found a symlink or unexpected filesystem entry. Inspect the path rather than disabling the check. HTML documentation build failures are separate from CLI runtime failures. Keep the root dependency lock unchanged while resolving an isolated documentation-renderer issue.

The manual's examples explain workflows; the generation task does not execute them. Report an example that no longer matches runtime behavior as a documentation defect, and fix its source metadata and associated behavioral test together.
