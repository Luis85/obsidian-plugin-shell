# Research: entity-driven Markdown creation

**Date:** 2026-09-22  
**Scope:** Primary documentation and live API declaration review for the DocumentCreationService addition. This is design research, not an implementation or native-host test.

## 1. Findings and decisions

| Finding | Evidence | Template decision |
| --- | --- | --- |
| Obsidian properties support scalar/list values, date-only notation, and standard list properties. A property's assigned type applies by name across the vault. | D01 | Keep managed frontmatter simple and validated. Do not pretend a local Task schema automatically configures native property types or overwrite global settings. |
| The public Vault API accepts the full content when creating a plaintext file and exposes separate folder creation/read operations. | D02 | Render the complete validated Markdown before one host create call; keep native objects inside the adapter. |
| The public API explicitly provides a frontmatter mutation method for existing Markdown files. | D03 | Do not conflate new-document creation with later update behavior. A future update service should use supported mutations rather than old-snapshot overwrite. |
| The Vault guide distinguishes file/folder objects and provides a protected read/modify/write operation for edits. | D04 | Check path kinds, preserve unrelated data, and avoid raw Node filesystem use for normal note operations. |
| The maintained `yaml` library provides serialization and browser-compatible operation. | D05 | Qualify one bundled YAML renderer used by both plugin and harness instead of hand-built YAML lines or two different serializer implementations. |

The exact service API, request handling, type inference, filename convention, frontmatter allowlist, and event semantics are this template's design decisions. External sources do not supply those guarantees automatically.

## 2. Creation is not an update transaction

`Vault.create(path, data, options)` accepts a complete string. The chosen design prepares frontmatter and body first, then invokes that API once. It does not create a blank file and mutate it in a second step.

The declarations inspected do not establish a filesystem-wide transaction spanning parent creation, other plugins, sync, and UI opening. Nor does the plaintext-create declaration specify a cross-process exclusive-create guarantee. The implementation must prove its no-overwrite adapter behavior on supported hosts, handle collisions/uncertain outcomes, and must not advertise stronger guarantees than tested.

For an existing note, the explicitly documented `processFrontMatter` mutation is relevant. This is not a reason to split initial creation into a deliberately incomplete note followed by a second write.

## 3. A schema is not a native property-type registry

The Task definition determines what inputs the service accepts and how they serialize. Obsidian's property-type assignment is a separate, vault-wide concern. Consistent registered schemas, truthful type hints, and actual native Properties tests are required; private-host configuration mutation is not an acceptable shortcut.

The date-only `due` value remains a calendar date. Tests must distinguish it from a timestamp and ensure UI locale/timezone changes do not shift the date. List properties must remain lists, and quoted strings must not silently become booleans, numbers, or executable/custom YAML tags.

## 4. Evidence design

A fake writer that returns success without retaining content cannot demonstrate correct document creation. The harness must use the real service and YAML renderer, capture the actual Markdown, and inspect its properties and body. Real Obsidian acceptance separately checks source content, native Properties behavior, cache lag, collisions, and supported mobile behavior.

Creation success is distinct from later indexing, event subscriber work, or opening the file. The contract intentionally returns a receipt from the known write outcome and does not infer success from a cache that may not yet contain a record.

The proposed `documents.created` event and caller-stable request ID improve application integration. They do not turn the local event bus into a durable delivery system or guarantee exactly-once behavior across crashes/devices.

## 5. Primary sources

| Ref | Source | Inspection scope |
| --- | --- | --- |
| D01 | [Obsidian Properties](https://obsidian.md/help/properties) | Types, dates, standard list properties, unique keys, and vault-wide property-type assignment. |
| D02 | [Obsidian API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) | Current `Vault` declarations including create, createFolder, configDir, file/folder lookup, read, and process. Inspected blob `4fd05b81a95a7f2316f6ca9264abef45fd2c8d58`, lines 7260–7560. |
| D03 | [Obsidian API declarations](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts) | `FileManager.processFrontMatter` signature and mutation guarantees, same inspected blob, lines 2920–2968. |
| D04 | [Official Vault guide](https://docs.obsidian.md/Plugins/Vault) | Host file operations, read/edit distinctions, process semantics, and file/folder checks. |
| D05 | [yaml library documentation](https://eemeli.org/yaml/) | Serialization behavior, scalar/schema concerns, and browser support. Exact package version/options remain subject to implementation qualification. |

Some direct generated API-reference URLs returned not-found or inaccessible responses during this review. The live public TypeScript declarations were used instead; third-party mirrors and search summaries were not treated as authoritative API guarantees.

## 6. Unverified implementation matters

No entity registry, serializer integration, native write adapter, generator, Task UI, or tests were executed during this documentation update. Qualify the exact dependency version, generated type safety, native no-overwrite behavior, serializer/host property compatibility, request/cancellation outcomes, and existing architecture/size gates before claiming the service is ready.
