# Design interview playbook

## Conversational loop

First restate what is already known, including explicit exclusions. Identify mode,
the desired outcome and the highest-risk unknowns. Ask 3–5 connected questions, wait,
summarize decisions, show a concrete scenario and continue. Never ask the user to
choose a dependency version that the checkout already fixes. Never repeatedly ask
whether they want Vue, Pinia, Nuxt UI, sources or import JSON: these are requirements.

Use short alternative descriptions when answers are hard: “Should saving close the
modal and select the new record, or keep it open for another entry?” Explain the
tradeoff. Propose defaults, but mark them proposed until accepted. A skipped question
stays open unless the user accepts a stated bounded assumption. “You decide” authorizes
you to propose a design, then seek agreement on the coherent result, not invent history.

Do not ask every question below. Resolve every relevant **decision** below by reading,
conversation, a demonstrated example, or explicit acceptance of a proposal.

## Coverage map

| Dimension | Decisions to resolve | Observable output |
| --- | --- | --- |
| Context and value | Who uses it, when, pain, expected improvement, constraints | Persona/job, outcome, success signal |
| Baseline | Existing plugin/feature, export, code revision, what works already | Baseline identity/hash, preserve list |
| Scope | Smallest complete experience, must/optional/not now, forbidden changes | In/out list and priorities |
| IA and entry | Ribbon/command/view/modal/settings, start point, parent/sibling paths, back | Surface map and entry/exit rules |
| Journeys | Happy path, repeated use, interruption, alternative and recovery | Numbered scenario walkthroughs |
| Page composition | Information hierarchy, primary action, panels, selection, density | Surface contract and layout |
| Components | Reuse vs instance, props, emits, slots, variants, ownership | Component inventory and contracts |
| Data | Entities, fields, relationships, source shapes, synthetic examples | Data dictionary and fixture sets |
| Rules | Validation, defaults, permissions, ordering, filters, duplicate handling | Decision table and negative cases |
| State | Default, loading, empty, error, disabled, dirty, saved, success | State/action/result table |
| Interaction | Click, keys, pointer/touch, focus, drag alternatives, undo/cancel | Interaction contract |
| Durability | What save means, transient vs canonical, reset, import/export, conflict | Persistence/simulation boundaries |
| Visual language | References, density, hierarchy, colors/tokens, light/dark, motion | Selected direction and token intent |
| Host/responsive | Desktop/narrow, pane size, mobile constraints, no extra shell | Width/host behavior contracts |
| Accessibility | Labels, names, focus return, keyboard, contrast, reduced motion | Concrete acceptance checks |
| Fidelity | What really works, simulated services, placeholders, integration gaps | Capability truth table |
| Delivery | Review journeys, artifact locations, source seams, required evidence | Definition of done |

Keep mobile readiness scoped: a viewport emulation is not proof of Obsidian mobile
compatibility, physical touch or screen-reader acceptance.

## Mode-specific rounds

**New plugin.** Clarify plugin identity, primary job, minimum coherent domain, essential
entry points and settings, first-run experience, empty-to-useful path, and daily repeat
journey. Decide whether a relevant starter helps; do not smuggle its domain into the
new concept. No accounts, AI, cloud or synchronization by default.

**New feature.** Read the existing design, find the extension point, identify surfaces,
commands, data and shared components changed, and trace affected users. Decide when
the feature is available and how it interoperates with old data. Preserve existing
IDs and explain any necessary migrations. Include regression scenarios outside the
new flow.

**Improvement.** Capture a reproducible problem and baseline experience first. Separate
visual polish, interaction redesign, performance and behavior changes. Specify what
must stay unchanged. Walk the before/after journey; define a way to judge whether the
new version solves the named problem. Avoid expanding scope while calling it polish.

## A useful state/action row

`AC-07 | Edit record | dirty form | press Escape | ask to discard; Cancel retains draft;
Discard closes and returns focus to originating row | no canonical write before Save`

Each visible action needs a named result. Disabled controls need an understandable
reason. Destructive actions need recovery/confirmation appropriate to risk. Navigation
must not strand the user. Use deterministic error and delay scenarios rather than
random failures. Distinguish simulated successful writes from real vault writes.

## Visual exploration checkpoint

After a coherent brainstorming recap, offer optional image-based concept boards before
the final agreement and prototype prompt. Follow `references/concept-boards.md` relative
to the canonical skill directory. Honor an explicit skip or prior request without
repeating the offer. Each visual iteration updates the same brief and decision log;
selecting or combining boards does not automatically execute or save the prototype.

## Readiness gate

Before agreement, every mandatory category is resolved, not applicable with a reason,
or an explicitly accepted bounded assumption. There are no contradictory entry/exit
rules, unnamed core actions, unclear saves, missing baseline dependencies, or hidden
native promises. The user has walked the primary journey and one significant failure.

Keep a table: decision ID, question, current answer, source (user/repo/research/proposal),
status, impacts. When a new answer contradicts an earlier one, show the conflict and
resolve it; do not quietly overwrite either. Give a compact recap after a long pause.
