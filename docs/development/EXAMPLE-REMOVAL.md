# Remove optional examples

> Type: how-to guide · Part of the [docs index](../README.md)

Run `npm run examples:remove -- --dry-run` to review exact file hashes, removals,
replacement foundation files and checks still to run. Apply with
`npm run examples:remove -- --yes --no-interaction` only after reviewing that plan.
`--json` produces a machine-readable plan/result. The installed TypeScript parser
is required to inspect explicit registrations; no network or installation occurs.

The checked-in ownership manifest identifies individual reviewed example files.
An edited file conflicts before any write; there is no recursive directory deletion
or force option. Consumer-created files and feature registrations are retained.
The same locked, staged file-plan engine used by setup and makers rechecks hashes
and preserves concurrent edits. Identical reruns do not rewrite source.

Template maintainers who change an example-owned file review its new bytes and refresh its
`sha256` in `scripts/examples/ownership.json`; a new example-only file is listed there too.
`tests/tooling/example-removal-rehearsal.checks.mjs` applies the manifest to a copy of the
checkout. It fails on a stale hash, an import of a removed file, a runtime module that only
removed examples used, or missing shared `form.*` messages. It is example-owned itself.

The replacement UI retains preferences, feedback, native view ownership and the
extension host. Task, Project and Items registrations and the showcase panels disappear,
including the Forms page and its example definition. The shared `DataForm` component, its `form.*`
messages and `src/styles/forms.css` remain for your own forms.
The example event registry and its catalog metadata become empty; custom event
and listener registrations remain in their separate explicit registries.
Shared service tests keep test-owned schemas, while example-only UI tests are
replaced by foundation behavior tests. No vault, note, `data.json`, installed
plugin or historical specification is deleted. The legacy preference key
`taskFolder` remains compatible stored data and is labeled as the default note
folder; removing examples does not migrate persisted preferences.

After removal run `npm run verify` and `npm run test:e2e`. Generate a new feature
with `npm run make -- feature bookmarks --entity bookmark`, then repeat those
checks. A generated schema is a starting point for your own business rules.
The current iteration's verification record identifies which consumer sequences
and native/device scopes actually ran; a successful source plan alone proves none
of those checks.
