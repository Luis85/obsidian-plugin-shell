# Choosing a boilerplate path

| You have | Use | Command (preview first) | Notes |
| --- | --- | --- | --- |
| A prepared package or executed prototype with `companion.project.json` | New project from the model | `node bin/app new ../<dir> --from <companion.project.json> --dry-run --json` | Schema 6 only. `--from` on `new` means project JSON, not a framework kit. |
| A project-starter package `projects/<slug>/` | Its `source/` folder | read the package README; install only after approval | Lock is resolution-required; prove a clean install before claiming reproducibility. |
| A file or Companion starter choice (`new --list`) | New project from a starter | `node bin/app new ../<dir> --starter <id> --id <id> --name "<Name>" --author "<Author>" --dry-run --json` | `custom-file-view` also needs `--extension <ext>`; `context-menu` takes `--extensions md,txt`. |
| An unconfigured folder that should become the project | Setup in place | `node bin/app setup --input <companion.project.json> --dry-run --json` | Do not run setup over identity conflicts just to pass a diagnostic. |
| A configured project and a reviewed new design export | Import, then generate | `node bin/app project import --input <companion.project.json> --resolve project --plan-out import.plan.json` | Review with `node bin/app plan inspect import.plan.json --json`; `--resolve` chooses which side wins identity conflicts, it is not a blanket overwrite. |
| A configured project and a changed model | Regenerate | `node bin/app generate --plan-out generation.plan.json` | `--scope feature:<id>` narrows; excluded artifacts must already exist unchanged. |
| An active managed prototype variant | Generate from it | `node bin/app prototypes generate --dry-run` | Strictly the saved active variant; no implicit selection. |
| A feature brainstorm that should ship generated source | Brainstorm boilerplate output | `node bin/app brainstorm feature --input - --out brainstorms/<slug>-boilerplate --json` with `"output": "boilerplate"` | Optional `node bin/app brainstorm verify --out brainstorms/<slug>-boilerplate --json` runs a separate process plan. Output is whole-project. |
| An existing non-Workbench codebase | Adoption plan | `node bin/app adopt analyze --target <dir>` | Use the `adopt-existing-project` skill instead of this chain. |

## Identity rules

The ID is lowercase letters, digits and hyphens and must not contain `obsidian` or `plugin` (`folio-tools` is fine, `my-plugin` is not). Changing an established identity is not cosmetic. Display names may contain spaces.

## After creation

```sh
node bin/app status
node bin/app doctor
node bin/app install
node bin/app make list
node bin/app check --plan
node bin/app check
```

`install` without `--yes` only reports. `check --plan` lists gates without running them. A generated consumer project verifies with `node bin/app verify --profile project`; framework-wide verification is a different scope.

## Delivery tiers (owned by `feature-delivery`)

These are the tiers of the framework repository (`docs/development/DELIVERY-PIPELINE.md`). The handoff and its Definition of Ready and Done exist only in the framework repository today. A generated project follows its own CI; `feature-delivery` reads its workflows or pipelines before promising a tier.

| Trigger | Tier | Purpose |
| --- | --- | --- |
| Before the draft | Handoff | a `docs/increments/<slug>.md` handoff that passes the Definition of Ready (the `increment-handoff` skill) |
| Draft pull request | Dev | "Dev checks": fast diff-scoped check, suite registration, repository policy, changelog structure; "Definition of Ready" on the handoff |
| Ready for review | Integration | "CI result" and every pull-request workflow (Linux legs), blocking self-review guard; "Definition of Done" on handoff plus diff |
| `release/X.Y.Z` branch | Release | every workflow on every matrix leg, then owner-dispatched Publish; never started from this chain (the `release` skill owns it) |
