# Performance and ownership qualification

These are separate measurements: deterministic owner cleanup, native correctness,
controlled-reference timing, shared-runner timing and retained asset sizes. None
promotes the 96-case legacy acceptance plan or authorizes a release. The NFR-02/03
200 ms and 500 ms budgets remain proposed reference targets until actual results
are recorded for a named environment.

## Commands and protocol

```sh
npm run test:native -- --allow-download --performance
npm run test:native -- --allow-download --performance --controlled-reference
node scripts/testing/asset-sizes.mjs dist
node node_modules/vitest/vitest.mjs run tests/runtime/resource-qualification.test.ts
node --test tests/tooling/performance-report.checks.mjs
```

Native execution requires the separately provisioned launcher 3.2.1, the existing
contained scratch-vault/config controls and the retained three candidate assets.
It never builds those assets. `--allow-download` is the existing explicit host
provisioning opt-in. `--performance` is optional: it adds measurement before the
ordinary native smoke, restores the original scratch data and runs that smoke.
`--controlled-reference` must be selected before execution on an otherwise idle
reference computer. It records the operator's classification, not proof of process
isolation. Run without installs, builds, coverage, analyzers or other known heavy
workloads. Hosted/shared-runner timings remain advisory.

The checked-in protocol in `scripts/testing/performance-report.mjs` declares:

- Three warmups followed by **30** measured samples for each metric, all retained;
  no retries, sample filtering, outlier removal or finish-line changes.
- Renderer `performance.now()` start/end values and their exact difference, in
  milliseconds. p95 uses sorted samples at `ceil(0.95 × 30) - 1` (nearest rank).
- Warm initialization starts immediately before awaited native
  `plugins.enablePlugin(id)`, after unloading the plugin. It ends after enable
  completes and the real runtime, command registration and empty diagnostics are
  checked. It excludes host startup and unload; includes host plugin loading,
  settings load, services, registrations and feature initialization.
- Readiness starts before opening a real native showcase leaf. It includes mount,
  selection of Documents, the real Items repository query, rendering **all 100
  exact labels**, `aria-busy=false`, and two animation-frame opportunities. An
  empty Overview, attached shell or generic ready marker cannot finish a sample.
- The predeclared fixture is 100 stable-ID schema-1 item records, collection
  revision 100, record revision 1, with `Reference item 001` through `100` labels.
  Fixture bytes are installed only while the isolated plugin is disabled and
  loaded by the production persistence/repository implementation. Fixture setup
  is outside timing and is not claimed as a user create operation.

`performance.json` keeps every completed warmup/sample, including failure,
protocol/hash, source-input digest, lock hash, native candidate hashes, operating
system/CPU/RAM, Node, launcher, resolved host versions, user agent and viewport.
It is flushed after every sample. An aborted run retains its reason and partial
samples; incomplete, duplicated, malformed or failed samples cannot summarize
successfully. Source changes during execution fail qualification. Budget outcomes
are separate from correctness: a slow complete run retains its timing and reports
`exceeds-proposed-budgets`, without a noisy universal timing gate.
Every invocation gets a distinct `reports/native/attempts/<timestamp-pid>/`
directory; `reports/native/report.json` is only the latest compatible report copy.
Failed attempts and their screenshots/raw samples remain in their original paths.

The size command only reads existing bytes, reporting SHA-256, minified
uncompressed sizes, gzip level 9 and Brotli quality 11. Empty, missing, nonregular
or symlinked assets fail; JS over 1 MiB or CSS over 100 KiB fails. Compression uses
the recorded Node runtime. It never rebuilds an accepted candidate. Exact
serializer attribution requires the accepted build's module graph; aggregate
sizes alone cannot establish how many bytes removing YAML would save.
The accepted build records `reports/bundling/<main.js-sha256>.json`. The reader
checks that graph's schema, exact asset hash/length, unique YAML module inventory
and rendered-length sum. `renderedLength` is the bundler's tree-shaken module
measurement, not an additive allocation of compressed/minified bytes. The current
native performance protocol requires this matching graph. Older standalone
candidate diagnostics explicitly report missing attribution separately from size.

