# Workbench MVP requirements

This directory contains **55 use-case PBIs** with `type: PBI`, grouped into **8 JTBD epics** and **28 features**. Each PBI has four observable acceptance criteria: **220 criteria** in total. Baseline `WB-MVP-2026-09-30-v2` added WB-PBI-055 through [change record CR-2026-09-30-01](changes/CR-2026-09-30-01.md). These are reviewable requirements, not evidence that their behavior already works.

Start with [governance and the attribute contract](GOVERNANCE.md), [the current progress snapshot](PROGRESS.md) and [traceability](TRACEABILITY.md). The authoritative hierarchy and fixed scope denominator are in [backlog.json](backlog.json). The [frontmatter schema](schema/pbi.schema.json) describes parsed metadata; the [template](templates/PBI.template.md) is excluded from the backlog.

## Progress commands

```sh
node docs/requirements/tooling/progress.mjs
node docs/requirements/tooling/progress.mjs --json
node --test docs/requirements/tooling/progress.test.mjs
```

The first command is read-only and writes its report to stdout. Use `--candidate <commit-sha>` to assess a specific implementation candidate. No shell-cli command, runtime schema or application feature is introduced. Existing Workbench Markdown intake is not claimed to support this new PBI profile until it is explicitly integrated.

## Scope and hierarchy

The selected MVP includes fixture-backed operational output and both C# and Java backend proofs under [MVP-QR-01](../product/MVP-BOILERPLATE-QUALITY.md). The [plan](../product/MVP-IMPROVEMENT-PLAN.md) and its prior requirements/tasks retain their authority. Priority is scope criticality; suggested rank is dependency order, not a measured business-value score.

## WB-E01 — Start a project safely

When starting from an idea or existing repository, establish a working project without rebuilding setup or risking existing work.

### WB-F01 — Capability and contract discovery

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-001](WB-PBI-001.md) | Inspect candidate capabilities and readiness | foundation / I0 |
| [WB-PBI-002](WB-PBI-002.md) | Validate and migrate a declarative project | foundation / I0 |

### WB-F02 — Project settings and migration

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-003](WB-PBI-003.md) | Configure project paths and preferences | foundation / I1 |
| [WB-PBI-004](WB-PBI-004.md) | Migrate legacy settings without losing data | foundation / I1 |

### WB-F03 — External starters

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-005](WB-PBI-005.md) | Install and inspect a separate starter pack | foundation / I1 |
| [WB-PBI-006](WB-PBI-006.md) | Author an external starter definition | foundation / I1 |

### WB-F04 — Reviewed project initialization

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-007](WB-PBI-007.md) | Initialize a project from a starter or blank | foundation / I1 |
| [WB-PBI-008](WB-PBI-008.md) | Initialize a project from an existing JSON design | foundation / I1 |
| [WB-PBI-009](WB-PBI-009.md) | Set up an existing Angular project vault with PRDs | foundation / I1 |
| [WB-PBI-010](WB-PBI-010.md) | Associate an existing GitHub repository | foundation / I1 |

### WB-F05 — First run, recovery and isolated installation

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-011](WB-PBI-011.md) | Build and showcase the generated demo on first run | foundation / I2 |
| [WB-PBI-012](WB-PBI-012.md) | Resume interrupted project setup | foundation / I2 |
| [WB-PBI-054](WB-PBI-054.md) | Install built plugin assets into an isolated test vault | foundation / I2 |

## WB-E02 — Keep documentation connected

When describing or changing the UI, retain useful intent and relationships without reconstructing handover documentation.

### WB-F06 — Typed document intake and reconciliation

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-013](WB-PBI-013.md) | Import typed Markdown requirements and UI elements | foundation / I1 |
| [WB-PBI-014](WB-PBI-014.md) | Resolve competing Markdown and model edits | foundation / I2 |

### WB-F07 — Context and living documentation

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-015](WB-PBI-015.md) | Capture product intent while designing an interface | concept / I2 |
| [WB-PBI-016](WB-PBI-016.md) | Generate and refresh connected project documentation | foundation / I2 |

### WB-F08 — Concept integration

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-017](WB-PBI-017.md) | Integrate a project, feature or improvement concept | foundation / I2 |

## WB-E03 — Create and evolve the interface

When designing or revising the UI, make structure, reusable elements and impact understandable.

### WB-F09 — Design-only project lifecycle

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-018](WB-PBI-018.md) | Start and continue a design-only project | concept / I2 |

### WB-F10 — Page, component and design-system composition

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-019](WB-PBI-019.md) | Compose a page and its interactive states | concept / I2 |
| [WB-PBI-020](WB-PBI-020.md) | Define and reuse a typed component | concept / I2 |
| [WB-PBI-025](WB-PBI-025.md) | Maintain and export a project design system | concept / I2 |

### WB-F11 — Revision and dependency management

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-021](WB-PBI-021.md) | Revise a component and migrate selected usages | concept / I2 |

### WB-F12 — Sitemap and journey semantics

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-022](WB-PBI-022.md) | Organize surfaces without changing routes implicitly | concept / I2 |
| [WB-PBI-023](WB-PBI-023.md) | Define and inspect a branching user journey | concept / I2 |

