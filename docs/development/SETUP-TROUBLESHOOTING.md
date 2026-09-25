# Setup: npm install-script policy

For current identity/profile/resume behavior, use [Setup and identity](SETUP-IDENTITY.md).
The original error report below predates the dependency remediation; historical
warnings are distinguished from the current locked graph.

## EALLOWSCRIPTS during npm run setup

The installer invokes `npm ci --no-fund`; it does not pass `--allow-scripts`. Some npm versions export persistent `.npmrc` values into lifecycle child environments. The resulting `npm_config_allow_scripts` is then interpreted by an inner project install as a forbidden one-off policy, even though the developer did not specify a CLI flag. This is reported in [npm/cli#9912](https://github.com/npm/cli/issues/9912) and matches the supplied failure. The exact originating user/global setting cannot be established from the terminal log alone.

The fix is local to the child-install boundary: `scripts/shared/npm-install.mjs` copies the environment and removes only the case-insensitive `npm_config_allow_scripts` key (including its hyphen spelling). It does not mutate the parent, write any `.npmrc`, or remove registry, proxy, certificates, authentication, `ignore-scripts`, or strict-policy settings. The child rereads persistent configuration; project policy is committed in package.json. The wizard discloses this behavior before confirmation.

## Version-specific project approvals

The current locked graph has the following install hooks:

| Policy entry | Decision |
| --- | --- |
| `esbuild@0.28.2: true` | Allow the reviewed locked build-tool binary setup/validation hook. |
| `vue-demi@0.14.10: true` | Allow the locked Vue compatibility redirect setup, including its three nested copies. |
| `fsevents: false` | Keep the optional macOS-specific install hook disabled. No macOS-native qualification is claimed by this fix. |

These are not wildcard future-version approvals. The policy test fails when a changed lockfile introduces an unreviewed hook or changes an approved version. Explicit approvals and denials are tested on the selected npm versions. npm 11 warns for unreviewed hooks by default, while npm 12 blocks them; strict mode is tested separately. The current locked graph has no unreviewed hooks under the committed policy. Older npm versions may not implement this field. This change does not make lifecycle code a sandbox or resolve dependency vulnerabilities.

After pulling the fix, rerun `npm run setup`. There is no need to delete the lockfile, clear the npm cache, approve all packages, install with `--force`, or change machine-wide settings. Review any local package.json changes before pulling. The install stage may replace node_modules as normal `npm ci` behavior; it does not reset vault data.

For the previously installed checkout only, a temporary alternative is to review and approve the named packages using `npm install-scripts approve esbuild vue-demi`, run `npm rebuild esbuild vue-demi` directly in the terminal, then run `npm run setup -- --skip-install`. These commands edit project approvals/run their hooks; they are not needed after applying the repository fix. Do not pass --allow-scripts to a project install or approve all dependencies.

## Other messages in the supplied log

The originally reported ESLint 9.39.5 warning is separate from EALLOWSCRIPTS. The
root linter is now ESLint 10.11.0, qualified with real rule/parser probes. Nested
ESLint 9.39.5 remains through the official Obsidian integration's peers; see the
[unresolved support exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md).

The originally reported low-severity advisory was remediated separately through
the reviewed esbuild override. A fresh `npm run check:security` establishes the
current all-category audit result; historical audit evidence is not a permanent
clean bill. Do not use `npm audit fix --force` as an installer workaround.

## Executable regression evidence

- `node --test tests/tooling/npm-install.checks.mjs`: five deterministic checks for environment isolation, unchanged security configuration, pinned hook coverage, the actual setup CLI boundary with explicitly stubbed build/npm steps, and installation-free dry run. Also included in npm run verify; not counted as new legacy-baseline tests.
- `node scripts/testing/check-npm-install-policy.mjs --npm-cli <path>`: real provisioned npm and synthetic registry packages served exclusively on loopback; failure reproduction, nested npm-run success, version-approved hook execution, explicit-denial enforcement, unchanged lock/config, and an unreviewed-hook rejection in strict mode. The fixture does not download packages from a public registry. No personal vault or global config changes.
- `.github/workflows/setup-compatibility.yml`: Windows/Linux with Node 24.15.0 + npm 12.0.2 and Node 24.21.0 + npm 11.19.1. Each runs fresh full setup with inherited offending config, the real policy fixture, and normal verification. Pull requests and pushes run it only when setup, npm-policy, lockfile, line-ending or Node-pin inputs change (see its `paths` filter); every pull request still runs the complete verify gates on both OSes through Showcase verification. [Candidate workflow 35758140905](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35758140905) identifies the tested implementation commit `39a5f8d5cd683dc173544f8beac4187c1c8665b8`; inspect each job's actual result rather than assuming configuration is evidence.

The npm version matters independently of the Node version; setup now prints both when launched through npm. An unknown version is printed honestly when no npm user-agent metadata was supplied.

## Primary references

- [npm install-scripts](https://docs.npmjs.com/cli/v12/commands/npm-install-scripts/): project approvals and pinned versions.
- [npm policy resolver](https://github.com/npm/cli/blob/latest/lib/utils/resolve-allow-scripts.js): rejects CLI/env-layer policy in project installs.
- [npm/cli#9912](https://github.com/npm/cli/issues/9912): lifecycle-forwarded configuration reproduction.
- [ESLint support policy](https://eslint.org/version-support/): support status, separate from installation failure.

The original installer-policy repair was reviewed on 2026-09-22. Its scope was
installer/policy/test code; later runtime and dependency changes have their own
iteration records and do not add mobile qualification.

## Iteration 02 toolchain and build notes

Select Node24.21.0/npm11.19.1 independently. ESLint10 raises the minimum Node22 floor to22.13. The historical Node24.15.0/npm12.0.2 combination is retained as a Windows/Linux regression target, not the preferred newly installed Node patch. A project-local npm selection or the package runner can select the tested npm without changing global tools; scripts never perform a global installation.

The reviewed lock now approves esbuild@0.28.2, not the old0.27.7 installer. Do not pass a broad one-off allow-scripts list to repair installation, disable audits, or delete the lockfile. `npm run check:dependencies` checks exact pins, reviewed hashes and a real CSS transform; `npm run check:security` records both full audits. Build sources now live in scripts/bundling; failed staged builds preserve dist. Inspect an orphaned .shell-build-lock only after confirming no build process is active. See [Iteration02](ITERATION-TWO.md) for the narrow fontless override and current commands.
