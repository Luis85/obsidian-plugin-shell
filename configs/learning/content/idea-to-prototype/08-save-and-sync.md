# Save the design into docs/design and sync

Export or save the design work from Claude Design back into the same folder, `docs/design/<slug>/`:

| Save to | What |
| --- | --- |
| `prototypes/` | The exported prototype HTML files, `<screen-id>--<variant>.html` |
| `assets/` | Exported images and screenshots (small, no personal data, no fonts) |
| `notes/decisions.md` | Decisions, open questions, new tokens and business rules |
| `handoff/implementation-map.md` | The rows with prototype files, acceptance notes and status `ready` |

Do not copy anything over the generated files. Then check the folder:

    node bin/app design status --name <slug> --json

`status` never writes. It lists the prototype files, counts the implementation-map statuses (for example
`{"ready": 2}`), reports `edited` generated files and whether the folder is `current` or `stale`.

When the project model or an engineering fact changed (status `stale`), regenerate the generated files:

    node bin/app design sync --name <slug> --json
    node bin/app design sync --name <slug> --json --apply <planHash>

Sync rewrites a generated file only while it still has the bytes recorded in the manifest, and never touches
`prototypes/`, `assets/`, `notes/` or the implementation map. A hand-edited generated file makes the plan fail
with `DESIGN_FILE_CONFLICT` and nothing is written: move the edit into `notes/` or `prototypes/`, or delete the
file so it is regenerated. Read [[docs/development/CLAUDE-DESIGN-HANDOFF#Sync rules|the sync rules]].

Committing the folder is your decision: saved files are not approval for an agent to commit or push them.

To finish this step, enter the file name of one prototype you saved (for example `node-1--compact.html`).
The step checks that it exists in `prototypes/`, carries `data-design-id` and that at least one row of the
implementation map is `ready`.
