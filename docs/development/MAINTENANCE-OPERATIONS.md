# Maintenance operations

The executable implementation is discovery and reviewed updates. It does not
certify every discovered candidate as compatible or mutate dependency versions.

Run `npm run maintenance:status` for a current report. It writes JSON and Markdown
under `reports/maintenance/`; the weekly/manual **Maintenance status** workflow
retains these even when a discovery fails. Every row records the source, timestamp,
selected/candidate versions, state, reason, owner and next review date. The JSON
also records candidate engines/peers and cooldown eligibility. A failed request,
invalid response, timeout or rate limit produces `source-unavailable` and a failing
process, not a current badge. Fixtures exercise both live-source shapes and forced
network errors; live checks still depend on upstream availability.

Discovery reads npm's stable `latest` dist-tag, Obsidian's public desktop feed and
separate installer release, Node's release schedule/index for the latest patched
Active LTS, and GitHub releases for the exact action pins actually used. The public
desktop feed's beta is recorded separately. The selected desktop value is the
declared minimum; discovery never raises it. Mobile is explicitly blocked pending
device/store qualification. The separate all-category audit is current only if a
passed local result is less than 24 hours old. Run `npm run check:security` for that
live audit; the scheduled discovery does not install packages or silently claim
that security was checked. Static compatibility decisions remain explicit rows.

`.github/dependabot.yml` configures daily npm and weekly Actions proposals, at most
five routine PRs per ecosystem, exact-version updates, and 3-day patch/minor and
7-day major npm cooldowns. Related Vue, TypeScript, Vite, Vitest, lint and Playwright
minor/patch updates are grouped; majors and Obsidian API remain visible separately.
The Actions cooldown is three days. Security updates bypass version cooldowns;
repository owners must enable/verify security update settings. No automerge rule,
publication trigger or broad permanent major ignore is configured.

GitHub's [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
and [security update documentation](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)
were reviewed on 2026-09-23. YAML/schema checks do not prove that GitHub has activated
the updater. Observe its first real version/security PR after merge and record the
run before advertising automatic upkeep.

For an update, review current engine/peer constraints, exact lockfile changes and
source hash guards. Run strict `npm ci`, complete verification and the negative
checker fixtures, then browser/native tests relevant to changed host/style code.
The [full contract](MAINTENANCE-AND-RELEASE.md) retains review objectives and all
future release requirements. The [ESLint support exception](ITERATION-TWO-DEPENDENCY-EXCEPTION.md)
is open even when discovery reports the root linter current and an audit passes.
