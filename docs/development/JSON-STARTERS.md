# JSON-defined project starters

> Type: reference · Part of the [docs index](../README.md)

Workbench starter contract v1. The public product name is Workbench.
The existing repository, plugin and CLI identifiers remain unchanged.

## Product contract

A starter is one local `configs/starters/<starter-id>.json` file. It contains its
listing metadata, editable input definitions, complete generation request, source
file payloads where applicable, and the definitions of subsequent processes.
There is no required `catalog.json`, adjacent template directory, executable
starter module, network resolver, or hard-coded starter-ID dispatch.

The shell supplies generic validation, rendering, compilation, file planning,
process execution and terminal presentation. **The shell ZIP supplies no starter
definitions.** Starter definitions are a separate, independently downloadable
release asset. A newly extracted shell has an empty starter list until the user
installs definitions. This includes Blank; there is no hidden fallback starter.

The canonical installed definitions live under `configs/starters/`. Every
Companion definition embeds a **project schema 6** document; a definition that
embeds schema 1–5 fails with `STARTER_VERSION` and is never migrated. The retired
v5 `.companion.json` copies were removed with the v5 build base; the checked-in
concept is schema 6 and embeds no starter. Twelve definitions carry the focused
Companion examples (with `agent-ready`), two more the golden Companion and the
visual-feature showcase; `webapp.json` provides a
complete dependency-free browser example using the file-generation primitive. Eleven **project
starters** (`generator.kind: "project"`) replace the former eight-preset maker
catalog: `plugin-nuxtui`, `plugin-vanilla`, `plugin-angular`, `webapp-nuxtui`,
`webapp-vanilla`, `webapp-angular` (also used by `project-setup`), `website`, `cli`,
`hybrid-nuxtui`, `hybrid-vanilla` and `hybrid-angular`.

Those stable IDs form four primary product families: Obsidian plugin (`plugin-*`), web application (`webapp-*`), terminal application (`cli`) and website (`website`). Obsidian plugins and web applications each ship Nuxt UI, vanilla TypeScript and Angular variants. The stable target/ID vocabulary remains unchanged for saved requests and project sidecars.

All `project` starters emit the shared TypeScript [generated project plugin system](./GENERATED-PROJECT-PLUGINS.md). Plugin-specific source and tests stay under `plugins/<plugin-name>/`, beside that plugin's `manifest.json` and `config.json`; each plugin exports a typed `PluginObject` and is activated through explicit static registration.

Running a starter is the only way to create a project. `new --from <project.json>`
remains the separate import of an existing exported Companion project.

## Installation and discovery

Extract the shell release in the folder from which it will be invoked. Extract
`workbench-starters-<version>.zip` there as well, or copy only selected JSON files
from that archive. The resulting starter files must sit next to the launcher as
`configs/starters/*.json`, not inside `.framework`.

```text
workspace/
  bin/
    app
    app.js
    kit.json
    template/
  configs/
    starters/
      blank.json
      quick-capture.json
      webapp.json
```

```sh
node bin/app starters list
node bin/app new --list --json
node bin/app starters show webapp --json
node bin/app starters validate --json
node bin/app starters schema --json
```

Discovery uses the invocation project, not the installed framework's source tree.
`--root` selects the discovery project; `new <directory>` keeps the existing
invocation-relative target-path behavior. Missing or empty folders return an
empty list without creating files. A malformed JSON definition fails discovery
rather than being silently skipped. Other non-JSON directory entries are ignored
within the bounded directory-entry limit.

The optional `configs/user-settings.json` key `paths.startersFolder` changes the
local discovery folder. It must be a contained relative path. The loader does
not rewrite settings, merge defaults into them, or read machine-global settings.
The distribution ZIP always uses the portable `configs/starters/` layout; move
its JSON files to a configured alternative folder explicitly.

## Definition structure

The editor schema is `scripts/starters/starter.schema.json` (catalog data, kept beside
the other JSON catalogs so starter files and in-place kit projects can reference it);
the runtime validator in `bin/adapters/starters/validation.ts` also checks semantic
rules such as path containment, dependency cycles, identity fields, current
Companion version, and input type/default compatibility.
`schemaVersion` versions this contract; `version` versions the individual starter.
A content SHA-256 identifies the exact local bytes but is **not** a signature or
proof that a starter is safe to execute.

| Field | Responsibility |
| --- | --- |
| `id`, `name`, `category`, `level`, `summary`, `outcome` | Discovery and selection. The ID must match the filename. |
| `includes`, `implementation`, `tags` | Descriptive metadata; each is a nonempty list. |
| `inputs` | Declarative labels, types, required flags, defaults and optional choices. |
| `generator` | Generic file emission, an embedded current Companion project document, or a `project` compiler selection. |
| `files` | Complete text or structured-JSON output payloads, with relative paths. |
| `processes` | Named process graph, ordered steps, argument arrays and timeouts. |
| `firstRun` | Process IDs selected only when the caller explicitly requests `--install`. |
| `nextSteps` | Informational guidance. Printing it never runs a command. |

