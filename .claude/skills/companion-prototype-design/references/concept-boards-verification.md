# Concept-board workflow verification — v1.2.0

Date: 2026-09-27. Follow-up to PR #27 at
`5dc60b3de9712e9ea48bd178eec8b823f840e45c`; still based on PR #5.
Previous archive/tooling receipts remain historical, not evidence for this change.

## Scope

Add the post-brainstorm optional image-board offer, visual iteration and selection,
fresh-session design handoff, one board/review template and eight live-evaluation scenarios.
Claude remains canonical; the unchanged Codex entrypoint delegates to it. No image
provider, parallel shell command, importer schema or dependency is added.

Also repair the prototype build worker's stdout protocol. In the prior head's hosted
framework run `36320124843`, Ubuntu job `108622227790`, real Vite compilation produced
HTML but Nuxt UI's `[success]` log polluted stdout and made the parent JSON parse fail.
The dedicated worker now sends third-party build diagnostics to stderr and restores
stdout before writing its single JSON result. Errors retain their original identity;
no trailing-line parsing, swallowed errors or disabled assertions are used.

## Executed locally

Environment: Linux, Node 22.16.0, Python 3.13.5. Direct Git DNS was unavailable. Edited
preimages were reconstructed from authenticated GitHub reads and checked against exact
upstream Git blob hashes or the upstream SHA-256 inventory. This is a focused local
source snapshot, not a complete PR checkout or the qualified pinned build environment.

From the canonical skill directory:

```sh
python3 -B -m unittest discover -s tests -p 'test_skill_contract.py' -v
node --test tests/worker-output.test.mjs
node --check scripts/lib/build-worker.mjs
node --check scripts/lib/worker-output.mjs
node --check tests/worker-output.test.mjs
```

- 17 static skill-contract tests passed, including 10 new concept-board contract checks.
- Four Node tests passed: real child-process stdout/stderr behavior with direct/console
  asynchronous diagnostics, restoration after async/sync errors, and worker CLI wiring.
- Changed Node module syntax checks passed. The new tests join the existing prototype
  suite through its existing helper-test registration; Python discovery is unchanged.
- Inventory updates cover changed/new payloads; untouched entries and the Codex pointer
  retain their existing hashes. Whitespace checks use exact changed-file preimages.

Static tests assert documented routing/contracts, not agent compliance or image quality.
The Node tests exercise stream handling, not a replacement or simulated Vite build.

## Not run in this local follow-up

Full current-repository suites, pinned Vite compilation after the fix, TypeScript/lint/
coverage/analyzer gates, real browser/native acceptance, companion round-trip, full
archive/generator requalification, actual Claude/Codex/image-tool sessions and the eight
conversation scenarios. Hosted CI after push is independent; no green result is assumed.
No concept-board images were generated for this skill-maintenance request.
