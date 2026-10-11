# Unresolved upstream advisory: moment via the Obsidian API package

> Type: explanation · Part of the [docs index](../README.md)

**Status: open. `npm run check:security` fails, and that result is correct.** The audit
gate was not weakened, no advisory was ignored and no override was adopted.
Investigation date: 2026-10-04. Like the
[lint dependency exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md), this record is not a
claim that the dependency graph is supported.

## Finding

`node tooling/security/audit.mjs` (live, all dependency categories) reports three moderate
findings, all from one advisory:

| Item | Value |
| --- | --- |
| Advisory | [GHSA-4p3w-j4w9-5jqw](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw): moment path traversal through a crafted non-string locale name |
| Vulnerable range | moment `2.29.2 - 2.30.1` |
| Installed | `node_modules/moment@2.29.4` (dev) |
| Dependents | `node_modules/eslint-plugin-obsidianmd/node_modules/obsidian@1.12.3` (pinned by `eslint-plugin-obsidianmd@0.4.2`). The root `obsidian@1.14.4` uses the patched `moment@2.31.0` (see the update below). |
| npm's proposed fix | `npm audit fix --force`, which installs `eslint-plugin-obsidianmd@0.1.8`: a lint-preset downgrade, refused |

## Update — 2026-10-10

`obsidian@1.14.4` (published 2026-10-08) depends on `"moment": "2.31.0"`, the patched
release. The root API package moved from 1.13.1 to 1.14.4 through the reviewed dependency
process; the declared host floor (`minAppVersion` 1.13.7) is unchanged. The live audit
still reports the same three moderate findings, now only through the lint plugin's own
`obsidian@1.12.3`, so the finding stays open until `eslint-plugin-obsidianmd` follows.

## Why no override was adopted

The patched release exists: npm registry metadata lists `moment@2.31.0` (published
2026-09-15, `latest`). But both installed Obsidian API packages declare an **exact**
dependency, `"moment": "2.29.4"`, and `obsidian@1.13.1` is the registry's `latest`
tag. An `overrides` entry would replace a version the parent pins exactly. That is the
same unsupported forced resolution the lint exception rejects, so it was not added.
The lockfile is unchanged.

Scope: both copies are development dependencies. The Obsidian package supplies type
declarations and the lint preset. The host provides `moment` at runtime, and the
plugin bundle does not ship this copy. That limits exposure, but it does not satisfy
the audit or make the finding acceptable to ignore.

## Owner decision — 2026-10-06

The owner approved the reconciliation review records and explicitly declined the
Moment override. Keep the pinned dependency unchanged. The isolated override
qualification does not close this advisory: the live audit and main candidate
security gate continue to report the three moderate findings. No audit ignore,
threshold change or security-gate exception was approved.

## Closure condition

Recheck `npm view obsidian dependencies` and
`npm view eslint-plugin-obsidianmd dependencies`. The finding closes when a published
Obsidian API release depends on a patched moment and the lint plugin follows it, or
when its own range permits one. Then update through the reviewed dependency process
with a strict `npm ci`, every normal gate and a fresh all-category audit. Do not mark
the finding resolved because the plugin bundle excludes moment, and do not add an audit
ignore.
