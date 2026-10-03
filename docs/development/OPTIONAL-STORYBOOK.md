# Optional Storybook and generated stories

Two **independent**, default-off switches are accepted in the top-level project JSON:

```json
{
  "tooling": {
    "storybook": {
      "enabled": true,
      "generateStories": true
    }
  }
}
```

This is a fragment to add to a complete project, not a complete project definition. Absent fields mean false. Values must be booleans; unknown tooling/Storybook fields are rejected. The current authoring reader accepts the addition for supported v1–v6 inputs and preserves it during migration. The frozen legacy validator and checked-in v5 concept are not retroactively extended; the current composed v6 companion preserves the fields through import, export and recovery validation.

| enabled | generateStories | Generated output |
| --- | --- | --- |
| false | false | Existing project output; no optional workspace or stories |
| false | true | Managed CSF3 TypeScript stories and a synthetic project decorator; no Storybook dependency manifest or configuration |
| true | false | Optional isolated Storybook workspace with a custom Welcome story; no generated component/page stories |
| true | true | Workspace plus generated component/page stories |

Neither setting installs packages, starts a server or grants execution authority. Root package.json and package-lock.json remain unchanged by either switch. Normal setup, install, build, project tests and verify:project remain independent of Storybook.

## Use the existing compiler and reviewed file plans

The terminal, shared operation API, compiler inspection, `new`, and legacy generator support independent `--storybook-stories on|off` and `--storybook on|off` overrides:

```sh
node bin/app new ../folio-tools --from project.json --storybook-stories on --storybook on --yes
node bin/app compiler inspect --input project.json --stage artifacts --storybook-stories on --json
# In an extracted/generated kit with imported project JSON:
node bin/app generate --storybook-stories on --storybook on --plan-out storybook.plan.json
node bin/app plan apply storybook.plan.json --yes
```

External `--input`/`--from` files are never overwritten. Overrides are written to the generated `design/project.json`; a reviewed in-place generation also updates the intake receipt, so the next generation and import can still verify ownership. A saved plan remains bound to its request and exact output; toggling either flag invalidates an old approval.

The TypeScript API accepts `compileProject({ source, template, storybook: { enabled, generateStories } })`. It remains pure after the template snapshot is loaded. `node bin/app schema --json` exposes the optional field schema as `projectTooling`, alongside the existing request/result schemas.

## Install and operate Storybook separately

After opting in and generating, install the normal root dependencies separately. Then:

```sh
node bin/app storybook status --json
node bin/app storybook install --dry-run
node bin/app storybook install --yes
node bin/app storybook check
node bin/app storybook build
node bin/app storybook dev
```

The first explicitly approved optional install runs npm install in `storybook/` to resolve its own lockfile. Review and commit that lockfile. Subsequent installs run npm ci; a manifest/lock mismatch is refused instead of silently updating it. Dependency lifecycle scripts are trusted project execution, not part of JSON import or generation.

Storybook 10.6.0, its Vue 3/Vite framework and Docs addon have exact matching direct pins. Vue, Vite, Vue plugin, Node declarations, TypeScript **6.0.3** and vue-tsc follow the qualified framework pins. No TypeScript 5 substitution, floating latest version or fabricated lockfile is supplied.

Build/dev/check invoke **local installed** tools with the project root as cwd; no npx auto-install or global Storybook discovery. The shared Vite adapter retains the shell's guarded Nuxt UI integration, scoped styles and local icons. Development binds to 127.0.0.1:6006 with no browser auto-open. The launcher sets `STORYBOOK_DISABLE_TELEMETRY=true` before startup, and generated config also disables telemetry and crash reports. Static output stays under `storybook/storybook-static`; publication is not performed.

## Story fidelity and boundaries

