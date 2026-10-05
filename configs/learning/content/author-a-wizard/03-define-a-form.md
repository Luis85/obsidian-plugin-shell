# Define the form

Create `configs/forms/<your form id>.json`. The file name must equal the form `id`.
A small form needs only an id, a title and its fields:

```json
{
  "$schema": "../schemas/form.schema.json",
  "schemaVersion": 1, "id": "contact", "version": 1, "title": "Contact",
  "fields": [
    { "id": "name", "kind": "title", "label": "Contact name" },
    { "id": "channel", "kind": "select", "label": "Channel", "choices": ["mail", "chat"], "default": "mail" }
  ]
}
```

Field kinds are listed in [[docs/development/WIZARDS-AND-FORMS#Forms|the forms reference]]: `text`, `title`,
`number`, `select`, `multi`, `boolean`, `confirm`, `list`, `record` and `section`.
Use `when` to ask a field only after an earlier answer, and `message` to replace the generic validation text.

Your form must use the form id you planned in the previous step, and it needs a `fields` list.
