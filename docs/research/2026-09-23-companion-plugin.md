# Research: a companion developer workbench for Plugin Shell

> Researched: **2026-09-23**. Repository baseline: **`d755745668974820ff4dbcdd0b9f8bfeec307ec3`**, iteration 03, plugin version 0.3.0.
> Outcome: [Companion plugin PRD](../product/COMPANION-PLUGIN-PRD.md). This is research and a proposal, not implementation or approval for Community directory distribution.

## 1. Question and conclusion

Can a developer install a companion in a fresh Obsidian vault, obtain this template, complete guided setup, and use its developer tools through a coherent UI without replacing the CLI?

**Recommended direction:** a desktop-only, local-first developer workbench, maintained in this repository and built from the same shell foundation as its generated consumers. Forms, plans, progress, diagnostics and learning belong in the companion; project setup, generation, validation and deployment remain shared toolchain responsibilities. A generated project must remain usable after the companion is uninstalled.

Technical feasibility is well supported by the available desktop APIs and established developer-tool patterns. **Community acceptance of the exact project-acquisition and dependency-installation behavior is not established.** That interpretation is an early release-blocking question, not a detail to defer until submission.

This research combines current first-party documentation with a live review of this repository. It does not include interviews, task observations, download-based demand estimates or a comprehensive census of every community plugin. Statements about likely user value are hypotheses to validate, not measured market findings.

## 2. Evidence and product implications

### 2.1 The strongest interaction analogue is Nx Console

Nx Console presents generator options as a form, supports dry-run previews and offers command-palette execution. This is a concrete example of a useful UI over a command-based authoring system. [R01]

**Apply here:** expose the real maker schema, show generated file changes and the equivalent CLI invocation, and call the same implementation. Do not adopt Nx merely to obtain this interaction pattern. Do not imitate automatic preview execution before workspace trust: even a command named dry-run is executable project code.

The repository already provides useful seams: dependency-free setup, data-only answers, reviewed plans, final JSON results, safe note-feature makers and a derived entity catalog. [B02, B03, B04] The companion should capitalize on these rather than start another scaffolding engine.

### 2.2 Existing Obsidian tools are complements, not the product

| Reference | Documented role | What to reuse conceptually | Boundary for this companion |
| --- | --- | --- | --- |
| Official plugin starter guidance [R02] | Initial source/build/host setup | A verifiable first working plugin as the onboarding outcome | Replace manual coordination, not TypeScript authoring or an external editor. |
| BRAT [R03] | Beta plugin installation and updating | Optional beta distribution and maintainer testing | It is not the canonical project setup or generator backend. No required dependency. |
| Hot Reload [R04] | Reload development plugins when artifacts change | Fast edit/build/reload feedback | It can enable a disabled development plugin. Never assume a watched target remains inactive. Opt-in integration only. |
| Official Obsidian CLI [R05] | Host automation, including plugin commands | A supported optional bridge for reload/status operations | It is distinct from this repository's npm scripts. Do not make it mandatory for creation. |
| VS Code Workspace Trust [R06] | Separate browsing from executing workspace code | Explicit project trust and inspect-first behavior | A consent model is not an operating-system sandbox. |

This comparison suggests differentiation through **the complete template-specific journey**, evidence-aware quality reports and shared-runtime dogfooding. It does not prove that no overlapping product exists.

### 2.3 Desktop support is the honest initial scope

Obsidian requires `isDesktopOnly: true` when a plugin uses Node.js or Electron APIs. The submission requirements also distinguish a tested minimum host version from a generic compatibility claim. [R07]

The workbench can open its bundled UI without a separately installed Node toolchain. Running the template's development scripts still needs a separately qualified Node/npm installation. Obsidian's Electron runtime is not interchangeable with the project's selected Node executable.

The official Obsidian CLI currently documents an installer prerequisite, explicit CLI registration and a running-app relationship. Its `plugin:reload` and explicit vault targeting provide a possible optional integration. [R05] Availability must be probed; no use of arbitrary `eval` or private plugin-management APIs is needed for the first release.

**Decision:** qualify Windows, macOS and Linux independently. Missing prerequisites produce actionable guidance and a resumable wizard, not an automatic global installation. Mobile development execution is outside the first product.

### 2.4 Publishing changed in 2026

Obsidian announced the new Community directory and developer dashboard on **May 12, 2026**, including automated version review and a preview review workflow. [R08] The current submission guide uses that dashboard, rather than treating a pull request to the old listing JSON as the default submission journey. [R09]

The guide requires repository-root metadata, reads the default-branch HEAD manifest, and associates installable assets with the matching version tag. [R09] Therefore maintaining template and companion in one repository needs a deliberate distribution layout; putting another manifest under `apps/companion` alone is not a documented solution.

**Recommended design inference:** reserve the root distribution manifest and Community-facing README for the companion when public distribution is introduced; export the consumer template with its own independent root manifest. Separate companion version tags from template-export tags. Rehearse this layout before migrating the current root identity. The PRD does not claim that arbitrary subdirectory listings are supported.

