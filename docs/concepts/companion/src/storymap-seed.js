// Authored self-project example. Fixed dates and IDs keep golden exports deterministic.
function companionExampleStorymaps(d, surfaces) {
  const store = emptyStorymaps(), map = smNewMap(store, 'From plugin intent to a portable design', '2026-09-24T00:00:00.000Z');
  map.purpose = 'A developer can explain an initial user experience and hand its saved design to the independent shell.';
  map.audience = 'Obsidian plugin developers and product owners. This example is design intent, not implementation evidence.';
  map.prds = d.prds.filter(p => ['Product & workspace', 'Storymaps & scope planning'].includes(p.title)).map(p => ({ id: p.id, label: p.title }));
  const activity = title => { const a = smNewItem(store, 'activity'); a.title = title; map.activities.push(a); return a; };
  const step = (a, title) => { const s = smNewItem(store, 'step', a.id); s.title = title; map.steps.push(s); return s; };
  const a = activity('Shape the plugin experience'), b = activity('Prepare the development handoff');
  const intent = step(a, 'Describe the user outcome'), experience = step(a, 'Connect stories and screens'), handoff = step(b, 'Transfer the saved project');
  const first = smNewItem(store, 'release'); first.title = 'First usable experience'; first.outcome = 'Create, connect and safely transfer one coherent plugin design.';
  const next = smNewItem(store, 'release'); next.title = 'Refine and review'; next.outcome = 'Review detailed acceptance notes and alternative scope without losing context.';
  map.releases.push(first, next);
  function story(s, title, release, keys, description) {
    const r = smNewItem(store, 'story', s.id, release?.id || null); r.title = title; r.description = description;
    r.ui = keys.length ? 'surface' : 'unspecified'; r.surfaces = keys.map(key => ({ id: surfaces[key].id, label: surfaces[key].label })); map.stories.push(r); return r;
  }
  story(intent, 'Describe the problem and intended outcome', first, ['requirements'], 'Keep the PRD as the source of product intent; the map adds experience context.');
  const linked = story(experience, 'Connect a story to existing screens', first, ['storymap-detail', 'sitemap'], 'Select existing sitemap items. Their stable identities remain shared; no screen is copied.');
  story(handoff, 'Export and reimport the complete project', first, ['export-project', 'import-project'], 'The transfer includes the saved storymaps and all linked project artifacts.');
  story(experience, 'Review acceptance notes in context', next, ['storymap-detail'], 'Use the inspector or outline to read stories alongside their release outcome.');
  story(handoff, 'Consider delivery-tool integration', null, [], 'Unplanned exploration. No external synchronization is implemented or implied.');
  const prd = d.prds.find(p => p.title === 'Storymaps & scope planning'), req = prd?.requirements.find(r => r.title === 'Connect without copying artifacts');
  if (req) linked.requirements.push({ prdId: prd.id, id: req.id, label: req.title });
  store.maps.push(map); d.storymaps = store; d.schema = 2;
}
