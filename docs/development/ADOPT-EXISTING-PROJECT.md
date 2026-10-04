# Adopt an existing project

> Type: how-to guide · Part of the [docs index](../README.md)

Workbench is usually used to start a project. `adopt` is for the other case: a project that already exists, for example a legacy Angular webapp, and that should gain Workbench later. It first analyzes the project read-only, then writes one Markdown integration plan. It does not integrate anything, and it does not claim that Workbench is released or qualified.

## Workflow

The commands run from the root of the existing project. The released CLI kit is extracted into `tools/shell-cli/` and invoked as `node tools/shell-cli/bin/app`; from a Workbench checkout the same commands are `node bin/app ... --target <project>`. Use the kit's own Node version (see its `.nvmrc`); the project keeps its Node.

```sh
# 1. Obtain the released CLI kit and verify it (see PUBLISHED-DISTRIBUTION-PLAN.md), then extract it
mkdir -p tools/shell-cli
sha256sum -c workbench-SHA256SUMS --ignore-missing
unzip workbench-cli-<version>.zip -d tools/shell-cli
unzip workbench-starters-<version>.zip -d tools/shell-cli   # optional: lets the report read the Angular target
node tools/shell-cli/bin/app framework status --root tools/shell-cli

# 2. Analyze (read-only) and review the findings
node tools/shell-cli/bin/app adopt analyze

# 3. Preview the plan, then write exactly that file
node tools/shell-cli/bin/app adopt plan
node tools/shell-cli/bin/app adopt plan --apply <planHash>

# 4. Optional: give the project's coding agents the skill that does steps 2 and 3 with them
node tools/shell-cli/bin/app adopt skill
node tools/shell-cli/bin/app adopt skill --apply <planHash>
```

No release is published yet. Until one exists, `node bin/app framework pack --out ./workbench-cli.zip --yes` builds a local kit from a checkout; that is a candidate, not a released or qualified artifact.

The `adopt-existing-project` skill (`.claude/skills/` and the Codex copy under `.agents/skills/`) runs the same commands, reads the code the report points to, refines the plan file, asks the owner the open questions and stops. It may edit only the plan file until the owner approves a named phase.

## Commands

| Command | Effect | Notes |
| --- | --- | --- |
| `adopt analyze [--target <dir>] [--out <file>] [--replace] [--json]` | Read-only | Prints the findings, or the full report with `--json`. `--out` stores the report JSON. |
| `adopt plan [--target <dir>] [--report <file>] [--out <plan.md>] [--replace] [--yes \| --apply <sha256>] [--json]` | Reviewed plan | Previews the Markdown and its hashes; writes only after `--yes` or `--apply`. |
| `adopt skill [--target <dir>] [--yes \| --apply <sha256>] [--json]` | Reviewed plan | Installs the skill into `.claude/skills/adopt-existing-project/` and `.agents/skills/adopt-existing-project/`. |

- The target is `--target`, then `--root`, then the current directory. No `shell.config.json` and no kit layout are needed. `--report` and the `analyze --out` path resolve from the invoking directory; `plan --out` is relative to the target.
- `plan` renders an inline analysis unless `--report` names a stored report. A stored report is untrusted input: it is validated field by field and anything unknown or malformed is refused (`ADOPT_REPORT_SCHEMA`, `ADOPT_REPORT_INVALID`).
- The apply hash is the shared plan hash of the whole reviewed request, so pass the same options on `--apply` that you used for the preview (including `--report`, `--out` and `--replace`). The preview also prints `markdownSha256`, the SHA-256 of the plan text itself. The same report always renders the same bytes.
- `analyze --out` may write outside the project, or inside it only as `docs/workbench/*.json`. It refuses to replace a different file unless `--replace`.
- `plan` refuses to overwrite an existing different file. `--replace` replaces only a file that starts with the adoption-plan heading; any other file is a conflict that no option overrides. `--out` must be a `.md` path inside the target, never through a symbolic link, `.git` or `node_modules`.
- `skill` never overwrites a different existing file, and an unreadable or missing template fails closed before anything is written.

## Safety guarantees

`adopt analyze` is read-only and bounded.

- It never executes project code, package scripts, installers or build tools. Package scripts are listed by name only.
- It never follows symbolic links. Links are counted and skipped, and each folder's real path must stay inside the target. Files are opened without following a final link.
- It skips `node_modules`, `dist`, `build`, `out`, `.git`, `.angular`, `.nx`, `coverage` and common caches, and records an extracted CLI kit by its marker file only.
- Limits: 20,000 files, 14 levels, 256 KiB per read file, 4,000 application source files and 16 MiB read in total. Larger or binary files are counted and not read. Reaching a limit marks the report as truncated and adds a finding. Only configuration files and application TypeScript are ever read; `.env` files, `.npmrc` and key files are not.
- Git is inspected for presence, a clean or dirty working tree and the remote host name. Credentials, user names and paths are never recorded. `git status` runs only when the repository configuration declares no filters, includes or fsmonitor settings, with fsmonitor disabled on the command line and prompts, pagers and optional locks off; otherwise the working-tree state stays `unknown`. A linked worktree or submodule is reported as present with an unknown state.
- The report holds relative paths only, plus the recording time. The plan body contains no other timestamp. Report-derived text is escaped before it is placed in Markdown, so a hostile README or file name cannot add headings, table cells or fences to the plan.
- The only files the commands write are the one plan file, the optional report file and the skill files, each through the shared reviewed file plan with the preconditions above. Files that the adoption workflow itself writes under `docs/workbench/` are ignored by later scans, so re-running a command is idempotent.

