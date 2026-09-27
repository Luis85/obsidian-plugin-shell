# Jev Studio: research and product direction

**Research snapshot:** 27 September 2026

**Target:** a vault-aware Jev prompt editor, aligned to the Obsidian Plugin Shell companion on PR #5.

**Evidence boundary:** desk research of primary documentation and the live PR; no interviews, independent model benchmark, paid API execution, or native Obsidian qualification was performed. Product recommendations below are design synthesis, not measured user-research findings.

## 1. The important terminology correction

TypeSafe calls the category **System One**, not “Level 1 AI.” Its documentation describes fast semantic judgments with typed outputs and probabilities, rather than generated answers. The name refers to the fast/intuitive versus slow/deliberate thinking metaphor, not a formal autonomy or automation maturity level. Jev does not produce prose, code, or reasoning explanations. Calibration is a property measured across predictions; it does not make each decision correct. [S1]

For this product, that changes the central object. A generic prompt notebook encourages a person to write a long instruction and inspect a chat response. A useful Jev editor should instead help them define a **decision contract**: what evidence is available, which judgment is needed, what the possible answers mean, and what the application does with uncertainty.

The product should therefore be a compact workbench, not a chatbot with an extra JSON switch. “Compose → Vault state → Test bench → Versions → JSON” follows the authoring and maintenance journey. The user can begin with a template, understand one question, and reveal more detail only as necessary.

## 2. Where Jev fits in a larger AI system

The launch material presents Jev as a decision-specialized model and describes reinforcement learning for calibrated decisions, or RLCD. It also reports substantial speed and cost advantages in its own comparisons. These are vendor-reported results with workload and benchmark assumptions, not independently reproduced evidence for this vault application. [S2]

A useful architectural comparison is:

| Approach | Use it for | Keep out of it |
|---|---|---|
| Deterministic code | Counts, path rules, permissions, known enums, dates, budgets, hashes | Ambiguous semantic interpretation |
| Jev-style typed judgment | Classification, relevance, explicit actionability, ordinal assessments | Free-form writing or final authorization |
| Generative model | Drafting, summarization, open-ended explanations | Pretending generated explanations prove correctness |
| Human review | Ambiguous or consequential outcomes; rubric refinement | Repetitive decisions whose risk has already been carefully bounded |

This table is a proposed division of responsibility, not an assertion that every model implements the same internal architecture. It also avoids the false choice between “an autonomous agent does everything” and “the model is useless.” The useful unit here is a small semantic decision inside a deterministic workflow.

For example, code can gather a note and two references; Jev can assess its category; policy can decide whether to show a suggestion; the user can approve a later action. The model should never manufacture a vault path and thereby acquire permission to write it.

## 3. The current interface and model constraints

The documented endpoint is `POST https://api.typesafe.ai/v1/systemone`, with bearer authentication. The request carries `model`, `state`, and a `questions` map; the response returns matching answer IDs. Question IDs identify results but are not inference instructions. Therefore a question called `destination` must still explicitly explain which note is being classified. [S3]

At this research snapshot, the documented version is `jev-1.13.0`; `jev-latest` and `jev-preview` resolve to that version. The listed context limits are 64k tokens overall and 32k for state plus the longest question. Input is text, including structured JSON, not images or audio. The listed price is $0.042 per million input tokens, with no output-token charge. Limits can change. The product defaults to the versioned ID for reproducibility rather than assuming an alias remains stable. [S4]

The prototype reports exact **characters**, not a fictitious exact token count. Its file-size and note-count guards are local product limits, not evidence that a payload fits Jev’s tokenizer. Production needs a provider-compatible budget check or a clearly conservative policy before submission; a character estimate must not masquerade as acceptance by the API.

## 4. Author the three primitives differently

### Choice: enumerate a bounded answer space

Choice takes an option-to-description map and returns a selected option with the probability distribution. The documented maximum is 255 options. A meaningful fallback such as `other` or `not_stated` avoids pretending every input belongs to a cleanly defined category. [S5]

