# Iteration Planner — design brief v1

## Status and authority

Mode: new feature concept for `Luis85/obsidian-plugin-shell`, intended for PR5 under `docs/concepts/iteration-planner`. Inspected reference: `8942680c6d29700c4f3440da447c14a767e78472`.

This is the documentation handover for the previously delivered local prototype. Its runnable artifact and source package are not uploaded in this draft; see [PUBLICATION.md](PUBLICATION.md). The owner's requirements are recorded below. Other defaults are proposals embodied in the first local clickdummy, not fabricated interview decisions or approval of a production architecture. No concept-board selection, native acceptance or design sign-off is claimed.

## Outcome and users

A team can answer: What are we trying to achieve? What did we agree? What needs attention today? What became usable? What should we improve next?

The primary users are a cross-functional product team, its facilitator and its product owner. Backlog vocabulary is unrestricted: feature, defect, operational work, research, experiment, improvement or a custom type. The tool is not limited to software tasks or a mandatory hierarchy.

## Owner requirements

| ID | Requirement |
| --- | --- |
| R01 | Maintain an arbitrary backlog |
| R02 | Create iterations with automatic indices and a goal-based name |
| R03 | Describe an iteration and set start/end dates |
| R04 | Add resources and choose backlog items for an iteration |
| R05 | Produce one increment record per iteration |
| R06 | Describe delivery with a changelog and actual progress against the agreed items |
| R07 | Make the current iteration and increment approachable through a visual dashboard |
| R08 | Support Monday planning, a daily backlog walk, review and retrospective |
| R09 | Make the full incremental team process easy to understand |
| R10 | Add the concept and clickdummy to PR5's `docs/concepts` |

R10 is only partially published by this documentation-only draft.

## Proposed defaults

One product workspace contains multiple backlogs, reusable people, items and iterations. One iteration may be active at a time; planned iterations and history are retained within explicit import limits. An item belongs to at most one open iteration. No accounts, permissions or collaboration infrastructure are introduced by the concept.

Indices start at zero and increase independently of the goal text. The example `0..10` is illustrative, not a maximum. A display name follows `Iteration — Goal — Index`. New dates default to the next available Monday and Friday, while other valid dates remain selectable. Weekends are excluded from the working-day indicator; holidays are not modeled. The local demonstration uses an explicit simulation date.

A title is sufficient to capture work. Description, type, estimate, owner, capacity and references are optional. Resources currently mean people, their available hours and reference links, not equipment booking or budgets. Estimate and capacity comparisons use hours, not an implicit story-point conversion or a delivery guarantee.

Starting an iteration freezes the original plan. Goal and dates become read-only in the first concept. Later additions/removals need a scope-change reason. Removing work does not delete its canonical backlog item. Production handling of amendments and cancellation remains an open decision.

## Information architecture

Eight views share product context and an iteration selector:

- Overview and Product backlog.
- Iteration planning and Daily walkthrough.
- Increment & review and Retrospective.
- People & resources and Iteration history.

The overview leads with the goal. A ring displays Done items against current scope; separate indicators show time, blockers and manually assessed goal confidence. A planning → daily → review → retrospective strip explains the process and links to each step. Work and team capacity remain visible below it.

The local visual proposal uses neutral surfaces, a green primary/delivery accent, amber impediments, system fonts and local vector icons. Every status has text, not color alone. Narrow layouts stack cards and contain table scrolling inside panels. Light/dark themes preserve the same hierarchy.

There is no fabricated burndown, automatic health score, velocity leaderboard or person-level productivity ranking. Done-item count is not delivered value, productivity or a forecast.

## State and integrity rules

### Iteration: planning → active → closed

Creation allocates a stable ID, display index and one increment report. Starting requires selected work and no other active iteration, and snapshots the planning agreement. While active, progress and the live increment evolve together. Review finalizes that same increment report rather than allocating another report.

### Work: ready ↔ doing ↔ blocked ↔ done

Done requires an explicit Definition of Done confirmation and a changelog entry describing usable delivery. Blocked requires a reason. Reopening Done removes it from the live delivered count. A note alone cannot count as delivered work.

### Increment: live report → frozen review

The report separates delivered work, unfinished progress, goal outcome and review observations. It can honestly contain zero delivered items. Closure does not create delivery or publish a release. Unfinished work becomes available for a deliberate future planning decision without being automatically carried forward. Subsequent work must not rewrite prior frozen work snapshots.

One increment report per iteration is this product's reporting convention; it is not a claim that an agile team cannot integrate usable changes more frequently.

## End-to-end journeys

### J01 — capture and refine

Capture a title inline, then optionally add details, custom type, priority, owner, estimate and backlog. Search/filter, reorder and archive/restore without deleting historical evidence. Selected available items can enter a draft plan or a reasoned active scope change.

### J02 — Monday planning

Create the next indexed iteration, state the useful outcome, choose dates, allocate realistic capacity and add supporting references. Select work in the context of the goal. Agree the plan to preserve the baseline and activate the iteration.

### J03 — daily backlog walkthrough

Start with impediments, then walk every current iteration item, including Done work. Record what changed, the next useful step, responsibility and status. Track per-date coverage by item rather than by person. Finishing requires all current items to be discussed. New scope reopens today's coverage requirement.

### J04 — review the increment

Inspect the delivered changelog and acknowledge unfinished progress separately. Record goal outcome, summary and feedback. Preview delivered/unfinished counts before freezing. Keep the reviewed record in history. A later directory rename may alter a displayed person's name, but must not rewrite the frozen work's title, estimate, notes or changelog.

### J05 — retrospective and next iteration

Capture Keep / Change / Try observations and an optional owner. Promote an improvement to a chosen backlog once, preserving its retrospective link. Do not automatically commit it to the next iteration. Deliberately select unfinished work and improvements during the next planning session.

### J06 — retain or exchange the prototype workspace

Export all concept data as versioned JSON. Import validates the entire candidate, previews replacement and allows cancellation. Optional browser storage uses the same validation boundary; unknown or corrupt stored bytes are preserved and storage denial falls back to in-memory work.

The local backup format is `iteration-planner.workspace` v1, not the Companion project schema. It must not be advertised as importable Companion authoring JSON.

## Failure and recovery

Reject invalid dates, missing references, duplicate identities, unsupported schemas, negative/non-finite estimates or capacity, unsafe URLs and inconsistent frozen records. Evaluate commands on a copy and validate the complete candidate before making it canonical, so a failed batch commits nothing.

Require confirmation for workspace replacement, reset and destructive removals. Preserve focus containment and Escape behavior in dialogs. Render user-entered content as text rather than executable markup. These single-tab safeguards do not substitute for distributed transactions, collaborative conflict resolution or native Markdown persistence.

## Acceptance and remaining decisions

The complete local package contains behavior traceability in `integration-map.json`, 38 domain tests, 20 named browser checks and detailed verification records. Those files and executable tests are not part of this draft branch. Publication does not convert local evidence into repository CI or native acceptance.

Before production integration, resolve goal/date amendments and cancellation; canonical Markdown/frontmatter fields and paths; links to Companion entities; other estimate units; configurable Definition of Done; calendar/timezone/holiday behavior; collaboration and conflicts; configurable work states; and large-backlog performance targets.

The remaining implementation must use the actual repository baseline, supported Companion model/compiler seams and pinned Vue/Pinia/Nuxt UI pipeline. Do not invent a Companion envelope or treat handwritten prototype logic as automatically regenerated application behavior.
