# Maintenance and release guide

> **Status:** Full implementation contract. Iteration 04 implements [maintenance discovery/configuration](MAINTENANCE-OPERATIONS.md), safe version preparation and [fixed-commit retained-asset rehearsal](RELEASE-REHEARSAL.md). The subsequent [opt-in local executor](RELEASE-EXECUTION.md) implements authenticated draft/upload/promotion operations; the privileged Actions interface and real first/subsequent public-release qualification remain open. No publication or permissions change is authorized by this document.

This guide implements the workflow intent of [PRD sections 5, 15, and 17](../product/PRD.md). [Research references R01–R35](../research/2026-09-22-template-research.md) identify the primary sources. Policy values below are chosen defaults, not vendor guarantees.

## 1. The maintenance principle

**Track current stable releases; commit and test exact versions.**

Ordinary development must install the same dependency graph. Update work deliberately changes that graph through a reviewed pull request. A lockfile is reproducibility, not a reason to leave a template frozen for years.

Maintain four related but separate records: the latest public Obsidian target, the plugin's declared minimum host version, the installed API declarations and runtime assumptions, and the development toolchain. A package update must not silently change all four.

### Initial policy

| Item | Default |
| --- | --- |
| Obsidian | Latest public desktop; independently record latest supported mobile apps. |
| Fresh template minimum | The current public desktop baseline selected and tested during initialization/qualification. |
| Historical compatibility | Not a default goal. A downstream plugin may explicitly retain a tested older floor. |
| Catalyst | Optional compatibility canary; no entitlement needed for normal development. |
| Node | Latest patched Active LTS that passes the toolchain matrix; the dated research track is Node 24. |
| npm | One supported exact toolchain selection and committed lockfile. |
| Direct dependencies | Exact stable versions, updated through PRs. |
| Installer/runtime | Record separately; installing new API declarations does not update Electron/WebView. |

The dated Obsidian public snapshot is 1.13.7 desktop, while 1.14.2 is early access. Re-resolve the official public feed during implementation and maintenance. Do not use an unrestricted highest-tag search. [R01–R04]

## 2. Default dependency updater

Use **Dependabot** for the baseline because it is integrated with the GitHub repository workflow. Deliver its configuration when executable package/workflow files exist. Do not create a permanently failing updater against a documentation-only repository.

The configuration contract is:

| Concern | Required behavior |
| --- | --- |
| Ecosystems | npm and GitHub Actions. |
| Discovery | Frequent scheduled checks, with an on-demand status path. |
| Routine release age | Explicit initial patch/minor cooldown of 3 days; major cooldown of 7 days. |
| Security updates | Not held for the routine waiting period; expedited reviewed remediation. |
| PR volume | Bounded, initially five routine version PRs; security handling remains explicit. |
| Groups | Coherent compatibility families, with independent majors visible for review. |
| Version policy | Update exact application dependencies and lockfile together; do not widen ranges as though publishing a library. |
| Automerge | Disabled initially. Optional narrow patch-only policy only after required checks and protection are verified. |
| Publishing | Never triggered merely by a dependency update. |

Dependabot's options support schedules, grouping, and cooldown configuration; its documentation separates security updates from cooldown behavior. [R23] The implemented configuration must be validated against the current schema and observed bot behavior, not assumed correct because YAML parses.

### Compatibility groups

Use separate groups for Vue/compiler/Pinia where appropriate; TypeScript/vue-tsc; Vite/plugin-vue; Vitest/coverage; ESLint/parser/Vue/Obsidian plugins; and Playwright-related tools. Do not put every development dependency in one large group. Some cross-group updates still require coordinated review when peer requirements overlap.

Keep Obsidian API updates distinct enough that their supported-host implications are visible. An API-package patch can matter to types, while a new declaration does not prove that the existing stable host implements the feature.

### Optional Renovate replacement

Renovate is a documented replacement for maintainers who need its richer package rules, release-age policies, dashboard, or lockfile maintenance. [R24] Disable the equivalent Dependabot version rules first. Keep the same verification, review, and publication boundaries regardless of the updater.

Do not add a second service merely to achieve a green update badge. The chosen updater must remain understandable to the generated repository's owner.

## 3. Freshness and compatibility review

A weekly and manually invokable status workflow should report host channels, direct dependency drift, supported Node status, relevant action pins, unresolved security findings, and blocked upgrade decisions. It does not mutate the main branch or publish.

Every row has one of these meanings:

| State | Meaning |
| --- | --- |
| Current | The checked stable candidate matches the selected version within the declared policy. |
| Cooling down | A routine candidate exists but is intentionally not yet eligible. |
| Update available | A stable eligible candidate should be reviewed. |
| Incompatible | A specific peer/runtime/test conflict prevents adoption. |
| Blocked | A named decision or environment issue prevents evaluation. |
| Source unavailable | Discovery failed; currency cannot be established. |