File and Companion starters require string `id` and `name` inputs (project starters
declare none; see below). Other inputs support string,
boolean and integer values. The wizard reads these descriptors, while automation
can provide a JSON values file. Unknown inputs fail instead of being discarded.
The input ID namespace is separate from a starter's hyphenated filename ID.

### Minimal complete definition

Save this as `configs/starters/hello.json`. This example emits two files; the
included `webapp.json` shows a runnable application with tests, build and preview.

```json
{
  "schemaVersion": 1,
  "id": "hello",
  "name": "Hello project",
  "version": "1.0.0",
  "category": "Web",
  "level": "Foundation",
  "summary": "A minimal project defined entirely in JSON.",
  "outcome": "An independent editable project folder.",
  "includes": ["Package metadata", "Readme"],
  "implementation": ["Add application source after generation"],
  "tags": ["minimal"],
  "inputs": [
    { "id": "id", "label": "Project ID", "type": "string", "required": true },
    { "id": "name", "label": "Project name", "type": "string", "required": true }
  ],
  "generator": { "kind": "files" },
  "files": [
    { "path": "package.json", "json": { "name": "{{id}}", "version": "0.1.0", "private": true } },
    { "path": "README.md", "content": "# {{name}}\n\nCreated with Workbench.\n" }
  ],
  "processes": [],
  "firstRun": [],
  "nextSteps": ["Review README.md and add application source."]
}
```

`generator.kind = "files"` needs no starter-specific code. The alternative
`generator.kind = "companion"` embeds a complete `generator.document` and calls
the existing shared compiler. It does not reference one of the old fixture files.
`generator.kind = "project"` selects the project compiler's `projectType`,
`framework`, canonical-order `targets` and, for Angular only, exact `angularPins`.
Its `inputs`, `files`, `processes` and `firstRun` must be empty: the maker's
prototype interview supplies identity and design, and the compiler owns every file.
Project starters run through `node bin/app new` (terminal) or `new guide --starter
<id>` / `new --input` (agents), which prepare a reviewed prototype package; `new <dir>
--starter <project-starter>` refuses with `STARTER_KIND`. The maker reads them from
the `configs/starters/` folder in the package root beside `bin/`. See [project starters](../../bin/PROJECT-STARTERS.md).
Generic compiler/runtime/template code still belongs to the shell; starter-specific
project designs and choices belong to the JSON. Native feature behavior retains
the existing compiler's scaffold and acceptance boundaries.

### Rendering rules

`{{inputName}}` inserts a scalar value. `{{inputName|html}}` escapes HTML text and
attribute characters. `{{inputName|json}}` emits a JSON literal inside a text file.
For a `json` payload, Workbench renders string values recursively and serializes
the object safely; object keys are literal. The renderer does not evaluate
expressions, run JavaScript, or fetch external templates. Missing referenced
values fail when the generation plan is prepared.

Use context-appropriate escaping. A raw substitution inside authored source is
not automatically safe for every programming language. Path substitutions allow
only the unfiltered form and are validated after rendering. No output may escape
the target, use a protected directory, follow a symlink, collide case-insensitively,
or use reserved Windows device names. Extra files cannot replace compiler outputs.

## Create and edit

```sh
# Preview the whole output, without writing or running processes.
node bin/app new ../my-app --starter webapp --name "My App" --json

# Create after reviewing the plan. A previous plan hash can replace --yes.
node bin/app new ../my-app --starter webapp --name "My App" --yes

# Supply all custom fields through JSON rather than new CLI-specific code.
node bin/app new ../my-other-app --starter webapp --values values.json --yes

# Validate and preview installation of a new definition.
node bin/app starters add --input hello.json
node bin/app starters add --input hello.json --yes

# Edit a separate candidate file, review its plan, then apply.
node bin/app starters edit hello --input hello-edited.json
node bin/app starters edit hello --input hello-edited.json --yes
```

Directly editing an installed JSON file is also supported; the next read sees it.
`starters edit` additionally provides the shared review/apply safeguards. Editing
cannot rename the ID. Add a new definition to introduce a new ID. Add refuses to
replace an existing definition; edit requires an existing one. Existing generated
projects are independent copies and are never updated by editing a starter.

A complete source-definition fingerprint and input values participate in the
generation plan. Even metadata-only changes invalidate a held plan. The existing
writer rechecks target preimages, rejects conflicts and preserves unrelated data.
Generation into a nonempty target remains blocked by PR #5's placement rules.

## Processes and explicit first run

Processes are data descriptions, but the project code they invoke is trusted code,
**not a sandbox**. Review package scripts, dependency lifecycle behavior and local
Node files before approving execution. Approved code can write files, use the
network and launch other processes. The engine supports `npm ci`, `npm install`,
`npm run <script>` and project-local Node JavaScript entrypoints. It does not
support starter module imports, shell command strings or inline `node -e` code.

