# Data-driven forms in the plugin runtime

> Type: how-to guide and reference · Part of the [docs index](../README.md)

A feature can describe an input view as JSON and let the shared `DataForm` component render it inside
the plugin. The definition uses the same format as the CLI forms in `configs/forms/`
([wizards and forms](WIZARDS-AND-FORMS.md)), limited to what a plugin view can render without CLI hooks.
The component validates the draft and emits typed values. It never saves anything; the feature decides
what happens with the value.

The showcase **Forms** page is the working example. The definition is
`src/plugin/features/showcase/forms/feature-brief.json`, and `src/plugin/features/showcase/feature-brief.ts` declares it.
The Forms page is an optional example: `npm run examples:remove` deletes it together with the other
showcase pages ([remove optional examples](EXAMPLE-REMOVAL.md)). `DataForm`, the `form.*` messages and
`src/plugin/styles/forms.css` are shared and stay.

## Add a form to a feature

1. Add the definition next to your feature, named after its id: `src/plugin/features/<feature>/forms/<id>.json`.

   ```json
   {
     "schemaVersion": 1, "id": "contact-card", "version": 1, "title": "Contact card",
     "fields": [
       { "id": "name", "kind": "title", "label": "Name", "maxLength": 80 },
       { "id": "channel", "kind": "select", "label": "Channel", "choices": ["email", "phone"], "default": "email" },
       { "id": "phone", "kind": "text", "label": "Phone", "required": true, "when": { "field": "channel", "equals": "phone" } }
     ]
   }
   ```

2. Declare it once in a feature module through the authoring API:

   ```ts
   import { defineForm } from '../api';
   import contactCard from './forms/contact-card.json';

   export const contactCardForm = defineForm(contactCard);
   ```

   `defineForm` validates the JSON when the module loads. An invalid file throws
   `FORM_DEFINITION: <reason> at <location>`, for example `form.cliOnly at fields[2].choicesFrom`.

3. Render it from a panel. Keep the Vue script to imports and bindings, and put the behavior that handles
   the submitted value in a composable or store (see `src/plugin/presentation/components/panels/FormsPanel.vue`
   and `src/plugin/presentation/stores/forms-showcase.ts`):

   ```vue
   <DataForm :definition="definition" :initial="saved" submit-label="Save contact" @submit="page.accept" />
   ```

4. Test it with real services. Use the example tests as a template:
   - `src/plugin/tests/unit/data-form-components.test.ts` mounts the real showcase. It is example-owned and
     removed with the showcase.
   - `src/plugin/tests/unit/data-form-standalone.test.ts` mounts `DataForm` with a feature-owned definition.
   - The domain tests read the test-owned copy `tests/fixtures/forms/feature-brief.json`, so they keep
     running after example removal.

   Run `node tooling/testing/suites.mjs --check` after adding a test file.

5. Run `node --test src/cli/tests/interactive-maker-runtime-form-format.checks.mjs`. It reads every
   `src/plugin/features/*/forms/*.json` with the CLI's authoritative reader, so a runtime form stays valid in the
   shared format. It proves discovery and the CLI value check on the test-owned fixture.

To persist the value, handle `submit` in a feature action, for example a repository from
`definePluginDataFeature` or `defineNoteFeature`. Do not write from the component.

## Where definitions live

Runtime definitions live in `src/plugin/features/<feature>/forms/`, not in `configs/forms/`.

- `configs/**` is the tooling zone. The architecture boundaries allow features to import only feature,
  application and domain code, so a feature cannot import `configs/forms/*.json`.
- The plugin bundle contains only the JSON a feature imports. CLI forms that need hooks
  (`user-settings`, `prd-intake`, ...) never enter `main.js`.
- The format is shared, so a form that needs no hooks, such as `configs/forms/project-identity.json`, also
  reads in the runtime. To use it in the plugin, copy it into the feature folder.

## Format reference

The runtime reader is `readDataForm` in `src/plugin/domain/forms/definition.ts`. It accepts a strict subset of
`configs/schemas/form.schema.json` and fails closed on everything else.

| Kind | Control | Value | Keys |
| --- | --- | --- | --- |
| `text` | Input, or a textarea with `multiline` | trimmed string (`''` when optional and blank) | `default`, `required`, `maxLength` (default 2000, multiline 10000), `multiline` |
| `title` | Input | trimmed single-line string, always required | `default`, `maxLength` |
| `number` | Number input | finite number; absent when left empty | `default`, `integer`, `min`, `max` |
| `select` | Native select | one choice id; absent when nothing is chosen | `default`, `choices` |
| `multi` | Checkbox group | choice ids in choice order, de-duplicated | `default`, `choices`, `required` |
| `boolean` | Checkbox | `true` or `false` | `default`; `yes`/`no` are accepted and only used by the terminal |
| `list` | Textarea, one item per line; blank lines are dropped | trimmed strings | `default`, `required`, `maxItems` (default 60), `maxLength` (per item); `separator`, `joiner`, `suffix`, `multiline` are accepted and only used by the terminal |
| `section` | Fieldset | nested object when `bind` is set, else the parent object | `fields` (inline only) |

Every field takes `id`, `kind`, `label`, and optionally `help`, `message`, `bind` and `when`.
Choices are strings or `{ "id", "label" }` objects.