Record the source, checked time, selected/candidate versions, reason, owner, and next review date. Do not convert a failed registry request into “all dependencies up to date.” Direct version checks also do not replace review of vulnerable or changed transitive dependencies.

Proposed operational targets are routine-update review within seven days of eligibility and major-update assessment within fourteen days. These are maintenance objectives, not permission to skip tests when time has elapsed.

### Review a toolchain update

Run `npm ci` with the proposed lockfile, then the complete normal verification. For parser, linter, analyzer, or build changes, run the negative gate fixtures and confirm they still detect their intended defects. Inspect build contents and size, not only TypeScript success.

For host/API changes, test the latest public host and any deliberately retained minimum. Update the compatibility record, native settings checks, and declared support only when their evidence changes. Do not suppress peer conflicts with unreviewed overrides or keep an entire major permanently ignored.

## 4. Release design: two remote actions, one candidate

The default should need no npm publication account, personal access token, release-management service, or special commit-message convention.

```text
Prepare version locally
    ↓ review source/metadata
Create release draft (GitHub Actions)
    ↓ build once, test, retain assets and evidence
Accept exact candidate in Obsidian
    ↓ explicit maintainer approval
Publish release (GitHub Actions)
```

A local developer may use GitHub CLI, but the standard interface is the repository's Actions page. The default repository-scoped workflow token is sufficient where the necessary repository permissions are allowed; an organization policy may still require administration approval.

A release workflow is not automatically safe because it is automated. Its source selection, artifact identity, permissions, and retry behavior must be tested.

## 5. Prepare the release

The intended local command is:

```sh
npm run release:prepare -- --version 0.1.0
```

It must validate the version before changing files and support dry run. It updates `package.json`, relevant lockfile metadata, `manifest.json`, `versions.json`, and the changelog consistently. It shows the diff and any compatibility-floor change.

It does **not** commit, tag, push, publish, merge, submit to the directory, or alter repository security settings. The developer reviews the changes through the usual repository process.

Stable versions use the exact three-number form, and the release tag matches: `0.1.0`, not `v0.1.0`. Reject suffixes or alternate tag conventions on the normal stable path. Preserve historical `versions.json` entries and explain any change to the new version's minimum host. [R25]

The procedure must avoid a long-lived mismatch between a default-branch manifest advertising a version and the release assets available for that version. The implemented release workflow documents its metadata/publication ordering and recovery. First submission occurs only after both the committed default-branch manifest and its corresponding public release are ready.

## 6. Create the candidate draft

The maintainer selects **Create release draft**, the version, and a reviewed source commit. The workflow must resolve and record the commit; it must not silently substitute whatever branch HEAD happens to be when a later job starts.

A candidate operation must:

1. Validate version, source trust/review conditions, support metadata, and whether that version already exists.
2. Run required checks in a read-only build/test context, build the production candidate, and retain it.
3. Perform available real-host checks using those retained files and attach source/hash-bound results.
4. Create an unpublished draft and upload the complete asset set, notes, and candidate metadata.

These steps are a workflow specification. Their actual job order should avoid redundant builds while preserving independent verification of the produced artifacts.

### Candidate assets

| File | Requirement |
| --- | --- |
| `main.js` | The tested host-loadable plugin bundle. |
| `manifest.json` | Matches the source identity/version/support policy. |
| `styles.css` | The shell's compiled stylesheet. |
| Optional installable ZIP | Contains the installable plugin assets in a documented layout; convenience only. |
| Checksums/candidate metadata | Records source SHA, file SHA-256 hashes, tool/host versions, and evidence references. |
| Release notes | User-visible changes, fixes, migration considerations, compatibility changes. |

The first three are individually attached to the GitHub release. A GitHub-generated source archive is not an installable plugin distribution. Do not include fixtures, browser binaries, agent servers, source-only paths, or personal diagnostics.

GitHub CLI supports draft creation and explicit target selection. [R26] Use those concepts intentionally; do not rely on an omitted target resolving to the desired commit.

### Hash-bound acceptance

A host record contains the candidate version, source SHA, asset hashes, host application/installer/platform, performed scenarios, results, timestamp, and actor/runner. Manual records are clearly manual; they are not disguised automated reports.

Store release evidence as a candidate artifact or controlled release record, not by editing source files and then invalidating the very source SHA the evidence refers to. A later rebuild produces a new candidate unless all accepted identity requirements are demonstrably unchanged.

## 7. Native acceptance and publication

