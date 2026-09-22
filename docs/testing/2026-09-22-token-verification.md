# Verification record: native style tokens and extracted host CSS

**Date:** 2026-09-22. **Reviewed baseline:** `810618a2a404e91430b1cc5e7794ed746baca541`.

## Delivered scope

The template now supplies 38 plugin-scoped aliases for native Obsidian variables, a reviewed 133-name starter reference, and an inventory of 968 lexically declared names in the owner's extracted stylesheet. These are different scopes: the starter reference is not the complete public CSS API, and a declaration inventory does not prove that every variable has a usable computed value in every context.

The default specimen profile loads the pinned extraction plus an explicitly labeled adapter for missing host document/widget structure. The earlier original simulator remains an opt-in separate profile. Both then load the same plugin-owned token aliases; neither profile is a complete Obsidian application or a native compatibility test.

Source and usage guidance: [Obsidian tokens](../design/OBSIDIAN-TOKENS.md). Execution design: [test concept](TEST-CONCEPT.md).

## Pinned input and transformation

Upstream: `Luis85/renovation-planner`, commit `ed5c50b76c481653b0bc19e30ebbf0a03e2da65c`, `tests/harness/obsidian.css`.

| Identity | Value |
| --- | --- |
| Original Git blob | `eb7b27320341f9ed0874bf152ed9955d82d38221` |
| Decoded original bytes / physical lines | 146116 / 4813 |
| Original SHA-256 | `c82582f1a05fc9dc17582b028841021c537d05eb3d5f9aab551836b4cb37195c` |
| Runtime CSS SHA-256 | `1517b7bb06cb45b5b1bbace02d05f3c7f624259293cd47379680a32199c200b3` |
| Recorded source application version | Unknown; the header's compatibility floor is not an app-version attestation. |
| Native comparison | Not run. |

The lossless gzip archive preserves original bytes and attribution. Serving/exporting repairs one documented malformed header-comment terminator (`--page-*/--scale-factor` becomes `--page-* / --scale-factor`), without changing selectors or declarations. Tests verify the exact input, precondition, output digest and inverse transformation. This is not an unrecorded edit of the supplied extraction or permission to bypass limits on other CSS files. No font binary is included.

## Executed checks

| Check | Result / scope |
| --- | --- |
| `node scripts/styles/check-tokens.mjs` | Passed: snapshot/provenance, reviewed names, 38 aliases, inventory and entry order. This is a deliberately restricted alias check, not a general CSS compiler. |
| `node scripts/testing/verify-baseline.mjs --repeat 3 --json` | 52 distinct Node tests, three complete runs, 156 passing executions, zero retries. |
| Inline extracted-profile browser checks | 12 distinct checks, two independent runs, 24 passes. |
| Inline simulated-profile browser checks | Same 12 checks, two independent runs, 24 passes. |
| Served extracted-profile browser checks | Infrastructure error, exit 2: environment blocks loopback navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. No automatic inline fallback. |

The two browser profiles exercise theme transitions, 320/390/900/1280 widths, localized validation, specimen notices/modal keyboard behavior, media/scope handling, native control metrics, alias resolution, live theme overrides, and missing-host/missing-plugin-style negative controls. Assertions wait for meaningful computed-style state instead of adding a fixed delay. They do not establish Vue/SFC build parity, native Notice/Modal behavior, screen-reader compatibility, or every possible theme.

The Node run reports 14 acceptance items verified in their declared narrow scope, six partial, and 76 not run, out of 96 specified items. The browser diagnostic passes are reported separately and not silently promoted to served or native evidence. Production coverage and release readiness remain unavailable.

## Reproducible report identity

These final runs share execution-input SHA-256:

```text
8d8ee89778f2c70bcf359be6f56f969e088a3dd418b85df3da9fc84ccaacc55a
```

The scope includes runtime style sources, harness, scripts, tests, the reviewed token data, machine plan and baseline workflow. It includes new files and verifies decompressed vendor identity. It is not a complete-repository signature; this report and most narrative documentation are outside that input scope.

Final retained report directories:

```text
reports/verification/run-1790083171418-1f5f4ec2-9188-47c8-9bf1-19a0d4c706fb/
reports/browser-specimen/run-1790083245093-9b7be544-7984-4d4a-b4f2-ba261254d029/
reports/browser-specimen/run-1790083325267-f6b5a873-be98-4b94-9a3b-955755ca23ce/
reports/browser-specimen/run-1790083478229-d64df2b0-e63c-488f-92bc-b46a142e6ebb/
```

Reports and traces are generated evidence, ignored by Git and included in the downloadable evidence package. They record their actual profile, driver, browser, input identity and limitations. Screenshots are diagnostics, not automatically accepted golden baselines.

## Environment and previous hosted failure

Local execution: Linux, Node 22.16.0, npm 10.9.2, Chromium 144.0.7559.96. The explicitly selected pre-provisioned driver reports `playwright-core` 1.57.0-beta-1764944708000. These describe the available review environment, not a newly qualified production dependency matrix. The intended current-stable Vite/Vitest/Playwright/Obsidian stack remains to be qualified.

The previous baseline's GitHub Actions run `35726885402` completed with Ubuntu success and Windows failure. Its retained Windows report identifies an ESM reporter path error: a drive path was interpreted as protocol `d:`. This revision uses Node's `pathToFileURL` for the reporter and tests the URL shape with a temporary path containing spaces and Unicode. The fix passes local tests; a later hosted Windows result must be checked independently before claiming Windows success.

The pinned extraction/JSON inputs were transferred with a narrowly scoped authoring-branch workflow that verified source hashes and created unreferenced Git blobs. It did not change main, publish a release, or become a prerequisite for local serving. Final product workflows do not need its temporary Python helper.

## Remaining evidence

No Obsidian instance, mobile device, full plugin build, source-to-SFC CSS extraction, native Properties UI, actual notification service, or release was run. The browser's served mode remains environment-blocked locally. Upstream redistribution rights and the unknown source app version are not resolved merely by recording a hash; the source retains its original provenance and is excluded from plugin distribution.
