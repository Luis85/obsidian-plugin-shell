> **Framework reference — not this project's backlog or instructions; follow ./AGENTS.md**

# Generated preview scenarios — PR35 MVP continuation

## Scope

Continue IP-05/IP-08/IP-11 after the PR5 reconciliation at
`ef49ab70e0fafed1968bd5de0922ad3de49ebf04`. The base integration record (maintainer-only asset, not included)
separates the earlier tested merge checkout from the later combined source.
This increment connects existing authored visual scenarios to the generated
clickdummy. It does not introduce a second renderer, a project schema, a source
provider or an alternative native companion.

## Implemented behavior

The labelled Authored scenario selector lists only the current surface's saved
page scenarios. Their canonical IDs, names, states and layout widths are emitted
as small detached metadata. Fixture values and bindings remain in the existing
visual specifications; the preview does not duplicate or reinterpret them.
Unknown and wrong-surface choices are rejected. Pages without scenarios do not
receive invented examples.

Selection supplies the matching definition with its scenario through the existing
VisualContext. The shared runtime applies authored bindings and values, including
false, zero and empty strings. Changing scenarios resets local drafts and effects;
navigation and Reset preview clear selection. The separate Preview state selector
can override rendered state. A narrow scenario expresses layout intent, not a
physical device or accessibility qualification.

Scenario mode refuses source actions and business implementation hooks while
retaining local UI effects and navigation. The read-only mode is inherited by
nested definitions and newly opened dialogs without injecting a different page's
scenario into them. Dialogs receive a per-open mount closure and retain the same
owned teardown. Custom external adapters remain trusted implementation points;
this is not a sandbox for arbitrary consumer JavaScript. The generated browser
sources remain synthetic, and a scenario is never reported as saved business data.

The shared runtime also releases pending UI state on a scenario change. An older
async completion cannot clear a newer request's pending state or apply stale
results. This does not undo an operation that was already submitted before the
scenario switch or turn an uncertain business write into a safe retry.

## Compatibility and controls

The original product goldens, original input hashes, original registry fixture and
previous preview-host delta remain unchanged. The new scenario delta checks six
specific generated paths before reversing them to the prior verified output:
preview entry, dialog host, scenario metadata, preview context, toolbar component
and shared visual composable. It then applies the existing checked host delta and
requires all twelve original aggregate product digests. Negative controls modify
the new metadata, host and runtime bytes; the earlier layer still rejects changed
stylesheet output. This is an explicit source transition, not screenshot-baseline
acceptance or an analyzer exclusion.

## Local verification

Tools: Node 22.16.0/npm 10.9.2. The exact TypeScript 6 workspace is not installed
locally; no TypeScript 5 compiler was substituted. Seven shared-runtime checks
execute the committed test file using a local module-resolution adapter to the
repository's retained Vue 3.5.43 runtime and Node's native type stripping. This is
real Vue reactivity with controlled data/handler ports, but not installed-toolchain
or browser verification.

| Check | Observed result |
| --- | --- |
| Original compiler goldens before this increment | 15 passed |
| Compatibility, emitted scenario metadata and preview lifecycle | 28 passed; no skips/TODOs |
| Shared scenario runtime with retained Vue | 7 passed; no skips/TODOs |
| Pure compiler core, selection and documentation | 21 passed; no skips/TODOs |
| Broader compiler attempt including target checks | Failed overall: 28 passed; target test could not import the unavailable TypeScript package |
| Source limits, suite ownership and whitespace | Passed; 296 test files, 31 suites, 32 helpers |

The initial six runtime controls failed four cases against the pre-change runtime;
two existing-behavior controls passed. The original compatibility checks also
failed twelve changed-output cases before the explicit reviewed delta was added.
Those are retained negative controls, not successful qualification. Overlapping
commands are not combined into inflated totals.

## Hosted qualification and remaining work

The existing compiler qualification runs independent generation, locked install,
project verification, TypeScript checking, offline HTML build and real file-origin
browser assertions. Its browser driver now checks all Quick Capture scenarios
against the actual canonical table rows and states, local draft reset, refused
hooks, modal read-only inheritance, selection cleanup, labelled control sizing and
existing navigation/export/lifecycle behavior. The emitted-host browser driver
also checks per-open mount ownership. These added assertions are not claimed
passed until their current-head hosted run completes.

No local full browser build or TypeScript 6 check is claimed. No native, formal
accessibility, real back/forward-cache or business acceptance follows from the
local runtime tests. Modal scenarios are not independently selectable in this
increment. Useful authored sample-copy improvements, complete companion visual
fidelity, observed authoring tasks, real-host lifecycle and full native companion
acceptance remain in the MVP closure status (maintainer-only asset, not included). No release,
tag, PR merge, provider call or personal-vault deployment occurred.
