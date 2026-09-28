# Project-preset prototype profile

This reference belongs to the canonical companion-prototype-design skill. Codex
uses the same reference through its existing thin entrypoint. It is selected by
`source/shell.project.json` in a `node shell.mjs new` preparation package.

## Sequence and authority

Choose a project preset first, then a compatible frontend, then conduct the
prototype interview. Hybrid requires at least two runtime targets before frontend
selection. A CLI-only project has frontend `none` and does not ask that question.
Changing the chosen runtime or frontend reopens the affected brief and agreement.
The maker never installs dependencies, executes an agent, activates a plugin or
publishes a project as a side effect of preparation.

Read the package's `project-create.json`, `design-brief.md`, `execution-prompt.md`,
`prototype.preparation.json`, and the generated `source/README.md` and `AGENTS.md`.
`project-create.json` stores a versioned `prototypeRequest`, not a `prototype` key:
the latter is forbidden by the shared safe-JSON boundary. Reuse the accepted
answers and recorded catalog/guide provenance; do not interview from scratch.
The manifest intentionally reports incomplete acceptance and unverified outputs.

## Runtime contract

| Preset | Frontend choices | Output |
| --- | --- | --- |
| plugin | Nuxt UI / native DOM / Angular | Obsidian main.js, styles.css, manifest.json |
| webapp | Nuxt UI / vanilla DOM | Browser application |
| website | Vanilla static HTML / Nuxt UI enhancement | Individually addressable HTML pages |
| cli | None | Node command-line program with machine protocol |
| hybrid | Intersection supported by every selected target | Several adapters sharing one source core |

Nuxt UI uses Vue/Vite, not a Nuxt server. Keep the copied CSS ownership pipeline,
local icon configuration and vendor-source hash guards. No preflight, global host
reset or unowned teleport may escape the plugin surface. Native DOM uses Obsidian
host tokens without a frontend framework. Angular uses scoped standalone views,
AOT compilation, and disposal of each application/view when its host closes.
A website is not relabeled SPA output: static content and links must remain usable
without JavaScript. Angular is not offered for website-containing hybrids because
this starter does not supply Angular prerendering. A hybrid shares code, not an
automatically synchronized storage service; design persistence explicitly.

## Source and generator integration

`src/core/` is host- and framework-free. `src/presentation/` supplies the selected
renderer. `src/targets/<runtime>/` owns native, browser or Node boundaries.
`design/project.json` is the unchanged closed Companion v6 envelope; preset
metadata stays in the separate sidecar. Navigation and placeholders are working
scaffolds, not completed business actions. Implement the agreed interactions and
edge cases before calling the result a prototype accepted by its users.

Use the shell installation that created the package to continue authoring:

```sh
node /path/to/shell.mjs sketch --root /path/to/package/source
node /path/to/shell.mjs sketch generate --root /path/to/package/source --out generated/next --json
```

The saved preset is used unless an explicit legacy `--kind` is requested.
Regeneration writes to a reviewed output package; it is not a source merge engine.
It must not overwrite consumer edits or claim that arbitrary authored interaction
models have been implemented. The full Companion JSON is retained for follow-on
implementation. Reconcile source edits separately; source-owned code is canonical
for behavior not represented by the starter.

The old `prototype:tools build`/browser-entry helper assumes the complete legacy
Vue shell and must not be run against these lean sources. Use the generated
package scripts instead. No parallel agent-host skill or hidden build dependency
is introduced.

## Build, qualify, deliver

After explicit installation authority, use the pinned Node/npm toolchain. Run
`npm install`, review/retain the generated package-lock.json, then use `npm ci` for
subsequent clean installs. Direct pins are not a substitute for a resolved lock.
Run `npm run typecheck`, `npm test`, and `npm run build` in `source/`.
The build stages all requested artifacts before replacing the last complete dist.
A failed build must leave the previous distribution intact. Retain license notices
and document transitive dependencies before distribution.

Serve dist/webapp or dist/website locally to test navigation, focus, accessibility,
local/offline behavior and errors. Exercise CLI help/list, each command, invalid
arguments, empty/non-TTY input, JSON output, cancellation and exit codes. Provision
an isolated approved vault for native tests; never activate in a personal vault.
A CLI build is not native/browser qualification, nor is a source test a bundle test.

Deliver source, built artifacts for each selected target, replay request, full
Companion JSON, integration map, license notices and actual verification evidence.
If the agreed browser deliverable is a single offline HTML file, additionally
bundle/assemble and test that file from the same selected-framework sources; the
starter's ordinary dist directory alone does not meet that extra criterion.
Report passed, failed, blocked and not-run checks with tool versions and hashes.
Only mark manifest outputs verified after measuring the actual produced bytes.
