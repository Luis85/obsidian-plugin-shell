# Project setup handout

Workbench’s root [PROJECT-SETUP-HANDOUT.md](../../PROJECT-SETUP-HANDOUT.md) turns an existing set of PRDs and a product-trio discussion into a reviewed brief for the first bespoke prototype. It is not a PRD replacement, a second application model, or an executable process manifest.

## What the meeting produces

The handout contains 20 descriptive sections and 69 stable checklist questions: 49 required and 20 optional. Every section has a description followed by required and optional information. Required questions cover the meeting owners/timebox, authoritative PRDs, problem and learning goal, users, scope/fidelity, journeys, pages/navigation, components/interactions, visual/accessibility/responsive behavior, domain rules, fixtures/persistence/reset, target/stack, integrations/privacy, project paths/preservation, external starter/capability fit, documentation/traceability, acceptance/demo, first run, agent boundaries and trio sign-off.

Complete required items by linking existing PRD answers where possible. Optional questions are intentionally not a default blocker. The showcase question becomes required when the first-run choice is `showcase`. A selected optional question must also have a complete answer and evidence. Trio sign-off uses `approved; reviewer=<name or role>; date=YYYY-MM-DD; limitations=<details>`; missing, rejected or malformed approvals remain blocking. A bare “N/A”, a checked placeholder or an answer without evidence does not close a required item. The product trio must still judge whether the answer is correct and sufficient; structural validation cannot make that judgment.

## What is automatic

On `setup`, the integration adds a new root handout to the existing reviewed file plan when none exists. The handout is not added to the intake ownership receipt: once created, it is a human-edited meeting record. Existing handwritten or generated handouts are preserved, including on repeated setup. Other creation routes use the explicit handout command unless they already invoke this setup path.

Generation reads bounded local inputs, creates an inventory of PRD paths and SHA-256 fingerprints, observes selected configuration fields and suggests project-relative paths. It never infers a product solution from unavailable PRDs, never checks a decision box automatically, never executes a starter or a Markdown instruction, and never installs dependencies. PRD bodies, arbitrary configuration fields and secrets are not embedded in the handout.

The repository-root copy supplied with this change is a reusable draft template. No project-specific product-trio decisions have been fabricated. Refresh that copy against the intended workspace’s actual inputs before reviewing it for execution.

## Integrated CLI contract

These commands are included in this contribution. Use a checkout or compiled kit containing it; older releases do not acquire the commands automatically.

```sh
# Discover the actual installed command set first.
node bin/app capabilities --json

# Create-only preview. Existing handouts are preserved.
node bin/app handout generate --dry-run --json

# Retain a reviewed file plan, inspect it, then explicitly apply it.
node bin/app handout generate --plan-out handout.plan.json --json
node bin/app plan inspect handout.plan.json --json
node bin/app plan apply handout.plan.json --yes --json

# Read-only readiness and structured answer export.
node bin/app handout validate --json
node bin/app handout inspect --json

# After PRDs or settings change: preserve answers/notes, reset review marks.
node bin/app handout refresh --plan-out handout-refresh.plan.json --json
node bin/app plan inspect handout-refresh.plan.json --json
node bin/app plan apply handout-refresh.plan.json --yes --json
```

`handout generate` and `handout refresh` use the existing framework file-plan/hash/apply machinery. They never execute project processes. A stale plan must be reviewed again; `--yes` does not carry execution approval. `handout validate` and `handout inspect` are read-only; incomplete, malformed or stale documents return `blocked` and a nonzero CLI exit code. `inspect` includes the parsed answers; `validate` omits those potentially sensitive meeting answers and returns counts and diagnostics. Neither response grants execution permission: `executionAuthorized` remains `false`.

Refresh updates only the generated source-snapshot comment and the actual review checkboxes, preserving answers and free-form notes. If source fingerprints are unchanged, refresh is a byte-for-byte no-op. A changed snapshot resets all review marks rather than guessing which decisions remain valid. Retained answers must be checked against changed inputs. Damaged/unsupported forms are preserved and must be repaired or explicitly migrated; refresh does not silently replace them.

## Project-root selection

