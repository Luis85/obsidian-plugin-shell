# Optional memory integration: verification record

Prepared 2026-09-27 against PR #5 (`docs/companion-plugin-prd`), commit `b66200e2f43cd0682028f0151f9bdffc853cd2bf`, tree `5279db5211a3f3e9c392cf1a869ced1d2b85245e`. This is a separately stacked change; the base branch is not modified.

## Executed locally

| Check | Result | Scope |
| --- | --- | --- |
| `npm run test:memory` | 39 passed; 0 failed/skipped | Node policy, install-port contracts, real Git fixtures, consent and file safety |
| `python3 -B -m unittest discover -s tests/hindsight -p 'test_*.py' -v` | 12 passed | Stdlib tests with injected SDK/manager doubles; not the real server |
| Strict TypeScript no-emit check of `scripts/hindsight/*.ts` | Passed | Compiler 5.8.3, Node types 24.0.4; equivalent options to `tsconfig.hindsight.json`, local typeRoots |
| Standalone `--help`, fresh-clone `status`, install/seed previews | Passed | No optional SDK, provider key, repository npm dependencies or daemon needed |
| Parent `package.json` reconstruction | Exact Git blob match `bacbdc46d05f68a16d41725f670ae6ae3c665aab` before script additions | Existing dependency versions and scripts preserved |

Environment: Linux, Node 22.16.0, Python 3.13.5. The repository's qualified Node 24.21.0/npm 11.19.1 and TypeScript 6.0.3 were not available locally. No package install was required for these fixtures. The added hosted workflow uses `.nvmrc`; its results must be inspected separately rather than inferred from this record.

Negative coverage includes unknown/misplaced options, absent consent, cloud/broad opt-in/automatic-update conflicts, per-harness and bank routing conflicts, malformed JSON, changed config preimages, exclusive helper locks, dangling symlinks, dirty versus committed source, missing/executable blobs, forbidden paths, oversized documents, common credential patterns, invalid endpoint schemes/hosts/credentials, source hashes, duplicate sources, native installer failure, installer configuration drift, SDK version mismatch and redacted subprocess/provider errors. Real linked worktree fixtures check stable bank identity and main-checkout discovery. Python tests verify profile lifecycle, no stop-on-client-close, no daemon creation during stop, full-batch validation and retain provenance.

## Not yet qualified

The execution container could not resolve external package hosts, so no real pip/npm optional installation, pg0 bootstrap/model download, live retain/recall, actual Claude/Codex native-hook session, authenticated `gh` PR fetch, or platform-specific package installation was executed. Python tests inject adapter doubles; they do not certify upstream dependency compatibility. Exact direct versions are pinned, but a cross-platform transitive lock was not produced.

The full parent repository was inspected through GitHub rather than cloned with dependencies, so `npm run verify`, full analyzer/coverage/build/packaging gates and Obsidian/native tests were not rerun locally. No thresholds/exemptions were weakened. Package scripts, not runtime dependencies or generator contracts, were changed. Standard repository gates and the new hosted fixture workflow are independent evidence, not an assumed pass.

## Live acceptance before calling the integration qualified

On a disposable supported workstation/home, preserve representative existing agent settings. Preview and apply an explicit opt-in with a dedicated provider/model and synthetic data only. Verify the venv and installed package versions, the Python profile's actual API binding/data path, native hooks/MCP entries and backups, unrelated config preservation, and Codex feature activation. Confirm the reported endpoint and bank with `hindsight_diagnose`.

Use a synthetic fact in two sessions, wait for queryability using `hindsight_sync_status`, and confirm only the allowed ingestion classes appear. Check a non-approved sibling repo, nested-project prefix behavior, a linked worktree, a fork and another clone. Exercise service-off degradation, profile restart/endpoint matching, disable/restart, shared stop, repeated installation, failure recovery and official per-agent uninstall. Check provider costs and inspect logs locally for accidental sensitive content before sharing any evidence.

Only then record exact platform, package versions, commands, source SHA and observed results here. Do not mark these checks passed merely because the offline tests or a workflow job succeeded.
