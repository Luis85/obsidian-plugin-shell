# Brainstorm the idea

A brainstorm turns a loose idea into a written problem framing before anything is designed. Pick the route
that matches your situation.

## A. A new idea, no project yet: brainstorm with Claude Code

Ask Claude Code to run the `ideation-brainstorm` skill (`.claude/skills/ideation-brainstorm/SKILL.md`), or
`ideation-journey` (`.claude/skills/ideation-journey/SKILL.md`), which detects where you are and recommends the next
skill. The skill asks rounds of questions about the problem, users, options, risks and non-goals, drafts a PRD in
the chat and writes `docs/prds/<id>.md` (the folder is `paths.prds`) only after your explicit yes.

`node bin/app settings show --json` shows the configured folders.

## B. A new feature for a saved project: the brainstorm wizard

`node bin/app brainstorm` asks eight sections: name, purpose, actors and entities, screens, interactions,
acceptance, what to prepare and what to verify. It needs a saved project model (`design/project.json`);
without one, `brainstorm context` fails with `BRAINSTORM_PROJECT_REQUIRED`, and project brainstorming is
planned, not available. Read [[docs/user-manual/shell-cli/brainstorm#TUI workflow|the brainstorm workflow]].

Agents use the same validated JSON contract: [[docs/user-manual/shell-cli/brainstorm#CLI and AI-agent parity|CLI and AI-agent parity]].
The approved package lands in `brainstorms/<slug>/` with `feature.definition.json`, `candidate.project.json`
and a README. The saved project is not changed; importing the concept is a separate reviewed step
([[docs/development/CONCEPT-INTAKE#Inspect, review, apply, generate|concept intake]]).

## Record where your brainstorm landed

Enter the project-relative path of the file that records the result, for example `docs/prds/reading-log.md`
or `brainstorms/reading-log/feature.definition.json`. This step checks that the file exists. Keep your answers
at hand: the prototype maker in the next step asks for the problem, audience, pages and acceptance again.
