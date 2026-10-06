# Shell CLI user manual

Start with the [user handbook](docs/user-manual/shell-cli/index.md).

The handbook covers first-run setup, project JSON, generation, daily development,
makers, testing, reviewed plans, automation, isolated vaults, optional memory,
maintenance, release preparation and troubleshooting.

Generate the command reference from the same metadata as terminal help:

```sh
node --experimental-strip-types scripts/documentation/manual.mjs
```

See [documentation authoring](docs/user-manual/shell-cli/documentation-authoring.md)
for source docblocks, Markdown contributions, checks and the optional TypeDoc build.
The [tooling research and decision](docs/_archive/research/SHELL-CLI-MANUAL-TOOLING.md)
compares TypeDoc, VitePress, Starlight, Docusaurus, JSDoc and CLI-framework approaches.
