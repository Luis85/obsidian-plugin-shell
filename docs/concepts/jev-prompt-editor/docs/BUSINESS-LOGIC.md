# Business logic, processes, and events

## Design goal

Turn bounded AI judgments into inspectable business decisions, without treating a probability as an instruction to execute an action. A homeowner, analyst, or product owner should be able to explain **which evidence was used, which rule selected a decision, which process supplied the next input, and which event triggered a subscriber**.

The implementation extends the existing Jev Studio under PR #32. It retains its editable prompts, native-vault integration boundary, offline artifact, canonical repository, and synthetic test bench. There is no separate hidden persistence store for rules or events.

## The four reusable concepts

**Prompt.** The original recipe defines a model, independent questions and scoped vault bindings. Its result is typed evidence. In a flow, the request also includes the previous step's mapped input under `state.workflow_input`. The inspector and trace show the prepared request. The simulator uses the chosen synthetic fixture, not inference.

**Business rule.** A named, reusable deterministic decision definition with an input contract, ordered branches, required fallback, lifecycle and events. Each branch combines conditions using AND or OR. The first matching branch wins; conditions short-circuit. The result contains an explicit `{ type, code, processId }` decision. Available types are `continue`, `process`, `end`, and `review`. A process decision names a process definition; its selected branch must connect to a node using that definition. It does not execute anything outside the graph.

**Process.** A named contract with purpose, input fields, output fields, output mappings, lifecycle and events. A local transform applies safe mappings; a fixture returns configured illustrative data; an external process validates its input, records the requested contract, emits only applicable review events and stops. No filesystem, network, native command or script adapter is supplied.

**Flow.** Instances of prompts, rules and processes connected through explicit output ports, with one manual Start, optional End nodes, node-specific input mappings, scenario input, global budgets and lifecycle events. Definitions are reusable; instances have stable identities, labels, positions and additional events. References use IDs, not display names.

## Condition and mapping language

The prototype deliberately does not accept JavaScript, arbitrary expressions, executable imports or dynamic function names. A mapping is a JSON literal, a safe dot-separated path, or addition of a fixed finite number to a numeric path value. Object prototypes and unsafe path segments are inaccessible.

| Path root | Meaning |
| --- | --- |
| `input` | Incoming output or event payload, then the node's explicitly mapped input |
| `initial` | The flow's initial sample input |
| `steps.<nodeId>.output` | The most recent completed output of a node in this run |
| `event.payload` | Payload of the specific event that scheduled this node |
| `output` | Current output when constructing an emitted event |
| `loop.iteration` | Number of prior body branches taken by the current While instance |

Equality compares scalars of the same type. Ordering requires finite numbers. `contains` supports text/text or an array/scalar. `exists` and `missing` explicitly test presence. All other missing operands and mismatched types are errors—not false results. A numeric threshold is `0.85`, while a category literal is `"project"`.

Field types are string, number, boolean, object and array. Required fields must exist; present optional fields must still match their type. Process/rule input and process/event output contracts reject undeclared fields. Nested business schemas are not a full JSON Schema editor; select exact nested paths or use object/array fields with application validation in a future native adapter.

## While semantics

A While rule has exactly one condition branch, an explicit Else exit, and a maximum of 1–25 body executions. The body is a connected process or other chain that returns updated data to the same rule instance. The rule reevaluates on each return; it is not a blocking JavaScript loop.

A false condition exits without running the body. If the condition becomes false exactly when the quota has been used, the normal exit is permitted. A true condition after the quota produces `review / loop_limit`, not a selectable continuation port. It does not emit a branch-matched event for the blocked iteration.

Preflight rejects control cycles that can bypass all bounded While instances. Event cycles are permitted for modeling but stopped by global budgets; there is no automatic claim that an event graph terminates. A run cannot exceed the configured step/event cap, 200 queued tasks or the trace-retention budget. Budget stops cancel remaining work. There are no timers, background watchers, unattended retries or parallel joins.

## Events belong to every item

Prompts, rules, processes, flow definitions, Start/End nodes and other individual instances can declare events. Contracts contain a stable ID, dotted name, meaning, emission phase, payload fields and payload mappings. Shared-definition events apply to each instance of that definition; node events add instance-specific facts. Colliding IDs/names within the combined publisher are refused by preflight.

Emission phases are successful completion, rule branch match, rule Else, review and error. Branch/Else phases apply only to rules. Flow lifecycle events support completed/review/error and are observable outcomes; they do not restart the same flow. Unsupported imported phase combinations are diagnosed before simulation.

An event connection selects **a source node and declared event ID**, then a destination. Similar event names elsewhere do not create implicit subscriptions. Names may be edited without breaking ID-based wiring. Deleting an event that has listeners is blocked until its connections are removed. Payloads are resolved and type-checked before they are published.

