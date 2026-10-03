# Selected generation over a canonical project

```sh
node bin/app generate --scope feature:workspace --json
node bin/app generate --scope page:vp-2 --json
node bin/app generate --scope component:vc-3 --json
# Review the exact plan and repeat the same request with --apply <planHash>.
```

Omitting `--scope`, or selecting `all`, retains whole-project generation. A feature scope uses canonical feature IDs; pages accept surface or visual-page IDs; components accept library or visual-component IDs. An ambiguous alias is refused. Canonical imported JSON remains the only source, and in-place `--input` cannot bypass reviewed project intake.

The compiler determines a bounded, deterministic dependency closure over owned pages/components, live nested components, sources, entities, requirements and prerequisite features. Navigation edges are not compile edges: navigation may cycle without introducing a component cycle. Shared registries, contracts and the full project/traceability remain complete; this is not an independently persisted partial project format.

The plan lists `selection.requested`, `included`, dependency edges, `selectedPaths`, `sharedPaths` and `retainedPaths`. The receipt and plan hash include the selection. Selected and shared paths use the existing ownership policy. Excluded artifact bytes are retained as guarded preconditions, including developer edits and non-UTF-8 extensions; their previous generator-owned hashes remain unchanged.

## Existing-project requirement

An excluded artifact must already exist with a matching previous generated definition. A new or changed excluded definition blocks apply and names the artifact: select a wider feature or `--scope all`. Therefore, initialize a complete project before narrow regeneration. This avoids claiming that a partial slice is independently buildable when the rest of its registry does not exist. A new feature can be added to an otherwise compatible generated project, provided its dependencies are included or already compatible.

Repeated identical generation is a no-op. An excluded file changed after review invalidates the plan; a retired file is never silently deleted. A template update that affects excluded artifacts requires a full or widened review. No dependency installation, acceptance, source execution or publication follows implicitly.

The pure closure model is `bin/compiler/domain/selection.ts`; the existing-emitter mapping is `bin/compiler/adapters/selection.ts`; the shared safe writer remains the owner of mutations. `compiler-selection.checks.mjs` tests the real emitted mapping and actual guarded file operations. `framework-kit-improvements.checks.mjs` replays the public interface from a compiled, extracted archive without consumer dependencies or Git. Native and browser acceptance remain separate.
