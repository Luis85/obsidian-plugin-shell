# Individual task template

Copy the structure below into the appropriate lane and assign a new stable ID. Do not copy a done status or an old test count. See [task rules](README.md) and [strategy](../product/DELIVERY-STRATEGY.md).

```yaml
---
task_id: SH-XXX
phase: shell
priority: P0
status: planned
depends_on: []
plan_refs: [E01]
---
```

## Outcome

State one independently reviewable developer/product outcome. Identify the current gap rather than assuming the whole capability is missing.

## Baseline and scope

Link current source/docs to inspect. Define included work and explicit non-goals. Reuse existing shared services and makers. For a companion feature, identify its shell prerequisite; generic missing behavior belongs in a shell task.

## Acceptance criteria

- [ ] Describe observable successful behavior.
- [ ] Describe a relevant rejection/failure/recovery case.
- [ ] Preserve independent consumer, ownership and compatibility constraints.

## Verification

Name the test scopes and what each must prove. Separate model, filesystem, generated consumer, browser, native, accessibility and performance evidence. Expected commands are plans, not executed results.

## Evidence and handoff

Initially: Not executed. At completion, record commit/artifact identity, exact commands/results, relevant environment and unexecuted scope. Link changed docs, decisions and follow-up tasks. A gate review and publication authorization are separate records.
