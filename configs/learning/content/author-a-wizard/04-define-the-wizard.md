# Define the wizard

Create `configs/wizards/<your wizard id>.json`. Steps run in order and share one JSON state:

```json
{
  "$schema": "../schemas/wizard.schema.json",
  "schemaVersion": 1, "id": "onboarding", "version": 1, "title": "Onboarding",
  "steps": [
    { "id": "contact", "kind": "form", "form": "contact", "bind": "contact" },
    { "id": "review", "kind": "action", "action": "wizard.review", "with": { "value": "contact" } },
    { "id": "done", "kind": "end", "text": "Thanks, {{contact.name}}." }
  ]
}
```

- A `form` step asks your form and stores the answers at `bind`.
- `wizard.review`, `wizard.agree` and `wizard.save-json` are built-in actions, so a wizard that only
  collects, reviews and saves needs no code.
- `{{contact.name}}` is a literal template: it is replaced by the answer, never evaluated.

The step kinds are described in [[docs/development/WIZARDS-AND-FORMS#Wizards|the wizards reference]].
Reference the form you created in the previous step by its id.