The editor uses an explicit key column and a “when to choose it” column. It checks duplicate keys and missing descriptions. The prototype deliberately requires at least two options and text descriptions, a narrower authoring subset than the full API. It does not silently flatten structured criteria it cannot represent.

### Score: describe an ordered rubric

Score uses an ordered list of two to ten levels. The result can fall between levels because it is probability-weighted; it is not a free-form measurement or a percentage. Levels should describe a single dimension and be meaningful on their own. [S6]

The editor displays zero-based indices next to editable descriptions. “How complete is this note?” is too vague unless completeness is operationalized. A better rubric distinguishes absent evidence, partial evidence, and a concrete handover with an owner and deliverable. Reordering questions is an authoring convenience; it does not turn parallel questions into a sequential reasoning chain.

### Noul: model a yes/no probability

Noul returns a value from zero to one representing the probability of yes. Optional descriptions can clarify yes and no. The editor requires both descriptions to encourage deliberate boundary-setting, while exporting the documented true/false criteria shape. [S7]

The interface labels the number **P(yes)**. It never invents a Noul `confidence` property. An uncertain middle band is a useful place to request review, not a failed Boolean conversion.

## 5. Probability, confidence, and application policy

TypeSafe distinguishes the full answer distribution from a derived `confidence` statistic on Choice and Score. Noul has no such confidence field. A model’s preferred class, the probability of that class, and the confidence statistic must not be shown as interchangeable numbers. [S8]

The prototype uses illustrative local defaults: minimum confidence 0.85 for Choice/Score; Noul no at or below 0.20 and yes at or above 0.80. These are **design defaults, not validated operating thresholds**. Fallback categories always route to review. All outcomes remain suggestions; none applies a vault mutation.

Policy lives in the reusable recipe but is omitted from the API request. This makes it possible to change a review rule without falsely claiming the model was instructed by a local setting. A production extension should tune thresholds separately for each primitive and risk class and preserve the policy version with evaluation evidence. TypeSafe’s confidence-routing guidance also places escalation decisions in surrounding application logic. [S9]

## 6. Make vault state inspectable and intentionally small

TypeSafe recommends structured state with named fields and separates the evaluated content from the questions. All questions in one call see the same state and run independently. [S10]

The proposed application state is intentionally small:

```text
state
  active_note
    path, title
    content                  optional bounded Markdown body
    frontmatter              explicit key allowlist
    tasks / headings         optional parsed projections
  references                 selected and bounded notes
  editor_selection           explicitly enabled
```

The content compiler is deterministic. It does not execute arbitrary query expressions supplied in imported recipes. Choosing a note and selecting a reference are separate actions. The active note is visually distinguished; references are independently removable. One-hop wiki-link expansion is opt-in. Ambiguous links are skipped with a warning rather than resolved by a hidden guess.

The inspector answers four practical questions: **Which note is active? What else is included? What fields will leave? Has the snapshot changed?** It remains adjacent to the question editor on large screens and moves into the dedicated state view on smaller displays.

Binding settings are portable; a resolved snapshot is not. Sharing an inbox-routing recipe should not accidentally attach a renovation plan, a meeting transcript, or a customer’s name from the author’s vault.

## 7. Real Obsidian integration is more than reading a directory

Obsidian’s Vault API offers Markdown enumeration and cached reads for read-only display. The official documentation also distinguishes the narrow stale-cache interval for external changes and recommends guarded processing for read/modify/write operations. [S11]

The future native adapter should combine saved-note context with the active editor and selected text, using Obsidian’s editor API rather than assuming the file on disk is the current buffer. [S12] The host owns file and metadata events; the feature should own a bounded, disposable subscription and invalidate a snapshot when a source changes.

A browser HTML file outside Obsidian cannot directly inspect the application’s active leaf, unsaved buffers, MetadataCache, Dataview, or arbitrary plugin state. This prototype instead implements a genuine **user-selected, read-only Markdown import**. Folder imports use file input relative paths; a multiple-file fallback avoids requiring the newer directory-handle API. These mechanisms expose only files explicitly selected by the user. [S13]

