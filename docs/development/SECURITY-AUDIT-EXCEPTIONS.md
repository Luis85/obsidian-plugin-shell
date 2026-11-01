# Security audit exceptions

> Type: reference · Part of the [docs index](../README.md)

`npm run check:security` runs the live npm audit over every installed dependency category
and fails on any finding. The only way past a finding without changing dependencies is an
**owner-approved, dated exception** for one named advisory that reaches development
dependencies only. The record is `tooling/security/audit-exceptions.json`; the rules live
in `tooling/security/audit-exceptions.mjs` and are proven by `tooling/tests/security.checks.mjs`.

An exception is not a claim that the dependency graph is fixed or supported. It records
that the repository owner accepted a specific, bounded risk so a release could qualify.

## Rules the gate enforces

| Rule | Result when broken |
| --- | --- |
| Every finding must trace, through the audit's `via` chain, to an excepted advisory. Any other advisory anywhere in the chain still fails. | `vulnerabilities` with the `uncovered` packages |
| The advisory must be absent from `npm audit --omit=dev`, which the gate runs whenever an exception exists. | `vulnerabilities`, `excepted-advisory-in-production-dependencies` |
| The advisory's severity must not exceed the approved `severity`. | `vulnerabilities`, `severity-above-approval` |
| The exception is valid through its `expires` day, never after. | `exception-expired` |
| An exception whose advisory no longer appears (fixed upstream) must be removed. | `exception-stale` |
| Each entry has exactly `advisory` (GHSA id), `package`, `severity`, `scope: "development"`, `approvedBy`, `approvedOn`, `expires` (after `approvedOn`) and `reason`; ids are unique. The committed record may span at most 100 days. | `exception-invalid` / failing test |

A passing run reports `passed-with-exceptions` and lists each exception with its expiry, in
the console and in `reports/security/result.json`.

Only the owner adds an exception, in its own reviewed change. Agents never add, extend or
widen one on their own; an expired or stale exception is resolved by updating the
dependency or by a new owner decision.

## Current exceptions

Approved by the owner on 2026-11-01, while release 0.6.0 was qualifying, after the live
audit in Candidate qualification reported 27 moderate findings from two advisories
published that day. Both expire on **2027-02-01**.

| Advisory | Package | Where it comes from | Why it is not fixed by an update |
| --- | --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): denial of service through globparts amplification, minimatch `<11.0.1` | `minimatch` 3.1.5, 8.0.7, 9.0.9, 10.2.6 | ESLint and its plugins (including `eslint-plugin-obsidianmd`), `typescript-eslint`, `editorconfig` | No patched 3.x–10.x release exists. minimatch 11 drops the callable default export that `eslint-plugin-json-schema-validator` (inside `eslint-plugin-obsidianmd`) and `@eslint/eslintrc` call, so forcing it breaks those code paths only when they run. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): AbortSignal cancellation bypass, glob `9.0.0–14.0.1` | `glob` 13.0.6 | `js-beautify`, a dependency of `@vue/test-utils` (tests only) | Fixed only in glob 14.0.2+, outside the range `js-beautify` accepts. |

Neither package is in a shipped artifact: the plugin's `main.js` and the CLI bundle
`bin/app.js` contain neither, and `npm audit --omit=dev` reports no findings.

To close an exception: when upstream releases bring these packages out of range, refresh the
lockfile through the reviewed dependency process; the gate then reports `exception-stale`
and the entry is removed in the same change.

Related records: [moment advisory exception](MOMENT-ADVISORY-EXCEPTION.md) and the
[upstream lint dependency exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md).

The record belongs to the framework checkout. Framework kits and generated projects do not
receive it: their owners judge their own dependency graphs, so they start with no exceptions.
