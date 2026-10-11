# Component Atlas — delivered prototype

**Define the building blocks.** Component Atlas owns C4 definitions (systems, containers, components, code), UI definitions, contracts, variants and definition relationships.

[`index.html`](index.html) is the delivered `component-atlas.html` from Obsidian Product Family prototypes
2.0.0, kept byte for byte. Open it directly in a modern browser. Its application, editor engine,
styles, icons, demo data and third-party notices are embedded.

| Field | Value |
| --- | --- |
| Delivered file | `component-atlas.html` |
| Version | 2.0.0 (Nuxt UI 4.11.3, Vue 3.5.22) |
| Bytes | 1274884 |
| SHA-256 | `9a754409f10f69a77cf4ce14506d4b840401eebe164da2eba3781845b6a1990e` |

The source is the standalone project [`projects/component-atlas`](../../../projects/component-atlas/README.md).
Family-wide material is in [`product-family`](../product-family/README.md): the delivery manifest,
the original verification and the sample package. The other family members are
[Storyloom](../storyloom/README.md), [Sitemap Atlas](../sitemap-atlas/README.md), [Dissect](../dissect-canvas/README.md).

## Rebuilt file versus this file

`npm run build` in the project produces the same editor engine, JavaScript bundle and notices. The
embedded CSS is smaller. The delivery build ran without a `.gitignore`, so Tailwind's automatic
source detection also scanned earlier build output and generated about 120 utility classes the shell
does not use. The project ignores its build output, which makes its CSS deterministic, so the two
files differ by hash. The project also registers Nuxt UI components as `<PfButton>` rather than
`<UButton>`, which keeps them out of the Workbench shell's own style detection. Both files render the
same: screenshots of all five screens in both themes, taken when the project was added, differ by at
most 3/255 per colour channel (anti-aliasing).

## Boundary

This is a working browser prototype, not an Obsidian plugin. It saves in browser storage and exports
vault-oriented files. It does not access a vault.
