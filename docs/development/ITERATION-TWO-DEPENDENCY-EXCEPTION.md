# Iteration 02 — unresolved upstream lint dependency support

**Status: unmet fully-supported-dependency-graph acceptance criterion.** Investigation date: 2026-09-22. This is separate from the all-category npm audit, which reports zero vulnerabilities for the qualified candidate.

## What is fixed

The active root linter is pinned to ESLint **10.11.0**, replacing 9.39.5. TypeScript-aware, official Obsidian and Vue rules execute under the root linter; negative fixtures prove that rule/parser failures are detected. No lint gate or rule directory was disabled. The exact-lock strict npm installation and the normal verify suite pass.

## What remains

The installed graph still contains `node_modules/eslint-plugin-obsidianmd/node_modules/eslint@9.39.5`.

| Dependency path / package | Published constraint relevant to the retained version |
| --- | --- |
| `eslint-plugin-obsidianmd@0.4.2` | Depends on ESLint `>=9.19.0`, SDL `^1.1.0`, and import `^2.31.0`. Its preset module imports these packages. |
| `@microsoft/eslint-plugin-sdl@1.1.0` | ESLint peer `^9`; its React dependency is 7.37.3. |
| `eslint-plugin-import@2.32.0` | Published ESLint peer range ends at major 9. |
| `eslint-plugin-react@7.37.3` through SDL | Published peer range ends at major 9. The current 7.37.5 release still does not declare major 10 support. |

ESLint 9 reached upstream end of life on 2026-08-06. Microsoft's SDL repository was archived on 2026-08-13 and says it is no longer maintained. Its ESLint 10 compatibility request remains open. The nested linter is a development dependency, not part of the shipped plugin, but that does **not** satisfy the requested dependency-support criterion or justify ignoring it.

## Investigation and rejected shortcuts

[Hosted investigation 35780036372](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35780036372) captured current primary npm metadata, `npm explain eslint`, the full dependency tree, before/after lockfiles, a supported targeted parent update/dedupe attempt, actual verification and audit output. The attempt retained ESLint 9.39.5 and added only unrelated optional WASM-resolution entries. Its trial lockfile was **not adopted**. The active repository retains one reviewed lockfile.

Forcing ESLint 10 into these declared ESLint-9 peers would be an unsupported bypass, not remediation. Removing the official Obsidian integration, importing undocumented deep files, or introducing an unreviewed private fork solely to remove the warning would also change the requested contract. None was done. The completed exploratory workflow has been removed; its evidence remains attached to the handover.

## Closure condition

Re-evaluate a supported Obsidian lint release that removes/replaces these older preset dependencies or a separately reviewed and maintained integration replacement. Require a fresh strict `npm ci`, an installed graph without unsupported lint dependencies, the real TypeScript/Obsidian/Vue negative probes, all normal gates and a new all-category audit. Do not claim the warning was resolved merely because root `eslint --version` reports 10 or npm audit is clean.

## Primary sources

- [ESLint version support](https://eslint.org/version-support/)
- [Official Obsidian ESLint package](https://github.com/obsidianmd/eslint-plugin/blob/master/package.json) and [preset imports](https://github.com/obsidianmd/eslint-plugin/blob/master/lib/index.ts)
- [Microsoft SDL repository maintenance notice](https://github.com/microsoft/eslint-plugin-sdl) and [ESLint 10 compatibility request #92](https://github.com/microsoft/eslint-plugin-sdl/issues/92)
- Exact `npm view` metadata and `npm explain eslint --json` captured in the dependency-investigation evidence. Registry metadata, not a guessed compatible override, is the basis for the peer constraints above.
