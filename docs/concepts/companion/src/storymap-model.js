// Ordered arrays carry meaning. Geometry and temporary selection never do.
function smCopy(value) { return JSON.parse(JSON.stringify(value)); }
function smShape(value) { try { if (value !== undefined) validateStorymaps(value); return true; } catch { return false; } }
function smStore(d = design()) { return d.storymaps || emptyStorymaps(); }
function smFind(store, id) { return store.maps.find(map => map.id === id) || null; }
function smItem(map, id) {
  if (!map) return null;
  for (const [kind, key] of [['activity', 'activities'], ['step', 'steps'], ['story', 'stories'], ['release', 'releases']]) {
    const record = map[key].find(item => item.id === id); if (record) return { kind, key, record };
  }
  return null;
}
function smNext(store, kind) { return kind + '-' + store.nextId++; }
function smNewMap(store, title = 'Untitled storymap', now = new Date().toISOString()) {
  return { id: smNext(store, 'map'), title, purpose: '', audience: '', status: 'draft', revision: 1, updatedAt: now,
    prds: [], activities: [], steps: [], stories: [], releases: [] };
}
function smNewItem(store, kind, parent = '', release = null) {
  const base = { id: smNext(store, kind), title: '' };
  if (kind === 'activity') return { ...base, surfaces: [] };
  if (kind === 'step') return { ...base, activityId: parent, surfaces: [] };
  if (kind === 'release') return { ...base, outcome: '' };
  if (kind === 'story') return { ...base, stepId: parent, releaseId: release, description: '', acceptance: '', ui: 'unspecified', surfaces: [], requirements: [] };
  throw Error('Choose an activity, step, story or release.');
}
function smPlace(array, id, beforeId) {
  const index = array.findIndex(item => item.id === id); if (index < 0) throw Error('The item no longer exists.');
  if (beforeId === id) return;
  const [item] = array.splice(index, 1), before = beforeId ? array.findIndex(entry => entry.id === beforeId) : array.length;
  if (before < 0) throw Error('The insertion target no longer exists.'); array.splice(before, 0, item);
}
function smMove(map, id, target) {
  const item = smItem(map, id); if (!item) throw Error('The item no longer exists.');
  const before = target.beforeId ? smItem(map, target.beforeId) : null;
  if (target.beforeId && !before) throw Error('The insertion target no longer exists.');
  if (before && before.kind !== item.kind) throw Error('Choose an insertion target of the same kind.');
  const siblings = map[item.key].filter(r => item.kind === 'story' ? r.stepId === item.record.stepId && r.releaseId === item.record.releaseId : item.kind === 'step' ? r.activityId === item.record.activityId : true);
  const sameParent = item.kind === 'story' ? target.stepId === item.record.stepId && target.releaseId === item.record.releaseId : item.kind === 'step' ? target.activityId === item.record.activityId : true;
  if (sameParent && (target.beforeId === id || (siblings[siblings.findIndex(r => r.id === id) + 1]?.id || null) === (target.beforeId || null))) return;
  if (item.kind === 'story') {
    if (!map.steps.some(step => step.id === target.stepId) || target.releaseId !== null && !map.releases.some(r => r.id === target.releaseId)) throw Error('Choose a current step and release.');
    if (before && (before.record.stepId !== target.stepId || before.record.releaseId !== target.releaseId)) throw Error('Choose a story in the destination cell.');
    item.record.stepId = target.stepId; item.record.releaseId = target.releaseId;
  } else if (item.kind === 'step') {
    if (!map.activities.some(activity => activity.id === target.activityId) || before && before.record.activityId !== target.activityId) throw Error('Choose a step in the destination activity.');
    item.record.activityId = target.activityId;
  }
  smPlace(map[item.key], id, target.beforeId || null);
}
function smRemove(map, kind, id) {
  const found = smItem(map, id); if (!found || found.kind !== kind) throw Error('The saved item no longer exists.');
  if (kind === 'activity') {
    const steps = new Set(map.steps.filter(step => step.activityId === id).map(step => step.id));
    map.stories = map.stories.filter(story => !steps.has(story.stepId)); map.steps = map.steps.filter(step => !steps.has(step.id));
  }
  if (kind === 'step') map.stories = map.stories.filter(story => story.stepId !== id);
  if (kind === 'release') for (const story of map.stories) if (story.releaseId === id) story.releaseId = null;
  map[found.key] = map[found.key].filter(item => item.id !== id);
}
function smDuplicate(store, id, now = new Date().toISOString()) {
  const source = smFind(store, id); if (!source) throw Error('The map no longer exists.');
  const copy = smCopy(source), refs = new Map();
  copy.id = smNext(store, 'map'); copy.title = (copy.title.slice(0, 110) + ' — copy').slice(0, 120);
  copy.status = 'draft'; copy.revision = 1; copy.updatedAt = now;
  for (const [key, kind] of [['activities', 'activity'], ['steps', 'step'], ['stories', 'story'], ['releases', 'release']]) {
    for (const item of copy[key]) { const old = item.id; item.id = smNext(store, kind); refs.set(old, item.id); }
  }
  for (const step of copy.steps) step.activityId = refs.get(step.activityId);
  for (const story of copy.stories) { story.stepId = refs.get(story.stepId); story.releaseId = refs.get(story.releaseId) || null; }
  store.maps.push(copy); return copy;
}
function smIssues(d) {
  const store = smStore(d), out = [];
  if (!smShape(store)) return [{ level: 'error', code: 'storymap-schema', message: 'Storymap data is malformed.', node: null }];
  const warn = (map, text) => out.push({ level: 'warning', code: 'storymap-reference', message: map.title + ': ' + text, node: null });
  for (const map of store.maps) {
    for (const ref of map.prds) if (!d.prds?.some(prd => prd.id === ref.id)) warn(map, 'PRD target missing: ' + (ref.label || ref.id));
    for (const item of [...map.activities, ...map.steps, ...map.stories]) {
      for (const ref of item.surfaces) if (!d.nodes.some(node => node.id === ref.id)) warn(map, item.title + ' has a missing sitemap target: ' + (ref.label || ref.id));
      for (const ref of item.requirements || []) if (!d.prds?.some(prd => prd.id === ref.prdId && prd.requirements.some(req => req.id === ref.id))) warn(map, item.title + ' has a missing requirement: ' + (ref.label || ref.id));
    }
  }
  return out;
}
function smSurfaceUses(ids, d = design()) {
  const targets = new Set(Array.isArray(ids) ? ids : [ids]);
  return smStore(d).maps.flatMap(map => [...map.activities, ...map.steps, ...map.stories]
    .filter(item => item.surfaces.some(ref => targets.has(ref.id))).map(item => ({ map, item })));
}
const SM_GEOMETRY = Object.freeze({ left: 174, column: 232, cardWidth: 216, cardHeight: 96, pitch: 108, top: 182 });
function smLayout(map) {
  const g = SM_GEOMETRY, nodes = [], columns = [], activities = []; let x = g.left;
  for (const activity of map.activities) {
    const steps = map.steps.filter(step => step.activityId === activity.id), start = x;
    for (const step of steps) {
      columns.push({ id: step.id, activityId: activity.id, x, width: g.cardWidth });
      nodes.push({ id: step.id, kind: 'step', record: step, x, y: 90, width: g.cardWidth, height: 68 }); x += g.column;
    }
    if (!steps.length) { columns.push({ id: null, activityId: activity.id, x, width: g.cardWidth }); x += g.column; }
    const width = x - start - 16; activities.push({ id: activity.id, x: start, width });
    nodes.push({ id: activity.id, kind: 'activity', record: activity, x: start, y: 18, width, height: 56 });
  }
  const width = Math.max(g.left + g.column, x), lanes = []; let y = g.top;
  for (const release of [...map.releases, { id: null, title: 'Unplanned', outcome: 'Not assigned to a release.' }]) {
    const counts = columns.map(column => map.stories.filter(story => story.stepId === column.id && story.releaseId === release.id).length);
    const height = Math.max(148, Math.max(0, ...counts) * g.pitch + 60);
    lanes.push({ id: release.id, title: release.title, outcome: release.outcome, y, height, width });
    nodes.push({ id: release.id || 'sm-unplanned', kind: 'lane', record: release, x: 0, y, width, height });
    for (const column of columns.filter(c => c.id)) {
      const stories = map.stories.filter(story => story.stepId === column.id && story.releaseId === release.id);
      stories.forEach((story, index) => nodes.push({ id: story.id, kind: 'story', record: story, x: column.x, y: y + 16 + index * g.pitch, width: g.cardWidth, height: g.cardHeight }));
      nodes.push({ id: 'sm-add-' + column.id + '-' + (release.id || 'unplanned'), kind: 'add', record: { stepId: column.id, releaseId: release.id },
        x: column.x, y: y + 16 + stories.length * g.pitch, width: g.cardWidth, height: 32 });
    }
    y += height + 12;
  }
  return { nodes, columns, activities, lanes, width, height: y };
}
function smDropTarget(map, id, position) {
  const layout = smLayout(map), item = smItem(map, id); if (!item) return null;
  const cx = position.x + SM_GEOMETRY.cardWidth / 2;
  if (item.kind === 'story') {
    const column = layout.columns.find(c => c.id && cx >= c.x && cx < c.x + SM_GEOMETRY.column);
    const cy = position.y + SM_GEOMETRY.cardHeight / 2, lane = layout.lanes.find(l => cy >= l.y && cy <= l.y + l.height);
    if (!column || !lane) return null;
    const others = layout.nodes.filter(n => n.kind === 'story' && n.id !== id && n.record.stepId === column.id && n.record.releaseId === lane.id);
    const before = others.find(n => position.y < n.y + SM_GEOMETRY.cardHeight / 2);
    return { stepId: column.id, releaseId: lane.id, beforeId: before?.id || null };
  }
  if (item.kind === 'activity') return { beforeId: layout.activities.filter(a => a.id !== id).find(a => cx < a.x + a.width / 2)?.id || null };
  if (item.kind === 'step') {
    const activity = layout.activities.find(a => cx >= a.x && cx <= a.x + a.width + 16); if (!activity) return null;
    return { activityId: activity.id, beforeId: layout.columns.filter(c => c.id && c.id !== id && c.activityId === activity.id).find(c => cx < c.x + c.width / 2)?.id || null };
  }
  return null;
}