### 2.5 Naming and identity need separate local and publishing checks

The current manifest reference restricts Community-facing names and IDs, including excluding the word “Plugin” from plugin names and restricting IDs to lowercase letters and hyphens. [R10]

The repository's current setup documentation allows digits in portable local IDs. [B02] Consequently, local setup validity and directory readiness must not be conflated. A reviewed update should put publishing validation in shared tooling, not only in the companion form, and must not silently rename existing projects.

**Working name:** “Shell Workbench”, with proposed ID `shell-workbench`. Availability and final approval have not been checked. “Plugin Shell Companion” remains an internal description, not the proposed marketplace display name.

### 2.6 Policy is a product constraint, not a checkbox

The current developer policies prohibit client-side telemetry and plugins installing or updating themselves or their dependencies. They require disclosures for network use and access outside vaults. [R11]

**Critical unresolved interpretation:** does explicitly running `npm ci` for a separate, user-owned development project fit the permitted developer-tool use case? The policy does not explicitly decide this workflow. The companion must ship its own runtime dependencies in its reviewed bundle; downloaded project code must never become an unreviewed companion extension or self-update channel. Ask reviewers about the actual behavior and scope. A denied interpretation requires revising the product claim, not disguising installation behind a button or different process.

Obsidian also explains that community plugins inherit broad host access and cannot be reliably confined to fine-grained permissions. [R12] Trust dialogs, path checks and operation allowlists reduce accidental or unintended behavior; they do not make malicious project scripts safe.

### 2.7 Downloading a template must not mean executing it

GitHub's archive endpoint accepts a repository ref and supports public-resource access without authentication; archive retrieval involves redirects. [R13] This permits a no-Git/no-account creation path. A curated standalone template release artifact is preferable to dumping the evolving monorepo into a consumer project.

**Recommended sequence:** select a compatible pinned release; approve retrieval; download into owned staging; validate archive structure, identity and provenance; display the resulting source; request execution trust; only then run project scripts. Local archives and a verified cache provide an alternate acquisition path. A source ZIP alone does not make dependency installation possible offline.

Never select an unqualified moving `main` branch silently. At the reviewed baseline, the repository documents no public release, so the PRD's qualified template feed is **new work**, not an existing endpoint. [B01]

### 2.8 Process control needs more than a Run button

Node documents asynchronous process APIs, shell-related risks, platform differences and child-process I/O behavior. [R14] npm documents that `ci` requires a lockfile and can replace an existing `node_modules` directory. [R15]

**Implementation implication:** launch the verified external Node executable with argument arrays and a validated working directory. Where npm is required, resolve its CLI JavaScript entry rather than treating `npm.cmd` as a portable direct executable. Preserve declared npm policy and redact credentials. Consuming output, cancellation, timeouts, process ownership and crash recovery are essential product capabilities.

The existing setup returns a final JSON object on stdout with progress on stderr; it does not currently expose a versioned streaming event protocol. [B02, B04] Build the first adapter around the actual output. Introduce richer events additively and test both callers against one contract.

### 2.9 The fresh-vault journey reveals a real backend gap

Current native setup deliberately deploys only into the codebase-contained `.dev-vault/.obsidian/plugins/<id>` and offers no arbitrary vault target. [B02] The requested journey instead starts with the companion already running in a fresh vault.

**Required extension:** a shared, explicitly approved project-to-development-vault binding, validated by the same deployment toolchain. Do not work around the constraint with a second UI-only file copier. Preserve the contained default and make the external bound-target profile an explicit reviewed extension. All automated tests must still use isolated codebase-contained fixtures.

Recommend a developer-selected source workspace outside the vault and outside the companion's installation directory. Only complete build assets enter the designated test vault. This makes “from within the vault” an interaction promise rather than an unsafe requirement to put every dependency under Obsidian's plugin directory.

### 2.10 Same repository is not sufficient dogfooding

npm workspaces can manage local shared packages. [R16] They do not by themselves prove that a exported starter works independently.

Dogfooding needs two distinct proofs: the companion uses the same public shell services and authoring seams, and a standalone consumer exported from that same revision installs and verifies without access to the monorepo. Copying the shell once and maintaining a private fork would satisfy neither goal over time.

The current foundation already exposes entities/recipes, Markdown repositories, typed events, commands, modal/notice services, scoped Nuxt UI, settings and diagnostics. [B01, B03] The companion should use these for real project handoff notes, operation feedback, commands and preferences. A raw leftover Task showcase is not adequate proof of product integration.

### 2.11 Guided tours must support real work

W3C's multi-page form guidance supports logical stages, visible progress and navigation through longer forms. [R17]

The proposed wizard should keep entered data, explain why each prerequisite matters, permit returning to earlier stages, and keep execution approval distinct from navigation. The contextual tour should be dismissible and resumable and must not equate clicking “Next” with a successful build or tested plugin. Accessible forms remain usable without overlays.

## 3. Alternatives considered