Each simulated envelope records event ID, source node, sequence, correlation ID, cause and payload. IDs are deterministic within the simulated scenario; they are not a distributed uniqueness or delivery guarantee. The trace records emissions from prompts, rules, processes, nodes and flow lifecycle. No external event bus is connected.

## Ordering, failure and termination

A step resolves input, evaluates its operation, validates its output and emissions, then appends its trace. A single matching control output is queued first. Event subscribers are then queued in authored connection order. Event delivery is FIFO and single-threaded; it is not parallel process execution.

End or Review is global termination: pending control tasks and event subscribers are cancelled. An emitted terminal fact is visible, but cannot be used to bypass the stop. Use Continue when work should actually proceed. This choice is explicit in the editor and trace, rather than silently mixing local branch completion with whole-run termination.

A failed step records an error output and can follow an explicit Error connection or a valid error-event subscription. It never publishes a successful-completion event for that failure. An invalid payload cannot be partially published. External processes never claim successful completion merely because a request was recorded. Flow lifecycle publication failures are visible as errors.

These are prototype execution semantics, not transactional guarantees across external systems. A native executor will need separate policies for idempotency, retries, compensation, cancellation, approvals and subscriber failure handling.

## Authoring and maintenance

The graph supports pointer placement, keyboard movement, pan/zoom/fit, node selection and explicit inspector connection controls. A rule/process editor shows all usages of its shared definition. Deletion is blocked for referenced definitions; archiving preserves references but blocks affected simulation. Unreachable nodes and unconnected observable events are surfaced rather than hidden.

Shape-valid edits save through the existing `StudioService` and one `LibraryPort`. Invalid drafts remain on screen with a last-good library behind them. Failed storage writes do not replace the canonical in-memory library. Undo/redo snapshots whole logic changes. This is not cross-tab locking or crash-proof persistence.

Named logic checkpoints capture rules, processes, flows and their events. Prompt revisions remain separate. Restore first checkpoints the current logic, then applies the selected snapshot; current prompts are not reverted. Changed prompt contracts are checked again by flow preflight. Imports assign new IDs and remap definition references, branch process references, node references and historical snapshots, while leaving authored text/literals unchanged.

## JSON and privacy boundaries

V1 prompt/library files remain readable. Adding prompt events promotes that recipe to schema 2. Adding logic promotes the library envelope to schema 2; unchanged prompts may remain schema 1 inside it. Older schemas reject this new envelope instead of silently discarding its additions.

Workspace JSON includes authored sample inputs and literal mappings, so authors must review it before sharing. It excludes imported vault snapshots, runtime responses, traces, prepared requests and execution approvals. Trace export is a separate, explicitly acknowledged operation and can contain selected vault content and paths. No event automatically triggers a network send or vault write.

The browser vault adapter is a read-only file-picker snapshot. A future native implementation should capture active-file/editor state through an Obsidian adapter, apply allowlists and privacy policies, freeze the reviewed input for a run and recheck approvals before side effects. Live vault state is not inferred or fabricated in this prototype.

## Architecture and native handoff

`src/domain/logic/` contains types, strict structural validation, safe value evaluation, reference/graph checks, the deterministic step interpreter and original examples. It has no host/UI imports. `src/application/logic-workspace.ts` owns linked-copy import and checkpoint operations; `StudioService` retains sole canonical persistence ownership. Presentation logic composes these services; the existing browser adapter and bootstrap remain the boundary.

Native increments should implement explicit provider, vault-context, process-execution and event-delivery ports. Store note-backed definitions with stable IDs and frontmatter in user-configured folders. Version the runtime contracts separately from this prototype interchange format. Reject stale context/definition approvals, preserve unrelated note text and expose accurate native error/cancellation states. Real process execution, durable event subscriptions, automatic triggers, security review and hosted-vault acceptance are separate implementation gates.

## Research rationale

The extension follows TypeSafe's recommendation to compose independent typed question results in code rather than ask the model to execute business logic. See [TypeSafe introduction](https://docs.typesafe.ai/introduction), [state](https://docs.typesafe.ai/concepts/state) and [Noul](https://docs.typesafe.ai/primitives/noul). Noul's P(yes) is not a separate confidence field. The editor continues to distinguish Choice/Score confidence from Noul probability.

Ordered pure predicates, explicit fallback and visible transition semantics are informed by [Stately guards](https://stately.ai/docs/guards). Bounded loop and cycle diagnostics address the risks described for [eventless transitions](https://stately.ai/docs/eventless-transitions). Typed event envelopes and visible source/data separation are inspired by [CloudEvents](https://cloudevents.io/), without claiming that this local simulation format implements that standard. The original [Jev research](RESEARCH.md) retains its broader model/context/privacy discussion.
