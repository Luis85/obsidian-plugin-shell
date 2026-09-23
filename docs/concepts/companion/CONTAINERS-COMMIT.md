# Container and connection handoff

Concept 12 was committed to the existing PR #5 branch.

- Source baseline: `c8f4972b16a5aeaea4d17d0f941b552c27794da5`.
- Reviewed staging commit: `5f9d4af20eba0eaad4ffb9583d716c69436c8f49`.
- Application and exact HTML commit: `b31d2380cc71596ae0ab60461c4aad19dec24433`.
- Accepted HTML: **1,112,611 bytes**.
- SHA-256: `5fd906301223be5c7cdf4fe98b91b15190c3a713f9d1467ed79d00e1c406046a`.
- Git blob: `9862f13f74901bae3f590b7a20c2ef682b4ae0ef`.

[GitHub finalization](https://github.com/Luis85/obsidian-plugin-shell/actions/runs/35912778574) validated all 28 source preimages and outputs, applied the reviewed patch, reproduced the exact accepted HTML, and committed it without a force push. The temporary helper and transport files were removed in that commit. The ordinary source-verification workflow remains read-only.

Current local evidence is **223 scoped checks** and syntax checks for **47 authored JavaScript files**. See [verification](CONTAINERS-VERIFICATION.md) and [review](CONTAINERS-REVIEW.md). The final handoff commit triggers ordinary PR verification; its outcome must be read separately rather than inferred from local concept evidence.

No root runtime, dependency/lockfile, production quality threshold, release, tag, marketplace listing or main-branch merge was changed. Native integration and production source generation remain unqualified.