Each process has `dependsOn` IDs and an ordered nonempty `steps` array. A step has
`runner`, `args`, `cwd`, `timeout`, and a `script` for Node. `cwd` and script paths
must be project-contained. Timeouts are finite. Dependencies are checked for
unknown IDs and cycles and run once in topological order. Arguments stay separate
argv entries; no command shell expands substituted values.

```sh
# Review a generated project's process graph and direct input fingerprints.
node bin/app starters run --project ../my-app --process verify,build --json

# Execute exactly the reviewed plan; a changed process graph or input fingerprint fails as stale.
node bin/app starters run --project ../my-app --process verify,build --yes --trust-processes --apply <planHash>

# Without --apply, --yes plans and runs in one step; that run is not compared with an earlier review.

# Create and explicitly request the starter's declared firstRun sequence.
node bin/app new ../first-run-app --starter webapp --yes --install --trust-processes

# Select a different declared process sequence instead of firstRun.
node bin/app new ../selected-run-app --starter webapp --yes --run verify,build --trust-processes
```

`--install` is a compatibility alias for selecting `firstRun`; its exact effects
come from the definition. It does not force an npm command. Omitting `--install`
and `--run` only creates files. Merely listing, showing, validating, editing,
packing, previewing or importing a starter never runs its processes.

The generated `.workbench/starter.json` records source identity/hash, resolved
inputs, generated file hashes and the selected project's process definitions.
It is a project receipt, not a second installed starter catalog. A project can
run its declared processes after the source starter is removed. Review/apply for
processes binds the receipt, package metadata, lock/config files and direct script
entrypoints; it is not a full dependency-graph attestation or an OS security lock.
The optional first run additionally verifies all generated file hashes before
executing the first step.

A failed process stops subsequent steps and returns completed-step information,
exit details and `automaticRetry: false`. External effects are not rolled back or
reported as untouched. Long-running previews remain attached until cancelled or
timed out. Saved generation plans exclude execution trust; applying a saved file
plan does not automatically run subsequent processes.

## Distribution and release

```sh
mkdir -p reports/workbench-distributions
node bin/app framework pack --out reports/workbench-distributions/workbench-shell-0.4.0.zip --yes
node bin/app starters pack --out reports/workbench-distributions/workbench-starters-0.4.0.zip --yes
```

Use the version committed in `package.json`; `0.4.0` is the implementation baseline.
The second archive contains only `configs/starters/*.json`. Definitions retain
their exact UTF-8 bytes. Archives are deterministic for the same input snapshot.
Neither command creates a tag, release or remote upload, and neither overwrites a
different existing archive. Changing the installed recipes changes the starter
archive, not a hard-coded shell registry.

`.github/workflows/starter-distribution.yml` builds separate versioned shell and
starter ZIPs, a source-bound manifest, and SHA-256 checksums on relevant pull
requests or explicit dispatch. It uses the qualified Node/npm/TypeScript graph
and runs starter/CLI/archive regressions. PR runs have read-only repository access.

The optional attachment job requires explicit dispatch with
`attach_to_existing_release=true`, the `workbench-release` environment, an existing
version release whose tag resolves to the exact packaged source, and that source
on the default branch. Configure required reviewers on the environment before
production use. The job cannot create or publish a release and does not use
`--clobber`; existing conflicting assets cause failure. Partial remote upload
failures require inspection, not an automatic replacement or retry policy.

This is an asset-building and separately authorized attachment path, not a bypass
of SH-022/SH-034, companion/native acceptance or the repository's broader release
qualification. No release, tag, merge, personal vault operation, or plugin activation
was performed to implement this feature.

## Verification scope

`tests/tooling/starter-*.checks.mjs` covers data contracts, dynamic discovery,
editing, generation, explicit process execution, stale plans, path/symlink defenses,
empty installations and extraction of independently packaged archives. Existing
starter/native-generator tests continue checking every authored Companion starter model.
Source-qualification inventories include canonical definitions as well as historical
fixtures; those source archives are not the end-user shell release.

The locked workspace TypeScript compiler is mandatory for qualified shell assets.
The archive smoke test permits Node's built-in type stripper only when that compiler
is unavailable locally, marks it `not-qualified`, and never calls that fallback a
typecheck. Hosted qualification must use the locked compiler. Local results and
remaining environment limitations are recorded in the accompanying handover evidence.

## Workbench plugin starters and framework adapters

Starter JSON no longer owns a closed frontend enum. A `project` starter names a framework adapter ID. The built-in IDs remain `nuxtui`, `vanilla`, `angular` and `none`; an enabled Workbench plugin can contribute another adapter and starter through its typed `PluginObject`.

Plugin-provided starters are validated and hashed by the same loader as files under `configs/starters/`. ID collisions fail closed. The starter remains data-only; the trusted plugin supplies the adapter implementation. See [Workbench plugin development](./WORKBENCH-PLUGINS.md).