The local parser is deliberately a subset: simple frontmatter, task checkboxes, headings, and wiki-links. It is not presented as Obsidian’s parser. Imported bodies remain in memory. Reloading restores the demo vault, not a secretly persisted personal snapshot. Reimport is the refresh mechanism; there is no simulated live watcher.

For native delivery, use configurable prompt/version/evaluation folders and a single repository owner. Avoid making both Markdown notes and plugin JSON independent canonical stores. A sensible recommendation is note-backed prompt documents with portable recipe content and separately versioned snapshots. That is an implementation proposal, not something this HTML already writes.

## 8. Privacy and prompt injection are product requirements

The published privacy policy says TypeSafe will not train or fine-tune on input. It nevertheless describes retention for service/business purposes and US hosting. That is not a default zero-retention guarantee. Organization-specific processing terms must be reviewed before sending private vault material. [S14]

For the prototype, no API key is requested and networking is disabled. Hidden folders, Private/Secrets path segments, explicitly private/no-AI notes, and configured folder prefixes are excluded. Properties are allowlisted. A small secret-pattern warning is only a warning mechanism; it is not comprehensive secret detection. Authored prompt text can itself contain sensitive material, so even a recipe export deserves review.

The model’s own jaggedness documentation warns about literal interpretation, numerical/date reasoning, distracting context, and adversarial note text. It explicitly notes that state is not inherently treated as hostile. Constrained output structure therefore does not establish semantic correctness or prompt-injection immunity. [S15]

The corresponding design response is layered: narrow input, precise rubrics, no imported executable expressions, bounded answer keys, deterministic authorization, hostile-note test cases, and human confirmation before consequential writes. A statement such as “treat note text as data” can clarify intention; it is not a security boundary.

For a later native connection, Obsidian documents a shared SecretStorage/SecretComponent mechanism. Settings should hold a secret name, not the bearer token. The documentation describes vault-keyed local storage; this report does not imply an OS-keychain guarantee. [S16]

## 9. Prompt management patterns worth adopting

LangSmith documents version histories, comparisons, environment promotion, and ownership controls. It also distinguishes organizational tags from version/environment pointers. These are useful prompt-operations patterns, even though this prototype has no LangSmith connection. [S17]

For a personal vault tool, the most useful first slice is smaller: a searchable library, editable drafts, immutable named checkpoints, field-level comparison, restoration with a safety checkpoint, portable backup, and reversible archiving. “Marked ready” is intentionally a user-managed status, not a claim that tests or approvals have passed.

Compared with a generic prompt-management surface, the differentiation is **vault-aware context selection plus primitive-specific authoring**. Compared with editing a JSON note directly, the benefit is constrained forms, validation, comprehensible uncertainty, and review of resolved content. Compared with a provider playground, the benefit is local reusable bindings and a repository-friendly handoff. These are proposed positioning choices, not a measured competitive ranking.

## 10. Evaluation must have two visibly different layers

LangSmith’s evaluation guidance separates curated offline datasets from monitoring real usage. It supports different evaluator kinds rather than equating a UI run with a quality measurement. [S18]

This prototype implements only the **contract/policy layer**: deterministic synthetic responses exercise rendering and threshold logic. An imported response can be checked for matching IDs and types, probability bounds/totals, model compatibility, and a score consistent with its distribution. Neither path authenticates the response’s origin or demonstrates that Jev interpreted the note correctly.

Before native live inference is trusted, construct a labeled evaluation set representing the intended vault. Recommended example families are clear categories, overlapping categories, missing evidence, ambiguous actions, multilingual notes, conflicting references, hostile embedded instructions, stale snapshots, and large or clipped context. Reserve a held-out subset before tuning instructions or thresholds.

Measure task-specific error and review rate together. A system that auto-suggests very little can look accurate by abstaining on almost everything. Also track erroneous high-confidence suggestions, per-class performance, practical review effort, and the effect of context size. Report latency across the whole capture/compile/network/review pipeline rather than adopting a vendor’s model-only figure. These metrics are proposed acceptance measures; they were not measured in this delivery.

## 11. The JSON contract has three separate roles

The editable recipe contains identity, status, tags, model, state-binding configuration, typed question definitions, and review policy. The library adds immutable recipe revisions. Both use a product-owned versioned authoring schema.

