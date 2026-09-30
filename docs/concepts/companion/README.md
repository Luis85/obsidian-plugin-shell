# Workbench authoring concept — Journey Lens

**Focus on your idea. Save time. Not quality.**

Workbench is a tool to create and manage declarative user interfaces for webapps and Obsidian plugins, with documentation along the way and developer experience at its core. Read the [product vision](../../product/PRODUCT-VISION.md), [product principles](../../product/PRODUCT-PRINCIPLES.md) and [documentation map](../../product/README.md).

This guide describes the **browser authoring concept**, not a complete production or natively accepted Workbench. The `companion` directory, build commands, JSON names and generated artifact paths remain technical compatibility identifiers; the product name is Workbench. Existing UI labels may still use the former name until a separately scoped runtime branding change.

## Open the current authoring concept

**Journey Lens is the sitemap editor inside Workbench's current authoring concept.**
It replaces the old sitemap surface; the surrounding workbench and existing page,
component, requirements, storymap and data editors remain in place.

With the repository's qualified locked dependencies installed, run:

```sh
npm run companion:build
```

Open **`reports/companion-mvp/companion-journey-lens.html`** in a desktop browser.
Use **Load companion project**, confirm, then **Design → Sitemap & views**.
The matching full-project export is **`reports/companion-mvp/companion-project-v6.json`**.
Both are included in the `companion-mvp-authoring` artifact of the existing
**Companion concept source verification** workflow for the chosen commit.

The HTML is self-contained: scripts, styles and icons are embedded, with no
runtime CDN or server required. It is an authoring concept, not an installable
native Obsidian plugin. GitHub's repository file viewer does not execute HTML.

Read [Journey Lens integration](JOURNEY-LENS.md) for the editor contract,
architecture, current entry points and verification scope.

## Work across the connected design

Structure, Navigation and Journeys are lenses over the same canonical surfaces.
Use the hierarchy-aware Outline and contextual inspector to reach parents,
siblings, children and connected pages. Journey steps select those same surfaces.
Open a page editor from its inspector; Back restores the selected surface, lens,
search and panel context within the current project session.

Dragging and **Arrange** change geometry, not containment or routes. Structure
connections review a parent change; Navigation connections review a transition.
Saved positions, immutable visual definitions and the full project v6 JSON are
retained. See the integration guide for limits and save/cancel protection.

The other authoring guides remain applicable within their stated scope:

- [Visual page and component editors](VISUAL-EDITORS.md), [component composition](COMPOSITION.md), and [Design System](DESIGN-SYSTEM.md).
- [Requirements-linked storymaps](STORYMAPS.md), [entity semantics](SEMANTIC-LAYER.md), [Data Sources](DATA-SOURCES.md), and [Test Data](TEST-DATA.md).
- [Manage prototypes, versions and active variants](PROTOTYPES.md), with [scoped verification](PROTOTYPES-VERIFICATION.md).
- [Project starters](PROJECT-STARTERS.md), [project JSON](PROJECT-JSON.md), and [one-vault project model](SINGLE-VAULT.md).

A [generated clickdummy](../../development/COMPANION-CLICKDUMMY.md) is a separate
output compiled from generated Vue source, not a wrapper around this authoring
HTML. Browser authoring, generated-source verification and native acceptance are
separate milestones.

## Project format and the build base

The current project format is **Companion project schema 6 only**. Schema 1–5
documents are rejected with a `COMPANION_VERSION` diagnostic; they are never
migrated. The history of the retired formats lives in Git.

The checked-in `index.html` and `companion-project.json` in **this directory** are
only the **build base** that `npm run companion:build` composes the current v6
authoring HTML from, together with the inputs they are assembled from (`src/`,
`starters/`, `seeds/` and the shared contracts named in
`scripts/concepts/build-companion.py`). They keep their earlier (v5) form until the
authoring build is made v6-native; they are not a supported import format or the
current Journey Lens review entry. Do not replace them with hand-edited generated
output; build the current authoring artifact as above.

Earlier increment reviews and verification reports keep their original
artifact/version boundaries as dated records. The
[2026-09-27 PR #5 review](../../product/PR5-PRODUCT-REVIEW.md) and
[improvement plan](../../product/PR5-IMPROVEMENT-PLAN.md) explain the wider roadmap;
the [2026-09-29 vision review](../../product/PR5-VISION-REVIEW.md) aligns product
identity without requalifying those earlier results.

## Source and acceptance boundaries

Edit `editor/`, the maintained `src/` modules and the shared authoring domain, not
generated HTML. The current build uses the existing composition seam and project
persistence; it does not add a second project database. The integration guide
names the Node and browser regression checks.

No real vault access, plugin activation, deployment or publication occurs in the
concept. The source-backed authoring milestone does not establish complete native
Workbench behavior, native accessibility acceptance or completion of the broader
PR #5 improvement plan. No merge or release is included in this documentation update.
