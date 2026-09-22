# Research supplement: setup, makers, events, and composed styles

**Date:** 2026-09-22  
**Purpose:** Evidence for the owner's additions to PRD 0.3. This supplements, rather than replaces, the [earlier research register](2026-09-22-template-research.md).  
**Scope:** Primary documentation and public API/source inspection. No dependency installation or runtime compatibility test was performed.

## 1. Findings and decisions

| Finding | Source | Decision for this template |
| --- | --- | --- |
| npm executes a package script; locally installed binaries are only necessary if that script uses them. It documents argument forwarding and package-root execution. | S01–S02 | `setup` starts with checked-in Node-only code, so no `node_modules` is needed to start the wizard. |
| `npm ci` uses the committed graph; npm has install lifecycle hooks and version-dependent script policies. | S01, S03 | Setup installs internally after consent, must not recurse through lifecycle hooks, and must preserve the selected dependency-script policy. |
| Windows `.cmd`/`.bat` launching differs from ordinary executable invocation. | S04 | A tested cross-platform child-process wrapper is required; user names/paths never become shell expressions. |
| Symfony MakerBundle supplies discoverable boilerplate commands, command help, and custom maker extension points. | S05 | Provide a local `npm run make -- <kind>` interface and explicit custom-maker registry; no PHP dependency or global Make tool. |
| Obsidian event subscriptions have ownership and supported cleanup via `registerEvent`/EventRefs. | S06, S08 | Build a narrow native-event bridge rather than replace the host's event mechanism. |
| The host may emit create events for existing files while initializing a vault. | S07 | Suppress startup replay by default and register live-change behavior after layout readiness, guarding deferred callbacks after unload. |
| Mapped/discriminated TypeScript types can associate literal event names with their payloads. | S09 | Use a correlated typed contract and test union cases; do not erase the guarantee through an arbitrary-string overload. |
| Vite supports CSS import inlining/rebasing, single CSS extraction, and a configurable library CSS filename. | S10–S11, S14 | Compose modular source and SFC CSS into one packaged `styles.css` through the existing build stack. |
| Vue scoped styles and CSS Modules require compiler transformations tied to markup/classes. | S12 | Do not concatenate raw SFC style text; preserve matching identifiers in plugin and artifact-fidelity harness builds. |
| Obsidian expects a stylesheet in the installed plugin root and exposes semantic variables for native styling. | S13 | Namespaced modular source compiles to the installed stylesheet; no monolithic handwritten root file or broad host reset is needed. |

The template's particular semantics—notification-only events, no replay, explicit generation plans, collision handling, setup profiles, and exact-artifact style tests—are product decisions. They are not claimed to be behaviors supplied automatically by npm, Symfony, Vite, or Obsidian.

## 2. Important distinctions

### Bootstrap versus dependency update

An installation wizard can run without already installed project dependencies when its initial code uses only Node built-ins. It still needs Node/npm installed. Setup should install the template's qualified lockfile, not silently discover and adopt the newest packages during the first run. Keeping current belongs to the reviewed update workflow.

npm's lifecycle mechanism is not a suitable place to rerun an interactive identity wizard. Package installation can execute trusted dependency hooks according to the selected policy; setup must explain that boundary instead of promising that package installation is side-effect-free.

### Typed events versus runtime trust

A typed bus improves compile-time contracts. It does not validate arbitrary external data or make a module in the same process untrusted-safe. Native bridge inputs and any later cross-plugin boundary need validation. Native host notifications are observations; triggering an event is not the same as invoking the host operation.

No cross-source total ordering, durable delivery, or exact causal attribution is inferred from Obsidian's event APIs. Those would require additional mechanisms beyond this baseline.

### Modular CSS versus CSS Modules

The owner's request is satisfied by splitting CSS into maintainable files with an explicit composition graph. `.module.css` and `<style module>` are optional class-scoping techniques, not a prerequisite for this organization. Likewise, `@layer` changes cascade precedence; it is not merely a directory system and is not mandatory.

The composed output can exceed the handwritten 400-line limit, but individual sources and SFCs remain bounded. Minified one-line output does not certify source maintainability. A correct stylesheet build includes both ordered ordinary imports and compiled styles from the real UI component graph.

### HMR versus release evidence

Vite's browser development injection is suitable for fast iteration. The production plugin should load the packaged stylesheet. A release-fidelity check uses that exact file and matching component identifiers; it must not conceal missing rules under a second harness-only copy.

## 3. Source register

All sources were consulted on 2026-09-22. Documentation is a moving reference; verify the selected package/API versions during implementation.

| Ref | Primary source | Used for |
| --- | --- | --- |
| S01 | [npm script lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/) | Explicit scripts, lifecycle hooks, root execution, and install recursion avoidance. |
| S02 | [npm run](https://docs.npmjs.com/cli/v11/commands/npm-run/) | Arguments, installed binary resolution, working directory, and missing-dependency distinction. |
| S03 | [npm ci](https://docs.npmjs.com/cli/commands/npm-ci/) | Lockfile installation and script-policy behavior; exact options are version-dependent. |
| S04 | [Node child processes](https://nodejs.org/api/child_process.html) | Windows script launching, arguments, process ownership, and failure handling. |
| S05 | [Symfony MakerBundle](https://symfony.com/bundles/SymfonyMakerBundle/current/index.html) | Discoverable makers and custom generators; inspiration only, no copied implementation. |
| S06 | [Obsidian events](https://docs.obsidian.md/Plugins/Events) | Native subscriptions and cleanup. |
| S07 | [Obsidian load-time guidance](https://docs.obsidian.md/plugins/guides/load-time) | Layout readiness and startup `create` replay. |
| S08 | [Obsidian public API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) | `Events`, `EventRef`, `on`, `offref`, and `trigger`; inspected blob `4fd05b81a95a7f2316f6ca9264abef45fd2c8d58`. |
| S09 | [TypeScript mapped types](https://www.typescriptlang.org/docs/handbook/2/mapped-types.html) | Event-map derivation and literal key relationships. |
| S10 | [Vite CSS features](https://vite.dev/guide/features) | Imports, rebasing, CSS Modules, development injection, and code splitting. |
| S11 | [Vite production/library CSS](https://vite.dev/guide/build) | Single library CSS artifact and `cssFileName`. |
| S12 | [Vue SFC CSS features](https://vuejs.org/api/sfc-css-features) | Scoped-style compilation, external ownership considerations, and CSS Module mapping. |
| S13 | [Obsidian HTML and styling](https://docs.obsidian.md/Plugins/User%20interface/HTML%20elements) | Installed `styles.css`, native elements, and semantic variables. |
| S14 | [Vite build options](https://vite.dev/config/build-options.html) | Selected-version validation for `cssCodeSplit` and library output configuration. |

## 4. Evidence still needed

Implementation must prove a fresh `npm run setup` without dependencies, safe rerun/cancellation, correct Windows process handling, generated-code compilation and registration, typed-bus error/lifecycle behavior, actual host bridge behavior, and complete modular/SFC CSS composition. Documentation/API inspection does not establish that those capabilities already work.