Every generated library component and navigable surface receives a story importing its actual Vue source. Group/action sitemap nodes are not treated as pages. Authored visual definitions expose Default, Loading, Empty, Error and Disabled stories, plus declared variants and scenarios. Scenario stories select the authored scenario rather than overriding it with an explicit default state. Controls reflect declared primitive prop types; false, zero and empty-string defaults survive. Missing required prop defaults receive clearly marked synthetic examples. Declared event handlers feed Storybook Actions, and declared slots receive labelled example content.

Metadata and `design/storybook.json` retain source paths, normalized JSON pointers, stable entity IDs and whether the target is authored or an implementation placeholder. Undesigned targets remain placeholders, not invented functionality. No interaction test or acceptance pass is inferred or generated from prose. Stories use fresh Vue/Pinia contexts with synthetic read sources; no live vault, network data provider or native Obsidian adapter is mounted. Navigation is preview information, not the full clickdummy workflow. External adapters and business operations can still be explicit implementation points.

## Regeneration, customization and disabling

`storybook/generated` and the generated inventory are managed files. The existing writer refuses modified managed files and unowned collisions; it never silently overwrites them. Put hand-written stories under `storybook/custom`. Config, preview, Vite config and Welcome are extension-owned, preserving customization when their generator-owned baseline is unchanged.

Active generated stories and TypeScript roots use the **exact current inventory**, not a directory-wide generated-story glob. Retired files are retained by the existing planner, but are not indexed/typechecked merely because they remain on disk. Disabling Storybook requires regeneration and blocks the launcher and retained main config against the current project flag. Existing packages, lockfiles and custom files are not automatically uninstalled/deleted. Enabling the workspace does not switch on story generation, and switching on story generation does not enable the workspace.

## Maintainer verification

`compiler-storybook.checks.mjs` and `compiler-storybook-lifecycle.checks.mjs` join the existing compiler suite. The compiled-kit and composed-companion tests also cover ownership and transfer. `Optional Storybook qualification` is a separate workflow: it explicitly creates an opted-in disposable project, installs both independent dependency sets, replays optional npm ci, builds/typechecks the generated workspace and probes the static stories in Chromium. It does not add Storybook to default consumers or claim native/business acceptance.

Authoritative format/config references (checked 2026-09-28):
- https://storybook.js.org/docs/get-started/frameworks/vue3-vite
- https://storybook.js.org/docs/api/csf
- https://storybook.js.org/docs/builders/vite
- https://storybook.js.org/docs/configure/telemetry
- https://github.com/storybookjs/storybook/releases/tag/v10.6.0

Execution status and limitations are recorded in [the verification record](../testing/OPTIONAL-STORYBOOK.md).

## PR41 / PR42 consolidation

PR41 is the canonical implementation. PR42 was an alternative implementation, not a
second layer to install. Keep `tooling.storybook` and the isolated `storybook/`
workspace; do not merge PR42's root-dependency installer or `design.storybook`
namespace. Existing experimental PR42 JSON must move that object to
`tooling.storybook`; its bare flags become `--storybook on` and
`--storybook-stories on`. No incompatible option is silently enabled.

The consolidated negative tests retain PR42's data-only, inherited-value,
false/zero/empty-default, deterministic-generation and ownership concerns. The
existing PR41 contract/lifecycle suite covers all four Storybook combinations,
custom-source paths, edited managed files, retained custom files and retirement.
An additional eight-case matrix proves coexistence with Airship and immutable
root dependency files. Neither integration authorizes the other.

The shared development-tooling schema now validates both integrations before
legacy migration and current authoring. The ESM builder uses the package
specifier rather than importing a directory, with an explicit matching direct
pin. Vite configuration retains the shared resolver/server options. Setup
failures dispose the per-story app and store; qualification preserves generated
source and hidden configuration for diagnosis and typechecks before building.

References: Storybook's Vite builder configuration
(https://storybook.js.org/docs/builders/vite) and Node ESM's mandatory file and
package resolution rules (https://nodejs.org/api/esm.html).
