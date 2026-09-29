# Requirements-package validation

**Date:** 2026-09-29. **Source baseline:** PR #5 at `22821c4d8b2764e014dc12569b470af9e05d86b0`.

This record concerns the new requirements files and their local reporting tool. It is **not** runtime acceptance evidence for any PBI and is excluded from PBI progress.

| Check | Observed result |
| --- | --- |
| PBI enumeration and identity | 54 unique typed Markdown PBIs; all `type: PBI`. |
| Hierarchy | 8 epics, 28 features; feature/epic references resolve. |
| Acceptance identity | 216 unique acceptance-criterion IDs in the PBI bodies. |
| Metadata schema | All PBI frontmatter parsed with Python YAML and validated against the JSON Schema using `jsonschema`. |
| Dependencies | All PBI references resolve and the graph is acyclic. |
| Source crosswalk | Every WM-01–19, MVP-01–24, MVP-QR-01, BQ-01–10, A01–20, WVA-01–20 and BQA-01–10 has at least one mapping. Mapping is not test execution. |
| New internal Markdown links | Targets within `docs/requirements` exist. The four external repository document targets were read/identified through GitHub; the whole repository link graph was not locally checked. |
| Progress checker tests | 16 passed, 0 failed, 0 skipped; includes stale/missing evidence, unsupported done/shipped states, type errors, dependency cycles and scope-denominator safeguards. |
| Initial progress snapshot | 0/54 evidence-backed accepted PBIs; 0/216 verified ACs; 54 new/unassigned/unestimated. Existing product implementation is not assessed as zero. |

Commands executed on the authoring copy:

```sh
node --test docs/requirements/tooling/progress.test.mjs
node docs/requirements/tooling/progress.mjs --as-of 2026-09-29
```

The local Node version was **22.16.0**, not the repository's qualified application toolchain. These dependency-free documentation checks do not substitute for `npm run verify`, actual browser/native acceptance, .NET/Java integration, publication qualification or stakeholder validation. No such product run or release was performed by this requirements change.

The PBI bodies and schemas are reviewable drafts. Structural checks cannot establish stakeholder agreement, feasibility, exhaustive behavioral coverage or authenticity of subsequently entered evidence. Review these aspects through the documented process before advancing the requirements lifecycle.