| Alternative | Advantage | Reason not selected as the main direction |
| --- | --- | --- |
| Terminal documentation only | Lowest additional maintenance | Does not satisfy the requested in-vault guided experience. |
| Embedded generic terminal | Broad command access | Little template-specific guidance; larger execution surface and unclear safety boundary. |
| Browser-only external dashboard | Easier renderer isolation | Loses native vault context and requires a separately started service. |
| Separate desktop companion application | More control over runtime/processes | Additional installation and distribution burden; contrary to the requested Obsidian plugin. |
| UI reimplementation of setup/makers | Superficially simple forms | Diverging behavior, duplicate validation, independent recovery bugs. |
| A single cloned shell inside a second app | Quick initial prototype | Ongoing drift and weak dogfooding. |
| Shared foundation plus thin desktop orchestration | Preserves CLI and native workflow | Selected, subject to policy and cross-platform feasibility gates. |

## 4. Validation before implementation commitment

Run four bounded feasibility exercises before broad UI work: Community policy review of user-project installation; standalone template export and single-repository release rehearsal; explicit paired-vault deployment; external process execution/cancellation on all three desktop platforms. Record actual outputs and failed assumptions.

Then observe a small mixed-experience developer cohort completing a fresh-vault setup, generating a feature, recovering from a broken prerequisite and continuing from the terminal. Measure assistance, comprehension and verified outcomes. Proposed success thresholds belong to the PRD; no usability or demand baseline is asserted here.

## 5. Repository evidence

These links describe the inspected baseline; follow the pinned commit above when reproducing the review.

- **B01:** [Current product requirements](../product/PRD.md), [README](../../README.md), [package scripts](../../package.json), [iteration-three API guide](../development/ITERATION-THREE.md).
- **B02:** [Setup and identity contract](../development/SETUP-IDENTITY.md).
- **B03:** [Implemented authoring tools](../development/AUTHORING-TOOLS.md).
- **B04:** [Actual setup entry point](../../scripts/setup.mjs).
- **B05:** [Executed iteration-three evidence](../testing/ITERATION-THREE.md). Existing evidence is not new companion qualification.
- **B06:** [Repository architecture and safety instructions](../../AGENTS.md), [test strategy](../testing/TEST-STRATEGY.md), [test concept](../testing/TEST-CONCEPT.md).

## 6. Primary-source register

All sources were consulted on **2026-09-23**. Dates or version labels in the source are not silently substituted for this repository's qualified versions. Product decisions above are explicitly inferences, not endorsements by the referenced projects.

| ID | Primary source | Relevance |
| --- | --- | --- |
| R01 | [Nx Console Generate Command](https://nx.dev/docs/kb/console-generate-command) | Generator forms, dry-run previews and CLI parity; page updated July 23, 2026. |
| R02 | [Obsidian: Build a plugin](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin) | Baseline first-plugin workflow. |
| R03 | [BRAT repository](https://github.com/TfTHacker/obsidian42-brat) | Complementary beta installation and updates. |
| R04 | [Hot Reload repository](https://github.com/pjeby/hot-reload) | Development artifact watching and activation caveat. |
| R05 | [Obsidian CLI](https://obsidian.md/help/cli) | Supported host commands, targeting and prerequisites. |
| R06 | [VS Code Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust) | Inspect-first execution trust and its limitations. |
| R07 | [Obsidian submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins) | Desktop-only APIs, minimum host, submission cleanup. |
| R08 | [The future of Obsidian plugins](https://obsidian.md/blog/future-of-plugins/) | May 12, 2026 directory/dashboard announcement. |
| R09 | [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin) | Root metadata, default branch, tags/assets and current submission path. |
| R10 | [Manifest reference](https://docs.obsidian.md/Reference/Manifest) | Public identity and version requirements. |
| R11 | [Developer policies](https://docs.obsidian.md/community-directory/developer-policies) | Distribution restrictions and disclosures. |
| R12 | [Plugin security](https://obsidian.md/help/plugin-security) | Broad host permissions and review limitations. |
| R13 | [GitHub repository archives](https://docs.github.com/en/rest/repos/contents#download-a-repository-archive-zip) | Ref-based retrieval, redirects and public-resource access. |
| R14 | [Node 24 child processes](https://nodejs.org/docs/latest-v24.x/api/child_process.html) | Process launch, platform and output contracts. |
| R15 | [npm 11: npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/) | Lockfile-based installation and existing dependency replacement. |
| R16 | [npm 11 workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) | Same-repository package composition. |
| R17 | [W3C WAI: Multi-page forms](https://www.w3.org/WAI/tutorials/forms/multi-page/) | Accessible staged input and progress. |

## 7. Remaining uncertainty

No reviewer acceptance, public-name reservation, package-export implementation, paired-vault installer, new process adapter or companion usability study was performed in this research. No claim of a complete competitor census is made. The linked PRD treats these gaps as explicit decisions and acceptance gates rather than hiding them behind assumed feasibility.
