# Concept intake example

Three complete data files demonstrate project replacement, feature addition and a
base-bound improvement. They contain no executable code, dependencies or credentials.
They are an example, not completed note-capture business behavior.

From a fresh **extracted shell-cli kit**, retain these files under this directory:

```sh
node shell.mjs setup --input docs/concepts/concept-intake-example/project.json --yes
node shell.mjs concept inspect --input docs/concepts/concept-intake-example/feature.json
node shell.mjs concept import --input docs/concepts/concept-intake-example/feature.json --plan-out feature.plan.json
node shell.mjs plan inspect feature.plan.json
node shell.mjs plan apply feature.plan.json --yes
node shell.mjs generate --plan-out generation.plan.json
node shell.mjs plan apply generation.plan.json --yes
```

The generated `Capture` surface has authored text and a declared navigation link.
Generation does not install dependencies or execute providers. After explicit locked
installation, the existing `node shell.mjs clickdummy build` command builds the preview.

To update that page, without changing its stable identity:

```sh
node shell.mjs concept import --input docs/concepts/concept-intake-example/improvement.json --plan-out improvement.plan.json
node shell.mjs plan apply improvement.plan.json --yes
node shell.mjs generate --plan-out regeneration.plan.json
node shell.mjs plan apply regeneration.plan.json --yes
```

The example's base hashes match the exact canonical snapshots in this sequence.
Changing project identity, data or canonical file bytes requires a freshly inspected
base and a reconciled concept. An old concept is not a general-purpose patch for an
arbitrarily changed project. Use `concept inspect --json` to obtain the current base.

`project.json` is a standard v6 companion export. `feature.json` and
`improvement.json` are v1 concept transports over canonical records; the compiler
still consumes the resulting **one** `design/project.json`.

See [concept intake contracts](../../development/CONCEPT-INTAKE.md) for supported
records, HTML markers, ownership, conflicts and recovery.
