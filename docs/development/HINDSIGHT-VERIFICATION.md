# Hindsight integration verification

## Current follow-up candidate — 2026-09-27

Built on PR #30 head `a5d36fa7a60a278339de38f3558470b8f6b92161`, tree `4786e100214d5cbc63ce35239ceddfa0b790c41a`. PR #30 remains stacked on PR #5 (`docs/companion-plugin-prd`). This record supersedes the initial 39-Node/12-Python fixture count; all three original test files remain byte-identical and still execute.

### Executed locally

| Command/check | Result | Scope |
| --- | --- | --- |
| `npm run test:memory` | **67 passed; 0 failed/skipped** | Original contracts plus keyless providers, real Git, native JSON/TOML edits, staged launchers and real subprocess/MCP transport fixtures |
| `python3 -B -m unittest discover -s tests/hindsight -p 'test_*.py' -v` | **24 passed** | Original adapter contracts plus no-LLM/provider/environment/query/lifecycle cases |
| Strict TypeScript no-emit/no-unused check of every `scripts/hindsight/*.ts` | **Passed** | Available TypeScript 5.8.3, Node types 24.0.4; explicit NodeNext/ES2023/strict flags |
| Original suite registry reconstruction | Exact original blob `adcd9edd7fe04ec14befb4a7b7fbd12ba824dea2` before additions | All original roots, suites, prerequisites and helper ownership preserved |
| Original test-file identity | Exact original blobs retained | Tests were added, not replaced to make changed behavior pass |

Local environment: Linux, Node 22.16.0, Python 3.13.5. This is not the repo's qualified Node 24.21.0/npm 11.19.1/TypeScript 6.0.3 environment. The full repository/dependency checkout was unavailable; the changed tooling and relevant fixtures were reconstructed from exact GitHub source. Root npm dependencies, lockfile and existing scripts are not changed by this follow-up.

The pipeline fixtures create real disposable venvs with `--without-pip`, run actual Node-to-Python commands, preserve keyless settings despite an unrelated ambient key, validate CLI recall/reflection refusal, and execute the **registered staged launcher** through stdio initialize/tools-list. Only the external Hindsight package/manager and upstream MCP server implementation are explicit doubles. No model/provider/account or live Hindsight database is exercised by those fixtures. An apparent package version in a fixture is test data, not evidence of an installed real distribution.

Negative tests include absent consent, unknown/duplicate/misplaced flags, dry-run versus live execution, cloud/broad opt-in/conflicting routes, globally or bank-disabled projects, unsafe provider fields/remote local endpoints/missing models, malformed/concurrently edited config, owned versus foreign MCP registrations, TOML layout conflicts, source/snapshot drift, invalid UTF-8 MCP output, stalled MCP discovery, wrong package versions, stale seed plans and unsafe committed sources. Original tests continue to cover symlinks, private backups, helper locking, Git identity/worktrees and subprocess error redaction.

### Confirmed existing hosted failure addressed

The previous Linux archive job `108637277626`, workflow run `36325456595`, passed its 96 framework tests but then failed with `UNDECLARED_TEST_DIRECTORY: tests/hindsight`. The follow-up declares the optional root and separate `memory`/`memory:python` suites and adds a registry check to the dedicated workflow. This fixes the identified cause in source; it does not constitute a green rerun or a diagnosis of every other existing check.

### Not executed / not claimed

No real pip/npm Hindsight installation, pg0/model bootstrap, authenticated provider call, real SDK retain/recall, actual Claude/Codex desktop UI session, macOS/Windows install, authenticated GitHub CLI request, full repo `verify`, analyzer/build/coverage or release-archive qualification was executed locally. No cross-platform transitive lock was produced. The added workflow performs offline contracts, not model or desktop acceptance. Its actual results must be inspected on the pushed head.

## Live acceptance checklist

Use a disposable supported workstation/home and synthetic data. Preserve representative existing client settings. Preview and explicitly approve a provider and project, then verify the real installed package versions and Python profile binding. Confirm the actual official tool list, selected harness and bank, native hook registration, relevant Codex feature settings and desktop permission prompts.

For no-LLM mode, retain a synthetic committed record and recall it through the CLI; confirm reflect is explicitly unavailable. For a full keyless provider, authenticate through its official client or load the selected local model, then verify real extraction, recall, reflection and page behavior across two sessions. Record the exact model/account route without credentials, latency/cost and source provenance. A successful health probe or tool list does not replace this check.

Test an unapproved sibling project, a linked worktree, another clone and a fork. Check desktop launch with a stopped profile, first cold-start behavior, restart after configuration, source update followed by explicit reconnect, disconnect, global/bank disable, stopped-profile provider changes and partial installation recovery. Ensure launching another Git branch cannot substitute current checkout code for the reviewed staged launcher. Check persisted auth-home behavior separately from the desktop client's own home.

Exercise native per-agent uninstall only after considering every project that uses that user-scope integration. Data purge is not automated. Confirm unrelated settings survive, and inspect logs locally for sensitive content before publishing evidence. Then record observed platform, package versions, source SHA and outcomes; do not promote this checklist to passed based on fixture success.
