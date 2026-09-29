# Save and resume project setup

The Angular setup wizard offers **Save setup progress and exit?** after the project
brief, PRD intake, prototype interview and brick editing. The default is No:
continue without creating a checkpoint. Selecting Yes opens the normal file-plan
review. Only approved saves write `configs/project-setup-draft.json`.

Restart `node shell.mjs project-setup` to resume, start over while preserving the
saved draft, or exit without changes. Resume retains completed answers and prior
brick operations. The prototype interview is reviewed again. Boilerplate generation
and optional first-run execution still require their own current approvals.

A checkpoint stores answers and source fingerprints, **not** a plan hash, a write
approval, an npm execution permission, a running process, or a prepared application.
Saving removes prototype `approved: true`. No autosave writes are introduced.

## Agent commands

```sh
node shell.mjs project-setup schema --json
node shell.mjs project-setup checkpoint --input partial-setup.json --json
# Review the checkpoint file change; repeat with its current --apply hash.
node shell.mjs project-setup checkpoint-status --json
node shell.mjs project-setup resume --json
```

`checkpointSchema` in schema discovery describes a partial setup request. Only
`schemaVersion: 1` is required; completed `project`, `settings`, `prds`,
`prototypeInterview`, `operations` and `boilerplate` fields use the normal setup
contract. The resume response's `data.request` contains the saved answers with no
reusable approval. Complete/review the request and pass it to `project-setup
--input` to prepare a **new** file plan. Resume itself is read-only and rejects
`--apply` and `--input`.

Resume rechecks the project-directory identity, saved settings and PRD inventory,
including newly added or removed scan files and changed Markdown. It refuses stale
sources, corrupt/foreign files and a project that has already been initialized.
Review source changes explicitly and save a new checkpoint to refresh its
fingerprints; merely rerunning resume does not authorize changed inputs.

The checkpoint remains after successful setup as a non-executing recovery record.
Remove it explicitly through a reviewed deletion:

```sh
node shell.mjs project-setup discard-checkpoint --json
# Review the deletion, then repeat with --apply <current-planHash>.
```

This deletes only the recognized checkpoint, never PRDs, generated code or settings.
Corrupt or unrecognized files are preserved for manual inspection. The checkpoint
path is a reserved bootstrap-discovery location, like the setup-state file. It
cannot be selected as an application, PRD, prototype, brief or report output.

Checkpoints are saved at completed stage boundaries, not after every keystroke.
A cancellation before an approved checkpoint save does not silently create a draft.
