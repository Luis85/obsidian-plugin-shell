# Storyloom — delivered prototype

**Map the user’s journey.** Storyloom owns story maps, activities, journey steps, stories, releases and personas.

[`index.html`](index.html) is the delivered `storyloom-prototype.html` from Obsidian Product Family prototypes
2.0.0, kept byte for byte. Open it directly in a modern browser. Its application, editor engine,
styles, icons, demo data and third-party notices are embedded.

| Field | Value |
| --- | --- |
| Delivered file | `storyloom-prototype.html` |
| Version | 2.0.0 (Nuxt UI 4.11.3, Vue 3.5.22) |
| Bytes | 1164088 |
| SHA-256 | `de6671361ee5f92ffabe3630d74425f4c66c51f5a24b15a4b40c7c64c2f7a5fc` |

The source is the standalone project [`projects/storyloom`](../../../projects/storyloom/README.md).
Family-wide material is in [`product-family`](../product-family/README.md): the delivery manifest,
the original verification and the sample package. The other family members are
[Component Atlas](../component-atlas/README.md), [Sitemap Atlas](../sitemap-atlas/README.md), [Dissect](../dissect-canvas/README.md), [Resource Atlas](../resource-atlas/README.md).

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
