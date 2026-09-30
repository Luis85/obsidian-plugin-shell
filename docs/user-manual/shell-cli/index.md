# Shell CLI user manual

The Shell CLI turns an approved plugin design into a working project, helps you extend and check it, and keeps file changes, dependency installation, native testing and publication as separate decisions. Use this handbook for the workflow; use the source-generated reference for exact command syntax.

## Choose your starting point

| You need to… | Read |
| --- | --- |
| Create your first plugin or use an extracted developer kit | [Getting started](getting-started.md) |
| Import project JSON, generate source, or build an offline clickdummy | [Design to working project](design-and-generation.md) |
| Add features and work on a project every day | [Development and testing](development-and-testing.md) |
| Brainstorm features in the TUI or with an AI agent | [Feature brainstorming](brainstorm.md) |
| Automate safely or integrate an AI agent | [Plans, automation and safety](automation-and-safety.md) |
| Maintain the framework, upgrade or prepare a release | [Maintenance and release](maintenance-and-release.md) |
| Use optional memory tooling and understand separate entry points | [Optional integrations](optional-integrations.md) |
| Resolve errors without losing work | [Troubleshooting](troubleshooting.md) |
| Maintain application pages, components, interactions and journeys as typed Markdown | [Application documentation](application-documentation.md) |
| Maintain this manual from code comments or Markdown | [Documentation authoring](documentation-authoring.md) |

## Exact reference, generated from source

The documentation build creates `generated/reference.md`, `generated/diagnostics.md`, `generated/commands.json` and `generated/manifest.json` beside this handbook. The HTML build includes these as **Command reference** and **Compiler diagnostics**. Generated command coverage applies to the shared framework catalog, not the separately dispatched memory CLI or the legacy compiler transport.

To produce these references from a trusted source checkout, run:

```sh
node --experimental-strip-types scripts/documentation/manual.mjs
```

No documentation package installation is needed for that command. Rendering the searchable HTML site is a separate, maintainer-only operation described in the authoring guide. Markdown remains readable in GitHub and Obsidian without a website or account.

## First orientation

From the folder containing `app.mjs`:

```sh
node bin/app help
node bin/app help --all
node bin/app help new
node bin/app version --json
```

The direct Node entry works without an npm alias or file extension. These forms all reach the same CLI:

| Form | Notes |
| --- | --- |
| `node bin/app help` | Extensionless entry; works on every platform. |
| `./bin/app help` | macOS/Linux, when the file keeps its executable bit. |
| `npx obs-shell help` | Inside the project only: the package `bin` maps `obs-shell` to `bin/app`, and flags pass through without `--`. Outside a project, npx would look for a registry package instead. |
| `npm run app -- help` | Package script; npm consumes flags such as `--json` unless they follow `--`. `npm run shell -- help` is kept as an alias. |
| `node app.mjs help` | The launcher itself. `node shell.mjs help` remains a compatibility shim for existing kits and generated projects. |

Do not assume that an unqualified global `shell-cli` command or an npm registry package has been published.

Commands in examples are separate steps, not a script to execute blindly. Replace filenames, project names and hashes with your own values. Inspection and preview come before approval. A successful command, generated scaffold or browser clickdummy does **not** establish completed business behavior, native Obsidian acceptance or permission to publish.

## Scope and provenance

This handbook was reconciled against PR #5 source commit `f140c7e89570329fc7ed40ee2d4cb885f4524fc2` on 2026-09-28. The generated reference always reflects the checkout used to generate it. Its manifest records relevant source fingerprints; it is not a digital signature or an acceptance report.

There are three distinct environments: the framework source checkout, an extracted compiled developer kit, and a generated consumer project. Build documentation in the first. Read the supplied documentation in the others. In the inspected kit layout, documentation is retained below `.framework/template/docs/` before project generation; do not assume every template file is already at the extraction root.
