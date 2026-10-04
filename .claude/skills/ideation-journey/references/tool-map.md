# Tool map

Every `node bin/app` command group, and which chain skill uses it. Discover the installed set with `node bin/app capabilities --json` and details with `node bin/app help <command>`; the installed CLI wins over this table. `tests/tooling/agent-ideation-skills.checks.mjs` fails when a listed skill stops citing its command, a cited command no longer exists, or a command group is missing here.

Effect legend: **read** writes nothing; **plan** previews and writes only with `--apply <planHash>` (or `plan apply <file> --yes`); **process** runs trusted project tools after approval.

## Used by the chain

| Command | Skills | Effect | Purpose in the chain |
| --- | --- | --- | --- |
| `node bin/app status --json` | `ideation-journey`, `ideation-brainstorm`, `ideation-concept`, `ideation-prototype`, `ideation-boilerplate` | read | configuration, generated state, next step |
| `node bin/app settings show --json` | `ideation-journey`, `ideation-brainstorm` | read | `paths.prds` and other configured folders |
| `node bin/app capabilities --json` | `ideation-journey` | read | the installed command set |
| `node bin/app memory status` | `ideation-journey`, `ideation-brainstorm` | read | whether optional memory is enabled |
| `node bin/app memory recall --query "<topic>"` | `ideation-brainstorm` | plan | opt-in background recall; `--apply` after approval |
| `node bin/app brainstorm guide --json` | `ideation-concept` | read | feature interview questions |
| `node bin/app brainstorm schema --json` | `ideation-concept` | read | feature request schema |
| `node bin/app brainstorm context --json` | `ideation-concept`, `ideation-journey` | read | `projectId`, `baseSha256`, existing surfaces |
| `node bin/app brainstorm validate --input - --json` | `ideation-concept` | read | validate a request from stdin |
| `node bin/app brainstorm feature --input - --out brainstorms/<slug> --json` | `ideation-concept`, `ideation-prototype`, `ideation-boilerplate` | plan | definition, prototype or boilerplate package |
| `node bin/app brainstorm verify --out brainstorms/<slug> --json` | `ideation-prototype`, `ideation-boilerplate` | process | separate test/build plan for generated source |
| `node bin/app concept schema --json` | `ideation-concept` | read | concept manifest contract |
| `node bin/app concept inspect --json` | `ideation-concept` | read | current base hash, or a concept file with `--input` |
| `node bin/app concept import --input <manifest> --plan-out concept.plan.json` | `ideation-concept` | plan | import a feature concept into the saved project |
| `node bin/app project schema --json` | `ideation-concept` | read | companion project schema 6 |
| `node bin/app project validate --input <file> --json` | `ideation-concept` | read | validate a candidate model |
| `node bin/app project inspect --input <file> --json` | `ideation-concept`, `ideation-design`, `ideation-boilerplate` | read | compiler obligations of a model |
| `node bin/app project measure --input <file> --json` | `ideation-concept` | read | model size measurements |
| `node bin/app project import --input <file> --resolve project --plan-out import.plan.json` | `ideation-boilerplate` | plan | bring a reviewed design into a configured project |
| `node bin/app sketch schema --json` | `ideation-concept` | read | sketch transaction contract |
| `node bin/app sketch --input - --json` | `ideation-concept` | plan | build a candidate model |
| `node bin/app sketch show --json` | `ideation-concept` | read | saved IDs and page composition |
| `node bin/app sketch generate --out generated/<slug> --kind clickdummy --json` | `ideation-prototype` | plan | maker-side clickdummy source |
| `node bin/app new starters --json` | `ideation-concept`, `ideation-boilerplate` | read | project starters with interview |
| `node bin/app new --list` | `ideation-concept`, `ideation-boilerplate` | read | file and Companion starters |
| `node bin/app new guide --starter <id> --json` | `ideation-concept` | read | starter request skeleton |
| `node bin/app new validate --input - --json` | `ideation-concept`, `ideation-prototype` | read | validate a starter request |
| `node bin/app new --input - --out projects/<slug> --json` | `ideation-prototype` | plan | project-starter package with `source/` |
| `node bin/app new ../<dir> --from <companion.project.json> --dry-run` | `ideation-boilerplate` | plan | new project from the prototype model |
| `node bin/app starters list --json` | `ideation-concept` | read | every installed starter definition |
| `node bin/app starters show <id> --json` | `ideation-concept` | read | one starter in full |
| `node bin/app starters validate --json` | `ideation-concept` | read | check a custom starter |
| `node bin/app templates list --for obsidian-plugin --json` | `ideation-design` | read | component vocabulary |
| `node bin/app templates search <term> --json` | `ideation-design` | read | find a component template |
| `node bin/app templates show <id> --json` | `ideation-design` | read | one component template |
| `node bin/app compiler check --input <file> --json` | `ideation-design`, `ideation-boilerplate` | read | compiler diagnostics |
| `node bin/app compiler inspect --input <file> --stage ir --json` | `ideation-design` | read | normalized model |
| `node bin/app compiler explain <CODE>` | `ideation-design` | read | explain a diagnostic code |
| `node bin/app styles inspect --input <file>` | `ideation-design` | read | design tokens |
| `node bin/app styles export --input design/project.json --format css --dry-run` | `ideation-design` | plan | token export |
| `node bin/app handout validate --json` | `ideation-journey`, `ideation-design` | read | product-trio readiness counts |
| `node bin/app handout generate --plan-out handout.plan.json --json` | `ideation-design` | plan | create the root handout |
| `node bin/app handout refresh --plan-out handout-refresh.plan.json --json` | `ideation-design` | plan | refresh after PRD changes |
| `node bin/app handout inspect --json` | `ideation-design` | read | read handout answers |
| `node bin/app design status --json` | `ideation-journey`, `ideation-design` | read | Claude Design folder states |
| `node bin/app design prepare --name <slug> --json` | `ideation-design`, `ideation-prototype` | plan | create or refresh a design folder |
| `node bin/app design sync --name <slug> --json` | `ideation-design`, `ideation-journey` | plan | regenerate a stale folder |
| `node bin/app prototype guide --json` | `ideation-prototype` | read | prototype interview and default answers |
| `node bin/app prototype validate --input - --json` | `ideation-prototype` | read | readiness of the answers |
| `node bin/app prototype --input - --out prototypes/<slug> --json` | `ideation-prototype` | plan | prepared prototype package |
| `node bin/app prototypes list --json` | `ideation-journey`, `ideation-prototype` | read | managed prototypes |
| `node bin/app prototypes create <slug> --input design/project.json --dry-run` | `ideation-prototype` | plan | capture a managed prototype |
| `node bin/app prototypes version <slug> --version v2 --from v1 --dry-run` | `ideation-prototype` | plan | new editable version |
| `node bin/app prototypes fork <slug> --version v1 --variant main --as <variant> --dry-run` | `ideation-prototype` | plan | variant to compare |
| `node bin/app prototypes compare <slug> --version v1 --variant main --with-prototype <slug> --with-version v1 --with-variant <variant> --json` | `ideation-prototype` | read | compare two variants |
| `node bin/app prototypes status <slug> --version v1 --variant main --status review --dry-run` | `ideation-prototype` | plan | lifecycle status |
| `node bin/app prototypes activate <slug> --version v1 --variant main --dry-run` | `ideation-prototype` | plan | choose the generator input |
| `node bin/app prototypes generate --dry-run` | `ideation-prototype`, `ideation-boilerplate` | plan | generate from the active variant |
| `node bin/app generate --plan-out generation.plan.json` | `ideation-prototype`, `ideation-boilerplate` | plan | plugin or clickdummy source |
| `node bin/app plan inspect <plan-file> --json` | `ideation-concept`, `ideation-design`, `ideation-prototype`, `ideation-boilerplate` | read | review a saved plan |
| `node bin/app plan apply <plan-file> --yes` | `ideation-concept`, `ideation-design`, `ideation-prototype`, `ideation-boilerplate` | plan | apply a reviewed saved plan |
| `node bin/app install` | `ideation-prototype`, `ideation-boilerplate` | process | report, then `--yes` for exact-lock install |
| `node bin/app clickdummy build --dry-run` | `ideation-prototype` | process | offline clickdummy HTML |
| `node bin/app ui status` | `ideation-journey`, `ideation-prototype`, `ideation-boilerplate` | read | generated UI progress |
| `node bin/app ui gallery --target clickdummy --json` | `ideation-prototype`, `ideation-boilerplate` | process | screenshots for human review |
| `node bin/app version --json` | `ideation-boilerplate` | read | CLI and toolchain version |
| `node bin/app doctor` | `ideation-boilerplate` | read | environment diagnostics |
| `node bin/app config explain` | `ideation-boilerplate` | read | effective project configuration |
| `node bin/app setup --input <companion.project.json> --dry-run --json` | `ideation-boilerplate` | plan | configure the current folder |
| `node bin/app make list` | `ideation-boilerplate` | read | maker recipes |
| `node bin/app make describe <recipe>` | `ideation-boilerplate` | read | one recipe's inputs |
| `node bin/app make <recipe> <name> --dry-run` | `ideation-boilerplate` | plan | scaffold a feature, view, command and more |
| `node bin/app check --plan` | `ideation-boilerplate` | read | gates a diff needs |
| `node bin/app check` | `ideation-boilerplate` | process | typecheck, lint and tests |
| `node bin/app test` | `ideation-boilerplate` | process | project tests |
| `node bin/app build` | `ideation-boilerplate` | process | project build |
| `node bin/app dev --profile ui` | `ideation-boilerplate` | process | local browser harness on request |
| `node bin/app verify --profile project` | `ideation-boilerplate` | process | full consumer-project verification |
| `node bin/app first-run schema --json` | `ideation-boilerplate` | read | optional first-run request contract |
| `node bin/app adopt analyze --target <dir>` | `ideation-journey`, `ideation-boilerplate` | read | route existing codebases to `adopt-existing-project` |

