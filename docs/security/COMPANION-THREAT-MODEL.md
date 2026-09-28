# Companion and developer-kit trust boundaries

Scope: imported project/concept data, trusted developer tools, generated consumers, native storage, optional memory and decision-workbench outputs. This is an implementation threat model and test map, not a penetration test, formal certification or permission to deploy to a personal vault.

## Assets and actors

Protect authored designs, stable IDs and revisions, handwritten code, vault notes/frontmatter, plugin preferences, credentials, release authority and the integrity of reported evidence. Treat imported JSON/HTML, dependency declarations, raw provider responses, edited archives, old plans and arbitrary diagnostic text as untrusted data. Local users/agents may propose changes; permission to read a project does not imply permission to execute its scripts, install packages, mutate a vault or publish a release.

The ordinary flow is data import → shared bounded validation → canonical design → pure compilation → reviewed artifact plan → ownership-aware writer. Build/install and native operations are distinct capabilities. Browser concepts and clickdummies have no authority to cross those boundaries merely because they display a button or include an executable-looking field.

| Threat | Existing or added control | Evidence and remaining work |
| --- | --- | --- |
| Executable HTML or hostile object shape presented as a project | Recognized inert carriers only, bounded UTF-8 input, versioned closed contracts, prototype/accessor rejection; no DOM-to-application inference | Concept input and authoring negative tests. Browser preview still must stay isolated from native/process APIs. |
| Rebinding IDs, modifying published revisions, silently deleting references | Canonical reference validation, immutable pins, explicit reviewed change sets and impact checks | Concept/visual/sitemap tests. Keep real multi-leaf/native write acceptance separate. |
| Replaying stale plans or overwriting edited consumer source | Source/preimage-bound plans, exact ownership and containment, guarded apply and conflict refusal | Scoped writer tests include excluded-file concurrent edits and byte preservation. A checksum is not a signature or permission. |
| Linked paths redirecting writes | Shared safe planner rejects links/unsafe ancestors and stale path state | Production checks unchanged. Temporary test paths use their actual canonical spelling; that is not a production bypass. |
| Imported dependency declarations executing code | Pure compiler returns declarations/readiness; install remains explicit trusted-code execution | Declared packages and lifecycle policies require review. Audit results do not prove supply-chain authenticity. |
| Cancellation/late async effects resurrecting disposed views | Scoped capabilities, existing session/disposal guards, save-outcome distinction | Real native open/close/external-edit and host timing acceptance still required. |
| A successful-looking report concealing missing evidence | Separate compilation, installation, browser/native/manual and release receipts; failures/skips remain visible | Measurement tool keeps cold/warmup/all samples and refuses invalid or cancelled series; it never asserts UI/native qualification. |
| Disclosure through diagnostics, paths, authored literals or provider traces | New `support report` projects only approved counts/flags/codes/versions and refuses raw failures | Executable tests include private canaries, getters, malformed metadata and unknown codes. Other export formats remain potentially sensitive. |
| Local memory mistaken for a protected service | Optional installation and explicit provider/client configuration; existing allowlists and review | Loopback and bank IDs are not authentication. Real SDK/provider, worktree, desktop and uninstall/data-retention acceptance remain open. |
| Jev decision or emitted event used as ambient execution authority | Offline bounded simulation stays separate from live native/process dispatch | Any future bridge needs response validation, capability approval, idempotency/cancellation, durable event policy and human-review rules. |
| Publication from an implementation or `--yes` request | Separate candidate digest, remote preflight and explicit release authorization | Authenticated disposable-repository rehearsal and actual shipment are not performed by this increment. |

## Data disclosure and retention

The support report does not include project names, IDs, paths, raw content, hashes, causes or arbitrary messages and performs no network call. Framework/version and platform metadata still identify an environment; review before sharing. A measurement report intentionally includes the input fingerprint, raw timing samples and non-isolated heap observations. Canonical JSON, debug IR, raw recovery files and resolved AI requests may include confidential content; share synthetic minimal reproductions instead where possible.

The tools do not silently delete original files, replace uncertain state or redact the user's canonical source. Cleanup must remove only unchanged receipt-owned test artifacts. Private data must not be placed in committed evidence, generated screenshots or remotely retained CI fixtures. A reviewed source archive is not authorization to run every script inside it.

## Residual risk and closure

A local hostile process can tamper with files outside this application's in-process guarantees. The host does not supply a universal cross-process transaction across notes, plugin data, generation and releases. Preserve uncertain outcomes and independently verify durable state rather than asserting rollback succeeded. Browser storage and simulated fixture services do not establish native guarantees.

Before release, run current-head hostile-input/ownership/diagnostic regressions, actual native multi-leaf and external-edit tests, approved provider/client acceptance, dependency/license review, accessibility protocols and explicitly authorized release recovery tests. Verify distribution-policy disclosures for the actual product lane. This document adds no background telemetry, remote endpoint, credential access, automatic retry, broad filesystem permission or security-setting changes.