## WB-E04 — Demonstrate every designed interaction

When presenting a generated application, let reviewers experiment immediately with coherent, resettable synthetic behavior.

### WB-F13 — Interaction and fixture contracts

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-024](WB-PBI-024.md) | Declare interaction contracts and fixture dependencies | foundation / I0 |

### WB-F14 — Operational target generation

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-026](WB-PBI-026.md) | Generate an operational webapp for the selected design | foundation / I2 |
| [WB-PBI-027](WB-PBI-027.md) | Generate an operational Obsidian plugin | foundation / I2 |

### WB-F15 — Scoped regeneration

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-028](WB-PBI-028.md) | Regenerate a selected use-case scope safely | foundation / I3 |

### WB-F16 — Stateful fixture scenarios

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-029](WB-PBI-029.md) | Create coherent deterministic fixture scenarios | foundation / I2 |
| [WB-PBI-030](WB-PBI-030.md) | Experiment with stateful mock interactions | foundation / I2 |
| [WB-PBI-031](WB-PBI-031.md) | Switch and reset demonstration scenarios | foundation / I2 |

### WB-F17 — Offline demonstration and completeness

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-032](WB-PBI-032.md) | Present the generated application offline | foundation / I2 |
| [WB-PBI-033](WB-PBI-033.md) | Inspect complete interaction coverage before acceptance | foundation / I3 |

## WB-E05 — Integrate an existing backend

When adopting real services, replace the simulation without rewriting the UI or losing developer-owned code.

### WB-F18 — Wire contracts and adapter substitution

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-034](WB-PBI-034.md) | Generate and validate language-neutral service contracts | foundation / I2 |
| [WB-PBI-035](WB-PBI-035.md) | Switch safely from mock to service adapters | foundation / I2 |

### WB-F19 — C# and Java reference integration

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-036](WB-PBI-036.md) | Connect the generated UI to a C# reference service | foundation / I3 |
| [WB-PBI-037](WB-PBI-037.md) | Connect the same UI build to a Java reference service | foundation / I3 |

### WB-F20 — Hosting and owned integration extensions

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-038](WB-PBI-038.md) | Serve the web UI within an existing application | foundation / I3 |
| [WB-PBI-039](WB-PBI-039.md) | Extend an adapter and preserve it during regeneration | foundation / I3 |

## WB-E06 — Qualify and ship the foundation

When delivering a reusable kit, prove quality and independent use on exact artifacts before an explicitly approved shipment.

### WB-F21 — Accessibility and performance qualification

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-040](WB-PBI-040.md) | Operate generated workflows accessibly | foundation / I3 |
| [WB-PBI-041](WB-PBI-041.md) | Assess responsiveness and resource lifecycle | foundation / I3 |

### WB-F22 — Trust boundaries

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-042](WB-PBI-042.md) | Verify unsafe inputs and execution are contained | foundation / I3 |

### WB-F23 — Exact archives and consumer upgrades

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-043](WB-PBI-043.md) | Qualify the exact extracted-kit user journey | foundation / I3 |
| [WB-PBI-053](WB-PBI-053.md) | Upgrade a generated consumer without losing extensions | foundation / I3 |

### WB-F24 — Release preparation and approved framework shipment

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-044](WB-PBI-044.md) | Prepare and rehearse a fixed release candidate | foundation / I3 |
| [WB-PBI-045](WB-PBI-045.md) | Publish and verify an approved framework release | publication / I4 |
| [WB-PBI-055](WB-PBI-055.md) | Pin every dependency exactly before publishing any version | foundation / I3 |

## WB-E07 — Use and deliver native Workbench

When working inside Obsidian, author and persist the complete Workbench product on its own generated foundation.

### WB-F25 — Generated native composition and persistence

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-046](WB-PBI-046.md) | Generate native Workbench from its self-project | native / I5 |
| [WB-PBI-047](WB-PBI-047.md) | Persist and reopen native authoring work safely | native / I5 |

### WB-F26 — Complete native operation and acceptance

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-048](WB-PBI-048.md) | Use shared project operations from native Workbench | native / I5 |
| [WB-PBI-049](WB-PBI-049.md) | Accept the complete generated native Workbench | native / I5 |

### WB-F27 — Approved native shipment

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-050](WB-PBI-050.md) | Publish and support the accepted native product | publication / I6 |

## WB-E08 — Continue independently and validate value

When handing over or investing in Workbench, prove maintainability and reduced repeated effort without reducing quality.

### WB-F28 — Developer handover and product-value evaluation

| PBI | Use case | Lane / increment |
| --- | --- | --- |
| [WB-PBI-051](WB-PBI-051.md) | Continue development from the generated handover | foundation / I3 |
| [WB-PBI-052](WB-PBI-052.md) | Evaluate first-change and second-change product value | learning / I3 |

## Initial evidence boundary

All PBI records start at `new`, with review pending, no assigned person or invented estimate, and no accepted runtime evidence. Existing implementation may already satisfy parts of a use case; reconcile it before implementing or advancing status. Zero evidence-backed accepted PBIs in this new baseline does **not** mean zero product implementation.

Public shipment remains separately authorized. No PBI, dependency, completed checkbox or local progress report is a release approval.
