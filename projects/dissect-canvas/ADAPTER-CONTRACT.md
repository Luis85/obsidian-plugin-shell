# Product family editor adapter v1

Each editor remains a standalone specialized engine. The common compiled Vue / Nuxt UI shell embeds it and owns family navigation, external-reference registry, reviewed package exchange, shared preferences, and linking UI. The editor owns its native data and native undo history.

Add `window.FamilyAdapter` inside the editor's UI closure, before startup. No parent listener is needed: root injects a common bridge at build time. Enable compact embedded styling through `html.family-editor` (the builder adds this before startup). Preserve original standalone operation. No external fetches, cross-plugin localStorage reads, or dynamic code compilation from imports.

## Required API

All methods may be synchronous or async. Throw Error with a useful user message on failure. Return JSON-safe data.

```js
window.FamilyAdapter = {
  getSnapshot() { return {
    appId: 'component-atlas', // or 'sitemap-atlas', 'storyloom', 'dissect'
    workspace: { id: 'stable-native-workspace-id', title: 'Workspace title' },
    view: 'library',
    title: 'Component library',
    nav: [{id:'library', label:'Component library', icon:'layers', count:20}],
    primary: {label:'New component', command:'create'},
    selection: {id:'native-id', kind:'ui.component', title:'Project card'}, // or null
    entities: [{id:'native-id', kind:'ui.component', title:'Project card',
      summary:'Optional description', status:'active', path:'optional/note.md',
      updatedAt:'optional ISO timestamp', data:{ /* portable native entity, data only */ }}],
    save: {state:'saved', label:'Saved in this browser'}, // saved | warning | dirty
    canUndo:true, canRedo:false
  }},
  navigate({view, entityId}) {}, // select entity when provided; preserve draft guards
  command({name}) {}, // create, undo, redo, import-native, export-native, help, settings, fit; unknown => Error
  setTheme(theme) {}, // 'dark' or 'light'; apply immediately, don't add an undo step
  exportNative() {}, // whole valid native JSON object; same format as existing native JSON export
  inspectNative(data) {}, // validate/normalize without mutation; return {workspace:{id,title}}
  restoreNative(data) {}, // validate atomically then restore; explicit reviewed action; guard unsaved changes
  canAdopt(entity) { return {allowed:false,label:'Link as reference',hint:'...'} },
  adopt({entity, native}) { return {entityId:'created-or-bound-local-id',message:'...'} }
};
```

`entity` passed to canAdopt/adopt is `{id,kind,title,summary,status,path,data,source:{appId,workspaceId,workspaceTitle},ref}`. Native is the imported source's validated full export if available, otherwise null. Never assume it is valid without native domain validation. Root's registry preserves the original record; adoption creates a local specialized object / binding and returns its ID; root then records a family link. The source is never edited.

## Kinds

Component Atlas: `architecture.person`, `architecture.system`, `architecture.container`, `architecture.component`, `architecture.code`, `ui.page`, `ui.layout`, `ui.component`, `ui.primitive`.

Sitemap Atlas: `ia.sitemap` for its project and `ia.page`, `ia.section`, `ia.external` for nodes; optionally `ia.navigation` for menus.

Storyloom: `story.map`, `story.activity`, `story.step`, `story.story`, `story.release`, `story.persona`.

Dissect: `dissect.workspace`, `dissect.instance`, `dissect.annotation`, `dissect.scenario`, `dissect.group`.

Keep the native ID in `id`. Root derives a canonical global reference from appId + workspaceId + kind + id. Add a stable workspace ID to Dissect with a backward-compatible migration.

## Adoption scope

Component Atlas: external objects remain references (no foreign responsibilities).
Sitemap Atlas: a selected page can use a foreign UI/architecture definition via its existing snapshot-based Atlas binding mechanism. When source native data is absent, retain a clearly labeled detached reference or explain how to import the complete source package.
Storyloom: a foreign page/component/scenario may become a story draft in the current story map. Keep explicit origin, don't imply shared editing.
Dissect: place foreign UI definitions / IA pages as safe metadata instances. Reuse a built-in renderer only if an explicit supported mapping exists; otherwise show a clear data-only preview, never execute templates from the file. Preserve foreign provenance through JSON roundtrip.

## Change events

Root bridge listens for `family:changed` on window, then publishes a fresh snapshot. Dispatch this from domain commit/undo/redo/navigate/select where convenient. The bridge also publishes after every command and uses a debounced DOM-event fallback. Do not postMessage directly. No polling loops.

## Styling

Storyloom is the authority. Shared dark values: bg #1c1c22; panel #222229; surface #292930; raised/card #303039; hover #35353f; border #3c3b46; text #ecebf1; muted #b7b5c3; faint #93909f; accent #b5a3f4; accent-bg #3d3456; canvas #202026; success #9cd5bb; danger #f0a2a8. Light: bg #f6f5f8; panel #eeedf2; surface/card #fff; raised #f7f6fa; hover #e9e6f0; border #d8d4df; text #25232b; muted #655f70; faint #756e80; accent #7354bd; accent-bg #e9e1fa; canvas #f3f1f7; success #2c7658; danger #a82c3d. 13px system sans; 6px control radius; 32px base controls; 8px rhythm; 1px borders; clear lavender focus ring; 150ms state transitions; reduced motion supported.

Hide only duplicate global ribbon/sidebar/tabbar/title header/footer in embedded mode. Keep specialized toolbars, left canvas palettes/tree as necessary, right inspector, dialogs and contextual actions. Common shell will have a 216px collapsible nav and collapse it by default for Dissect. Ensure editor responds to 390px/768px/1200px iframe widths without blocking core actions; use scrolling or drawers, not clipped data. Root injects cross-editor color/control tokens after existing styles too.
