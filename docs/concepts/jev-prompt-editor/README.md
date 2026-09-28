# Jev Studio — the decision workbench

An offline prototype for creating Jev prompts and composing them with **business rules, reusable process contracts, decision flows, and typed events**. Open [jev-studio.html](jev-studio.html) in a desktop browser; no server, account, installation, or API key is needed.

Retained under `docs/concepts/jev-prompt-editor/` on PR #32 of Obsidian Plugin Shell, stacked on PR #5. This is an executable design concept, **not an installable native plugin or a live automation service**. The current business-logic implementation guide is [docs/BUSINESS-LOGIC.md](docs/BUSINESS-LOGIC.md); the original [native handoff](integration/PR5-HANDOFF.md) remains historical context.

## Try the complete loop

1. In **Prompts**, edit **Route an inbox note**. Choose **Vault state** to import selected Markdown files as a read-only snapshot. No live Obsidian connection is implied.
2. Choose **Logic** or **Open business logic**. The first flow connects a preparation process → Jev prompt → deterministic rule → task-data process → another Jev prompt → End.
3. **Simulate flow** runs pure local mappings and synthetic Jev answers. Choose **Ambiguous fixture** to see the rule stop for review rather than drafting task data. **Step** executes one queued node; **Cancel run** discards remaining scheduled work.
4. Open **Business rules** to edit ordered If / Else-if / Else branches, AND/OR conditions, and explicit Continue / Process / End / Review decisions. The second example demonstrates a bounded While and a process that changes the next iteration's input.
5. Open **Processes** to define names, typed input/output fields, and output mappings. Pure transformations execute locally. Fixture outputs are labeled. External processes stop for review and never run.
6. Open **Events**. Prompts, rules, processes, flows, and individual flow nodes can declare emitted events with typed payloads. The third flow demonstrates event-triggered prompt/rule chaining. Draw connections through the node inspector's source and destination selectors; there is no hidden global subscription.
7. Save a named **Checkpoint**, revise a definition, compare changes, and restore. Export **workspace JSON** to preserve the complete linked design. Import creates independent linked copies rather than replacing existing work.

**How business logic works** opens a short inline guide. The original prompt walkthrough remains available. Keyboard users can move focused graph nodes with arrow keys (Shift for larger increments), use explicit connection controls, and use the existing dialog focus/escape handling.

## What is implemented

| Surface | Implemented behavior |
| --- | --- |
| Prompts | Choice / Score / Noul editing; templates, search, duplicate/archive, versions, scoped vault bindings, request preview, events |
| Business rules | Ordered branches; AND/OR; typed comparisons and presence checks; explicit fallback; bounded While; decision types; lifecycle, usage/deletion guards |
| Processes | Name/purpose; required/optional typed inputs/outputs; safe paths, JSON literals and numeric addition; local transform / fixture / external contract modes |
| Flows | Draggable graph, pan/zoom/fit, keyboard movement, shared definition references, typed input bindings, control/event connections, validation, undo/redo |
| Events | Publisher-specific contracts and catalog; editable names, phases, payload fields/mappings; instance events; subscriber references and deletion protection |
| Simulation | Manual start, step/replay/cancel, clear/ambiguous/negative fixtures, input/output/decision trace, prepared requests, event causality, stale-result detection |
| Maintenance | Named logic checkpoints, comparison, pre-restore snapshot, workspace export/import with ID remapping, bounded history and canonical storage |

## JSON contracts

Original `jev-prompt` and `jev-prompt-library` **schema 1** remain readable without modification. Event-capable prompts use **schema 2**. Linked workspaces use `jev-prompt-library` **schema 2**, with an optional `logic` envelope containing `jev-logic` schema 1. Full workspace exports include prompts, revisions, rules, processes, flows, declared events, and logic checkpoints.

V1 schemas remain unchanged. New schemas are in `schema/jev-prompt-v2.schema.json`, `schema/jev-workspace.schema.json`, and `schema/jev-logic.schema.json`. Register their URNs together when validating locally. Runtime validation additionally checks safe data paths, literal JSON, unique IDs, references, event collisions, contracts, and graph semantics. Schema-valid drafts can still have unfinished wiring; execution is blocked until flow preflight passes.

These are **not** companion project JSON, BPMN, DMN, CloudEvents, or executable scripts. The original provider request compiler still produces the supported text-only Jev request subset (`model`, `state`, `questions`). Flow inputs are added explicitly under `state.workflow_input`. No request is sent.

## Privacy and boundaries

The embedded Content Security Policy blocks network connections and authorizes the exact precompiled scripts by hash. There is no API-key entry, CDN, external font, `eval`-based rule language, network transport, or vault write. Imported Markdown/HTML is data, not executed code.

