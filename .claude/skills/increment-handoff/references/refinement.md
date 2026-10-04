# Refinement session: question bank

Use this when `node scripts/delivery/ready.mjs --handoff docs/increments/<slug>.md` exits 1. The report lists each failing rule with a hint and a refinement brief (questions per failed rule and a suggested skill). Start from that brief; the questions below fill gaps and keep rounds concrete. Rule identifiers come from the report, never from this page.

## How to run a round

1. Group the failures by section and order them: open questions and scope first, then acceptance criteria, then test plan, docs and changelog.
2. Ask 3–5 related questions per round with the AskUserQuestion tool (or a numbered list), each with two to four concrete options drawn from the source and the repository, plus room for the user's own answer.
3. Summarize the answers, show the exact section edits, save them on approval and rerun the check. Change only the sections the answers affect.
4. Record decisions separately from your proposals and assumptions. Never answer a question for the user.
5. After three rounds without a new passing rule, stop and report what blocks readiness.

## Questions per typical failure

### Placeholders left in place (`TBD`, `TODO`, `<...>`, template prompts)

- "Section <name> still says '<text>'. What is the actual value?" Offer the candidates you can read from the source (PRD, PBI, task) and the repository.
- "If this is not known yet, is it an open question that blocks the start, or can the increment proceed without it?"

### Out of scope missing or empty

- "Which nearby things could a reader assume are included? For example generated projects, other operating systems, migration of existing data, documentation translations."
- "Is anything from the source PRD or PBI deliberately deferred to a later increment?"
- "Which owner settings or follow-up pull requests are needed but not part of this one?"

### Acceptance criteria missing, untestable or over budget

- "What does a user or maintainer observe when this works? Name the condition and the result."
- "Where will the evidence for AC-<n> live: a test file, a doc page or another repository path?"
- "AC-<n> says '<vague word>'. Which threshold or exact behavior makes it pass or fail?"
- "AC-<n> covers several behaviors. Which ones should become separate criteria, and which belong in another increment?"

### Open questions not resolved

- For each open question: "Can we decide this now? Options: <a>, <b>, or defer it as out of scope."
- "Who owns the answer if it cannot be decided here? Until then the increment is not ready."

### Test plan names unknown suites or gates

- "The suites in `tests/suites.json` are <list>. Which ones exercise the affected areas?"
- "`node bin/app check --plan --base origin/main` selects <gates>. Should the plan name all of them?"
- "Which new test file proves each acceptance criterion, named by behavior?"
- "If no test changes, what is the reason, and does a reviewer accept it?"

### Affected areas or refs that do not resolve

- "Path <path> does not exist. Is it a new file (under which root) or a typo of <candidate>?"
- "Ref <ref> does not resolve. Which PRD, PBI, task or issue is the source?"

### Docs impact without a Diataxis type

- "Which page changes, and is it a tutorial, how-to guide, reference or explanation?"
- "Is a new page needed, and where does it belong in `docs/README.md`?"
- "If no docs change, what is the reason (for example internal refactor, test-only)?"

### Changelog line invalid or missing

- "Is the change user-facing? If yes: Added, Changed, Deprecated, Removed, Fixed or Security, and one sentence for the reader of the release notes."
- "If not, what is the reason for 'None'?"

### Size budget exceeded

- "The handoff has <n> criteria and <m> affected areas, above the <size> budget. Which outcome can ship first on its own?"
- "Which criteria form a second, independent increment? Each split gets its own slug and handoff."
- "Is there a smaller first step that proves the riskiest part?"

## When to escalate instead

- The outcome, the users or the problem keep changing between rounds: `ideation-brainstorm` to back-fill or revise a PRD.
- Screens, entities, commands or criteria cannot be stated without design work: `ideation-concept` (and later `ideation-design`).
- The increment depends on an owner decision (a required check, a policy, a threshold): record it under Dependencies and stop; do not decide it here.
