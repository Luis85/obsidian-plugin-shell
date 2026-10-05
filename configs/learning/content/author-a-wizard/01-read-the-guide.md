# Wizards are data

Every guided process of `node bin/app` is a **wizard**: a JSON file in `configs/wizards/`.
The questions it asks are **forms**: JSON files in `configs/forms/` or inline fields in a wizard step.
TypeScript only provides named actions and hooks; a definition names them and never contains code.

Read these parts of the guide before you continue:

1. [[docs/development/WIZARDS-AND-FORMS#Run, inspect and check|Run, inspect and check]]: the commands you will use.
2. [[docs/development/WIZARDS-AND-FORMS#Add a guided process|Add a guided process]]: the two files you will write.
3. [[docs/development/WIZARDS-AND-FORMS#Validation and safety|Validation and safety]]: why a broken reference stops a run before anything is asked.

Tip: `node bin/app wizard list --json` shows every shipped wizard and form with its steps and fields.
