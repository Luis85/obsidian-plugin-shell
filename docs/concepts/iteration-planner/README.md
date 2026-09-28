# Iteration Planner — draft concept

**Publication is incomplete. This branch contains concept documentation only, not the runnable clickdummy.**

The owner requested an Iteration Planner feature prototype under `docs/concepts` and then explicitly requested another attempt at opening a pull request. This documentation-only draft is stacked on PR #5, branch `docs/companion-plugin-prd`, inspected at `8942680c6d29700c4f3440da447c14a767e78472`.

## Concept

Help an agile team plan a useful step, walk its iteration backlog daily, review what became usable, and improve its next iteration. The intended cadence is Monday planning, daily backlog walkthroughs, iteration review and retrospective.

The concept includes arbitrary backlogs; automatically indexed, goal-named iterations; descriptions and dates; people/capacity/reference resources; selected work and an agreed planning baseline; one increment report per iteration; and an approachable progress dashboard. Delivered work is distinguished from unfinished progress. Closing an iteration neither marks unfinished items Done nor automatically carries them forward.

Read [the design brief](design-brief.md) for requirements, proposed defaults, journeys and open decisions. Read [the publication record](PUBLICATION.md) for the exact upload blocker, available local artifacts and verification boundaries.

## What is and is not on this branch

This directory currently contains this README, the design brief and the publication record. The complete HTML, TypeScript sources, build scripts, tests, evidence and screenshots remain in the previously delivered `iteration-planner-concept.zip`. They are **not** present in this draft PR. No build command in this repository is claimed to produce the missing concept artifact.

The GitHub branch and initial object writes succeeded during the retry. A subsequent prototype-source upload was blocked twice with an OpenAI safety-status error, including one unchanged retry. The final commit therefore intentionally excludes the incomplete source tree instead of introducing broken imports, a non-working build or a README linking to an absent HTML file.

## Qualification boundary

The saved local prototype is a TypeScript/native-browser interaction implementation. It is **not** the Vue 3/Pinia/Nuxt UI package prescribed by PR5's canonical prototype skill. Actual Companion project JSON, importer/compiler qualification, native Obsidian integration and the repository's full quality gates remain outstanding. Opening this draft PR does not change those limitations or represent production feature acceptance.

No production code, current Companion project, schema, dependency, workflow, quality threshold, vault, release or PR5 branch is changed by this documentation addition. Keep the pull request in draft until its intended artifact transfer is completed and verified.
