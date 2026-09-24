# Data-only capability discovery and operation protocol

## Real entrypoints and trust boundary

```sh
npm run --silent capabilities
npm run --silent capabilities -- makers
node scripts/operations/cli.mjs --request < request.json
```

These commands read maintained JSON metadata relative to the installed tool, not
relative to the current project. They do not read project package.json, load Vite,
import custom recipes, execute npm scripts, inspect a vault, install dependencies,
write files or activate plugins. The same modules run in a Git-free copy containing
only scripts/operations, scripts/contracts and scripts/makers/recipes.json.
No companion code or npm installation is required for discovery.

The catalog describes fourteen actual built-in maker registrations and seven
implemented entrypoints (two protocol discovery handlers and five existing
CLI-only operations), plus seven visibly planned capabilities. “Implemented” means
an entrypoint exists, not that its complete SH task or platform qualification passed.
The catalog is deliberately scoped to authoring/setup/build/deployment/verification,
not every maintenance/release command in package.json. Release/publication operations
are not exposed by the protocol.

Existing `npm run make -- --list` and `--help` remain backward-compatible, including
explicitly trusted local custom-registry evaluation. They are **not data-only discovery**.
Entity and event source catalogs also evaluate trusted feature definitions through
existing tooling. Use the new capabilities command before establishing execution trust.
Custom makers remain executable local code, not metadata to import in a renderer.

## Source of truth and drift checks

- scripts/makers/recipes.json owns built-in names, options, descriptions, schema
  metadata, prerequisites and supported outputs. Argument validation and listing use
  this data; scripts/makers/dispatch.mjs owns the actual implementation registrations.
- scripts/operations/operations.json describes the bounded operation catalog.
  scripts/operations/protocol.mjs registers the actual two discovery handlers.
- scripts/operations/catalog.mjs validates supported schema keywords, duplicates,
  aliases, implementation/transport claims and maker option parity. Tests additionally
  compare actual handler keys and package script/entrypoint declarations.

The inputSchema/outputSchema metadata uses a deliberately bounded JSON-Schema-like
subset: type, properties, required, additionalProperties:false, items, enum,
maxLength, maxItems and pattern. It is not a general JSON Schema engine. Maker schemas
support discovery/forms; the existing maker validator remains authoritative for
reserved names, composed IDs, paths, backend dependencies and existing-owner checks.
Current aliases are empty; do not advertise a new maker alias without qualifying the
CLI/parser/handler change. Discovery never imports an arbitrary schema validator or
executes text from metadata.

## Version 1 messages

```json
{"protocolVersion":1,"type":"request","requestId":"review-001","operation":"capabilities.read","input":{}}
```

`makers.list` is the other accepted discovery request. Stable request and operation
identifiers are bounded to 64 ASCII letters/digits/dot/underscore/hyphen characters,
starting with a letter or digit. Unknown fields are rejected. Discovery accepts only
an empty input object: filesystem roots, credentials, commands and approval tokens
are neither needed nor accepted. Malformed/future versions receive a version-1 error;
a receiver must not silently downgrade a future request into an operation.

A result has protocolVersion, type:result, requestId, operation, output and receipt.
The output is the exact installed catalog or maker array. A progress message has
protocolVersion, type:progress, requestId, operation, sequence, phase:discovery,
completed and total; counters are nonnegative safe integers with completed <= total.
Progress is a validated client contract, not an invented emitted event: current
synchronous discovery returns one terminal result and does not stream progress.

An error has protocolVersion, type:error, requestId, operation, error:{code,message}
and receipt. Error codes are INVALID_REQUEST, UNKNOWN_VERSION, UNKNOWN_OPERATION,
CAPABILITY_PLANNED, CLI_HANDOFF_REQUIRED and INTERNAL_ERROR. Messages are fixed and
never include raw input, process environments, secrets, absolute paths or exception
stacks. Invalid correlation fields use invalid-request/unresolved; well-formed request
IDs are preserved for correlation. IDs are not authorization or secret-storage fields.

A receipt has requestId, operation, catalogDigest, authorization:none, sideEffects:[]
and outcome:succeeded or rejected. The digest is SHA-256 of JSON.stringify of the
validated, fixed-order installed catalog. It identifies these bytes; it is **not an
attestation, approval, signature or write receipt**. Internal catalog failures use
an all-zero digest and an error, never successful evidence. The executable response
validator rejects altered outputs, mismatched correlation/digests and fabricated
side effects or approval. It validates results against its installed catalog version;
clients must retain the matching catalog when interpreting a different tool revision.

Version numbers cover the message/schema contract, independently of maker version 2
and capabilityVersion 1.0.0. An incompatible message change requires a new protocol
version with explicit negotiation; new metadata must preserve current consumers or
advance its schema version. Unknown capability IDs return UNKNOWN_OPERATION. Planned
capabilities return CAPABILITY_PLANNED. Existing write-capable CLI entrypoints return
CLI_HANDOFF_REQUIRED, never an execution-success receipt.

## Bounds and execution exclusions

Input is at most 1 MiB of valid UTF-8, maximum depth 32, 20,000 JSON values and 10,000
array entries. Plain JSON preserves false, zero, empty strings, null and Unicode.
Functions, accessors, custom prototypes, prototype-sensitive keys, cycles, non-finite
numbers and sparse arrays are rejected. The transport accepts JSON bytes; the library
is not a sandbox for hostile in-process JavaScript Proxies or modified installed tools.
For the trusted module seam, accessors and toJSON are never invoked by validation.

CLI stdout is JSON only; successful discovery exits 0 and rejected requests exit 1.
No HTTP server, native integration, process launcher, installer or permission grant
is added. Invoke installed discovery directly from a trusted tool path; running an
unknown consumer's npm script named capabilities still executes that consumer's code.

SH-012 owns shared reviewed execution, exact plans/preimages/tool identity, approval,
locks, cancellation and recovery. SH-013–018 own export, preparation, design interchange,
compilation and ownership. The planned fixture and token capabilities must become
shared shell implementations before their status changes. Concept-only exports or
forms cannot qualify them. Imported receipts never authorize machine-local work.

## Verification

Run `node --test tests/tooling/capability-discovery.checks.mjs` for actual CLI and
independent-copy probes, handler/catalog parity, hostile consumer scripts, malformed
JSON/versions, output tampering and existing maker help/list compatibility. Existing
maker and consumer suites must additionally qualify actual source generation after
the dispatch refactor. See [execution record](../testing/preconversion-gauntlet/SH-011.md).
