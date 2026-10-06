# Compiler integration after PR28

> Type: explanation · Part of the [docs index](../../README.md)

The compiler is the single parse/validate/resolve/lower/emit pipeline. Its input adapter uses the shared project schema 6 authoring contract: v6 routes and journeys remain intact, and schema 1–5 input is rejected with a schema diagnostic, never migrated (the former migrate phase and its loss report were removed). Typed authoring errors become schema diagnostics, not internal compiler defects.

The parent browser composition is emitted by the pure plugin adapter for both output targets. The compiler clickdummy entry is only a compatibility alias; it does not replace the preview, synthetic services, dialogs, reset, visual states or JSON export. Authoring and sitemap TypeScript configurations remain in generated workspaces.

The historical post-MVP equivalence digests (`tests/fixtures/compiler/post-mvp-base-code.json`, independently captured by executing the untouched parent generator at `931db74da3576d20b862583395cb0a1b9a4412e5` in a separate worktree and layered with reviewed deltas) were retired with their equivalence test in `b91e3185` and the v5 inputs they were keyed to; they remain in Git history and were never silently overwritten. Generated output is now pinned by the reviewed project v6 golden baseline described in [TESTING.md](TESTING.md). The focused target tests additionally cover v6 routes, invalid typed authoring data and identical shared browser code.

Generation remains distinct from build, browser/native acceptance and release authorization. Current hosted checks, not this document, determine qualification of the final commit.