Use the same canonical CLI entry to operate on an explicit project directory. Source checkouts use the repository’s locked toolchain; extracted framework kits run the bundled CLI.

```sh
node bin/app handout generate --root /path/to/project --dry-run --json
node bin/app handout generate --root /path/to/project --yes --json
node bin/app handout validate --root /path/to/project --json
node bin/app handout inspect --root /path/to/project --json
```

All four handout commands use this entry. `--yes` applies the freshly rebuilt generation plan, which preserves an existing handout. Use `handout refresh` to review source-snapshot changes without replacing authored answers. The retired `scripts/handout.mjs` entry is no longer available.

## Input paths and settings compatibility

The handout location is fixed at the project root. PRD input precedence is an explicit `--prds <relative-folder>`, then `configs/user-settings.json` → `paths.prds`, then `docs/prds`. A recorded explicit override is retained by validation/refresh; a settings-derived folder follows subsequent settings changes and requires re-review.

The handout reader can observe the following `paths` keys for suggestions: `prds`, `docs`, `pages`, `components`, `interactions`, `journeys`, `design`, `source`, `tests`, `assets`, `fixtures`, `reports`, `starters`, `prototype`, `testVault`, and `obsidianConfig`. It can also observe `preferences.firstRun` as exactly `skip`, `verify`, or `showcase`. These are handout input conventions, not a claim that every other shell subsystem already consumes these keys. The reader does not create, migrate or modify `configs/user-settings.json`.

At the reviewed PR5 source snapshot, the existing framework configuration contract is still `shell.config.json`, with `project` and `paths.codebaseFolder`, `testsFolder`, `testVaultFolder`, and `configDirectory`. The handout observes those fields for compatibility without rewriting that contract. Proposed settings passed by `setup` are fingerprinted as the bytes the setup plan will write, preventing an immediately stale document after successful setup.

No absolute or traversing PRD path is accepted. Reads refuse symlink descendants and protected paths such as `.git`, `.obsidian`, `.framework`, test-vault folders and `node_modules`. The isolated test-vault and host configuration values can be displayed as context, but those folders are never scanned by the handout reader. Inputs are bounded: 500 Markdown files, 1 MB per source file, 16 MB aggregate input, 5,000 directory entries, 16 directory levels and 2 MB per handout. Malformed settings, unsupported source metadata, binary/invalid UTF-8 input and exceeded limits fail without modifying source material.

## From completed handout to prototype

The agent must read the selected PRDs and completed handout, run readiness validation, inspect installed capabilities, and report target/starter/Markdown/persistence gaps before planning writes. It then proposes the appropriate existing project/design/starter configuration, a scoped implementation plan and separately authorized process steps. Typed pages, components, interactions and journeys keep their stable IDs and PRD mappings. Arbitrary business behavior remains explicitly scoped agent implementation, not an assumed compiler capability.

The desired external starter contract remains `configs/starters/<starterName>.json`, distributed separately from the shell with no hidden bundled fallback. A compatible external starter, full `configs/user-settings.json` integration, typed Markdown round trips, Angular output or integrated first-run execution must be verified against the actual installed build. This handout change does not implement those separate product workstreams or re-label incomplete ones as supported.

Selecting `skip`, `verify`, or `showcase` records intent only. Installation/network access, package scripts, build/test processes, local serving, browser opening, plugin activation and publication require separate explicit session authorization. Showcase must wait for successful agreed verification, remain local-only as reviewed, and include shutdown instructions. A browser preview must not be reported as native Obsidian acceptance.

## Tests and integration acceptance

Run the dedicated tests and the repository’s normal checks:

```sh
node --experimental-strip-types --test tests/tooling/framework-handout.checks.mjs tests/tooling/framework-handout-integration.checks.mjs
npm run typecheck:framework
npm run test:framework-cli
```

The implementation bundle records executed local evidence separately in `HANDOUT-VERIFICATION.md`. The focused source tests and isolated typecheck do not substitute for the full framework suite, compiled framework kit packaging, CI on the exact applied commit, or native acceptance. Both test files use the existing framework-*.checks.mjs naming convention and are selected by the CLI suite in tests/suites.json. The five framework-integration tests still require execution in a complete checkout; discovery is not a passing test result.
