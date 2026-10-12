# Resource Atlas

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Create an Obsidian resource deployment plan quickly. Define inclusive start and end dates, required roles and FTE, allocate dated periods, block time, and read person-days per role and for the complete plan.

## Operating Context

This is the next independent prototype in the user's Obsidian product family. It inherits the shared Nuxt UI foundation and Storyloom visual direction already requested and delivered. The supplied resource plan image establishes a role-by-time planning matrix, multiple assignment bars per role, company holidays, role totals, and a plan budget.

## Capabilities and Constraints

Self-contained HTML; no account, backend, or other plugin required. Native browser persistence and explicit JSON/Markdown exports represent future vault integration. FTE and PT are distinct from headcount. Calendar dates, role assignments, and blocked periods determine effort. Calendar workdays and hours per PT are configurable. Holidays are entered explicitly.

## Confirmed Evidence

The reference image shows a roughly150PT budget, weekly iterations, UX1FTE35PT, RE1FTE35PT, Dev1FTE80PT, DM0.2FTE14PT, and company holidays. The role totals sum to164PT. The demo uses actual dated weeks from October2026 through February2027; exact dates are illustrative.

## Assumptions

The working prototype uses German planning terminology, Monday–Friday workweeks,8hours per PT, inclusive date ranges, and explicit assignment periods. Blocked time reduces effort inside existing periods and does not shift their dates. These defaults are visible and editable. The primary interaction is a timeline following the supplied reference.

## Product Principles

- Make calculations explainable at daily precision.
- Keep roles, assignments, and blocked time separate.
- Prefer direct input and manipulation with equivalent form controls.
- Retain source ownership when importing optional family context.
- Preserve user data and show persistence or validation failures.