`npm run prototype:tools -- discover --repo <checkout>` (the `companion-prototype-design` helper) is used by `ideation-prototype`.

## Increment handoff and delivery checks

Dependency-free repository scripts (not `node bin/app` commands) that bridge the chain to delivery. They exist in the framework repository only. `tests/tooling/agent-delivery-skills.checks.mjs` fails when a row's script is missing or a listed skill stops citing it. Exit codes: 0 pass, 1 not ready or not done, 2 usage or configuration error.

| Command | Skills | Effect | Purpose |
| --- | --- | --- | --- |
| `node scripts/delivery/increment.mjs new <slug> --from <source>` | `increment-handoff` | plan | preview a `docs/increments/<slug>.md` handoff from the template; `--write` creates it, never overwrites |
| `node scripts/delivery/ready.mjs --handoff docs/increments/<slug>.md` | `increment-handoff`, `feature-delivery`, `ideation-journey` | read | Definition of Ready report and refinement brief; `--write` only adds missing section scaffolds |
| `node scripts/delivery/done.mjs --base origin/main` | `feature-delivery` | read | Definition of Done report; `--write` generates the completion record, Unreleased entry and docs index rows |

## Outside the chain

| Command | Owner or reason |
| --- | --- |
| `node bin/app ci --list` | `feature-delivery` reproduces CI jobs |
| `node bin/app check submission` | publication readiness; not part of prototyping |
| `node bin/app entities catalog` | registered entity definitions in a built project; not needed before a boilerplate exists |
| `node bin/app hosting show`, `node bin/app hosting set` | GitHub, Azure DevOps or no hosting for an existing project; `new` and `setup` take `--hosting` directly (docs/development/HOSTING-PLATFORMS.md) |
| `node bin/app release prepare` | never; release is a separate authorization |
| `node bin/app framework status` | Workbench maintainers |
| `node bin/app schema --json` | operation request schema for agents; not needed by the chain |
| `node bin/app support report` | troubleshooting on request |
| `node bin/app docs status` | application documentation workflow |
| `node bin/app storybook status` | optional integration, on explicit request |
| `node bin/app airship status` | optional integration, on explicit request |
| `node bin/app obsidian status` | optional Obsidian CLI, on explicit request |
| `node bin/app mcp` | local agent MCP server; not launched by the chain |
| `node bin/app vault prepare` | isolated native test vault; never a personal vault |
| `node bin/app plugin install` | installs into a test vault; out of scope |
| `node bin/app data plan` | test-vault data; out of scope |
| `node bin/app project-setup guide --json` | Angular setup inside an existing Git and Obsidian vault; separate guide |
| `node bin/app help` | discovery for every skill |
