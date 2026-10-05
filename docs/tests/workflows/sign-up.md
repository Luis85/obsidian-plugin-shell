---
type: "TestWorkflow"
id: "sign-up"
title: "Sign up for the demo shop"
target: "static tests/fixtures/workflows/sign-up"
status: "active"
---
<!-- workflow:generated:start sha256=92cda9d9772bbf7373bc9d1a5aec881a2402d4378acd3fcd58cab815d74f0e4e -->
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

No run recorded for this version of the workflow. Run `node bin/app workflow run --name sign-up --json`, then record it with `node bin/app workflow record --name sign-up --json`.

Generated from `configs/tests/workflows/sign-up.json` by `node bin/app workflow docs --name sign-up`. Edit the definition, not this block.
<!-- workflow:generated:end -->

## Notes

Hand-written notes outside the generated block are kept when this note is regenerated.
