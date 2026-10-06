# Getting started

## 1. Check your tools and working directory

Use the Node and npm versions qualified by the checked-out release: inspect `.nvmrc`, `package.json` and the retained release instructions. The reviewed source declares Node at least 22.13.0 and npm at least 11.19.1 but below 13. A minimum supported version is not a statement that every newer version has passed the project's qualification suite. The project uses TypeScript 6; do not downgrade it to accommodate documentation tooling.

```sh
node --version
npm --version
node bin/app version --json
node bin/app doctor
```

Run from the project or CLI package root and invoke `node bin/app`; it is the single supported launcher. Commands normally discover a project root from the working directory; use `--root` when you need to select it explicitly. Quote paths containing spaces. Avoid developing directly inside your personal Obsidian vault.

The extracted kit contains compiled CLI modules and can start before project dependency installation. The source launcher uses Node's TypeScript support, requesting type stripping where necessary. Starting the CLI is different from installing dependencies required to build or test a generated application.

## 2. Add Workbench to a project that already exists

Use `adopt` instead of `new` or `setup` when a project exists, for example a legacy Angular webapp: `node bin/app adopt analyze --target <project>` reads it without changing anything, and `adopt plan` previews and then writes one Markdown integration plan. Nothing else in the project is touched. See [Adopt an existing project](../../development/ADOPT-EXISTING-PROJECT.md).

## 2A. Start from a framework checkout

Discover the installed starter catalog instead of copying a list that can become stale:

```sh
node bin/app new --list
node bin/app help new
node bin/app new ../folio-tools --starter blank --id folio-tools --name "Folio Tools" --author "Your Name" --dry-run
```

Read the preview. Then apply the requested creation deliberately:

```sh
node bin/app new ../folio-tools --starter blank --id folio-tools --name "Folio Tools" --author "Your Name" --yes
cd ../folio-tools
node bin/app status
node bin/app doctor
```

`new` creates a separate project; `setup` configures the current project. A positional directory for `new` is relative to the invoking terminal. Do not point `new` at a populated unrelated project. The command protects against unintended vault-local creation; `--inside-vault` is an explicit exception, not the recommended everyday path.

Pull requests and CI default to GitHub. If the project lives in Azure DevOps, add `--hosting azure-devops --azure-organization https://dev.azure.com/<organization> --azure-project <project>` to the preview and creation commands, or `--hosting none` for no CI; an interactive run asks. See [optional integrations](optional-integrations.md#hosting-platform-github-azure-devops-or-none).

Use a stable lowercase ID with letters, digits and hyphens. The reviewed validator rejects IDs containing `obsidian` or `plugin`, so `folio-tools` is suitable whereas `my-plugin` is not. Display names can contain spaces. Changing an established plugin identity is not just a cosmetic rename.

For a custom-file viewer, first inspect the starter, then review a creation such as:

```sh
node bin/app new ../folio-tools --starter custom-file-view --extension folio --dry-run
```

Custom extensions are lowercase, dotless and must not take over a protected core Obsidian extension. Other starters are discoverable through `new --list`; their presence in your installed kit is authoritative.

Plugin, webapp, website, CLI and hybrid projects with a selected frontend (Vue + Nuxt UI, vanilla, Angular or none) come from **project starters** such as `plugin-angular` or `webapp-vanilla`. They run without a directory and start a prototype interview before any reviewed write:

```sh
node bin/app new --starter plugin-angular
node bin/app new starters --json
node bin/app new guide --starter plugin-angular --json
```

See [project starters](../../../bin/PROJECT-STARTERS.md) for the agent request format and generated package.

## 2B. Start from an extracted framework kit

Obtain an actually published framework kit archive for the intended release, verify its provenance and any supplied checksums, and extract into a new project folder. Do not substitute an arbitrary source ZIP and assume it contains compiled kit modules. Checksum agreement detects changed bytes; it does not independently authenticate the publisher.

Open a terminal in that folder:

```sh
node bin/app help
node bin/app setup
```

In an interactive terminal, setup can ask for a project JSON path or an explicit blank design, then identity fields. Review the proposed changes before accepting. Where the kit offers generation and installation next, each is a separate confirmation. Declining installation leaves dependencies uninstalled; that is not an error.

For an explicit, noninteractive blank setup, preview and apply separately:

```sh
node bin/app setup --blank --id folio-tools --name "Folio Tools" --author "Your Name" --dry-run --json
node bin/app setup --blank --id folio-tools --name "Folio Tools" --author "Your Name" --yes --no-interaction
node bin/app generate --dry-run
```

Review generation, then apply it or save a reviewed plan as described in [design and generation](design-and-generation.md). Do not run setup over existing identity/configuration conflicts merely to get past a diagnostic.

## 3. Install only after reviewing the project

After creation or generation, inspect the generated package manifest, lockfile and any lifecycle policy. Installation is an explicit network/process operation:

```sh
node bin/app install
node bin/app install --yes
```

The first invocation reports the installation requirement without running the installation. The second requests exact-lock `npm ci`. Approved lifecycle scripts can run; do not install untrusted generated or third-party project code just because it has a lockfile.

A dependency-resolution diagnostic means the declared packages and lockfile need deliberate reconciliation. Read the diagnostic, review the requested dependency changes, resolve them intentionally and review the resulting lockfile before using exact-lock installation. Do not automatically delete the lockfile, weaken install policy or switch to a different TypeScript major.

## 4. Verify the first useful result

```sh
node bin/app test
node bin/app build
node bin/app verify --profile project
```

Use the project verification profile in a generated consumer project. Framework-wide verification has a different scope and may require additional tools and evidence. When a command fails, inspect its diagnostic and retained result rather than treating a build artifact as proof of success.

For the everyday editing loop, continue with [development and testing](development-and-testing.md). For a supplied companion JSON design, use [design and generation](design-and-generation.md).
