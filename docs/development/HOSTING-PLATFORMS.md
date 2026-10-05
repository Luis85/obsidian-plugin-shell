# Choose GitHub, Azure DevOps or no hosting platform

> Type: how-to guide · Part of the [docs index](../README.md)

Every Workbench project records where its pull requests and CI live in `tooling.hosting` of
`design/project.json` ([schema](COMPANION-PROJECT-SCHEMA.md)). An absent field means GitHub, the behaviour every
project had before the field existed. The choice decides which pipeline, pull-request template, README section,
agent hint and Claude Code permissions a generated project receives:

| Platform | Generated files | CLI | Pull-request template |
| --- | --- | --- | --- |
| `github` (default) | `.github/workflows/ci.yml`, `.github/workflows/obsidian.yml`, Dependabot, Copilot pointer | `gh` | `.github/pull_request_template.md` |
| `azure-devops` | `azure-pipelines.yml` (Check, UI and Obsidian stages) | `az repos`, `az pipelines`, `az boards` | `.azuredevops/pull_request_template.md` |
| `none` | no CI | none | `docs/project-tasks/CHANGE-SUMMARY.md` |

Choosing a platform only prepares files and printed hints. Workbench never runs `gh` or `az`, adds or changes a git
remote, signs in, stores a token or contacts a host. Sign in with `gh auth login` or `az login` yourself, or set
`AZURE_DEVOPS_EXT_PAT` in your own shell for one session; never put a token in a project file.

## Create a project for Azure DevOps

```sh
node bin/app new ../field-notes --starter quick-capture \
  --hosting azure-devops --azure-organization https://dev.azure.com/contoso --azure-project "Field Notes" --dry-run
node bin/app new ../field-notes --starter quick-capture \
  --hosting azure-devops --azure-organization https://dev.azure.com/contoso --azure-project "Field Notes" --yes
```

`--azure-organization` is `https://dev.azure.com/<organization>` or the legacy `https://<organization>.visualstudio.com`;
`--azure-repository` defaults to the project name. The organization and project are optional: with only
`--hosting azure-devops` the README and printed hints keep `<organization>` placeholders. After writing, `new` prints
the commands that connect the folder (nothing is run):

```text
Hosting azure-devops (commands are printed, never run):
  az extension add --name azure-devops   (once), then az login
  az repos create --name "Field Notes" --project "Field Notes" --organization https://dev.azure.com/contoso
  git remote add origin https://dev.azure.com/contoso/Field%20Notes/_git/Field%20Notes
```

Then create the pipeline from `azure-pipelines.yml` and add it to `main` as a build-validation branch policy: Azure
Repos ignores YAML `pr:` triggers. The generated README section "Hosting and pull requests" lists the daily `az`
commands; `.claude/settings.json` pre-approves only read-only `az repos pr list/show` and `az pipelines runs list/show`,
asks before creating or queueing anything and denies `az devops login` and inline tokens.

Interactive `new` (a TTY without `--json`, `--yes` or `--no-interaction`) asks for the platform after the Airship
question; a new folder has no remote, so the default is GitHub. `new --from <project.json>` asks nothing: pass the
flags, or set `tooling.hosting` in the exported JSON. File starters refuse the hosting flags.

## Choose the platform during setup

`node bin/app setup` accepts the same flags with `--starter`, `--input` or `--blank`, and the interview asks after the
MCP question. The default follows the folder's `origin` remote (an Azure DevOps remote pre-selects `azure-devops` and
its organization, project and repository); otherwise it is GitHub, and accepting the GitHub default leaves the design
unchanged. Credentials in a remote URL are never printed or stored. To change an existing design, use `hosting set`.

## Switch an existing project

```sh
node bin/app hosting show
node bin/app hosting set azure-devops --azure-organization https://dev.azure.com/contoso --azure-project Demo --dry-run
node bin/app hosting set azure-devops --azure-organization https://dev.azure.com/contoso --azure-project Demo --yes
```

`hosting set <github|azure-devops|none>` is a reviewed plan, like `airship enable`: it rewrites `tooling.hosting`,
updates the intake and generation receipts (an edited design is refused with `HOSTING_OWNERSHIP`), and creates the
new platform's pipeline and pull-request template only where no file exists yet. It deletes nothing. The summary (`--json`)
lists the previous platform's files as `retired`, each `generated-unchanged`, `edited` or `not-generated`; remove the
ones you no longer want yourself. In a kit setup the next `generate` refreshes the README hosting section, the agent
hint and `.claude/settings.json`; in a project created by `new`, review those by hand.

## Check the Azure CLI

`node bin/app doctor` reports the hosting platform. For an Azure DevOps project it runs one read-only probe,
`az version --output json` with telemetry off, and reports `AZURE_CLI_MISSING` or `AZURE_DEVOPS_EXTENSION_MISSING`
with the command to run yourself. It never installs the CLI or the extension and never signs in. `status` and
GitHub projects do not run `az` at all.

## Prepare this framework checkout

`npm run setup` (the dependency-free checkout setup) takes `--hosting github|azure-devops|none` and the same
`--azure-*` flags; interactive setup asks after the MCP question, and a blank answer keeps the current platform. With
`azure-devops` it creates `azure-pipelines.yml` (baseline and `npm run verify` on Linux; the GitHub workflow matrix is
not reproduced) and `.azuredevops/pull_request_template.md` (a copy of the GitHub template) only when absent, writes the
Azure Repos `_git` URL to `package.json` `repository`, and records the choice on one line of `PROJECT-IDENTITY.md`.
`--repo owner/name` stays the GitHub shorthand and is refused with `azure-devops`. `.github` is never deleted. See
[identity setup](SETUP-IDENTITY.md).