## Correctness and resource ownership

`RESOURCE-20` runs production Vue mounts, stores, services and event bus through
20 complete open/close cycles while retaining a sibling view. Each cycle opens
an owned notice with its timer and a pending confirmation. Unmount must restore
the live-sibling baseline for bus subscriptions, owner-observer references,
timers, notices, dialogs and feedback. Canceled timer delivery and the resolved
modal continuation cannot recreate UI; the sibling publishes a real typed event
after every cycle. Runtime disposal is explicitly forbidden during that loop.

`RESOURCE-PENDING` closes the writing view while a save is held at the adapter
boundary; its eventual commit reaches the sibling without modifying the dead
view or sibling draft. `RESOURCE-FAILURE` independently observes an uncertain
late adapter failure, forbids success feedback and verifies the shared writer
does not issue another save. These are happy-dom/component and controlled adapter
evidence. The observer/timer/notice counters do not claim actual native EventRef
or OS-resource measurement.
`RESOURCE-HOST-20` additionally executes the production native registration and
view classes against the declared host fixture: its eight runtime bridge refs
remain live, each opened view acquires three owner EventRefs, and closing that
view restores the sibling baseline in all 20 cycles. Bus disposal is forbidden
until final runtime cleanup. This qualifies native adapter wiring, not a real
Obsidian process or OS resource census.

The native Items sequence exercises real retained-code views and actual native
data I/O: whitespace/oversized rejection without writes; trimmed create; stable
ID/creation-metadata rename; second-view projection and draft isolation; canceled
deletion preserving exact bytes; confirmed deletion; preference/entity writer
serialization; retained current-state load after the existing cold process
restart. A driver-owned wrapper only counts unchanged calls to native `saveData`
and is restored in `finally`. The post-restart Documents query and explicit
Reload each preserve bytes and together invoke zero writes. This observation
starts after plugin startup; it does not claim to count earlier startup I/O.
No test globals or instrumentation enter shipped runtime code.

A separately labeled `controlled-adapter-in-native-host` sequence holds one save
while its real native initiating view closes, then releases the real write and
checks that a live sibling receives the committed row with its draft unchanged
and no late success message. A rejected save is deliberately injected at the
same boundary: the native UI must retain the draft, block further submission,
emit no success, preserve bytes and record exactly one `settings.write`
diagnostic. Counts distinguish two boundary calls, one completed native save and
one injected failure. It restores the fixture's prior exact scratch data while
the plugin is disabled and restarts that isolated runtime before other smoke
checks. These controls are never described as native disk-failure evidence.

## Execution status and retained limitations

Implementation of the commands is not execution evidence. Record actual sample
files, code/candidate hashes, classification, contention, p95 and budget outcomes
in the milestone execution record after the fixed candidate runs. No native or
performance pass is inferred from helper/validator unit tests.

The historical Windows Appearance failure remains unexplained. The existing
active-Appearance guard, native controls, assertion limits and bounded
partial-JSON/ENOENT polling remain. Preserve the first failure and contemporaneous
window/theme/config/focus evidence if it recurs; later passing sessions do not
explain or erase it. macOS, devices, third-party themes and manual accessibility
remain separate qualification work.
The native driver now retains its bounded host log on failure as well as success.
Read-only snapshots bracket each unchanged Appearance action/assertion sequence
and retain per-window body/root classes, computed background, visible native
select options/values, live host theme config, DOM focus/visibility and viewport.
No new readiness wait occurs inside that sequence. This is not a continuous
propagation trace or an independent OS foreground HWND measurement; the latter
is explicitly recorded as not captured. These observations occur after the
optional benchmark and do not instrument its timed samples.
