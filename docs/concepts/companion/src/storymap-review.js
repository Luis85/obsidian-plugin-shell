// Derived, read-only views. Keep planning questions separate from delivery evidence.
function smReferenceIndex(d) {
  return { surfaces: new Map(d.nodes.map(n => [n.id, n])), prds: new Map(d.prds.map(p => [p.id, p])),
    requirements: new Map(d.prds.flatMap(p => p.requirements.map(r => [JSON.stringify([p.id, r.id]), { prd: p, requirement: r }]))) };
}
function smMissingReferences(item, index) {
  return [...(item.surfaces || []).filter(r => !index.surfaces.has(r.id)).map(r => ({ kind: 'surface', ref: r })),
    ...(item.requirements || []).filter(r => !index.requirements.has(JSON.stringify([r.prdId, r.id]))).map(r => ({ kind: 'requirement', ref: r }))];
}
function smReviewFindings(map, d) {
  const index = smReferenceIndex(d), findings = [];
  const add = (kind, item, code, title, detail) => findings.push({ kind, id: item.id, code, title, detail });
  if (!map.activities.length) add('map', map, 'empty-map', 'Start the user experience', 'Add an activity, then describe its steps and stories.');
  if (!map.purpose.trim()) add('map', map, 'purpose', 'Describe the map outcome', 'What useful experience should this map help deliver?');
  if (!map.audience.trim()) add('map', map, 'audience', 'Name the audience or scenario', 'Make the person and situation explicit.');
  for (const ref of map.prds) if (!index.prds.has(ref.id)) add('map', map, 'missing-prd', 'Repair missing PRD: ' + (ref.label || ref.id), 'Relink or remove this reference in map settings.');
  for (const activity of map.activities) if (!map.steps.some(s => s.activityId === activity.id)) add('activity', activity, 'empty-activity', activity.title + ': add a step', 'This activity has no steps yet.');
  for (const step of map.steps) if (!map.stories.some(s => s.stepId === step.id)) add('step', step, 'empty-step', step.title + ': add a story', 'No story currently describes this step.');
  for (const release of map.releases) if (!release.outcome.trim()) add('release', release, 'outcome', release.title + ': describe its outcome', 'Explain what becomes useful in this slice.');
  for (const item of [...map.activities, ...map.steps, ...map.stories]) {
    for (const { kind, ref } of smMissingReferences(item, index)) add(smItem(map, item.id).kind, item, 'missing-' + kind, item.title + ': target missing', (ref.label || ref.id) + ' — relink or explicitly remove it.');
  }
  for (const story of map.stories) {
    if (!story.acceptance.trim()) add('story', story, 'acceptance', story.title + ': clarify acceptance', 'Acceptance notes are empty; this is a planning question, not a failed test.');
    if (story.ui !== 'none' && !story.surfaces.length) add('story', story, 'interface', story.title + ': clarify the interface', 'Link a sitemap item or explicitly choose No UI required.');
  }
  return findings;
}
function smMatchingStories(map, d, filters = {}) {
  const q = (filters.itemQuery || '').trim().toLowerCase(), index = smReferenceIndex(d);
  const steps = new Map(map.steps.map(s => [s.id, s])), activities = new Map(map.activities.map(a => [a.id, a]));
  return map.stories.filter(story => {
    const step = steps.get(story.stepId), activity = activities.get(step?.activityId);
    if (filters.releaseFilter && (filters.releaseFilter === 'unplanned' ? story.releaseId !== null : story.releaseId !== filters.releaseFilter)) return false;
    if (filters.findingFilter === 'missing' && !smMissingReferences(story, index).length) return false;
    if (filters.findingFilter === 'acceptance' && story.acceptance.trim()) return false;
    if (filters.findingFilter === 'interface' && (story.ui === 'none' || story.surfaces.length)) return false;
    const surfaces = story.surfaces.map(r => index.surfaces.get(r.id)?.label || r.label);
    const requirements = story.requirements.map(r => index.requirements.get(JSON.stringify([r.prdId, r.id]))?.requirement.title || r.label);
    return !q || [story.title, story.description, story.acceptance, step?.title, activity?.title, ...surfaces, ...requirements].join(' ').toLowerCase().includes(q);
  });
}
function smReleaseSummary(map, releaseId) {
  const stories = map.stories.filter(s => s.releaseId === releaseId), covered = new Set(stories.map(s => s.stepId));
  return { stories: stories.length, steps: covered.size, totalSteps: map.steps.length,
    emptySteps: map.steps.filter(s => !covered.has(s.id)).map(s => s.title) };
}
function smHasFilters() { return !!(smUi.itemQuery.trim() || smUi.releaseFilter || smUi.findingFilter); }
