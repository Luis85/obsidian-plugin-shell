# Optional Storybook generation and tooling

Storybook is not a default dependency, runtime feature, server or acceptance gate.
The current authoring/compiler reader accepts an optional `design.storybook`
namespace in project JSON. Both switches default to `false` and accept only JSON
booleans. Unknown fields are errors; strings such as `"true"` are not coerced.

```json
{
  "design": {
    "storybook": {
      "generateStories": true,
      "enabled": true
    }
  }
}
```

This fragment belongs inside a complete project definition, not in a standalone
configuration file. It coexists with the existing sitemap, visual designs and
project settings. The current compiler preserves it across legacy-to-v6 migration
and project export. The frozen v5 standalone compatibility viewer is unchanged;
use the current authoring/compiler entrypoints for this extension.

| `generateStories` | `enabled` | Effect |
| --- | --- | --- |
| false / absent | false / absent | No story files, Storybook configuration, scripts or dependencies. |
| true | false / absent | Managed CSF3 files and browser preview support only; no dependency or package-script changes. |
| false / absent | true | Development tooling/configuration only. Write custom stories or opt in to generation separately. |
| true | true | Generated stories plus a configured Vue 3/Vite Storybook workspace. |

## CLI workflow

```sh
# Review generation from the JSON. No files or packages are written yet.
node shell.mjs new ../my-project --from project.json

# Explicit generation shortcuts: independent, additive flags persisted in the generated JSON.
node shell.mjs new ../my-project --from project.json --storybook-stories --storybook --yes

# A starter can opt in the same way.
node shell.mjs new ../my-project --starter blank --storybook --storybook-stories --yes

# Package installation and server launch remain explicit.
cd ../my-project
npm install
npm run typecheck:storybook
npm run storybook
npm run build-storybook
```

`new --storybook` enables only tooling. `new --storybook-stories` enables only file
generation. Neither erases existing JSON choices. The flags participate in the
reviewed plan hash. For later `generate` operations, edit and import the project
JSON through the existing reviewed intake rather than passing generation overrides.

`--install` is a separate existing consent: after writing, it runs `npm ci` for a
locked project, or `npm install` when the compiler reports new unresolved direct
pins, followed by normal project verification. It does not start Storybook.
Without `--install`, generation never contacts npm. Commit the resulting lockfile
and use `npm ci` for subsequent reproducible installs.

## Output and architecture

With file generation selected, `.storybook/generated` contains CSF3 `.stories.ts`
files importing the actual generated Vue components, a preview context and a
traceability manifest. This hidden directory is outside ordinary runtime/test
source folders, including projects with custom codebase paths.

Visual page and component definitions receive a Default story and explicit
loading, empty, error and disabled states. Components also expose authored
variants and scenarios. Scenarios bind through `designScenario`, preserving the
runtime's scenario state, values and fixtures; narrow scenarios receive a 390px
preview container. Variant/scenario export identifiers derive from stable source
IDs, not user-editable display labels. Library entries and surfaces without a
visual definition receive clearly marked scaffold stories, never invented UI.

Typed prop defaults retain `false`, `0` and empty strings. Missing required props
receive labeled synthetic values of their declared type. Required slots get text
placeholders; optional slots keep their authored fallback. Declared emitted events
and visual interactions receive per-story spy functions. Controls are explicitly
emitted from the shared prop contract; automatic docgen is disabled.

Each mounted story owns its Vue app, Pinia instance, mock functions and synthetic
read adapters. Cleanup unmounts the app and disposes Pinia. No Obsidian bootstrap,
vault adapter, live HTTP source or filesystem provider is injected. Business
writes remain implementation stubs, and unimplemented external components still
surface errors. Navigation and modal intents identify the target instead of
opening native surfaces. Trusted consumer component code is not sandboxed.

With tooling selected, `.storybook/main.ts`, a dedicated Vite config, preview
settings and `tsconfig.storybook.json` are emitted. Storybook uses the existing
scoped Vue/Nuxt UI pipeline, not the native plugin's build configuration. Tooling
pins `storybook`, `@storybook/vue3-vite` and `@storybook/addon-docs` to **10.6.0** as
devDependencies only. Incompatible pre-existing pins fail generation rather than
being silently overwritten.

The development server binds to `127.0.0.1:6006`; browser auto-open and telemetry
are disabled. Static builds go to `reports/storybook-static`, already covered by
the project's report-output convention. The normal plugin build, typecheck and
verification commands do not acquire a Storybook requirement. Generation does
not publish a site, use Chromatic, create accounts or enable native plugins.

## Ownership and opt-out

Generated stories/support/manifest are managed files. Regeneration is deterministic
and conflicts with user edits rather than overwriting them. Keep handcrafted
stories in `stories/`, outside `.storybook/generated`. Storybook configuration is
extension-owned and retains compatible consumer edits.

The shared writer never implicitly deletes retired files. Changing an option to
`false` stops emitting that feature but does not silently remove existing stories,
configuration, installed packages or retained ownership records. Review removal
explicitly; after changing package declarations, resolve and commit the lockfile
again. Old story files otherwise remain discoverable by the configured glob.

## Verification

`tests/tooling/compiler-storybook.checks.mjs` belongs to the existing compiler
suite. It covers all four opt-in combinations, strict validation, migration,
source imports, variants/scenarios, falsy values, custom paths, exact dependency
pins, unresolved lockfile reporting, CLI plan behavior and guarded regeneration.

The Optional Storybook qualification workflow separately generates a scratch
project, explicitly installs its optional packages, runs both Vue typechecks,
builds the real Storybook, then checks browser-rendered page/component/state
stories and records external requests/errors. Its result is separate from normal
plugin/native acceptance. Generated stories are not acceptance tests and do not
close existing TODOs.

## Upstream basis

- [Vue 3 and Vite framework](https://storybook.js.org/docs/get-started/frameworks/vue3-vite)
- [TypeScript stories and CSF typing](https://storybook.js.org/docs/writing-stories/typescript)
- [Dedicated Vite configuration](https://storybook.js.org/docs/builders/vite)
- [Telemetry controls](https://storybook.js.org/docs/configure/telemetry)
- [Reviewed Storybook 10.6.0 release](https://github.com/storybookjs/storybook/releases/tag/v10.6.0)

The selected version's published framework manifest declares TypeScript >=4.9
and Vite 5/6/7/8 peers; repository checks continue to use its pinned TypeScript 6.0.3.
A supported peer range is not a claim that a build or browser qualification ran.
