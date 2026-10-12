# Resource Atlas in the product family

Resource Atlas owns resource plans, role capacity, assignment periods, the plan calendar, blocked time, and calculated effort. Storyloom remains responsible for stories; Component Atlas for components; Sitemap Atlas for information architecture; Dissect for its captured product context. Importing another tool's package does not create assignments or translate story estimates into person-days.

## Standalone operation

The distributable includes Vue, the Nuxt UI shell and controls, icons, styles, calculation code, and the example plan. It has no runtime dependency on another prototype, a shared server, or an account. Each plan has its own stable identity and its own external-reference index.

The companion HTML links are optional shortcuts. Import and export work through files even when the other prototypes are on another device or in another folder.

## Portable packages

The existing `obsidian-product-family` version 1 envelope remains unchanged. Resource Atlas adds namespaced entity kinds within that existing format:

| Kind | Meaning |
| --- | --- |
| `resource.plan` | Plan identity, date bounds, budget, and calculated total |
| `resource.role` | Role, standard FTE, planned effort, and capacity |
| `resource.allocation` | A dated assignment belonging to a role |
| `resource.block` | A shared or role-specific blocked period |

A reference contains source application, workspace identity, kind, and entity identity. Resource Atlas exports its native plan alongside its entity snapshots. Foreign snapshots and links may be forwarded, with their original source identity intact. A received snapshot is context, not an editable copy of its owner's data.

The application ID is `resource-atlas`. All four existing prototypes accept its namespaced records through their existing general package format; they do not need a resource-specific module or another plugin installed.

## Update and restore behavior

An import first shows a review. Users explicitly choose whether to refresh existing snapshots. Reimporting the same links is idempotent. A complete export from an owner can identify records no longer present at that source; a forwarded partial context cannot make that assertion for another owner.

Native Resource Atlas restoration checks that the embedded plan identity matches the package's source workspace before changing data. The plan and its connection index are committed together. A package from another application supplies external context and cannot replace a resource plan.

Connections are always created from a record in the current resource plan. If a local role or assignment is later deleted, its connection remains available for review as unresolved instead of being silently reassigned.

Native JSON and Markdown export the current resource plan. A workspace JSON exports all native plans. Use a family package per plan to include external snapshots and links as well.

## Future Obsidian implementation

The pure calculation and serialization modules can be reused in an Obsidian plugin. The remaining native integration consists of an Obsidian plugin entry point and manifest, a workspace view that mounts the interface, Vault-backed persistence, settings, and registered commands. The browser prototype does not install these pieces or write directly into a vault.

Any future automated connection should use the same optional file/reference contract. Planning must continue to work if a companion is unavailable, uninstalled, or uses a different release cycle. Resource Atlas should not acquire story authoring, component management, personal staffing, or actual time-tracking responsibilities merely because it can read their context.
