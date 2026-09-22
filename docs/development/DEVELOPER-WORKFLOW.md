# Developer workflow

> **Status:** Target developer experience for the template implementation. The repository currently contains specifications, not an executable plugin or npm scripts. The commands below are acceptance contracts for that implementation.

This guide is the short path through the [PRD](../product/PRD.md). The [maintenance and release guide](MAINTENANCE-AND-RELEASE.md) covers keeping the plugin current and publishing it.

## 1. What a developer should need

For browser development: Git, the documented Node LTS/npm versions, a code editor, and a browser. The template must not require an AI account, Docker, a separate package manager, or a personal Obsidian vault.

For real-host development: the latest public Obsidian and a development vault created inside the repository. The official CLI is optional; native testing still needs a real host. For releases: GitHub repository access and permitted Actions workflows. Local GitHub CLI authentication is not required when using the GitHub Actions interface.

The dated research baseline selects public desktop Obsidian 1.13.7 and Node 24 LTS. The implemented compatibility record—not this dated guide—must identify the current exact tested versions. See [research R01–R02 and R15](../research/2026-09-22-template-research.md).

## 2. First run: the intended quickstart

Create a repository using the GitHub template, clone it, and install the committed dependency graph:

```sh
npm ci
npm run setup
npm run dev:ui
```

`setup` must explain and collect plugin ID, display name, author, description, repository identity, and initial version. It validates the proposed changes before applying them and finishes with a summary, including the local test-vault destination and the next command.

A proposed noninteractive equivalent for agents and automation is:

```sh
npm run setup -- --id field-notes --name "Field notes" --author "Your name" --repo your-account/field-notes --yes
```

The precise accepted options must be included in `npm run help`. A `--dry-run` must show intended changes without writing them. Re-running setup with the same identity is safe; renaming a plugin that already has user data requires a separate identity/data migration.

The default distributable ID must not be copied from `obsidian-plugin-shell`: IDs intended for Community directory submission cannot contain `obsidian`. The repository name and plugin ID are different fields. See [research R25](../research/2026-09-22-template-research.md).

### Expected first screen

The browser opens, or prints a loopback URL for manual opening, into the real example view. It shows a clear empty state, one primary create action, and a small path to useful preferences/help. Creating an item exercises the actual use case and persistence adapter. There is no fake dashboard, account setup, or mandatory guided tour before the first action.

The browser harness labels its host simulation boundary. A settings/notices/modal preview is not falsely presented as native Obsidian behavior.

## 3. The small primary command surface

| Command | Use it for |
| --- | --- |
| `npm run setup` | Identity initialization and prerequisite checks. |
| `npm run dev:ui` | Fast UI development with the real components and controlled fixtures. |
| `npm run dev:local` | Watch, build, and safely install successful builds into the development vault. |
| `npm run verify` | Complete normal checks, including browser tests once prerequisites are provisioned. |
| `npm run release:prepare -- --version 0.1.0` | Prepare consistent release metadata for review without publishing. |
| `npm run help` | Find specialized tasks and explain prerequisites. |

Useful lower-level commands remain available: `doctor`, `test`, `test:coverage`, `verify:fast`, `build`, `build:local`, `harness:shot`, `test:e2e`, and `test:obsidian`. Existing `test-build` and `check` names are aliases, not separate implementations.

`verify` must not silently download tools or start an endless watcher. `test:setup` provisions browser or selected native prerequisites explicitly. Its network/disk requirements must be explained before it runs.

## 4. First change: add a description to an example item

The template's first-change recipe should demonstrate a real extension without creating unnecessary architecture. This scenario is a tutorial specification; the implementing files must be named explicitly once the code exists.

### Define the behavior

An item may have an optional plain-text description. Empty text is allowed; oversized text is rejected with a localized message. The description survives reload, remains separate from logging, and is shown safely without HTML interpretation.

### Change the existing layers

| Location | Change | Do not add |
| --- | --- | --- |
| `src/domain/example/` | Value validation and updated item shape. | Obsidian or Vue imports. |
| `src/application/example/` | Extend the existing create/update use case and DTO. | A new global command bus. |
| Existing persistence adapter | Update schema decoding and provide a migration/default for older records. | A second independent settings/data writer. |
| `src/presentation/example/` | Add a labeled field and safe text display using the existing store/service contract. | Direct calls to `saveData` or `localStorage`. |
| `src/locales/` | Add matching English/German labels and validation text. | Hardcoded fallback strings scattered through components. |
| `harness/scenarios/` | Extend one populated/validation fixture. | A second implementation of the use case. |
| `tests/` | Cover validation, old-data load, successful write/reload, failed write, and browser interaction. | Tests that stub the action while claiming to verify persistence. |

