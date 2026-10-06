# Hindsight + Git/GitHub: integration research and decisions

> Type: explanation · Part of the [docs index](../README.md)

Research reviewed 2026-09-27. This is an engineering recommendation and implementation rationale, not a benchmark proving productivity gains.

## Decision: private working memory, reviewed shared knowledge

Use the Python embedded service as each contributor's optional working-memory backend. Use the official coding-agents integration for session recall and permitted Git ingestion. Keep repository instructions, architectural decisions, tests and reviewed Markdown authoritative. A model-generated memory is a retrieval aid, not a new policy layer.

This deliberately separates three things: the facts published through Git review; each developer's local memory/cache and permitted conversations; and a potential future authenticated team service. Giving every clone the same bank name does not synchronize their machines, establish identity or authorize sharing. This change implements the first two, not the third.

The upstream unified coding-agents package supersedes old per-agent plugins, installs native hook/MCP integrations, and supports explicit targets. It normally enables memory for every project. Its user-config `optInOnly` switch and explicit path mapping are therefore essential for a public/template repository. It intentionally does not trust repository-carried activation configuration. Our helper preserves that boundary: clone/setup/build cannot enable memory. [1]

The Python `HindsightEmbedded` class uses named profiles and the embed manager; its `url` property starts/reuses the profile, and closing a client need not stop that profile. We connect the coding plugin to this existing endpoint in self-hosted mode instead of launching a second independent daemon/data store. Reviewed Python source and published package metadata establish the selected 0.10.1 interface. This is different from the separate in-process/background-thread `HindsightServer` class. [2][3]

## Git: decisions with provenance, not a database in version control

Store small decision records under `docs/memory/decisions/`. A useful record names the problem, chosen behavior, alternatives and rationale, affected contracts, verification command/result, source PR/commit and review status. Keep a clear difference between proposed branch decisions and merged policy. An agent should verify a cited source against the current checkout before relying on it. Preserve an ADR's original rationale when superseding it; write what changed and why.

Use meaningful commit messages to capture constraints that code cannot explain. The default helper permits messages rather than full diffs, limits the initial backfill, disables source surveying and transcript retention, and keeps refresh manual. Full diffs can improve recall of past fixes, but increase volume and can expose credentials or customer information that was later removed. The upstream ingestion engine already observes Git as the agent works, so an additional `post-commit`/`post-merge` network hook would duplicate work and introduce latency, failure and conflict with existing hooks. Do not modify `core.hooksPath`, install repository hooks automatically or make a successful commit depend on a memory service. [1][4]

A canonical `github.com/owner/repository` hash, not directory basename or branch name, identifies our local bank. SSH/HTTPS and case variations normalize to the same identity; forks and identical basenames under different owners do not collide. An offline/no-GitHub-origin checkout falls back to the common Git directory. Worktrees share the logical repository while retaining their own worktree paths; Git's common-directory semantics make this a more appropriate fallback than a `.git` file path. Moving a checkout requires re-reviewing path opt-in; it must not silently broaden scope. [4]

Branch names should be source context, not the sole bank identity: branch-per-bank would lose useful cross-branch architectural memory and proliferate stale banks. But one project bank may contain unmerged experiments. Keep proposed decisions clearly labeled, carry source commits/PRs, and never infer merged status from memory alone. In this stacked change, PR #5 remains the integration base; merging or rebasing the stack does not automatically promote an experimental decision to policy. Record the final merged source when accepted.

The implemented `seed` bridge is explicit and bounded. It accepts at most 20 regular non-executable Markdown blobs, each at most 64 KiB, from HEAD under the allowlisted folder. It ignores dirty changes and rejects traversal, symlinks, invalid UTF-8, missing files and common token/private-key patterns. The token check is a guardrail, not a comprehensive secret scanner. The preview names the exact source commit, SHA-256 and stable document ID; apply requires the matching plan hash. The Python adapter validates the full batch before the first retain. Partial server failures are not disguised as atomic rollback. Repeated IDs support source replacement, but removal/supersession and cost still require deliberate handling.

Never commit pg0/PostgreSQL data, embeddings, daemon files, venvs, user path mappings, keys, raw agent transcripts or diagnostic logs. They are private/rebuildable or machine-specific and often poor merge artifacts. The repository carries instructions, optional helper source, tests and reviewed Markdown. Contributor-local snapshots belong in an appropriately protected backup, not a Git branch.

## GitHub: reviewable knowledge promotion

Use the existing PR as the review boundary. At the end of a change, an author can add a short knowledge-impact paragraph explaining which assumption changed, why the rejected alternative failed, and what test protects the new behavior. Only durable information merits a decision record; avoid copying every status update or full review thread.

