# Verification receipt — original v1.0.0 archive

This is the historical archive receipt. The v1.1.0 repository integration and new
verification results are recorded in `references/tooling-verification.md`. Statements
below about unperformed repository integration apply only to the original delivery.

Date: 2026-09-27. Skill version: 1.0.0.

## Repository grounding

Read PR #5 metadata and the actual pinned source through the authenticated GitHub
connector. Observed head: `6178b1025336941ad6fb10eae4e26930622363f9`, branch
`docs/companion-plugin-prd`, open/unmerged at inspection. Inspected AGENTS.md,
package.json, the executable project contract, transfer/generator contracts and current
visual-editor documentation. The real source uses companion format v5; older v4 text
in the PR description was not treated as the current schema.

Primary pinned links are in `references/repository-contract.md`. This package paraphrases
those constraints and calls the real reader/compiler at execution time instead of
shipping a forked permissive companion schema.

## Executed locally

Environment: Node 22.16.0, npm 10.9.2, Python 3.13.5 on Linux.
These are this helper-test environment, **not** the shell's qualified toolchain, which
the inspected AGENTS.md identifies as Node 24.21.0/npm 11.19.1.

| Command | Result | Evidence |
| --- | --- | --- |
| `node --check` for all eight helper/library .mjs files | Passed syntax checks | Checked before packaging |
| `node --test tests/helpers.test.mjs tests/validator.test.mjs` | 23 passed, 0 failed, 0 skipped, 0 TODO | `evidence/helper-node.tap` |
| `python -B -m unittest discover -s tests -p 'test_*.py' -v` | 25 passed, 0 failed | `evidence/helper-python.log` |

Total: **48 executed tests**. Coverage includes CLI dispatch, byte-exact echo protocol,
error/time-out propagation, unexpected writes, deterministic HTML/CSP/data assembly,
external-resource detection, UTF-8 bounds, symlink refusal, conservative project diffs,
ZIP integrity/determinism, overwrite refusal, missing sources, package/lock drift,
source stack pins, secrets/fonts, case collisions, skill references and workflow gates.

The CLI protocol tests use explicitly synthetic reader/planner fixtures, not the real
shell compiler. Packaging tests use explicitly synthetic source packages, not a built
Vue prototype. The static skill tests inspect files/requirements; they do not measure
an agent's actual conversational compliance.

## Not executed or not performed

- Real checkout reader/compiler plan/apply and generated-project install/build/test.
  Authenticated source reads worked; a local clone attempt failed because the runtime
  could not resolve github.com. No fake repository was substituted as integration proof.
- Vue/Nuxt UI compilation or a bespoke product prototype: this task creates the skill;
  no agreed individual product design was supplied for execution.
- The browser helper against a real Vue/Nuxt UI artifact, including file-origin/CSP
  behavior. The helper passes syntax checking, but this integration remains unrun.
- Actual companion UI import/export and semantic round-trip.
- Native Obsidian tests, screen-reader/physical touch trials or release qualification.
- Live multi-turn agent/subagent evaluation. Fifteen behavioral evaluation cases are
  supplied in `examples/conversation-contracts.md` for subsequent evaluation.
- Repository installation, generator-devkit integration, commits, pushes or PR changes.

The package is **tooling-tested and contract-grounded**, not end-to-end qualified
against PR #5. Each produced prototype must run its own real import/build/browser
verification using the target checkout and retain that evidence. The skill requires
failed/blocked/not-run work to remain explicit and forbids promoting it to success.