**Rejected CLI-only constructs.** Each is reported as `form.cliOnly` at its location:

| Construct | Why the runtime rejects it |
| --- | --- |
| `choicesFrom`, `effect`, form or section `commit`, section `prepare` | Named CLI hooks. A runtime form carries data only and has no hook registry. |
| `confirm` kind | A terminal agreement step. CLI value validation skips it, so it never produces a value. |
| `record` kind | One prompt per existing object key. It needs the object up front and has no fixed control layout. |
| `transient` | Answers that are asked but not stored. They exist only for terminal effects. |
| section `form` (include) and `gate` | Cross-file includes and gate prompts. Use inline `fields`, and a `boolean` with `when` instead of a gate. |
| `when.changed` | Compares against the wizard's initial state, which the runtime does not have. |
| `{{…}}` templates in labels, help or choice labels | They are filled from wizard state, which the runtime does not have. |

The runtime is also stricter than the CLI in a few places:
- Labels are single-line.
- Field ids `constructor` and `prototype` are rejected, because an id is also the default binding.
- `maxLength` and `maxItems` must be positive integers, and `min` cannot exceed `max`.
- Sections must not be empty and nest at most 8 deep.

Every runtime form is still valid for the CLI.

## Value semantics

- **Bound paths.** Each field writes to `bind`, a dotted path that defaults to `id`. Inside a section with
  `bind`, paths are relative to that section's object, and the absolute path is used for errors and ids.
- **Conditions.** `when` takes `field` (an earlier sibling at the same level) or `path` (relative to the
  enclosing bound section, or the form value). It also takes exactly one of `equals`, `notEquals` or
  `present`. Comparisons are structural. An absent `field` sibling counts as its `default`.
- **Hidden fields** keep their draft but are skipped by validation and left out of the result.
- **Validation** (`readDataFormValue`) returns either `{ ok: true, value }` with only visible, normalized
  values, or `{ ok: false, issues }`. Each issue has `path`, `code`, optional `params` (`limit`, `min`,
  `max`) and the field's own `message`, if set.
- **Issue codes** map to locale keys `form.issue.<code>`: `required`, `text`, `title`, `number`,
  `integer`, `range`, `min`, `max`, `choice`, `items`, `invalid`. A field's `message` replaces the generic text.
- **Safety.** Paths reject `__proto__`, `constructor` and `prototype` segments. Reads use own properties
  only, and writes create plain objects. Control characters are rejected (multiline text keeps tab and
  newlines). Definitions are frozen.

## Authoring API

Import these from `src/plugin/features/api.ts`:

| Export | Purpose |
| --- | --- |
| `defineForm(json)` | Validated `DataFormDefinition`; throws `FORM_DEFINITION` for an invalid shipped file. |
| `readDataForm(json)` | Same check as a `Result`, for definitions that arrive at runtime. |
| `readDataFormValue(definition, value)` | Validates a complete value, for example one loaded from storage, without rendering. |
| `DataFormDefinition`, `DataFormField`, `DataFormValue`, `DataFormValues`, `DataFormIssue`, `DataFormOutcome` | Types. |

`DataForm` (`src/plugin/presentation/components/forms/DataForm.vue`) takes these props and emits one event:

| Prop or event | Type | Meaning |
| --- | --- | --- |
| `definition` | `DataFormDefinition` | Required. Treated as fixed for the component instance; key the component by id to swap definitions. |
| `initial` | `DataFormValues` | Seeds the draft before definition defaults. Choice values that are not offered are dropped. |
| `disabled` | `boolean` | Disables every control and ignores submit. |
| `submitLabel` | `string` | Replaces the localized "Submit". |
| `@submit` | `DataFormValues` | Emitted only for a valid value. |

## Behavior and presentation

- **Draft state** lives in the per-view Pinia store `data-form-drafts`, keyed by `id@version`. A draft
  survives page navigation inside the same view. Two `DataForm` instances of the same definition in one
  view share a draft. **Reset** restores `initial` and the defaults.
- **Errors** appear after the first submit and then update live. The first invalid control receives focus.
  - Each control has a label, and help and error text are linked through `aria-describedby`.
  - Invalid controls carry `aria-invalid="true"`.
  - A summary is announced with `role="alert"`.
- **Controls** follow the existing panels: Nuxt UI `UInput`, `UTextarea` and `UButton`, plus native
  `select` and checkbox controls styled with shell tokens in `src/plugin/styles/forms.css`. Measured on this
  branch, `USelect` would add about 89 kB to `main.js`, and `UCheckbox` with `USwitch` about 76 kB more.
  The chosen set adds about 31 kB, and `styles.css` grows by about 1 kB. No global styles or Preflight
  are added. All selectors are scoped by the shared pipeline.
- **Labels** come from the definition and are not translated. Generic texts (buttons, hints, issues) use
  the `form.*` locale keys.

## Not covered

- Browser (Playwright) and native Obsidian runs of the Forms page. Only happy-dom component tests and
  domain tests run.
- Translated labels inside a definition.
- Clearing a `select` back to "no choice" once chosen.
- Dynamic choices, cross-file includes and the other CLI-only constructs listed above.
