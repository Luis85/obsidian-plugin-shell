# PR #51 — merge and CI repair

## Observed failure

The reported feature head was `bae3083d9d258184f5f2ce3d39468605dfce695b`.
PR #5 advanced to `bde086c4440de300f31dc550ae10e9cb9836b219`, adding the
product-trio handout and updated MVP quality documents. The shared ancestor was
`40799d9489e0bd436a47f819732292e8a35a4774`.

A three-way merge reproduced conflicts in `scripts/framework/catalog.ts`,
`help-text.ts` and `planning.ts`. Both sets of command registrations, help metadata
and handlers are preserved; neither feature is selected in place of the other.
The incoming setup, handout, MVP requirements and evidence files are retained.

The Ubuntu interactive-maker artifact from workflow **36617269099**, artifact
**11056928079**, reports two actual full-analyzer findings: the documentation
adapter exported `Source` and `digest`, already exported by the companion compiler.
The documentation exports now use `DocumentationSource` and
`documentationDigest`. All callers use explicit imports of those names. No analyzer
suppression, threshold change, dependency upgrade or removed test is used.

## Integration safeguards

The packaged CLI must expose all six docs commands and all four handout commands.
Setup creates its bespoke, human-owned root handout; subsequent docs export/import
must preserve authored handout bytes. The framework handout is included in both
template inventories but relocated to `docs/framework/PROJECT-SETUP-HANDOUT.md`
in generated consumers. The project-setup guide links to that retained reference
without replacing the consumer's own meeting answers.

The dedicated docs workflow now also runs the real full repository analyzer and
both architecture gates on Linux. Its regression step includes both handout suites.
This closes the gap where the narrow docs workflow could be green while the
broader maker and generation workflows correctly rejected duplicate exports.

## Executed local verification

The feature, incoming base and common ancestor were reconstructed from exact
GitHub Actions source archives. Their raw Git tree hashes were checked before
merging, rather than trusting filenames or normalized checkout bytes:

- Feature: `6aa59d956f5609c6e94bab9eda9ac79244b36b72`.
- Incoming base: `4f08dfd57ad4d6ca4901c79419834c9cb6692b50`.
- Common ancestor: `e79cbd85a73830408837c80d1f16c0e3af7679c4`.

Local Node **22.16.0** differs from qualified hosted Node **24.21.0**. The retrieved
TypeScript **6.0.3** and YAML **2.9.1** are the pinned project versions.

- Framework TypeScript checking: passed.
- Combined docs, handout, setup and manual tests: **159 passed, zero failed,
  zero skipped**. Includes the actual extracted-kit integration test.
- Command-reference generation and deterministic check: passed, **74 commands**.
- Authored manual audit: passed, **10 documents, 97 parsed examples, 13 local
  links**. The audit does not execute handbook examples.

The full analyzer and complete build toolchain are not installed in this isolated
local runtime. Candidate-specific hosted checks, not historical green results,
provide that qualification. The PR conversation records the resulting run IDs
and current statuses without relabeling pending, failed or cancelled jobs.

No PR merge, release, activation or personal-vault operation is part of this repair.
