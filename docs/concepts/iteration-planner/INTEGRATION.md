# Iteration Planner integration boundary

## Runnable source handover

The sixteen files in `source/` form a standalone, dependency-free browser-prototype project. `npm run prototype:build`, run from that directory, assembles `../prototype.html`. No source from the conversation ZIP, remote CDN, root framework installation or private workspace is required for this build.

`model.ts`, `validation.ts`, `commands.ts` and `fixtures.ts` own the prototype's data, validation, state transitions and synthetic example. `ui.ts`, `overview.ts`, `planning.ts`, `ceremonies.ts`, `dialogs.ts` and `app.ts` implement browser rendering and interactions. `styles.css` and `frame.html` are assembler inputs; `build.mjs`, `package.json`, `package-lock.json` and `tsconfig.json` complete the source project.

`tests/domain.test.mjs` runs through Node's test runner. `tests/browser_journeys.py` exercises the generated HTML, requiring separately provisioned Python Playwright and Chromium. See the [README](README.md) for commands and the [completion record](PUBLICATION.md) for exact evidence.

## Not a native integration

The planner is not registered as a production Obsidian feature. It does not write Markdown, open a vault, operate a shared server, synchronize team state or integrate an external backlog. Its local workspace export is `iteration-planner.workspace`, not a Companion authoring-project envelope.

The prototype uses native-browser rendering with TypeScript type stripping. It has not been converted to the repository's Vue 3/Pinia/Nuxt UI pipeline and does not establish TypeScript semantic checking, shell compiler support or real Companion import/export. Preserve this boundary when evaluating the concept.

A future native implementation should map the reviewed entities and rules onto actual application/persistence contracts, port presentation into the prescribed Vue components and state boundaries, and qualify the resulting feature independently. Do not copy the browser's localStorage adapter into native persistence or treat a frozen increment report as a claim that all planned work shipped.

## Scope of this PR update

Only the isolated concept directory is changed. Existing root tooling, dependency pins, quality gates, other concepts, production feature registrations and PR5/main are preserved. The missing-source transfer is complete; production implementation and full prototype-skill qualification are separate work.
