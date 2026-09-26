# Generated providers, relationship integrity and test data

This is part of PR #21 / [SH-035](../tasks/shell/SH-035.md) (formerly the colliding SH-023). It extends the existing explicit action, canonical note and scoped Design System compilers. It does not infer business rules from PRD prose or turn the browser concept into a finished native plugin.

## Supported declaration-to-code mapping

| Declaration | Output and behavior |
| --- | --- |
| Enabled source test recipes | `scripts/test-data/manifest.json`, exact retained engine/CLI/adapters, guarded `.test-vault` seeding and reset, generated recipe tests |
| Native entity fixture | UUID identities, declared properties/defaults/relations plus canonical `schema_version` and `created_at`; real Markdown/repository consumption tests |
| Native note create/update/delete with relationships | Shared generated relationship preflight around the existing canonical repositories |
| HTTPS API source | Typed `<source>-http.ts` provider; input/output guards, path/query/JSON mapping, explicit runtime origin approval |
| Custom/database source | Typed complete-source override contract, not a guessed driver or embedded SQL evaluator |
| Runtime provider configuration | Editable `bootstrap/source-providers.ts`; actual plugin lifecycle closes configured providers on unload or failed initialization |

The source and test folder preferences still select product roots. Imports are generated relative to those roots. No dependency version or network authorization is taken from imported JSON. No new package or dependency upgrade is required by this increment.

## Seed the isolated test vault

After generation and explicit dependency installation, use the generated workspace:

```sh
npm run testdata:plan
npm run testdata:apply -- --approve HASH_FROM_PLAN
```

The first command is read-only. The second reconstructs the exact plan and checks its approval hash. Output is confined to the workspace's `.test-vault`. Existing manual files and edited generated files cause conflicts rather than silent replacement. Installing or enabling an Obsidian plugin is a separate action.

```sh
npm run testdata:reset-plan
npm run testdata:reset -- --approve HASH_FROM_RESET_PLAN
```

Reset removes only unchanged files covered by the fixture receipt. It is not a vault reset. The existing kit's loopback server is available through `npm run testdata:serve`; it does not proxy or fall back to a live source.

The compiler resolves enabled recipes using the actual exported source/entity contracts. Seed, count, reference date, field rules, fixed/stateful behaviors and empty/error/slow scenarios retain the existing engine semantics. Entity defaults preserve false, zero and empty text. Dangling, duplicate or malformed enabled recipes stop generation. With no enabled recipes, the generator adds no recipe commands. The optional Faker seam stays separately version-bound; no registry download or provider execution is inferred from the export.

Canonical Markdown fixture metadata is significant: data containing only `id` and `type` is not a valid native repository note. The shared browser/compiler translator includes `schema_version` and a deterministic `created_at` in emitted Markdown without adding metadata to operation DTOs. Generated tests read the actual seeded Markdown through the real `NoteRepository`, Markdown codec and generated source service. A passing fixture read proves that boundary, not all product PRDs.

## Simulated and custom providers

Generated `application/sources.ts` contains `SourcePorts`. `createSources(shell, overrides)` accepts complete ports per source, applies the normal input/output validators, and keeps the existing per-view Pinia stores. It rejects unknown sources, accessors, extra/missing operations and non-functions. A partial simulation cannot accidentally combine mocked reads and live writes.

`createProjectTestPorts(manifest)` in `scripts/test-data/source-ports.mjs` adapts non-vault fixture operations to the same `(input, signal)` signature. Use it only in tests or an explicitly controlled development bootstrap, pass its `ports` as overrides, and call `dispose()` at scope end. Native vault sources use actual seeded notes rather than a second in-memory persistence owner. The generated typed factories under the configured tests root cover every method; disabled or missing recipes reject. The generic simulator-port helper still needs a complete source before it can be injected. Production bootstrap never imports the test-data kit.

For a database, implement the generated port in a developer-owned module and return it from `configureSourceProviders`. The export does not specify a trustworthy database driver, credential store, migration strategy or transaction protocol, so none is silently chosen.

## Configure an HTTPS API

Generation produces a typed provider for each declared API. Supported methods are GET, HEAD, POST, PUT, PATCH and DELETE. A source must have an HTTPS locator without URL credentials/query/fragment. Resource paths are source-relative; required scalar input fields can supply `{parameters}`. GET/HEAD query inputs must be closed scalar objects. HEAD must declare no output. Unrepresentable contracts are rejected rather than weakened.

The generated default adapter has no origin approval and refuses requests. Edit the generated `bootstrap/source-providers.ts` implementation point to configure a reviewed provider. For a source slug `my-api` with authentication `none`, the pattern is:

