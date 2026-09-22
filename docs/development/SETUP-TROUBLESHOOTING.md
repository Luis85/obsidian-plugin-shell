# Setup: npm install-script policy

## EALLOWSCRIPTS during npm run setup

The installer invokes `npm ci --no-fund`; it does not pass `--allow-scripts`. Some npm versions export persistent `.npmrc` values into lifecycle child environments. The resulting `npm_config_allow_scripts` is then interpreted by an inner project install as a forbidden one-off policy, even though the developer did not specify a CLI flag. This is reported in [npm/cli#9912](https://github.com/npm/cli/issues/9912) and matches the supplied failure. The exact originating user/global setting cannot be established from the terminal log alone.

The fix is local to the child-install boundary: `scripts/shared/npm-install.mjs` copies the environment and removes only the case-insensitive `npm_config_allow_scripts` key (including its hyphen spelling). It does not mutate the parent, write any `.npmrc`, or remove registry, proxy, certificates, authentication, `ignore-scripts`, or strict-policy settings. The child rereads persistent configuration; project policy is committed in package.json. The wizard discloses this behavior before confirmation.

## Version-specific project approvals

The current locked graph has the following install hooks:

| Policy entry | Decision |
| --- | --- |
| `esbuild@0.27.7: true` | Allow the locked build-tool binary setup/validation hook. |
| `vue-demi@0.14.10: true` | Allow the locked Vue compatibility redirect setup, including its three nested copies. |
| `fsevents: false` | Keep the optional macOS-specific install hook disabled. No macOS-native qualification is claimed by this fix. |

These are not wildcard future-version approvals. The policy test fails when a changed lockfile introduces an unreviewed hook or changes an approved version. Modern npm enforces this field; older npm versions may not implement that enforcement. This change does not make lifecycle code a sandbox or resolve dependency vulnerabilities.

After pulling the fix, rerun `npm run setup`. There is no need to delete the lockfile, clear the npm cache, approve all packages, install with `--force`, or change machine-wide settings. Review any local package.json changes before pulling. The install stage may replace node_modules as normal `npm ci` behavior; it does not reset vault data.

For the previously installed checkout only, a temporary alternative is to review and approve the named packages using `npm install-scripts approve esbuild vue-demi`, run `npm rebuild esbuild vue-demi` directly in the terminal, then run `npm run setup -- --skip-install`. These commands edit project approvals/run their hooks; they are not needed after applying the repository fix. Do not pass --allow-scripts to a project install or approve all dependencies.

## Other messages in the supplied log

The ESLint 9.39.5 deprecation warning is genuine but is not EALLOWSCRIPTS. ESLint documents v9 as end-of-life from 2026-08-06 and v10 as current. Moving this project's lint stack to v10 needs its own compatibility verification, rather than bundling an untested major upgrade into an installer repair.

The one low-severity audit finding is also separate. Run `npm audit` for the actual advisory and dependency path. This repair leaves dependency versions and package-lock.json unchanged, does not suppress audit results, and does not claim the warning is harmless or fixed. Do not use `npm audit fix --force` as an installer workaround.

## Executable regression evidence

- `node --test tests/tooling/npm-install.checks.mjs`: five deterministic checks for environment isolation, unchanged security configuration, pinned hook coverage, the actual setup CLI boundary with explicitly stubbed build/npm steps, and installation-free dry run. Also included in npm run verify; not counted as new legacy-baseline tests.
- `node scripts/testing/check-npm-install-policy.mjs --npm-cli <path>`: real provisioned npm, local offline tarball fixtures, failure reproduction, nested npm-run success, approved hook execution, denied/unreviewed hook blocking, unchanged lock/config, and strict-mode failure. No personal vault or global config changes.
- `.github/workflows/setup-compatibility.yml`: Windows/Linux with Node 24.15.0 + npm 12.0.2 and Node 24.21.0 + npm 11.19.1. Each runs the real policy fixture, fresh full setup with inherited offending config, and normal verification. Job configuration is not evidence until that run passes.

The npm version matters independently of the Node version; setup now prints both when launched through npm. An unknown version is printed honestly when no npm user-agent metadata was supplied.

## Primary references

- [npm install-scripts](https://docs.npmjs.com/cli/v12/commands/npm-install-scripts/): project approvals and pinned versions.
- [npm policy resolver](https://github.com/npm/cli/blob/latest/lib/utils/resolve-allow-scripts.js): rejects CLI/env-layer policy in project installs.
- [npm/cli#9912](https://github.com/npm/cli/issues/9912): lifecycle-forwarded configuration reproduction.
- [ESLint support policy](https://eslint.org/version-support/): support status, separate from installation failure.

Reviewed 2026-09-22. This patch changes installer/policy/test code, not the plugin's runtime behavior or its declared native/mobile support.
