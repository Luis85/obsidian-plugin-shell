# Iteration Planner — buildable interaction prototype

**All sixteen source/build files and both test runners are now present. The clickdummy can be built from this checkout without the conversation ZIP.** The compiled `prototype.html` is generated locally by the command below; it is not checked in.

This concept is on PR #45, branch `feat/iteration-planner-concept`, stacked on PR #5 (`docs/companion-plugin-prd`). The source completion extends `7081d06bdca784165e807a3aa3c83b62b01a8347`. GitHub reported the PR mergeable before this update: the earlier missing files were caused by tool upload blocks, not merge conflicts.

## Build and test

From the repository checkout, using Node.js 22.16.0 or newer:

```sh
cd docs/concepts/iteration-planner/source
npm ci --ignore-scripts
npm run prototype:build
npm run prototype:check
npm test
```

Open `docs/concepts/iteration-planner/prototype.html` after the build. The source package has no npm dependencies and does not require installing the framework's root package. It assembles all ten TypeScript modules, the HTML frame and styles into one offline browser artifact. Browser startup requires `DecompressionStream` support. Node's type stripping is not TypeScript type checking.

The optional browser journey runner is also included:

```sh
npm run test:browser
```

That runner additionally requires Python with Playwright and a Chromium executable. It uses `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to the installed browser on another system. Browser provisioning is separate from the dependency-free npm build. It writes evidence under `../evidence/` and requires the HTML build first.

## Experience

Manage arbitrary named backlogs and work types; create automatically indexed, goal-named iterations; describe the goal and dates; allocate people and capacity; agree selected backlog items; walk every iteration item daily; review a changelog and frozen increment; and turn a retrospective improvement into the next backlog action.

The dashboard separates confirmed delivery from unfinished progress, time and capacity. Monday planning is the default cadence, not a forced date. Closing an iteration does not mark unfinished work Done or automatically carry it into the next iteration. Existing increment snapshots are retained.

See [the design brief](design-brief.md), [integration boundaries](INTEGRATION.md), and [publication history](PUBLICATION.md).

## Verification

A fresh directory containing the complete source and test files, initially without an HTML artifact, passed `npm ci --ignore-scripts`, build, deterministic artifact check and all **38 domain tests** on Node 22.16.0 / npm 10.9.2. The generated HTML is 54,462 bytes and matches the original attachment byte-for-byte.

The browser rerun recorded B01–B17 passing, then the execution environment terminated it at 120 seconds. B18–B20 and the overall suite are **not claimed as passed in this run**. See [completion metadata](evidence/completion-checks.json) and [output excerpts](evidence/completion-checks.log). Earlier [partial-checkout evidence](evidence/transfer-checks.json) is historical and retains its genuine missing-file build failure.

## Qualification boundary

This is the existing TypeScript/native-browser interaction prototype, not the Vue 3/Pinia/Nuxt UI package required by the canonical prototype skill. Actual Companion project JSON/import/compiler qualification, pinned TypeScript checking, native Obsidian integration and full repository qualification remain outstanding. Workspace JSON is not Companion project JSON.

The PR stays draft for those separate qualification gaps. All source needed to build the fallback clickdummy is nevertheless present. No production runtime, root dependency, workflow, quality threshold, vault, release, PR5 branch or main branch is changed.
