---
type: "TestWorkflow"
id: "sign-up"
title: "Sign up for the demo shop"
target: "static tests/fixtures/workflows/sign-up"
status: "active"
lastRun: "passed"
lastRunAt: "2026-10-04T15:38:52.643Z"
lastRunSummary: "18/18 steps passed in 1526 ms with Chromium 141.0.7390.37 (non-pinned SHELL_CHROMIUM override)."
lastRunDefinition: "d8b801f22cb97df20784a664657c35cbaed6b17ec1a97bd927e353162b73e329"
lastRunScreenshots:
  - "reports/workflows/sign-up/run-2026-10-04T15-38-51-117Z/screenshots/sign-up-filled.png"
  - "reports/workflows/sign-up/run-2026-10-04T15-38-51-117Z/screenshots/welcome-greeting.png"
---
<!-- workflow:generated:start sha256=0fa66b442cf01ea817e31e20ed5e0cd3815f030646521c178ce0ae469acf868b -->
# Sign up for the demo shop

> Test workflow `sign-up` · active · viewport 1280×800 · step timeout 5000 ms

## Purpose

A visitor opens the shop, follows Create an account to the sign-up page, fills the form with a seeded fake contact and a chosen plan, and lands on the welcome page that greets them by name.

## Target

`static tests/fixtures/workflows/sign-up`: A project folder with index.html, served read-only by `node bin/app workflow run` on an ephemeral 127.0.0.1 port.

## Steps

1. Visit /
2. Expect the page title to be "Demo shop"
3. Click link "Create an account"
4. Expect the URL to be /signup.html
5. Expect heading "Create your account" to be visible
6. Fill field labelled "Full name" with "{{data.customer.name}}" (id `name`)
7. Fill field labelled "Email" with "{{data.customer.email}}" (id `email`)
8. Select "{{data.plan}}" in field labelled "Plan"
9. Check field labelled "I accept the terms"
10. Expect field with placeholder "you@example.com" to have value "{{data.customer.email}}"
11. Screenshot "sign-up-filled" (full page), masking 1 element: The completed form before submitting; the email is masked.
12. Click button "Create account" inside form "Sign up" (id `submit`)
13. Expect the URL to contain /welcome.html — The form submits with GET, so the answers follow in the query.
14. Expect test id "greeting" to have text "Welcome, {{data.customer.name}}!"
15. Expect test id "plan" to contain text "{{data.plan}}"
16. Expect 3 × listitem inside list "Next steps"
17. Screenshot "welcome-greeting" of main: The welcome page content for the seeded customer.
18. Expect alert to be hidden

## Assertions

- Step 2: Expect the page title to be "Demo shop"
- Step 4: Expect the URL to be /signup.html
- Step 5: Expect heading "Create your account" to be visible
- Step 10: Expect field with placeholder "you@example.com" to have value "{{data.customer.email}}"
- Step 13: Expect the URL to contain /welcome.html
- Step 14: Expect test id "greeting" to have text "Welcome, {{data.customer.name}}!"
- Step 15: Expect test id "plan" to contain text "{{data.plan}}"
- Step 16: Expect 3 × listitem inside list "Next steps"
- Step 18: Expect alert to be hidden

## Screenshots

Captured for human review in each run report; never compared with a baseline.

- Step 11: Screenshot "sign-up-filled" (full page), masking 1 element: The completed form before submitting; the email is masked.
- Step 17: Screenshot "welcome-greeting" of main: The welcome page content for the seeded customer.

## Test data

| Reference | Source | Value |
| --- | --- | --- |
| `{{data.customer.name}}` | fake-data config contacts-demo, record 1 | Nikita Crist |
| `{{data.customer.email}}` | fake-data config contacts-demo, record 1 | Moises.Sipes-Effertz18@example.com |
| `{{data.plan}}` | inline value | Pro |

## Last recorded run

Passed at 2026-10-04T15:38:52.643Z: 18/18 steps passed in 1526 ms with Chromium 141.0.7390.37 (non-pinned SHELL\_CHROMIUM override).

Screenshots of that run (local report files, not committed):

- `reports/workflows/sign-up/run-2026-10-04T15-38-51-117Z/screenshots/sign-up-filled.png`
- `reports/workflows/sign-up/run-2026-10-04T15-38-51-117Z/screenshots/welcome-greeting.png`

Run `node bin/app workflow run --name sign-up --json`, then record it with `node bin/app workflow record --name sign-up --json`.

Generated from `configs/tests/workflows/sign-up.json` by `node bin/app workflow docs --name sign-up`. Edit the definition, not this block.
<!-- workflow:generated:end -->

## Notes

Hand-written notes outside the generated block are kept when this note is regenerated.
