# Generated test data

The exported DataSource recipes are compiled into manifest.json by the same data-only translator as the companion prototype. Generation validates the actual fixture engine and simulator but never seeds notes, starts a server, installs a package, or contacts a provider.

Run npm run testdata:check to check reproducibility. Run npm run testdata:plan, review the approval and file list, then npm run testdata:apply -- --approve HASH. The writer is contained in this project's .test-vault and refuses foreign/edited files. Regeneration of code does not re-seed or reset data. Use npm run testdata:reset-plan followed by npm run testdata:reset -- --approve HASH for explicit receipt-owned cleanup.

API recipes support npm run testdata:serve: an explicit loopback server with an ephemeral session token, no live fallback. Database recipes simulate application ports, not a database engine. Vault recipes seed actual Markdown with schema_version and created_at for the canonical repositories rather than substituting a memory port. Native operation JSON examples are payload examples, not live snapshot leases: list records through the running repository before updating or deleting them.

Typed fixture port factories live under tests/project/fixtures for API/database sources. They translate the generated AbortSignal argument to the simulator's options object. Inject them into the actual generated service or pass them as explicit source overrides. Unknown/disabled operations reject, even when a production adapter exists. Dispose every test adapter after the test. Fixture code is never imported by the production bootstrap.

The built-in provider is dependency-free. faker-provider.mjs remains an optional explicit seam; no Faker dependency, network font, credential, executable expression or production endpoint is imported from the design.