For the candidate's declared platforms, exercise plugin load, settings search/edit/reload, a complete example flow, failed writes, native modal focus/cancel, notices, command/ribbon entry, view close/reopen, and disable/re-enable. Include pop-outs and device behavior where support is claimed.

When native automation is unavailable, the maintainer downloads the candidate files into an isolated test vault and records this manual acceptance. Missing host evidence is **not run**, not a pass. The workflow must still provide a usable manual path rather than requiring one specific automation vendor.

The maintainer then selects **Publish release** for that candidate. Promotion validates required checks/approval, source/tag identity, unchanged asset hashes, and appropriate host evidence. It publishes the retained files without rebuilding them.

GitHub's token/event behavior means that a tag created with `GITHUB_TOKEN` must not be assumed to start an independent push-triggered release job. Use directly connected stages, reusable workflows, or supported explicit dispatch. [R27]

An owner may technically bypass safeguards through repository administration. Documentation must distinguish the enforced workflow from permissions a repository administrator retains; it must not promise an impossible absolute prevention guarantee.

## 8. First Community directory submission

The current documented initial submission path is the **Obsidian Community directory dashboard**, using an Obsidian account with linked GitHub ownership. It is not the older default recipe of editing a central community-plugins list through a pull request. [R25]

The generated project must include a concise submission-readiness checklist:

| Check | Expected result |
| --- | --- |
| Repository | Source is available at the declared repository. |
| Root documents | Product README, LICENSE, and accurate manifest exist. |
| Identity | Unique plugin ID, appropriate display name/description, correct repository/author information. |
| ID validation | Distributable ID does not contain `obsidian`; template naming is not copied blindly. |
| Version | Manifest version and release tag match exactly. |
| Assets | The matching public release contains individual plugin assets. |
| Compatibility | Minimum host and desktop/mobile claims match evidence. |
| Quality | Current developer/submission policy and lint expectations reviewed. |
| User guidance | Installation, basic use, support/reporting, and relevant privacy limitations are explained. |

The directory reads the manifest from the repository's default branch during submission. Ensure that committed metadata and published release are consistent before submitting. Review findings are resolved with corrected code and a new version where required. Later plugin releases and the initial listing approval are distinct workflows. [R25]

No template automation should silently create an account, connect identity, submit a listing, or claim approval on the developer's behalf.

## 9. Failure and recovery policy

| Failure | Safe result |
| --- | --- |
| Build/test failure | No public release; retained logs explain the failure. |
| Native host unavailable | Candidate can remain a draft; promotion waits for real evidence. |
| Wrong candidate hashes | Reject promotion; investigate or create a new candidate. |
| Partial asset upload | Draft stays unpublished; resume only after matching source/artifact identity. |
| Existing published version | Refuse mutation; prepare a higher version for correction. |
| Wrong existing tag | Refuse automatic movement; maintainer investigates rather than force-pushing. |
| Permission denied | Explain the minimum missing permission; do not request an unrestricted token by default. |
| Failed post-publication smoke | Notify maintainer; prepare a forward fix. Preserve public artifact integrity and user data. |
| Downgrade encounters newer data | Refuse destructive overwrite; recovery follows schema compatibility policy. |
| Directory review rejects metadata | Correct source/docs and release consistently; do not mislabel a draft as approved. |

Do not use blanket asset clobbering for published versions. Re-running a draft workflow is allowed only under documented identity checks. Release concurrency is keyed by repository/version to prevent two jobs racing to publish different assets with the same version.

## 10. Workflow security and repository setup

Use read-only permissions for builds/tests and narrowly scoped `contents: write` only for the release mutation stage. Do not run untrusted pull-request code with release privileges. Pin third-party actions by full revision and keep those pins updated. [R28]

Generated repository owners must verify Actions permissions, required checks, protected publication approval where available, dependency update settings, and template/repository identity. Configuration files do not automatically establish all administration settings.

The baseline does not require attestation infrastructure, a signing service, or immutable releases, but these may be added after the standard host installation and recovery path is proven. License notices and hashes remain required. Extra supply-chain integrations must not make a basic local plugin impossible to build offline after provisioning.

## 11. Qualification checklist for the template implementation

Before advertising easy releases, test a differently named generated repository through first draft, explicit publication, a subsequent version, and failed/retried operations. Validate exact tag spelling, source selection, release assets, built-in token permissions, missing native evidence, changed asset hashes, and published-version immutability policy.

Before advertising automatic upkeep, observe a dependency PR and a freshness run with both successful discovery and a forced network failure. Confirm that gate fixtures continue detecting their intended defects after a representative analyzer/parser update.

The documentation can define these workflows now; only those implementation tests establish that they work.