Most features do not need to change `main.ts`. New native registrations belong in the small composition registration module only when the behavior actually requires them.

### Verify the change

Run the relevant unit/component tests during implementation and `verify:fast` for early feedback. Inspect the changed UI in the real harness, exercise its success and failure states, then run `verify` before handoff.

For host-sensitive changes, add `test:obsidian` or the documented native check. Report separately what the browser and host checks established. A successful screenshot is not a persistence test; a mocked native contract is not a real settings integration test.

## 5. Working with the native plugin

The standard generated location is:

```text
<repository>/
  .dev-vault/
    .obsidian/
      plugins/
        <plugin-id>/
          main.js
          manifest.json
          styles.css
```

`dev:local` must preserve plugin data, unrelated plugins, vault notes, and all other configuration. An unsuccessful rebuild leaves the last good installed bundle intact. The output states where files went and whether a reload is required.

Open `.dev-vault` as a vault in Obsidian. Any required decision to enable Community plugins belongs to the developer; the installer must not silently disable Restricted Mode. Do not open your personal knowledge vault merely to test a template.

An explicit repository-root-vault mode is supported for developers who prefer it. It uses the same validated deployment implementation and is never inferred automatically from an existing `.obsidian` folder.

### Optional CLI feedback loop

The official CLI can reload a plugin and capture the native window. It communicates with the actual installed host and has its own prerequisites. [Research R08](../research/2026-09-22-template-research.md)

The template wrapper must confirm the intended fixture vault, plugin ID, and available CLI capabilities before taking action. If CLI support is absent, print the manual reload procedure rather than failing browser development or operating on an arbitrary active vault. Do not grant unrestricted evaluation to an agent merely to support a reload command.

## 6. Browser scenarios and evidence

The harness must make scenario selection discoverable. Proposed URL parameters include:

```text
/?scenario=storage-failure&locale=de&theme=dark&seed=42
```

Stable scenario families cover first run, populated data, input validation, successful persistence/reload, failed writes, future/corrupt schema, unavailable local storage, language switching, narrow panes, two views, and repeated mount/unmount.

For a UI change, inspect the relevant states rather than only the happy path. A deterministic failure scenario should expose the error without editing production code or deliberately damaging a real vault.

The browser runner owns its server and checks application readiness. CI must not silently connect to an unrelated old process occupying the expected port. Traces/screenshots/reports identify the actual build and scenario. Golden screenshots are changed only through an explicit reviewed baseline update. [Research R19–R20](../research/2026-09-22-template-research.md)

## 7. Troubleshooting requirements

The implemented `doctor` and command output must cover these cases:

| Symptom | Required explanation / safe recovery |
| --- | --- |
| Node is unsupported | Print detected and supported versions plus the repository's version-selection file. Do not silently bypass engine checks. |
| Browser binaries are missing | Identify `test:setup`; explain downloads separately from normal tests. |
| Harness port is occupied | Identify the conflict and allow an explicit alternate port; do not claim another server is this build. |
| Plugin fails to appear | Check destination, manifest ID, valid build, Community-plugin enablement, and host minimum. Preserve existing data. |
| Plugin fails after reload | Identify current artifact hash, native logs, and the last good build; no automatic destructive reset. |
| Settings do not persist | Surface the write error, explain which storage category is affected, and avoid reporting false success. |
| fallow reports an unused host entry | Investigate real registration/entrypoint modeling. Do not ignore the whole directory or delete code solely on trust. |
| Vue lint reports an unexpected result | Check active parser/rule coverage and the gate fixture; do not disable the rule in both linters. |
| Release permissions are missing | Identify the required narrowly scoped workflow permission; do not recommend an unrestricted personal token by default. |
| Latest package is incompatible | Record a bounded maintenance exception and the failed check, not a permanent blanket ignore. |

## 8. Removing the sample and starting the real product

Keep reusable host integration, localization, error handling, persistence primitives, testing adapters, and verification scripts. Remove the example's domain/use cases, UI, registrations, fixtures, tests, and translations using the supplied recipe.

The recipe must be exercised in a generated-repository acceptance test. It must not leave an unused example service hidden by a fallow exception, a ribbon action pointing to a removed view, or a README claiming functionality that no longer exists.

A new product replaces the example behavior with its own first vertical slice. It does not need to retain an example-item database or copy a large feature-generator framework.

## 9. Handoff and release preparation

A useful handoff states the behavior changed, exact checks run and their results, relevant browser/native evidence, compatibility or data migration impact, and any untested scope.

Use the [maintenance and release guide](MAINTENANCE-AND-RELEASE.md) for dependency PRs, preparing a version, creating a draft, testing its exact assets, and explicit publication. Creating a GitHub release and obtaining the first Community directory listing are separate steps.
