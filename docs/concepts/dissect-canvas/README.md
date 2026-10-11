# Dissect — delivered prototype

**Explore interfaces & interactions.** Dissect owns review instances, local property overrides, canvas arrangement, annotations, groups and interaction scenarios.

[`index.html`](index.html) is the delivered `dissect-canvas.html` from Obsidian Product Family prototypes
2.0.0, kept byte for byte. Open it directly in a modern browser. Its application, editor engine,
styles, icons, demo data and third-party notices are embedded.

| Field | Value |
| --- | --- |
| Delivered file | `dissect-canvas.html` |
| Version | 2.0.0 (Nuxt UI 4.11.3, Vue 3.5.22) |
| Bytes | 1794847 |
| SHA-256 | `b1405ebe3b4232815864ea95460590ede10143e02fc9a3bab0d84d7897fef164` |

The source is the standalone project [`projects/dissect-canvas`](../../../projects/dissect-canvas/README.md).
Family-wide material is in [`product-family`](../product-family/README.md): the delivery manifest,
the original verification and the sample package. The other family members are
[Component Atlas](../component-atlas/README.md), [Storyloom](../storyloom/README.md), [Sitemap Atlas](../sitemap-atlas/README.md).

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
