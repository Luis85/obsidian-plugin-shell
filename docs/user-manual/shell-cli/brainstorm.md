# Brainstorm — feature-first project authoring

Brainstorm is available in the Projects TUI and through the same validated shell CLI used by agents. This increment implements **Brainstorm a new feature**. **Brainstorm a new project** remains planned; use the existing New Project wizard until that sub-use-case is implemented.

## TUI workflow

Open a saved project with `node shell.mjs` and choose **Brainstorm**, or start directly with `node shell.mjs brainstorm`. Full-screen and accessible plain terminals share the same validation. Unsaved edits must be reviewed and saved before the feature workflow starts.

The wizard asks for the feature's name and purpose, actors, entities, screens and dialogs, the purpose of each screen, navigation, planned action outcomes, and acceptance criteria. The first screen becomes a native feature view. Other pages belong to it; dialogs remain overlays. Navigation produces canonical sitemap links. **Planned actions are descriptive only:** no arbitrary callbacks or commands are executed.

Choose a definition-only package, an offline prototype, or application/plugin boilerplate. Before saving, the wizard shows the full request and exact file changes; the approval defaults to No. It separately offers reviewed concept import and, if requested, a separately approved build/test execution plan.

## CLI and AI-agent parity

Agents use these same entry points, without parsing terminal text:

    node shell.mjs brainstorm guide --json
    node shell.mjs brainstorm schema --json
    node shell.mjs brainstorm context --json
    node shell.mjs brainstorm validate --input feature.json --json
    node shell.mjs brainstorm feature --input feature.json --out brainstorms/example --json
    node shell.mjs brainstorm feature --input feature.json --out brainstorms/example --apply <fresh-planHash> --json

Use the current `projectId` and exact `baseSha256` supplied by `brainstorm context` to reject stale agent drafts. Requests are strict, versioned, inert JSON. `--input -` accepts JSON on stdin. Feature ownership is additive; modifying existing features requires a separate improvement concept.

An approved package contains `feature.definition.json`, `candidate.project.json`, a base-bound concept manifest in `docs/concepts/brainstorms/`, and a README. The current saved project is not changed by package creation. To import the concept, use the separate `concept inspect` and `concept import` commands and independently approve their plan hash.

Optional generated source comes from PR5's existing compiler. It currently emits whole-project output, not scoped feature-only implementations. A generated clickdummy does not prove real persistence, event handling or native Obsidian acceptance.

If the request selects tests or build, inspect a separate process plan:

    node shell.mjs brainstorm verify --out brainstorms/example --json
    node shell.mjs brainstorm verify --out brainstorms/example --apply <fresh-verificationPlanHash> --json

This execution may download dependencies and run npm lifecycle, test and build scripts under the current user's permissions. Generated source and local caches are not rolled back after execution errors. No process begins during discovery, validation, file planning or initial generation approval; no path authorizes publishing or plugin activation.

## Boundaries

The initial feature workflow supports a main view, up to twelve screens and twelve interactions per screen. Actors, domain entities and acceptance criteria remain planning information until refined in the canonical visual, semantic and requirement editors. Project brainstorming, automatic implementation of arbitrary actions, native acceptance and publication are not claimed by this increment.
