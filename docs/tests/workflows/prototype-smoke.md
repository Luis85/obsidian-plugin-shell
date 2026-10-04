---
type: "TestWorkflow"
id: "prototype-smoke"
title: "Prototype opens offline"
target: "prototype prototypes/my-prototype"
status: "draft"
---
<!-- workflow:generated:start sha256=671898fee0ac2bf76f9e9db6367d33d89759301ed411a947985021838fc1c5d6 -->
# Prototype opens offline

> Test workflow `prototype-smoke` · draft · viewport 1440×900 · step timeout 10000 ms

## Purpose

Pattern for a prepared prototype package: open its built offline HTML, wait for the first heading and confirm that no error alert is shown. Copy it, point target.package at your prototypes/<slug> folder and add the steps of your journey. Until that package is built, workflow run reports not-run.

## Target

`prototype prototypes/my-prototype`: A prepared prototype package; the run serves the built artifact named by its prototype.manifest.json on 127.0.0.1 and reports not-run until it is built.

## Steps

1. Visit /
2. Wait until heading \#1 is visible
3. Expect alert to be hidden

## Assertions

- Step 3: Expect alert to be hidden

## Test data

No test data: every value is written in the steps.

## Last recorded run

No run recorded for this version of the workflow. Run `node bin/app workflow run --name prototype-smoke --json`, then record it with `node bin/app workflow record --name prototype-smoke --json`.

Generated from `configs/tests/workflows/prototype-smoke.json` by `node bin/app workflow docs --name prototype-smoke`. Edit the definition, not this block.
<!-- workflow:generated:end -->

## Notes

Hand-written notes outside the generated block are kept when this note is regenerated.
