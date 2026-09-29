# Getting started

## 1. Check your tools and working directory

Use the Node and npm versions qualified by the checked-out release: inspect `.nvmrc`, `package.json` and the retained release instructions. The reviewed source declares Node at least 22.13.0 and npm at least 11.19.1 but below 13. A minimum supported version is not a statement that every newer version has passed the project's qualification suite. The project uses TypeScript 6; do not downgrade it to accommodate documentation tooling.

```sh
node --version
npm --version
node shell.mjs version --json
node shell.mjs doctor
```

Run from the folder containing the intended `shell.mjs`. Commands normally discover a project root from the working directory; use `--root` when you need to select it explicitly. Quote paths containing spaces. Avoid developing directly inside your personal Obsidian vault.

The extracted kit contains compiled CLI modules and can start before project dependency installation. The source launcher uses Node's TypeScript support, requesting type stripping where necessary. Starting the CLI is different from installing dependencies required to build or test a generated application.

## 2A. Start from a framework checkout

Discover the installed starter catalog instead of copying a list that can become stale:

```sh
node shell.mjs new --list
node shell.mjs help new
node shell.mjs new ../folio-tools --starter blank --id folio-tools --name "Folio Tools" --author "Your Name" --dry-run
```

Read the preview. Then apply the requested creation deliberately:

```sh
node shell.mjs new ../folio-tools --starter blank --id folio-tools --name "Folio Tools" --author "Your Name" --yes
cd ../folio-tools
node shell.mjs status
node shell.mjs doctor
```

`new` creates a separate project; `setup` configures the current project. A positional directory for `new` is relative to the invoking terminal. Do not point `new` at a populated unrelated project. The command protects against unintended vault-local creation; `--inside-vault` is an explicit exception, not the recommended everyday path.

Use a stable lowercase ID with letters, digits and hyphens. The reviewed validator rejects IDs containing `obsidian` or `plugin`, so `folio-tools` is suitable whereas `my-plugin` is not. Display names can contain spaces. Changing an established plugin identity is not just a cosmetic rename.

For a custom-file viewer, first inspect the starter, then review a creation such as:

```sh
node shell.mjs new ../folio-tools --starter custom-file-view --extension folio --dry-run
```

Custom extensions are lowercase, dotless and must not take over a protected core Obsidian extension. Other starters are discoverable through `new --list`; their presence in your installed kit is authoritative.

## 2B. Start from an extracted developer kit

Obtain an actually published developer-kit archive for the intended release, verify its provenance and any supplied checksums, and extract into a new project folder. Do not substitute an arbitrary source ZIP and assume it contains compiled kit modules. Checksum agreement detects changed bytes; it does not independently authenticate the publisher.

Open a terminal in that folder:

```sh
node shell.mjs help
node shell.mjs setup
```

In an interactive terminal, setup can ask for a project JSON path or an explicit blank design, then identity fields. Review the proposed changes before accepting. Where the kit offers generation and installation next, each is a separate confirmation. Declining installation leaves dependencies uninstalled; that is not an error.

For an explicit, noninteractive blank setup, preview and apply separately:

```sh
node shell.mjs setup --blank --id folio-tools --name "Folio Tools" --author "Your Name" --dry-run --json
node shell.mjs setup --blank --id folio-tools --name "Folio Tools" --author "Your Name" --yes --no-interaction
node shell.mjs generate --dry-run
```

Review generation, then apply it or save a reviewed plan as described in [design and generation](design-and-generation.md). Do not run setup over existing identity/configuration conflicts merely to get past a diagnostic.

## 3. Install only after reviewing the project

After creation or generation, inspect the generated package manifest, lockfile and any lifecycle policy. Installation is an explicit network/process operation:

```sh
node shell.mjs install
node shell.mjs install --yes
```

The first invocation reports the installation requirement without running the installation. The second requests exact-lock `npm ci`. Approved lifecycle scripts can run; do not install untrusted generated or third-party project code just because it has a lockfile.

A dependency-resolution diagnostic means the declared packages and lockfile need deliberate reconciliation. Read the diagnostic, review the requested dependency changes, resolve them intentionally and review the resulting lockfile before using exact-lock installation. Do not automatically delete the lockfile, weaken install policy or switch to a different TypeScript major.

## 4. Verify the first useful result

```sh
node shell.mjs test
node shell.mjs build
node shell.mjs verify --profile project
```

Use the project verification profile in a generated consumer project. Framework-wide verification has a different scope and may require additional tools and evidence. When a command fails, inspect its diagnostic and retained result rather than treating a build artifact as proof of success.

For the everyday editing loop, continue with [development and testing](development-and-testing.md). For a supplied companion JSON design, use [design and generation](design-and-generation.md).
