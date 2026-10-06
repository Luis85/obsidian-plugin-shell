# Repository verification — corrected 0.15 source

Date: 2026-10-05. Based on PR #5 and the uploaded 0.15 package.
This record supersedes the original packaging blockers for the checks below;
[the original report](VERIFICATION_0.15.md) retains its historical results.

## Fixes

- Strict core checks use TypeScript 6.0.3 with ESNext/Bundler resolution. Checked
  emitted modules are converted to CommonJS only for temporary Node test files;
  no diagnostic or deprecation suppression is used.
- The compiler loader requires local TypeScript 6.0.3 and has no global fallback.
- Tall, pointed, floppy and round thumbnail ears form one valid Vue conditional
  chain. Paired ears are rendered together through template groups.
- Four regression cases compile and render the actual Vue thumbnail, checking
  both ears and excluding shapes belonging to other choices.
- Nuxt UI's Vite integration disables its optional router for this router-free
  application. A first complete build exposed missing `vue-router` exports;
  the subsequent complete check passed with the supported configuration.
- The prototype now has its own lockfile; root dependencies and lockfile were
  not changed.

## Executed checks

Toolchain: Node **24.21.0**, npm **11.19.1**, TypeScript **6.0.3**.
Application: Vue **3.5.43**, Pinia **3.0.4**, Three.js **0.180.0**, Nuxt UI
**4.11.3**, Vite **8.3.2**, Vitest **5.0.3**, as retained by the local lockfile.

From `docs/concepts/agents-prototype-0.15`:

```sh
npm ci --ignore-scripts
npm run check
npm run preview -- --host 127.0.0.1 --port 4285 --strictPort
```

| Check | Result |
| --- | --- |
| Architecture | Passed: 85 source files, 299 imports. |
| Syntax/local imports | Passed: 110 files, 308 imports. |
| Model source contracts | Passed: 17 authored contracts. |
| Schema consistency | Passed: both generated schemas unchanged. |
| Strict core compilation | Passed: 42 modules, TypeScript 6.0.3. |
| Node core tests | Passed: 96; no failures, skips or cancellations. |
| Vue SFC/template compilation | Passed: all 19 components. |
| Full application typecheck | Passed with local `vue-tsc`/TypeScript 6.0.3. |
| Vitest | Passed: 163 tests in 9 files; includes four thumbnail rendering cases. |
| Production build | Passed. Vite retains an advisory about a chunk above 500 kB. |
| Served-build browser smoke | Passed with Chromium 151.0.7922.173: editor heading and WebGL canvas render, Agent Registry opens, editor remounts, zero page errors. |

Dependency installation originally used `npm install --ignore-scripts --no-fund
--no-audit` to create the lockfile. The frozen `npm ci --ignore-scripts` path was
subsequently verified. The full `npm run check` completed successfully after the
router correction. Installation hooks were not needed for the tested build.

## Remaining scope

The browser smoke is a functional startup/navigation check, not full visual,
accessibility, GPU-performance or cross-browser qualification. Historical
screenshots remain historical. Native Obsidian/Vault integration and installable
plugin packaging remain outside this concept's implemented scope. No release or
deployment was performed.
