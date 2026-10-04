# Projects

`src/` is the shell. `projects/<name>/` holds the standalone projects built from the
concepts in [`docs/concepts`](../docs/concepts) (and Claude Design folders in
`docs/design`). Each project is its own TypeScript project: it installs, builds,
tests and ships from its own folder, with its own lock, gates, agent instructions
and workflows. The shell never imports from a project, and a project never reaches
into the shell.

| Project | Prototypes | Workflows |
| --- | --- | --- |
| [`companion`](companion/README.md) | `docs/concepts/companion`, `docs/concepts/sitemap-editor` | `ci.yml`, `obsidian.yml` |

## The contract

A folder `projects/<name>/` (lowercase words joined by single hyphens) must hold:

- **Its own toolchain:** `package.json`, `package-lock.json`, `.nvmrc`, `README.md`
  and `AGENTS.md`. There are no npm workspaces, no `file:`/`link:`/`workspace:`
  dependencies, and no `tsconfig*.json` that extends or references `../`.
- **`workbench.project.json`:** the manifest that names the project and links the
  prototypes it implements.

  ```json
  {
    "schemaVersion": 1,
    "name": "companion",
    "title": "Workbench Companion",
    "prototypes": [{ "path": "docs/concepts/companion", "role": "Browser authoring concept" }],
    "origin": { "starter": "configs/starters/companion-plugin.json" }
  }
  ```

  `prototypes[].path` is a repository path under `docs/concepts/` or `docs/design/`
  and must exist. `origin` is optional; when present, `origin.starter` must exist.
  A site project (below) adds a `site` section and may list no prototype.
- **Its own workflows** in `projects/<name>/.github/workflows/`. They are written as
  if the project were its own repository (paths relative to the project root).
- **An npm entry for `/projects/<name>`** in the root `.github/dependabot.yml`,
  because Dependabot reads only the root configuration.

## Creating a project

```sh
node bin/app new projects/<name> --starter <id> --yes        # or --from <project.json>
# add projects/<name>/workbench.project.json and the dependabot entry, then:
npm run projects:sync
npm run check:projects
```

`projects/<name>` is the only target inside the checkout that `node bin/app new`
accepts. Git initialization is skipped there, because the folder is already in this
repository. Then work inside the project as you would in its own repository:

```sh
cd projects/<name>
npm ci
npm run check
```

## Site projects (opt-in Astro websites)

A site project is a standalone [Astro](https://astro.build) website built from a template
(`product-page`, `project-page` or `documentation`) whose pages render Obsidian Bases
collections. Astro is a dependency of the site only; the shell never installs or runs it.

```sh
node bin/app site templates
node bin/app site new projects/<name> --template <id> [--title "..."] --yes
# list Bases collections under site.collections in projects/<name>/workbench.project.json, then:
node bin/app site collections projects/<name> --yes
```

Its manifest carries `"site": { "template": "<id>", "collections": [...] }`. `check:projects`
requires a known template id and valid collections:

- a unique kebab `name`
- a normalized repository path in `base` to an existing `.base` file, inside the optional `vault`
- a non-empty `view`

The site needs the same Dependabot entry and workflow sync as any other project. See
[Astro website projects](../docs/development/ASTRO-SITES.md).

## Workflows: owned by the project, run by GitHub from the root

GitHub runs only the root `.github/workflows`. `npm run projects:sync` copies every
project workflow there as `.github/workflows/projects--<name>--<file>.yml` and scopes
it to the project:

| In the project's workflow | In the synced copy |
| --- | --- |
| `name: CI` | `name: "<name>: CI"` |
| `push` / `pull_request` triggers | `paths: [projects/<name>/**, <the synced copy>]`; the project's own `paths` and `paths-ignore` are moved under `projects/<name>/` |
| `concurrency.group: ci-…` | `projects-<name>-ci-…`, so it never cancels or is cancelled by a shell run |
| `run:` steps | `defaults.run.working-directory: projects/<name>` |
| `working-directory`, `actions/setup-node` `node-version-file` / `cache-dependency-path`, `actions/upload-artifact` / `download-artifact` / `cache` `path`, `hashFiles('…')` | Prefixed with `projects/<name>/` (absolute, `~` and `$`-led values are kept) |

The sync refuses, instead of guessing, any construct it cannot scope faithfully:

- `pull_request_target` and `workflow_run` triggers
- reusable-workflow jobs and local `./` actions
- `actions/checkout` with `path`
- an unknown action input whose name looks like a path
- `github.workspace` or `GITHUB_WORKSPACE`
- YAML anchors and aliases

Every synced copy must also pass the shell's workflow security floor
(`check:repository`): read-only permissions, SHA-pinned actions,
`persist-credentials: false` and no untrusted shell interpolation.

Never edit a synced copy. Edit the project's workflow and run `npm run projects:sync`.
`npm run check:projects` fails on a missing, stale or orphaned copy.

## Isolation from the shell

- **Shell workflows ignore projects.** Every shell workflow's `push` and `pull_request`
  triggers carry `paths-ignore: ['projects/**']`, or a final `'!projects/**'` in
  `paths`. `check:projects` fails a shell workflow without it. The one exception is
  [`projects-boundary.yml`](../.github/workflows/projects-boundary.yml): it runs
  `check:projects` and `check:repository` for project changes and never installs,
  builds or tests a project.
- **Shell gates ignore projects.** Examples are the analyzer (`configs/quality/fallow.json`),
  the docs-launchers check, `check --fast` / `--plan`, the self-review guard, the
  line-limit, maintainability, lint, type and test roots (which list explicit shell
  folders), the framework kit, and the generator's template snapshot.
  `.gitattributes` keeps projects and their synced workflows out of the shell's
  `git archive` source archives.
- **Known coupling:** the shell build's Nuxt UI component detection scans the whole
  checkout, and its ignore list is not configurable. A project that uses a Nuxt UI
  component the shell does not use would add that component's styles to the shell
  plugin's CSS. With `companion` today, `dist/styles.css` and `dist/main.js` are
  byte-identical with and without `projects/`. Re-check this when a project adopts
  new Nuxt UI components.
- **Branch protection:** a pull request that only touches `projects/<name>` does not
  run the shell's **CI result**. Require the project's own checks and
  **Projects boundary** for such pull requests, for example with a path-scoped ruleset.