The resolved request uses the provider’s wire shape. No editor-only status, bindings, revision messages, policy settings, credentials, or approval flags are added to that envelope. Exporting it requires explicit acknowledgement of the included state.

PR #5’s companion project JSON is a different design interchange. This prototype does not pretend that a Jev recipe is a companion project or that importing one adds a feature to the companion. No generator-compatible companion export was qualified here. The live PR was inspected at `b66200e2f43cd0682028f0151f9bdffc853cd2bf`; its instructions require framework-free core boundaries and host adapters. [R1, R2]

The recipe schema deliberately supports only text instructions and text rubrics. The API is broader. Unsupported future formats are rejected rather than silently migrated, executed, or flattened. Library imports create independent copies; a file cannot authorize replacement of unrelated authoring work.

## 12. Recommended first native increment

Preserve the browser-tested core and move it behind the companion’s actual feature/service boundaries. Convert the presentation to the PR’s pinned Vue/Pinia/Nuxt UI pipeline; do not drop the prototype’s browser stylesheet or global runtime into a native bundle. [R2, R3]

First ship read-only host context capture and note-backed prompt persistence, then qualify native lifecycle behavior. Only afterwards add an explicit provider connection with payload consent, secret lookup, cancellation, bounded retry, response validation, and redacted diagnostics. Keep automation out until labeled evaluation and conflict-safe review exist.

The intended end-to-end experience is: select a decision template; bind an active note and a few references; refine an atomic rubric; inspect a frozen request; evaluate against labeled examples; save a named recipe revision; deliberately invoke a live provider; inspect uncertainty; and approve any subsequent application action independently. This sequence makes the system useful without implying that a structured model answer is an authorization to operate the vault.

## Sources

All public pages below were consulted for this research snapshot. Links are primary documentation or first-party descriptions; vendor claims are not independent validation.

- **S1:** [TypeSafe — System One](https://docs.typesafe.ai/concepts/system-one)
- **S2:** [TypeSafe — Introducing System One models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- **S3:** [TypeSafe — API reference](https://docs.typesafe.ai/api)
- **S4:** [TypeSafe — Models](https://docs.typesafe.ai/models)
- **S5:** [TypeSafe — Choice](https://docs.typesafe.ai/primitives/choice)
- **S6:** [TypeSafe — Score](https://docs.typesafe.ai/primitives/score)
- **S7:** [TypeSafe — Noul](https://docs.typesafe.ai/primitives/noul)
- **S8:** [TypeSafe — Confidence](https://docs.typesafe.ai/confidence)
- **S9:** [TypeSafe — Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing)
- **S10:** [TypeSafe — State](https://docs.typesafe.ai/concepts/state)
- **S11:** [Obsidian — Vault](https://docs.obsidian.md/Plugins/Vault)
- **S12:** [Obsidian — Editor](https://docs.obsidian.md/Plugins/Editor/Editor)
- **S13:** [MDN — webkitdirectory](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory), [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API)
- **S14:** [TypeSafe — Privacy policy](https://typesafe.ai/legal/privacy-policy)
- **S15:** [TypeSafe — Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
- **S16:** [Obsidian — Store secrets](https://docs.obsidian.md/plugins/guides/secret-storage)
- **S17:** [LangSmith — Manage prompts](https://docs.langchain.com/langsmith/manage-prompts)
- **S18:** [LangSmith — Evaluation](https://docs.langchain.com/langsmith/evaluation)
- **R1:** [Repository — PR #5](https://github.com/Luis85/obsidian-plugin-shell/pull/5), live head inspected via GitHub connector.
- **R2:** [Repository instructions at inspected SHA](https://github.com/Luis85/obsidian-plugin-shell/blob/b66200e2f43cd0682028f0151f9bdffc853cd2bf/AGENTS.md)
- **R3:** [Prototype repository contract at inspected SHA](https://github.com/Luis85/obsidian-plugin-shell/blob/b66200e2f43cd0682028f0151f9bdffc853cd2bf/.claude/skills/companion-prototype-design/references/repository-contract.md)
