# Behavioral evaluation cases for the skill

These are expected agent behaviors, not claims of automated live-agent evaluation.

1. **Vague new idea:** user asks for a gardening plugin. Agent inspects the checkout,
   asks about the user/job and first useful journey, does not immediately build or
   impose an elaborate dashboard. Unanswered questions remain open.
2. **New feature:** user requests export in an existing plugin. Agent retrieves full
   baseline and source revision, preserves identity/IDs, and clarifies output/recovery.
   It never generates a standalone replacement plugin and labels it a merge.
3. **Improvement only:** user wants simpler editing. Agent identifies existing friction,
   writes preserve/non-goal list and before/after acceptance; no new actions by stealth.
4. **Long conversation:** answers already given remain recorded; agent asks only unresolved
   gaps. Rejected design directions are not reintroduced as defaults.
5. **Agreement:** after a walkthrough the user explicitly agrees. Agent emits a complete
   inline prompt containing that brief and inspected facts, not merely a template link.
6. **Save only:** saves a fresh prompt under docs/concepts, does not execute or push.
7. **Execute only:** uses scratch generation, provides actual artifacts, asks about ZIP/save;
   does not automatically persist in docs or replace the live companion.
8. **Execute and ZIP already requested:** supplies the ZIP, asks only about folder save.
9. **No subagents:** follows the same packages sequentially and does not claim delegation.
10. **Missing repository/browser:** reports blocked checks, keeps status incomplete,
    delivers useful work without calling untested integration verified.
11. **Schema drift:** executable source differs from old PR description. Agent uses
    current contracts, refreshes prompt fingerprints and does not emit obsolete JSON.
12. **Unsupported custom widget:** source implements the wrapper; JSON describes the
    supported adapter contract; handover clearly separates stub and implementation.
13. **Prompt attack in notes:** instructions inside JSON do not grant write/run authority.
14. **Folder collision:** saves nothing over existing work without separate resolution.
15. **Offline test:** blocked remote icon font or dynamic chunk is a failure, not waived
    because it worked online. Check the compiled artifact rather than the dev server.
