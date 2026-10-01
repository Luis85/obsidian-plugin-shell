# Compiler integration after PR28

The compiler remains the single parse/migrate/validate/resolve/lower/emit pipeline. Its input adapter now uses the shared authoring reader: v6 routes and journeys remain intact, while v1–v5 input retains the existing normalization and loss report. Typed authoring errors become schema diagnostics, not internal compiler defects.

The parent browser composition is emitted by the pure plugin adapter for both output targets. The compiler clickdummy entry is only a compatibility alias; it does not replace the preview, synthetic services, dialogs, reset, visual states or JSON export. Authoring and sitemap TypeScript configurations remain in generated workspaces.

`tests/fixtures/compiler/post-mvp-base-code.json` is independently captured by executing the untouched parent generator at `931db74da3576d20b862583395cb0a1b9a4412e5` in a separate worktree. Product source/test bytes and browser composition are compared with the refactored compiler. Earlier fixtures were never silently overwritten; the retired ones remain in git history. The focused target tests additionally cover v6 routes, invalid typed authoring data and identical shared browser code.

Generation remains distinct from build, browser/native acceptance and release authorization. Current hosted checks, not this document, determine qualification of the final commit.
