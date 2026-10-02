# Companion handoff: one artifact, two front ends

The shell has two front ends: the terminal (`node shell.mjs …`) and the companion
(today the offline browser concept in `docs/concepts/companion/index.html`). This page
is the contract between them. The research behind it is the "Dual interface" section
of the developer-experience research: one operation core, schemas as the contract,
always preview, apply only a reviewed plan hash.

## The only artifact that crosses

The **exported project JSON** is the only thing that moves from the companion to the
terminal or to a coding agent.

- Format: `kind: "obsidian-companion-project"`, a versioned `schemaVersion` (currently
  4; the shared contract also accepts 1–3), `executable: false`, `project` identity,
  `settings` folders, `design`, `notes`. It is defined once in
  `scripts/companion/project-contract.mjs` and assembled unchanged into the concept,
  so the browser and the CLI validate with the same code. See
  [Companion project JSON](COMPANION-PROJECT-JSON.md).
- It is data. It carries no approvals, trust, credentials, machine paths, test
  results or plan hashes, and nothing in it is evaluated, imported or executed.
- Limits are the generator's: at most 4 MB, bounded nesting and item counts, no
  prototype keys, a regular non-linked file.
- A newer companion may export a newer schema. The CLI refuses it with
  `PROJECT_VERSION_UNSUPPORTED` rather than guessing; upgrade the framework.

The companion does not send commands, plans or approvals. Everything it shows is copy
or download only, and it never starts a process.

## Terminal side

| Step | Command | Notes |
|---|---|---|
| Create a new project | `node shell.mjs new <dir> --from <id>.companion.json` | Preview by default. `--yes` or `--apply <planHash>` writes. `--id/--name/--author` override identity only. Mutually exclusive with `--starter`. |
| Adopt a design into an existing project | `node shell.mjs project import --input <file>` then `node shell.mjs generate` | Reviews configuration conflicts, then regenerates in place from `design/project.json` (requires an extracted, verified kit). |
| Explicit placement (lower level) | `node shell.mjs generate --input <file> --vault <dir> --target <rel>` | The compiler interface that `new` composes. |
| Discovery for tools and agents | `node shell.mjs help --json`, `capabilities --json`, `schema --json` | Machine-readable command catalog and request/result schemas. |

`new --from` reuses the same pieces as `new --starter`: placement (the target must
be absent or empty and outside the framework checkout), the unchanged compiler plan,
the request-bound plan hash and a rebuild before apply. Refusal codes are listed in
[Framework CLI](FRAMEWORK-CLI.md#from-an-exported-companion-project).

### Plan hash review

1. The preview prints the file count, warnings, conflicts and a 64-character
   `planHash`. The hash binds the canonical request, the target's current bytes and
   the compiler's hash over the input bytes.
2. `--apply <planHash>` rebuilds the plan and writes only when the hash still matches.
   Editing the JSON, the target or the framework after review gives `PLAN_STALE` and
   writes nothing. `--yes` applies the plan just computed in the same process.
3. Neither a person nor an agent may invent a hash or reuse one from another run.
   Approvals are never portable, so the companion never carries a hash.

## Companion side: "Generate plugin shell"

The handoff dialog (`docs/concepts/companion/src/project-handoff.js`) has three
parts. It opens from **Generate plugin shell** on the project overview (where a
confirmed starter lands) and in the project files card, and from **Reviewed code
generator** in the read-only JSON handoff.

1. **Download project JSON** saves `<id>.companion.json` (the existing export).
2. **Terminal commands**, each with its own labelled copy button, plus **Copy all
   commands**:
   ```sh
   node shell.mjs new ../<id> --from <id>.companion.json
   cd ../<id>
   npm ci
   npm run check          # script of the generated project
   npm run dev:obsidian   # script of the generated project; isolated sandbox vault
   ```
   Plugin IDs are validated lowercase slugs, so the commands need no quoting.
3. **Copy agent prompt**: a ready-to-paste prompt for Claude Code, Codex or another
   coding agent.

### What the agent prompt contains

The prompt is short on purpose, because curated context works better than long
context. It contains:

- the plugin name and ID;
- the `new --from` command, with "review the plan, then re-run with `--yes`; never
  invent a plan hash";
- `cd ../<id> && npm ci`;
- "read `AGENTS.md` before changing anything";
- "pick the first requirement in `design/traceability.json`", followed by the current
  project's requirement IDs (at most 24, then a count of the rest);
- the loop: `npm run test:tdd`, replace that requirement's TODO with a failing
  behavioral test, then implement until it passes;
- the stop condition: finish only when `npm run check` passes, report real command
  results, and never treat a TODO as passing acceptance.

It contains no hashes, paths from the author's machine, credentials or instructions to
publish, enable or install into a personal vault.

### Verification

`tests/concepts/companion-project-starters.browser.py` opens the dialog after a
confirmed starter and checks the following. The command list contains the project
ID. Every command has a labelled copy button. The prompt is read-only, labelled and
names the plugin and every requirement ID. The copy buttons copy exact text and run
nothing. The layout does not overflow at 390 px. It also runs the displayed
`node shell.mjs new … --from …` argument vector on the actual downloaded bytes in a
temporary folder and confirms a `planned` result that writes nothing.
`tests/tooling/framework-new-from-project.checks.mjs` covers the CLI: preview,
identity overrides, apply, stale input, and refusal of malformed, future, invalid,
linked, oversized or conflicting sources.

`npm run check` and `npm run dev:obsidian` come from the generated project. The
generated-project wiring is delivered separately. Until it lands, generated projects
provide `verify:project`, `test:watch` and `test:tdd`.

## Roadmap (planned, not implemented)

- **Native companion via the operation protocol.** The Obsidian companion calls the
  same operations as the terminal: `executeOperation` requests validated against
  `schema`, `--json` results with the same states (planned/blocked/applied/
  unchanged/failed), and forms rendered from the schema instead of written by hand.
  Spawning `node shell.mjs` requires Node APIs and a desktop-only plugin, so it would
  be an explicit **desktop developer mode** opt-in that streams JSON results. The
  default stays handoff-only (copy/download), which works on every platform and passes
  review.
- **Thin MCP adapter** over the same operation registry, so a coding agent can list
  starters, preview `new --from` and read plan results as tools. It gets no extra
  authority: applying still requires the reviewed plan hash.
- Saved plan requests (`--plan-out`) written next to the export for review before
  apply.

None of these exist yet. The browser concept never runs commands.
