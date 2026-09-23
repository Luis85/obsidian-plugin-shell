# Maintainability measurement

`npm run check:maintainability` measures the entire current source tree with the
qualified Fallow 3.28.0 CLI. It never rewrites application source. Reports and the
unaltered JSON/stderr of each tool invocation go to a new timestamped directory
under `reports/maintainability`. Run
`node scripts/quality/check-maintainability.mjs --check REPORT_DIRECTORY` to
validate a retained result against current source and installed tool identities.
Report commands are descriptive data; the checker never executes them.

## Blocking production policy

Every `src` JavaScript, TypeScript and Vue input is production, including newly
generated and subsequently edited consumer features. There is no changed-file
filter, baseline, per-function waiver or directory suppression. Maximum per-function
cyclomatic complexity is **10** and cognitive complexity **15**. Production
duplication must be **at most 3%**, with clone minimums **50 tokens and 5 lines**,
at least two occurrences, and Fallow's `mild` mode. These retain the proposed
QLT-05/12 targets instead of adjusting the numbers to the existing hotspots.

The gate selects functions by the actual cyclomatic/cognitive values. Fallow also
reports estimated CRAP and function length findings; those are preserved in raw
output but are not this policy's complexity thresholds. The CLI can exit 1 for
those additional findings, so a valid complete report and its actual numeric
measurements determine this gate. A tool crash, unknown schema or invalid JSON
never counts as a measurement. The independent zero-finding `check:analyzer`,
architecture, source-line and coverage checks retain their own rules.

Fallow parses Vue scripts and also emits `<template>` aggregate render metrics.
These markup aggregates are listed separately as `templateFindings`; they are
not JavaScript functions and are not qualified against a per-function ceiling.
The Vue parser records each real template's source range. A template-named finding
outside such a range, more template units than template-bearing SFC inputs, or
multiple template findings in one component fails closed. This rejects real
TypeScript/string-computed methods named `<template>`, which Fallow otherwise
misclassifies as template units, including methods inside Vue script blocks.
For the original showcase, those aggregates identify DocumentPanel 29/18,
ItemsPanel 24/25, TaskRepositoryPanel 20/19 and ShowcaseApp 13/18
(cyclomatic/cognitive). This is an explicit remaining template-complexity policy
gap, not four waived functions. Vue markup remains part of clone detection and
the existing full-SFC code-line and presentation checks.

## Inventory and denominator

The inventory records exact path, SHA-256, bytes and classification for every
file under `src`, `scripts`, `tests` and `harness`, root executable configuration,
and package/lock/analyzer configuration. Symlinks and nonregular inputs fail.
The immutable host CSS archive is checked with the existing vendor hash policy.
Styles, markup-only HTML, data and compressed vendor material are visibly
classified as unsupported by this JS/TS/Vue function/clone measurement. They keep
their independent parser, provenance, style and source-line checks.

The companion adds Python assembly/browser tooling as immediate `.py` files in
`scripts/concepts` and `tests/concepts`. These are retained with exact hashes,
byte counts and `view: unsupported`, `measurement: not-measured`, plus an explicit
Python scope reason. They do not enter any Fallow function/clone corpus or inflate
the production denominator. Changing or omitting one still invalidates a retained
report. This classification does not accept Python in `src`, unrelated folders,
nested concept folders, bytecode or arbitrary extensions. Unknown inputs still fail.
The separate companion CI parses every concept Python source without executing
it or writing bytecode, then runs the existing assembly tests and current browser
suites. Syntax success is not Python complexity, coverage or native qualification;
normal template setup does not acquire an additional Python runtime prerequisite.

Four measured views are retained: production, executable tooling/configuration,
test/harness fixtures, and executable example-removal templates. Tooling and
fixture/template complexity and duplication are diagnostic reports, without a
claim that production targets have been met in those different corpora. Embedded
maker source strings remain tooling tokens; their actual output becomes ordinary
production when a consumer is generated and verified.

Each view is copied byte-for-byte into an isolated temporary corpus with neutral
filenames, preserving language extensions and recording a reversible path map.
This avoids Git-ignored archive parents, generated-file default ignores and
misleading positional scoping: `fallow dupes src` filters reported clones but its
denominator can still include the repository. The configured duplicate defaults
are disabled. No dependency graph/reachability claim comes from these isolated
copies; that remains the original analyzer's job. An installed-dependency junction
keeps the tool's dependency availability checks intact. The isolated metric config
explicitly turns off its unconfigured boundary/policy detectors; those independent
checks still run against the real repository configuration.

Health must report exactly the supplied input count, and any source-discovery or
degraded-parse diagnostic fails. Duplication uses Fallow's actual token-bearing
corpus: import/re-export wiring is excluded by its explicit default. Inputs below
the configured token eligibility minimum can contribute zero, including type-only
and small implementation inputs. Every individual input is additionally run
through the same real duplicate analyzer; the raw receipt records its eligible
file/line/token contribution. Summed per-input receipts must exactly equal the
whole view denominator, so an omitted input cannot disappear behind a plausible
aggregate. The report retains both supplied input count and eligible tool corpus
count. The percentage is independently
checked as `100 * duplicated_lines / total_lines`, using Fallow's line counts,
not physical repository lines or the code-line-limit denominator. Token statistics
are retained separately; Fallow's duplicated-token count excludes one retained
copy of each clone. Clone findings retain source path/ranges and minimum counts.
Native threshold decisions and clone instance/file counts must agree with the
reported totals; nonempty clone groups cannot claim zero duplicated_lines/tokens.

Initial source qualification exposed 33 executable function violations and four
Vue template aggregates. Cohesive validation, request preparation, owned feedback,
notification capacity and native folder preparation helpers removed the function
hotspots without changing persistence ownership. The initial isolated production
clone measurement was 33/4229 lines (0.780326%); authoritative results for changed
source belong to its retained execution report, not this historical measurement.

## Failure controls and evidence limits

The tooling tests exercise the real CLI on valid composition, an excessive
function, a Vue-script hotspot, duplicated production code, invalid parse data,
changed source, omitted inventory, contradictory clone totals and unknown report
schemas. They also prove the
immutable vendor input is inventoried and altered bytes are rejected. They exercise
all actual concept Python sources, unchanged production metrics, stale/omitted
Python records and rejection outside the narrow language scope. Raw outputs
are kept; no report is synthesized as the only positive control.

The report binds the source inventory, policy, Node version, installed package and
launcher hashes, output-contract hash, raw tool output hashes, exit codes and
declared arguments. Source is re-inventoried after the run. Check mode rejects
stale source/tool identities and recomputes summaries from raw reports. These are
reproducible integrity checks, not signed proof that an untrusted person executed
honest tooling, and they grant no release authority. Generated consumers, reviewed
example removal and Git-free archives must each run this same gate on their own
actual source.
