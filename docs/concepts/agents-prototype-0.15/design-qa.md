# Manual editor and renderer acceptance · 0.15

**Status: not executed for the packaged 0.15 app.** This checklist is the remaining browser acceptance gate. Historic screenshots under docs/history are not evidence for this version.

## Startup and navigation

Serve the project with Vite and confirm the current Vue-based Klaus Editor loads. Verify Nuxt UI controls and utility CSS render correctly and the console contains no missing-plugin/module errors. Visit each configuration view and confirm the global persistence panel remains accessible. Check narrow and wide layouts, keyboard focus, contrast and overflow.

## Character construction and rotation

Exercise all 15 presets across human, pet, animal and item categories. Check grounding, structural centering, faces, limbs, paws, tails, ear hinges, screens and accessories. Switch through the 49 compatible part choices. Test every finish, pattern, eye style and pose. Confirm faces and badges stay attached during animation.

Rotate through 0, 90, 180, 270 and 360 degrees using both drag and numeric controls. Confirm character yaw changes while camera position is unchanged. Check reversed/negative and greater-than-360 input normalization. Switch agents and presets while rotated and animated. Confirm picking/highlights still map to the correct semantic configuration section.

Repeatedly rebuild the model, toggle inventory/decorations and mount/unmount the editor. Inspect renderer memory/resource counters where available. Verify resources stabilize instead of monotonically accumulating. Static resource tests do not replace this browser observation.

## Configuration panel isolation

Open Appearance → Parts/Style/Team/Packs, then select Skills, Tools, Memory and the other sections. Confirm only the selected section's controls are visible, no old panel overlaps persist, and the skills filter/search still works. Change a look and verify role, skills, tools, permissions and evaluation data remain unchanged.

## Persistence and imports

Edit and wait for autosave, then reload and compare the actual data. Disable autosave, edit, save manually and repeat. Edit while a slow fake adapter is saving and confirm the newer draft stays dirty. Trigger quota/access failures with a test adapter and verify errors remain visible and export is usable.

Place invalid JSON in the known browser key, reload and confirm it is not overwritten. Verify the recovery message, blocked autosave, session export and explicit replacement confirmation. Exporting the session does not restore the unreadable original bytes.

Try malformed JSON, unsupported schemas, invalid parts, unknown references, duplicate IDs, wrong nested types and oversized packs. The live state and selection must remain unchanged on rejection. Import a supported legacy fixture and inspect migration diagnostics. Import an exported pack twice and verify identifier remapping, model/part references and looks.

Edit a JSON draft, change the live state elsewhere and return. Verify the draft survives, its conflict notice appears and applying requires confirmation. Reloading a changed draft must also require confirmation.

## Build acceptance

Run npm run check, serve the production output with npm run preview, and repeat the essential editor, import and save/reload flows. Record the exact browser, dependency lockfile, viewport and observed results before approving the release.
