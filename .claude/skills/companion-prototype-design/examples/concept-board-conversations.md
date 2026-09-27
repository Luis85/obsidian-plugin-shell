# Concept-board conversation evaluation scenarios

These are expected conversational outcomes, not claims of automated live-agent evaluation.
The static contract tests check instructions; image quality and live routing need actual
Claude/Codex sessions with the relevant image tools.

1. **Offer after brainstorming.** A coherent feature brief exists. Before the final
   prompt, the agent offers generated UX/UI/interaction boards or direct continuation.
   No implementation or image generation occurs before the corresponding choice.
2. **Accept and explore.** The user chooses boards. An available image tool is called
   for 2–3 meaningfully different directions; actual images and revision identifiers
   appear. Tool-specific turn rules are respected; prompts alone are not called images.
3. **Iterate selectively.** The user keeps A's hierarchy but changes its action area.
   Accepted parts are retained, a new revision is generated, and feedback is recorded.
   The agent does not produce the final prompt while the user is still iterating.
4. **Combine and reconcile.** The user chooses A's outline and B's inspector. Conflicting
   selection/focus rules are resolved and the combined direction is reviewed, not treated
   as two contradictory approved designs.
5. **Skip or proceed.** The user explicitly skips images or asks for the agreed design's
   prototype prompt. The choice is honored without another board pitch or duplicate
   agreement. The complete inline prompt is still delivered; execution is separate.
6. **Unavailable or failed tool.** No image tool exists, or generation fails. The agent
   discloses this, offers an image prompt or direct continuation, and claims no images.
   It does not install providers, fake a tool result, or introduce an image CLI command.
7. **Fresh session and missing image.** A selected board is referenced from another
   session. The handoff contains full textual decisions and actual portable references;
   essential missing bytes are requested, not replaced with an invented image ID/hash.
8. **Changed scope and boundaries.** Visual exploration changes a key journey. The brief
   and agreement reopen; the stale final prompt is invalidated. Codex uses the same
   canonical workflow. A board choice does not trigger saving, building, pushing or
   live import, and an editor-only brief never silently gains an app shell.
