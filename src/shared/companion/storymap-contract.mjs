// Renderer-independent, bounded authoring contract. References are IDs, never code.
export const STORYMAP_LIMITS = Object.freeze({ maps: 12, activities: 24, steps: 100, stories: 500, releases: 12, items: 4000, refs: 120 });
export function emptyStorymaps() { return { schema: 1, nextId: 1, maps: [] }; }
function smRequire(condition, message) { if (!condition) throw Error('STORYMAP_INVALID: ' + message); }
function smObject(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function smText(value, max, title = false) {
  return typeof value === 'string' && value.length <= max && (!title || value.trim().length > 0 && !/[\r\n]/.test(value));
}
function smCounter(value) { return Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER - 100000; }
function smRefId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 4000 && !/[\u0000-\u001f\u007f]/.test(value); }
function smReferences(refs, requirement = false) {
  smRequire(Array.isArray(refs) && refs.length <= STORYMAP_LIMITS.refs, 'Too many artifact references.');
  const seen = new Set();
  for (const ref of refs) {
    smRequire(smObject(ref, requirement ? ['id', 'prdId', 'label'] : ['id', 'label']) && smRefId(ref.id) &&
      smText(ref.label, 160) && (!requirement || smRefId(ref.prdId)), 'Malformed artifact reference.');
    const key = requirement ? JSON.stringify([ref.prdId, ref.id]) : ref.id;
    smRequire(!seen.has(key), 'Duplicate artifact reference.'); seen.add(key);
  }
}
export function validateStorymaps(value) {
  smRequire(smObject(value, ['schema', 'nextId', 'maps']) && value.schema === 1 && smCounter(value.nextId), 'Unsupported collection or counter.');
  smRequire(Array.isArray(value.maps) && value.maps.length <= STORYMAP_LIMITS.maps, 'Too many storymaps.');
  const ids = new Set(); let max = 0;
  function identity(record, prefix) {
    const match = typeof record?.id === 'string' && new RegExp('^' + prefix + '-([1-9][0-9]*)$').exec(record.id);
    smRequire(match && smCounter(Number(match[1])) && !ids.has(record.id), 'Invalid or duplicate storymap item ID.');
    smRequire(smText(record.title, 120, true), 'Give each map and item a single-line title (up to 120 characters).');
    ids.add(record.id); max = Math.max(max, Number(match[1]));
  }
  for (const map of value.maps) {
    smRequire(smObject(map, ['id', 'title', 'purpose', 'audience', 'status', 'revision', 'updatedAt', 'prds', 'activities', 'steps', 'stories', 'releases']), 'Unsupported map fields.');
    identity(map, 'map');
    smRequire(smText(map.purpose, 4000) && smText(map.audience, 1000) && ['draft', 'review', 'archived'].includes(map.status) &&
      smCounter(map.revision) && typeof map.updatedAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(map.updatedAt) &&
      Number.isFinite(Date.parse(map.updatedAt)) && new Date(map.updatedAt).toISOString() === map.updatedAt, 'Invalid map metadata.');
    smReferences(map.prds);
    for (const key of ['activities', 'steps', 'stories', 'releases']) {
      smRequire(Array.isArray(map[key]) && map[key].length <= STORYMAP_LIMITS[key], 'Collection exceeds the ' + key + ' limit.');
    }
    const activities = new Set(), steps = new Set(), releases = new Set();
    for (const item of map.activities) {
      smRequire(smObject(item, ['id', 'title', 'surfaces']), 'Unsupported activity fields.');
      identity(item, 'activity'); smReferences(item.surfaces); activities.add(item.id);
    }
    for (const item of map.steps) {
      smRequire(smObject(item, ['id', 'title', 'activityId', 'surfaces']) && activities.has(item.activityId), 'A step needs an activity in the same map.');
      identity(item, 'step'); smReferences(item.surfaces); steps.add(item.id);
    }
    for (const item of map.releases) {
      smRequire(smObject(item, ['id', 'title', 'outcome']) && smText(item.outcome, 4000), 'Unsupported release fields.');
      identity(item, 'release'); releases.add(item.id);
    }
    for (const item of map.stories) {
      smRequire(smObject(item, ['id', 'title', 'stepId', 'releaseId', 'description', 'acceptance', 'ui', 'surfaces', 'requirements']) &&
        steps.has(item.stepId) && (item.releaseId === null || releases.has(item.releaseId)), 'A story needs a valid step and release in its own map.');
      identity(item, 'story');
      smRequire(smText(item.description, 8000) && smText(item.acceptance, 8000) && ['unspecified', 'none', 'surface'].includes(item.ui), 'Invalid story details.');
      smReferences(item.surfaces); smReferences(item.requirements, true);
      smRequire(item.ui !== 'none' || !item.surfaces.length, 'A no-UI story cannot also link surfaces.');
    }
  }
  smRequire(ids.size <= STORYMAP_LIMITS.items && value.nextId > max, 'Item limit exceeded or counter could reuse an ID.');
  return value;
}
