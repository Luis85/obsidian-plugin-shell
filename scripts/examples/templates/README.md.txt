# Plugin foundation

The optional showcase, Task, Project and Items features have been removed. Your own features and registrations remain.

Run `npm run make -- feature bookmarks --entity bookmark` to add a working note-backed feature, or use `npm run make -- --help` for the full catalog. Run `npm run verify` and `npm run test:e2e` after authoring. Native/device checks have separate evidence.

`npm run check:maintainability` applies the same production function and duplication gates to your generated source. `npm run evidence -- --help` explains input-bound reports and remaining acceptance gaps; `npm run measure:assets` inspects existing candidate sizes without rebuilding. Example-specific acceptance remains unverified after removal, and no report authorizes publication.

Use `npm run dev:ui` for the browser harness and the **Open plugin** command in the isolated development vault. Native preferences and shared runtime services remain available. No note or plugin data is deleted by example removal.

[Authoring](docs/development/AUTHORING-TOOLS.md) · [Architecture and requirements](docs/product/PRD.md) · [Example removal](docs/development/EXAMPLE-REMOVAL.md) · [License](LICENSE)

The [framework guide](docs/development/FRAMEWORK-GUIDE.md) describes the public
authoring API, action scopes, persistence recovery and qualification steps.

[Release execution](docs/development/RELEASE-EXECUTION.md) uses retained assets and authenticated discovery. Its default is read-only; creating a draft or publishing requires separate explicit authorization.