```ts
import type { Services } from '../../bootstrap/services.ts';
import { createGMyApiHttpProvider } from '../infrastructure/sources/my-api-http.ts';

export function configureSourceProviders(_shell: Services) {
  const provider = createGMyApiHttpProvider({
    approvedOrigin: 'https://api.example.invalid',
  });
  return {
    ports: { 'my-api': provider.port },
    dispose: () => provider.dispose(),
  };
}
```

Use the actual generated imports/source name and exact reviewed origin. Keep the `Services` import generated for the selected folder layout. For authenticated sources, supply the asynchronous `headers` provider. It receives the symbolic source/credential reference and AbortSignal; credential acquisition/storage belongs to the product, not to exported JSON. The generator does not implement an OAuth login or refresh flow merely because `auth` says `oauth`.

Requests omit ambient browser credentials, refuse redirects, bound UTF-8 body size and elapsed waiting, and validate JSON responses. Default limits are eight seconds and four million bytes; configuration is bounded to 30 seconds/four million bytes. Errors use scrubbed codes, not response bodies or secret-bearing transport messages. Cancellation/disposal abort owned requests; a noncooperating injected provider is signalled and its result is ignored, not forcibly killed. No automatic retry risks repeating a write with an uncertain outcome. Browser CORS and remote server behavior still apply; this is not a CORS bypass or a proxy.

## Native relationship semantics

Native writable connected components register every related entity with the existing repository registry. Each entity must therefore satisfy the native note contract (including title, folder and supported frontmatter types). A shared session serializes generated adapter preflight and writes, reading current canonical repository snapshots first. Actual persistence remains in those repositories, including original Markdown/stale-revision checks and idempotent creation plans.

Implemented checks include outgoing and incoming cardinality (`0..1`, `1`, `1..1`, `0..*`, `1..*`), scalar/list shape, missing targets, duplicate targets, and restrict deletion. References resolve by the target entity's exact ID or an exact vault-relative wikilink, with optional `.md` and display alias. Basename guessing, heading/block links, traversal and ambiguous paths are not accepted as entity identities. The generator does not rewrite every reference into a wikilink or infer a filename from an ID.

A rejected preflight writes nothing and discards only an unused canonical creation plan. A commit with an uncertain failure is not retried or discarded as though it never occurred. Cancellation of a queued write prevents its commit. A retry of the same canonical request through another adapter or view sharing the session waits for the first attempt and receives the repository's recorded outcome; it does not re-run preflight against its own committed note or write again.

The graph must satisfy the declared constraints after each operation. Required inverse relationships and mandatory cycles may require a separately implemented batch/import transaction; the generator does not pretend sequential writes can satisfy an impossible intermediate graph. A mandatory two-way cycle therefore rejects either creation order with no write; this is tested as explicitly unsupported. Duplicate relationship ids, and empty or prototype-named reference keys, are refused at generation and again by the runtime graph check. `cascade` and `unlink` deletion policies on writable graphs are explicitly refused pending such a transaction implementation.

These are **in-process preflight checks, not a cross-file vault transaction**. External writers or direct repository calls can race or bypass them. Existing invalid data may block a write until repaired. Bounds are 120 relationships, 12,000 records and 100,000 inspected reference entries. Read-only relationships remain preserved design data without claiming write enforcement.

## Verification and remaining product implementation

The unchanged generator workflow checks root analyzer/source/archive integration, compiler types and the generator regressions. It independently generates, installs, builds and runs tests for both the actual companion export and a synthetic boundary fixture. The latter exercises typed form actions, writable self relationships, HTTPS providers and enabled API recipes without claiming those declarations are authored business requirements of the companion itself.

Generated executable tests include entity/service/Pinia behavior, actual canonical Markdown fixture reads, native relationship mutation protection, provider dispatch and transport error/cancellation/limit handling. JavaScript (`.mjs`) tests execute through Vitest; generated TypeScript/Vue files retain compiler checking. Acceptance prose remains separately identifiable TODOs. Full framework coverage/quality, browser/native host acceptance and release authorization remain independent gates.

Product work still includes visual Vue Flow editors, any components without authored internals, undeclared domain behavior, translations, custom drivers/authentication flows, multi-record transactions and real native Obsidian acceptance. JSON/Markdown input controls are usable text editors, not a claimed port of every rich editor in the prototype.

## Primary references

- Fetch API and request/redirect/credential semantics: https://fetch.spec.whatwg.org/
- Pinia's actual-store testing: https://pinia.vuejs.org/cookbook/testing.html
- Obsidian Vault API usage: https://docs.obsidian.md/Plugins/Vault

These references guide integration. Repository tests, not documentation links, establish the implemented behavior above.

See [the local-review reconciliation](GENERATOR-FIXTURES-AND-RELATIONSHIPS.md) for shared translation, read-only checks, audits and queue disposal.