Prompt and workspace persistence/export omit runtime vault snapshots, responses, traces, and execution approvals. **Authored literals, sample inputs, descriptions, and instructions are included and may themselves be sensitive.** Resolved request export and simulation trace export require separate acknowledgement because they can contain note bodies, paths, and event payloads. Imported files remain memory-only snapshots; reloading resets the context to the synthetic demo.

The parser supports a deliberately small Markdown/frontmatter subset, not Obsidian's full metadata engine. Hidden/private paths and supported `private: true`, `ai: false`, and private/no-AI tags are excluded. Metadata is allowlisted. These filters and the limited secret warning are not a confidentiality guarantee.

No business-rule decision authorizes a native action. An external process is a contract awaiting a future adapter. Event listeners are explicit and FIFO; this is not a concurrent workflow engine or durable event bus. End or Review terminates the entire simulated run and cancels queued work.

## Limits and recovery

Prompts: 100 recipes, 50 versions each, 24 questions each. Logic: 40 rules, 40 processes, 20 flows, 20 checkpoints, 60 nodes and 120 connections per flow. Each item can declare up to 12 events. While bodies are limited to 1–25 iterations; flows have at most 200 steps and 100 events. The queue is capped at 200 tasks and retained trace data at approximately 2 million characters. Missing/type-incompatible data fails closed, not as an implicit Else.

Browser file selection inspects at most 1,500 files, accepting at most 250 Markdown notes / 5 MB total / 256 KB per note. Context is limited to 20 references and 200–30,000 body characters per note; visible clipping is not a token-budget guarantee.

One repository owns the canonical workspace. Invalid edits stay visibly unsaved; failed writes preserve the last good canonical library. Unknown/corrupt/future stored values are not silently overwritten. Browser storage is not a durable database or cross-window transaction mechanism. Export JSON backups before closing, especially when the interface reports memory-only or failed storage.

## Build and checks

The maintained build requires the repository-local **TypeScript 6.0.3**, installed from the root lockfile with the qualified **Node 24.21.0 / npm 11.19.1** toolchain. It retains bundled **Vue 3.5.13**. Earlier TypeScript 5.8.3 receipts are historical evidence, not the current build policy. It is not a claim of integration with PR #5's production Nuxt UI/Pinia stack. No production dependency or root lockfile is changed. The included Vue license is in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

Install the repository dependencies with the qualified `npm ci` from the repository root first. From this concept directory, with the tools provisioned:

```sh
npm run test:toolchain
node scripts/build.cjs
npm test
python tests/schema.test.py
python tests/browser.test.py
python tests/logic.browser.py
```

The build never resolves `tsc` through PATH or accepts a `TSC` override. It checks the exact root manifest, lockfile, policy, installed package and compiler API versions before emitting anything. TypeScript checks the explicitly ordered namespace sources with ESNext/Bundler settings; the assembler joins their checked script outputs without deprecated `module: none` or `outFile`. This assembler intentionally rejects external-module imports instead of pretending to bundle them.

`CHROMIUM` selects Chromium. Browser checks additionally require Python Playwright, and schema checks require Python jsonschema. Build and use require no network access. Generate new schema/example artifacts with `python scripts/build-logic-schemas.py` and `node scripts/export-logic-examples.cjs`.

Historical TypeScript 5.8.3 local verification: **148 domain tests** (64 retained + 84 new), **149 browser checks** (49 retained + 100 new), and **20 schema/example checks** passed. Both browser suites recorded zero page errors and zero network requests. See [verification scope](docs/BUSINESS-LOGIC-VERIFICATION.md).

Browser tests load exact HTML bytes with Playwright `set_content` and an explicit in-memory Storage adapter. They do not qualify real `file://` persistence, Safari/iOS, a screen reader, native Obsidian, live Jev accuracy, or real external process execution. Screenshots are reproducible with `scripts/capture-logic.py` and are not committed as binary assets.

## Repository integrity

The concept is maintainer-only. Existing developer-kit and companion-generator exclusions keep this directory out of consumer projects. Production plugin code and companion schema remain unchanged. The root distribution regression suite verifies that boundary.

From the repository root:

```sh
node docs/concepts/jev-prompt-editor/scripts/manifest.cjs
node --experimental-strip-types --test tests/tooling/jev-concept-distribution.checks.mjs
```

The manifest binds all checked-in concept files and the standalone HTML by SHA-256, excluding itself and transient screenshots/caches. Rerunning tests updates receipts; after reviewing intentional changes, regenerate with `node scripts/manifest.cjs --write` from this directory. Prior research and verification receipts retain their historical artifact scope.
