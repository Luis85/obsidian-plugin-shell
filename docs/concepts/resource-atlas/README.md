# Resource Atlas — delivered prototype

**Plan roles and effort.** Resource Atlas plans roles and FTE over a period, blocks time and reports
the effort in person-days (PT) per role and for the whole plan. Its UI is German.

[`index.html`](index.html) is the delivered `resource-atlas.html` (Resource Atlas prototype 1.0.0), kept
byte for byte. Open it directly in a modern browser; it needs no server or other file.

| Field | Value |
| --- | --- |
| Delivered file | `resource-atlas.html` |
| Version | 1.0.0 (Nuxt UI 4.11.3, Vue 3.5.22) |
| Bytes | 976316 |
| SHA-256 | `eac459aa86ae12b6efba462cf4b545ee6c9483ed1cced8eb3346c02444c2e0f9` |

The delivery had no manifest; the hash was taken when the file was added. The source is the
standalone project `projects/resource-atlas` in this repository. It is the fifth member of the
[Obsidian Product Family](../product-family/README.md).

## Rebuilt file versus this file

The project registers Nuxt UI components as `<PfButton>` rather than `<UButton>` and keeps its build
output under `dist/`, which keeps them out of the Workbench shell's own style detection. The rebuilt
file therefore differs by hash from this one.

## Boundary

This is a working browser prototype, not an Obsidian plugin. It saves in browser storage and exports
JSON, Markdown and CSV files for a vault. It does not access a vault.
