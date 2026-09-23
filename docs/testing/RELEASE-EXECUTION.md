# Release execution qualification

Baseline: merged main `386353f5ef3bc6ec94d19057bef159e4efa6e7a1`.
This milestone changes tooling, qualification workflow inputs and documentation;
it does not change production TS/Vue, runtime assets or dependency selections.
The frozen candidate identity and complete hosted results are recorded after the
actual run; prior iteration-four evidence is not promoted to this source.

## Local checks completed before the candidate

Node `v24.21.0`, npm `11.19.1`, Windows x64. A fresh
`npm ci --strict-allow-scripts` installed 693 packages from the unchanged lockfile.
The separate `npm run check:security` passed with zero vulnerabilities across all
installed categories. The nested ESLint 9.39.5 support exception remains open.

Targeted commands use the qualified Node binary:

```sh
node --test tests/tooling/release.checks.mjs tests/tooling/release-plan.checks.mjs tests/tooling/release-cli.checks.mjs tests/tooling/release-execution.checks.mjs tests/tooling/release-remote.checks.mjs
node --test tests/tooling/example-removal.checks.mjs
node scripts/quality/check-source.mjs
node scripts/quality/check-repository.mjs
node scripts/quality/check-analyzer.mjs
```

The initial release run passed 41 checks before independent-review corrections;
the corrected final targeted run passed **44/44** checks. Reviewed example-removal checks
passed 10/10 after updating the exact README ownership hash and replacement
template. Source limits/locales and the full zero-finding analyzer passed.
Repository links initially failed while the readiness ledger was being written;
the completed ledger then passed the same repository gate.

Actual read-only GitHub discovery confirmed the baseline on the default branch,
authenticated draft visibility, and absent target tag/releases. No remote draft,
upload, tag or public release was created. Injected HTTP/child-process tests are
synthetic transport evidence, not successful real publication.

## Independent findings and corrections

| Finding | Correction |
| --- | --- |
| First draft response ID was not pinned before readback | Require the returned positive release ID and reject a replacement draft before uploads. |
| Historical assets could block an unrelated subsequent candidate for lack of digests | Validate target assets only; retain stable public-version/tag checks and ignore unrelated declared prereleases. |
| Promotion confirmation did not bind platform/evidence scope | Include a canonical hash of platforms, native acceptance and review in the authorization binding; changed scope rejects the old confirmation. |
| Local cleanup could mask an already verified remote outcome | Attempt every cleanup independently and attach incomplete-cleanup recovery details without relabeling publication or an uncertain write. |

The engine and transport owners reviewed each other's implementation. A third
agent independently reviewed the actual integrated diff and author-facing
workflow after producing the requirement inventory. Reviews are bounded source
and adversarial-test checks, not an assertion of an atomic remote transaction.

## Qualification boundary

Full source verification, complete production coverage inventory, served E2E,
fresh setup/generated-consumer/source-archive checks and retained-byte native
evidence are separate from the targeted checks. Hosted read-only workflows supply
those results. The consumer path includes a distinct identity, custom source,
a local custom maker, example removal and a new post-removal feature.

Real remote publication, the privileged Actions interface, tag creation,
macOS/physical devices/manual screen readers and the upstream dependency-support
exception remain unqualified or externally blocked. The [readiness ledger](../development/TEMPLATE-READINESS-LEDGER.md)
accounts for all 96 legacy acceptance conditions; its old release guard remains
blocked and is not overridden by this milestone.