## What the report contains

The report is `workbench-adoption-report/v1` JSON: target identity and Git facts, scan facts, package manager and lockfiles, Node pins (`.nvmrc`, `.node-version`, `.tool-versions`, `engines`), TypeScript range and strictness, frameworks with versions, Angular details, styling and token files, testing, lint and format tools, CI providers and workflows, monorepo tools, existing agent files, skills and settings, existing Workbench files, the Workbench targets used for comparison, and findings.

Angular facts come from `angular.json` or Nx `project.json` files: projects, builders (application, esbuild, webpack, library), standalone versus NgModule component and module counts, route files and a route-entry estimate with the top-level paths, services, pipes, directives, signal-API usage, Angular Material and CDK and other libraries, NgRx and other state libraries, SSR, i18n and zoneless setup. Counts come from regular expressions over bounded source reading; treat them as sizing aids. React, Next, Vue, Nuxt, Svelte, Astro and plain TypeScript or JavaScript projects are recognised, and so is an Obsidian plugin (a `manifest.json` with `id` and `minAppVersion`).

The comparison targets are read from the installed kit or checkout, never hard-coded: the Angular version from `configs/starters/webapp-angular.json` (the starters ZIP extracted beside the kit; otherwise the finding says it is unknown), Node from `.nvmrc` and the TypeScript pin from `package.json`.

Each finding has an id, a severity (`info`, `warn`, `block`), a message and evidence paths. Findings are ordered by severity, id and evidence. A `block` rules out the options it names; it does not stop design-only use. Examples: `ANGULAR_TARGET_GAP` (two or more majors behind the generated Angular), `ANGULAR_NGMODULE_BASED`, `ANGULAR_WEBPACK_BUILDER`, `NODE_MAJOR_DIFFERS`, `NODE_ENGINES_EXCLUDE_TARGET`, `TYPESCRIPT_MAJOR_DIFFERS`, `TYPESCRIPT_NOT_STRICT`, `MULTIPLE_LOCKFILES`, `TOOL_CONFIG_CONFLICT`, `PATH_COLLISION` and `PATH_COLLISION_FILE` (for `tools/shell-cli/`, `design/`, `docs/workbench/`, `apps/workbench-app/` and the skill folders), `GIT_ABSENT`, `GIT_DIRTY`, `WORKBENCH_PRESENT`, `SCAN_TRUNCATED` and `MALFORMED_CONFIG`.

## What the plan contains

Sections: summary and recommendation, current state with evidence, strategy options, phased steps, conflicts and risks, what stays untouched, verification gates, rollback and open questions for the owner. It states that it is a plan and that release and qualification are separate decisions.

| Option | Idea | Recommended when |
| --- | --- | --- |
| A | CLI kit sidecar plus a dedicated generated Angular package in the same repository, optionally mounted into the legacy router later | Angular is within one major of the generated version (or newer) |
| B | A separate Workbench-generated app beside the legacy project, no shared build | Angular is two or more majors behind, its version cannot be read, or the stack is not Angular (Vue projects are pointed to the Vue starter) |
| C | Obsidian plugin target: design and review gates first, no regeneration | The project is an Obsidian plugin |

Phases: 0 prerequisites and toolchain, 1 install the kit, 2 agent setup (the skill; instruction files and settings are merged by hand, additions only), 3 describe the existing screens (a `sketch` request derived from the routes, then `design/project.json`), 4 first generated feature behind a link or route and a flag, 5 tests and CI gates, 6 rollout. Each phase has exact commands, files to add or change and acceptance checks, and project scripts are quoted with the project's own package manager.

Command facts the plan relies on, checked against the compiled kit from a project root:

- `project-setup` needs a Git root that is also an Obsidian vault, so it is not used for a legacy webapp. The plan uses `sketch` for the design and `new --starter ... --input ... --out` for the generated package.
- Kit commands that need a project root take `--root` (`framework status --root tools/shell-cli`, `compiler check --root .`); `sketch`, `new` and `adopt` do not.
- The generated package is a prepared prototype that still needs implementation, with its own `package.json` and lock. Its browser targets mirror their routes in the URL hash, which can collide with a legacy router that also uses the hash; mounting it in the legacy router is therefore an optional step after a spike.

## Packaging

The skill templates live in `templates/adoption/claude-skill/` and `templates/adoption/agents-skill/`. `framework pack` copies the `templates/` tree, so the kit carries them under `bin/template/templates/adoption/`, and `adopt skill` reads them from there (or from `templates/adoption/` in a checkout). A test keeps the templates byte-identical to the repository's own skill files.

## Limits

- The analysis reads JavaScript and TypeScript ecosystems only. Other ecosystems are reported as having no recognised frontend.
- Detection is static. It cannot know runtime behavior, feature flags, authentication, shared libraries outside the scan or how screens are tested; the skill asks an agent to read the code for that.
- Only Nx is understood among monorepo tools beyond listing them.
- The plan's commands were checked for shape against the CLI; generating, installing and building a package, or mounting it in a legacy router, is separate work that the plan sequences and the owner accepts.
- This is not a release or qualification claim. The kit used for adoption has to come from a candidate that was qualified separately.
