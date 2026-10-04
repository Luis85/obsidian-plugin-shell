# Journey Lens in this generated plugin

Open the declared sitemap surface to use the actual Vue 3 / Nuxt UI / Vue Flow editor.
The editor is copied from the maintained framework source; it is not the static visual page definition.

Native views start with project.companion.json. Opening never creates a file. Enter a visible vault-relative
.json or .companion path, then Open file. To create a project, use Create from generated definition,
Validate and review, and the explicit approval checkbox. The parent folder must already exist.
Every applied editor command saves the complete validated project using the vault's serialized process operation.
JSON imports are inert data: they cannot supply code, paths for other writes, dependencies or permissions.

Each view owns its draft and undo history. Other views and external edits cannot be overwritten by stale approval.
An uncertain save blocks further writes to that file until explicit recovery reads and validates the stored bytes.
Download draft recovery before discarding edits. Export project returns the last saved full canonical definition,
not pending fields. Missing/corrupt files are never silently repaired. Closing a view discards its unexported draft;
committed changes reopen from the file. The chosen path is remembered for this plugin session, not across application restarts.

Browser clickdummies use the same editor and an explicitly labelled memory-only file store. Export JSON to retain
those edits. Resetting or closing the preview does not persist them in a vault.

Generated page/component/source screens outside this binding retain their existing implementation contracts.
Opening an adjacent editor is navigation, not a claim that all Companion editors have been implemented.
Regenerate from an exported canonical project through the normal reviewed plan/apply workflow; customized
extension files are preserved or reported as conflicts. This does not authorize publication or activation.

Native acceptance is executable through npm run test:obsidian -- --allow-download journey-lens.
It exercises create/edit/plugin reload and independent leaves in isolated native fixtures.
A generated test file is not evidence of a passing run; retain its actual host report separately.
