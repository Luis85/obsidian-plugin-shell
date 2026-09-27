# Optional concept-board exploration

## Placement and choices

Brainstorm enough to establish a working brief, outcome, key journey, scope, host and
constraints. Then offer image-based UX/UI/interaction exploration before final agreement
and before drafting the prototype prompt. Do not wait for a completely frozen visual
design: boards exist to help resolve it. Do not restart product discovery unnecessarily.

Ask whether to generate boards or proceed directly to the prototype prompt. The offer
is mandatory unless the user already chose a route; image generation itself is optional.
An explicit skip records `skipped` and goes to the agreement/prompt path. Do not keep
selling the optional stage or create an empty deliverable. A skip is not a missing
requirement. Resume an unfinished exploration from its latest recap, not a fresh offer.
An already approved execution prompt starts execution; do not insert another board gate.

## Generate actual images

Use the image-generation capability actually available in the current agent session.
Respect its invocation, approval, privacy and response rules. Do not invent a shell-cli
image command, install another provider, launch Claude from Codex, or use a hidden API
key. No provider-specific workflow is forked into the Codex adapter. Image tools are
for visual exploration; the shell's existing tools still own source/build/import work.

Use `assets/templates/concept-board.md` as a prompt and review-record construction aid.
Fully expand the generation prompt from the working brief. Default to 2–3 genuinely
distinct directions, or the number/specific direction the user requested. Do not show
only color variations or generic dashboards. Name the decision each direction tests,
such as information density, navigation, direct manipulation or staged task completion.
Keep the same user task and representative synthetic data so comparisons are useful.

Each board should show a legible primary screen, enough context to understand hierarchy,
a short interaction sequence and a meaningful state/recovery or narrow-layout variation.
Keep annotated interaction details in companion text when an image cannot render them
reliably. Use the user's vocabulary, real Nuxt UI component vocabulary, Obsidian host
boundaries and known design tokens. An editor-only brief must not gain an application
shell. Do not invent accounts, AI or business functionality to decorate a board.

Call the real tool and present its image outputs. Text descriptions, image prompts,
stock imagery and unrendered files are not generated concept-board images. Where the
host ends the response after image generation, let the images stand and collect review
on the next user turn; never violate host rules to force a follow-up into that turn.

If no image tool is available, disclose `unavailable`; if a call fails, record `failed`.
Offer detailed image-generation prompts for a capable session or continuing without
images. Follow the user's choice, without a silent downgrade from images to prose.
No tool attempt/result may be reported as successful without an actual returned image.
Before editing an existing board, verify that the image is actually available in the
current session. Ask for the missing image or generate a clearly labeled new candidate;
never pretend a prior opaque image ID is an editable reference.

## Iterate without losing decisions

Label candidates and revisions consistently, for example `CB-01-r01`, `CB-02-r01`.
Record the brief version, hypothesis, generation prompt, actual image reference, status,
tradeoffs and unresolved questions. Do not overwrite earlier candidate images/records.
Reference paths are portable, for example `concept-boards/CB-01-r01.png`; a path or hash
is recorded as available only after the image bytes exist. Keep unavailable provenance
as a stated limitation, not a guessed link or invented checksum.

At review, ask one routing question: iterate on a board, select a direction, combine
specified elements, or proceed to the prototype prompt? Ask only a few focused follow-up
questions about hierarchy, findability, input speed, feedback, focus and recovery.
Record **keep / change / reject** decisions per board/revision. On iteration, retain
accepted parts and generate revised images for the changed design. There is no fixed
round limit, but do not force another round once the user chooses to proceed.

For a combination such as "A's outline and B's inspector", specify which parts survive
and reconcile conflicting navigation, selection, spacing and state behavior. A combined
direction is a new candidate until the user accepts it; conflicting boards do not jointly
become an implementation contract. Rejected and superseded designs remain history only.
A substantial scope or interaction change reopens the affected questions and agreement.
Returning later to boards invalidates an older final prompt when its design has changed.

## Turn selection into an implementation contract

Update the design brief, not a second product specification. Capture selected exact
revisions or explicit skip/fallback, acceptance status and the updated visual direction.
Translate images into measurable textual rules: page regions and hierarchy; component
contracts; density/spacing/token intent; primary and secondary actions; state/action/result
transitions; error/empty/loading/disabled states; keyboard/focus and drag alternatives;
responsive layouts, light/dark behavior and motion constraints. Map custom visuals to
real generator capabilities or explicit source-owned seams. No image is compilation,
accessibility, interaction, import compatibility or business acceptance evidence.

Walk the consolidated brief back to the user and resolve remaining blocking questions.
Board selection alone is not full-brief agreement, implementation execution, repository
persistence, commit/push, live companion import or permission to disclose private data.
An explicit "proceed with this agreed design to the prototype prompt" can satisfy the
agreement and routing choice together; do not ask for the same approval twice.

## Fresh-session handoff and existing tools

The final inline prompt must describe all accepted UX/UI/interaction decisions in text,
identify selected IDs/revisions, preserve before/after constraints, and exclude rejected
alternatives. Supply authorized image attachments or portable file paths and retrieval
instructions. Include SHA-256 only for bytes actually inspected. Never depend only on
"the board above", earlier chat history, or transient provider image IDs. When a missing
image is essential, arrange access; otherwise the complete textual contract can stand.
Approved textual decisions supersede artifacts; clarify material discrepancies.

Keep optional images, prompts and review history under `concept-boards/` in the prototype
package when authorized and available. Do not make this folder mandatory after a skip.
Keep a Markdown review record using the template; do not create a new JSON importer or
add image approvals/history to the closed companion envelope. Reference boards are not
runtime UI assets unless explicitly selected as such in the product brief.

Reuse the current ZIP scanner and guarded concept-save planner for final package saving.
Do not run the completed-prototype packer on an unfinished board-only folder, fabricate
missing prototype artifacts, or authorize a docs/concepts save by accepting image creation.
An explicitly requested board-only save uses approved file writes to a fresh path and
retains separate authority; no overwrite, commit or push follows implicitly.

Conversation evaluation scenarios: `examples/concept-board-conversations.md`.
