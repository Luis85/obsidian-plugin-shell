# Harness host styles

**Current default:** the owner-supplied reduced Obsidian extraction, plus a small explicit DOM adapter. The old original simulator remains an opt-in separate profile.

```sh
node scripts/harness/serve-style-fixture.mjs --port 4174
node scripts/styles/check-tokens.mjs
node scripts/testing/verify-baseline.mjs --repeat 3 --json
```

The default page is `/harness/style-fixture/`. The isolated original simulation is `/harness/style-fixture/simulated.html`. Use the supplied server, not an arbitrary file server: it verifies/decompresses the pinned archive and serves its CSS URL without writing a generated file or downloading anything.

`obsidian.css` imports verified vendor CSS then `host-adapter.css`. The page loads plugin aliases from `src/styles/index.css` afterward, and gallery styles last. No approximate palette is layered above the native extraction. Root theme variables remain host-owned. The optional density override is visible, not a hidden change to native defaults.

The archive is byte-identical to source blob `eb7b27320341f9ed0874bf152ed9955d82d38221`; its header's malformed comment terminator receives a single declared runtime repair. `vendor/provenance.json` identifies source and runtime hashes. Source app version and native comparison are unknown/not run. It is a reduced snapshot, not a complete current application stylesheet. The original rights are not replaced by the repository MIT license; no font files are included.

Vendor/global host rules require a dedicated document. They and the small adapter must never enter plugin release CSS. The original simulator remains scoped to `.obsidian-harness`; it is not a fallback when the pinned archive is missing or modified.

Browser probes accept `--host extracted|simulated` and `--mode served|inline`. Inline is an explicit diagnostic, not evidence of served CSS imports/CSP. The fixture still has no real Vue plugin, native Modal/Notice service, Properties editor, or device guarantee.

See [token and integration contract](../../docs/design/OBSIDIAN-TOKENS.md), [original harness contract](../../docs/testing/HARNESS-STYLES.md), and the current verification record. This profile-specific contract supersedes the old original-only assumption for the default harness, but preserves the original profile and its tests.
