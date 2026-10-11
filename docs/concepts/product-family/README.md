# Obsidian Product Family — delivery 2.0.0

Four focused browser tools that work alone and exchange records through one reviewed package format:

| Tool | Responsibility | Delivered prototype | Project |
| --- | --- | --- | --- |
| Component Atlas | C4 architecture, UI definitions, contracts and variants | [`component-atlas`](../component-atlas/README.md) | [`projects/component-atlas`](../../../projects/component-atlas/README.md) |
| Storyloom | Journeys, stories, backlog and release slices | [`storyloom`](../storyloom/README.md) | [`projects/storyloom`](../../../projects/storyloom/README.md) |
| Sitemap Atlas | Page hierarchy, routes, content inventory and navigation | [`sitemap-atlas`](../sitemap-atlas/README.md) | [`projects/sitemap-atlas`](../../../projects/sitemap-atlas/README.md) |
| Dissect | Interface review, annotations and interaction scenarios | [`dissect-canvas`](../dissect-canvas/README.md) | [`projects/dissect-canvas`](../../../projects/dissect-canvas/README.md) |

The delivery was one archive: four self-contained HTML files and one shared source tree that built
all four. The source tree is split into four standalone projects. Each project carries the same
shared shell (`src/`), only its own editor engine, and its own lock, tests and CI. A change to the
shell or the exchange protocol (`src/protocol.mjs`) is a family change: make it in all four projects.

## What is kept here

[`delivery/`](delivery) holds the family-wide parts of the archive, unchanged:

- [`README.md`](delivery/README.md): the archive's own introduction. Its `source/` links pointed
  into the archive; that source now lives in the four projects.
- [`FAMILY-GUIDE.md`](delivery/FAMILY-GUIDE.md): ownership, the exchange format, native backups,
  conversions and the production migration path. Each project also carries a copy in `docs/`.
- [`VERIFICATION.md`](delivery/VERIFICATION.md) and [`evidence/`](delivery/evidence): the original
  checks and their recorded results. They include the integrated browser run that opened all four
  tools together and exchanged real packages in all twelve directions. These records describe the
  delivered build. They were not re-run when the projects were added, and no single project can
  re-run the cross-tool part.
- [`DELIVERY-MANIFEST.json`](delivery/DELIVERY-MANIFEST.json): byte counts and SHA-256 hashes of the
  four HTML files. Each `index.html` in the tool folders matches its hash.
- [`product-family-example.json`](delivery/product-family-example.json): a real family package with
  records from all four tools and a connection spanning them. Each project keeps a copy in
  `examples/` for its browser test.
- [`THIRD-PARTY-NOTICES.txt`](delivery/THIRD-PARTY-NOTICES.txt).

## Boundary

These are working browser prototypes, not Obsidian plugins. They export vault-oriented files but do
not access a vault, and they do not synchronize open tools automatically.