`npm run memory -- pr-context --pr NUMBER` reads the canonical origin's PR through the GitHub CLI. It returns title, state, merged flag, base/head/merge identities and a source URL as explicitly **untrusted data**. It does not check out PR code, execute body text, publish a review, alter labels, copy conversation histories or retain content. A human/agent still verifies the sources, writes a sanitized Markdown record in a normal PR, and explicitly seeds the committed result. This is intentionally safer and more inspectable than treating every issue comment as shared agent memory.

Recommended sequence: begin by checking current instructions/tests, then use memory to locate previous context; during implementation retain only approved content and treat branch claims as provisional; on PR review publish durable rationale as Markdown; after merge verify the final source and refresh local memory explicitly. CI remains evidence, not a memory assertion. A recalled statement that tests passed never replaces a real test run.

Do not automatically export private conversational memory into a PR. A developer may have discussed customer details, credentials, speculative proposals or information from another task. “Summarize” does not guarantee that those details are absent. Review the exact text being committed, and use existing secret-scanning/review controls as well as this helper's narrow guardrails.

## GitHub Actions and trust boundaries

The added workflow runs dependency-free Node tests and stdlib Python adapter tests with read-only repository permissions and no Hindsight credentials. It does not install the optional products, start a daemon, call an LLM or ingest PR contents. It uses the repository's pinned checkout/setup-node actions and does not persist checkout credentials. Standard development and pull-request validation do not depend on contributor opt-in.

Do not create a privileged `pull_request_target` pipeline that checks out or executes an untrusted PR branch. GitHub documents that event's privileged context; untrusted code or script-interpolated PR text can turn a convenience integration into credential theft. Keep untrusted event text out of shell source and separate unprivileged evidence collection from privileged, approved publishing. [5][6]

A future live smoke should be manually initiated from reviewed default-branch code, use a protected environment with explicit approval, dedicated synthetic data and a separate bank, minimal permissions, an LLM spending limit and teardown. Never run it using fork-provided workflow code or a personal memory bank. A GitHub-hosted runner cannot reach a contributor's localhost; testing against a shared endpoint introduces a new authenticated service and consent decision, not a URL substitution.

A future organization-wide knowledge publisher should consume only allowlisted **merged** decision records from trusted refs. Use a bounded queue, stable source IDs/content hashes, explicit retirement, auditing and least-privilege credentials. If webhooks are introduced, verify their signatures and delivery identity, handle retries idempotently, and separate untrusted PR content from instructions. These are recommended follow-ups, not implemented webhook or cloud features in this PR.

## Shared service: defer until governance is explicit

A team server becomes useful when repeated investigations across contributors justify its operational and privacy cost. It needs authentication/authorization, project/tenant separation, retention/deletion rules, source access checks, backups, provider terms, cost ownership and a reviewed writer role. Separate curated team knowledge from personal/transient memory. A bank name is not an ACL. Read-only access to shared knowledge and tightly controlled promotion are a safer starting point than unrestricted agent writes by every fork.

The present helper intentionally refuses to silently migrate an existing cloud/authenticated configuration. Existing users can reconcile their configuration manually rather than having a repository installer replace another project's service. Automatic migration of old per-agent banks is also excluded: upstream notes that old static banks often lack enough repository attribution to split safely. [1]

## Evaluation rather than assumed benefit

Start with a small set of recurrent repository tasks: generator contract changes, a previously diagnosed CI failure, framework-boundary decisions, and an onboarding question. Compare similar memory-on and memory-off runs, varying ordering to reduce learning bias. Record whether the recalled source is current/correct, acceptance-test pass rate, repeated mistakes, review rework, total time, tokens, latency and provider cost. Count false/conflicting memories and privacy incidents as regressions.

Keep fresh-clone development and server-unavailable agent use functional without memory. Validate refusal on an unapproved sibling repository, all selected native agent wiring, restart behavior, bank/worktree identity and a two-session synthetic recall. The included offline tests establish our contracts; they are not a substitute for these live checks. Expand ingestion depth, automatic page refresh, agent targets or team sharing only after measured benefits justify them.

## Primary sources

[1] Vectorize, coding-agents installation, migration, configuration, opt-in, retention and diagnostics: https://hindsight.vectorize.io/sdks/integrations/coding-agents

[2] Vectorize Python SDK guide: https://hindsight.vectorize.io/sdks/hindsight-all ; installation/platform guidance: https://hindsight.vectorize.io/developer/installation

[3] Published Python 0.10.1 metadata: https://pypi.org/project/hindsight-all/0.10.1/ ; reviewed release source: https://github.com/vectorize-io/hindsight/blob/f8950b0c07d9e34c76493dba802bb309f0ce60fd/hindsight-all/hindsight/embedded.py ; coding package metadata: https://www.npmjs.com/package/@vectorize-io/hindsight-coding-agents/v/0.7.0

[4] Git worktree/common-directory behavior: https://git-scm.com/docs/git-worktree ; hooks: https://git-scm.com/docs/githooks

[5] GitHub, secure use of pull_request_target: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target

[6] GitHub Actions secure use reference: https://docs.github.com/en/actions/reference/security/secure-use
