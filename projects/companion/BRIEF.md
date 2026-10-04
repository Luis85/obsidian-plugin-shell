# Product brief: Workbench Companion

> Read this before changing anything. It is the owner's statement of what this plugin
> is for; `design/` says what the prototype contains, this file says why.
> Agents: do not invent product decisions. Every `TODO(owner)` is a gap: ask the user
> to answer it, then write the answer here. This file is yours to edit and is never
> overwritten by regeneration.

## Product goal

Developer workbench for declarative UI authoring, project setup, source generation and fixture-backed review.

Design goal from the prototype (confirm or replace): Help developers turn a plugin idea into a consistent, reviewable design and portable handoff without requiring build tools during discovery.

TODO(owner): In one or two sentences, what outcome does this plugin give its user, and
how will you know it works?

## Users

TODO(owner): Who uses it and in which situation (for example "me, capturing an idea
while reading, without leaving the note")?

## Surfaces (from the design)

- Workbench (view, entry)
- Project overview (page)
- Project Starters (page)
- Product requirements (page)
- Storymaps overview (page)
- Storymap editor (page)
- Sitemap & views (page)
- Pages overview (page)
- Page editor (page)
- Component editor (page)
- Entity relationships (page)
- Data Sources (page)
- Test Data (page)
- Design System (page)
- Component library (page)
- Blueprints (page)
- Action patterns (page)
- Prepare project (page)
- Generate a feature (page)
- Development (page)
- Quality & verification (page)
- Shell capabilities (page)
- Release readiness (page)
- Runs & recovery (page)
- Workbench preferences (settings)
- Import project JSON (modal)
- Export project JSON (modal)
- Shell JSON handoff (modal)

## Data it works with (from the design)

- Plugin Project
- Requirement
- Screen
- Component
- Entity Definition
- Data Source
- Source Operation
- Test Recipe
- Storymap
- Storymap Item
- Design Token

## Must-have journeys

Starting point, taken from the design's requirements. Rewrite them as end-to-end
journeys ("the user does X, sees Y, and the vault contains Z").

- Start from a curated full project (requirement `req-1cb6a142a83a`)
- One vault owns one project (requirement `req-73b0ebfdbfbe`)
- Capture requirements and acceptance (requirement `req-081cfb20a85a`)
- Author screens and transitions (requirement `req-36d7b6f4547b`)
- Declare domain relationships (requirement `req-c08099e105e7`)
- Use reusable components (requirement `req-bd1de4fc44cb`)
- Select blueprints and patterns (requirement `req-6584340ce18d`)
- Describe every source port (requirement `req-06f774817644`)
- Reuse source operations (requirement `req-ef2c7cdeff8a`)
- Generate deterministic test data (requirement `req-ec335e351077`)
- Exercise isolated operations (requirement `req-be077636eb52`)
- Export isolated test tooling (requirement `req-aee105c0a183`)
- Author the design system (requirement `req-fcb287b6f1cc`)
- Export a readable design guide (requirement `req-2651c9659f14`)
- Describe the companion itself (requirement `req-116526fbf97d`)
- Export the complete saved project (requirement `req-1c5bf64b5012`)
- Import a full project safely (requirement `req-beb85ed6e1ba`)
- Configure project folders (requirement `req-a5dabcd85e66`)
- Accept JSON at the shell boundary (requirement `req-71f899ffeb21`)
- Keep generation a separate stage (requirement `req-4087fd81471e`)
- Create and open storymaps from either entry point (requirement `req-5f7e49dbd623`)
- Plan structured user experiences (requirement `req-af43374c5ccc`)
- Connect without copying artifacts (requirement `req-fdb955f23f8e`)
- Plan outcome-oriented release slices (requirement `req-7c2e61640a9a`)
- Transfer storymaps without data loss (requirement `req-4c0c8d01c184`)
- Preserve drafts and keyboard context (requirement `req-050daad8f2a9`)
- Protect recovery copies (requirement `req-c10894e716c1`)
- Keep test-vault boundaries (requirement `req-bc455a45fb5d`)
- Keep verification scopes separate (requirement `req-bb80b5c4e153`)
- Teach the complete workflow (requirement `req-4d1af6b2ff59`)
- Publish only after native acceptance (requirement `req-d72427bd6f3d`)
- TODO(owner): confirm, reorder or add the journeys that must work before the plugin is
  useful, each with one concrete example the acceptance tests can use.

## Out of scope

- TODO(owner): what this plugin deliberately does not do (mobile, sync, other note formats...).

## Open questions

- TODO(owner): anything undecided that blocks implementation. Agents add questions here
  instead of guessing.
