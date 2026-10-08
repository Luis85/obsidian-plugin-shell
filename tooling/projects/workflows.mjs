import { isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';
import { inspectWorkflow } from '../quality/check-repository.mjs';

/**
 * Scopes a standalone project's own GitHub workflow to its folder inside this repository. GitHub only runs root
 * `.github/workflows`, so a project's workflow is copied there as `projects--<project>--<file>.yml`; every relative
 * path it uses is moved into `projects/<project>/`, its triggers only fire for that folder and its concurrency groups
 * cannot cancel shell runs. Anything the transform cannot scope faithfully is refused, never guessed.
 */
export const SYNCED_PREFIX = 'projects--';
export const syncedName = (project, file) => `${SYNCED_PREFIX}${project}--${file.replace(/\.yaml$/, '.yml')}`;
export const parseSyncedName = name => /^projects--([a-z][a-z0-9]*(?:-[a-z0-9]+)*)--(.+\.yml)$/.exec(name);

const PATH_TRIGGERS = ['push', 'pull_request'];
const REFUSED_TRIGGERS = ['pull_request_target', 'workflow_run'];
/** `with` inputs of known actions that name workspace-relative paths (newline-separated lists allowed). */
const ACTION_PATHS = {
  'actions/setup-node': ['node-version-file', 'cache-dependency-path'],
  'actions/upload-artifact': ['path'],
  'actions/download-artifact': ['path'],
  'actions/cache': ['path'],
  'actions/cache/restore': ['path'],
  'actions/cache/save': ['path'],
};
/** Defaults a known action would otherwise resolve against the repository root. */
const ACTION_DEFAULTS = { 'actions/download-artifact': { path: '.' } };
const pathLikeInput = /(?:^|[-_])(?:path|paths|file|files|dir|directory|folder|root|cwd)$/i;
const workspaceReference = /\bgithub\.workspace\b|\bGITHUB_WORKSPACE\b/;

class ScopeError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.code = code; }
}

/** `reports/x` becomes `projects/<p>/reports/x`; absolute, home, variable and expression-led values stay as they are. */
export function scopePath(value, folder) {
  const text = String(value).trim();
  if (!text) return text;
  const negated = text.startsWith('!');
  const body = negated ? text.slice(1) : text;
  if (/^(?:\/|~|\$|[A-Za-z]:[\\/])/.test(body)) return text;
  if (body.split(/[\\/]/).includes('..')) throw new ScopeError('PROJECT_WORKFLOW_PATH_ESCAPES', body);
  const relative = body.replace(/^\.(?:\/+|$)/, '');
  return `${negated ? '!' : ''}${folder}${relative ? `/${relative}` : ''}`;
}
const scopeList = (value, folder) => String(value).split('\n').map(line => (line.trim() ? scopePath(line, folder) : line)).join('\n').replace(/\n+$/, '');

function triggers(doc) {
  const on = doc.get('on', true);
  if (isScalar(on)) return doc.createNode({ [on.value]: null });
  if (isSeq(on)) return doc.createNode(Object.fromEntries(on.items.map(item => [item.value, null])));
  if (isMap(on)) return on;
  throw new ScopeError('PROJECT_WORKFLOW_SHAPE', 'missing `on`');
}
function scopeTriggers(doc, folder, target) {
  const on = triggers(doc);
  for (const event of REFUSED_TRIGGERS) if (on.has(event)) throw new ScopeError('PROJECT_WORKFLOW_PRIVILEGED_TRIGGER', event);
  for (const event of PATH_TRIGGERS) {
    if (!on.has(event)) continue;
    const filter = on.get(event, true);
    const config = isMap(filter) ? filter : doc.createNode({});
    const own = [`${folder}/**`, `.github/workflows/${target}`];
    const paths = config.get('paths')?.toJSON?.() ?? config.get('paths');
    const ignored = config.get('paths-ignore')?.toJSON?.() ?? config.get('paths-ignore');
    let scoped;
    if (paths) scoped = [...paths.map(path => scopePath(path, folder)), `.github/workflows/${target}`];
    else scoped = [...own, ...(ignored ?? []).map(path => scopePath(`!${path}`, folder))];
    config.delete('paths-ignore');
    config.set('paths', doc.createNode(scoped, { flow: false }));
    on.set(event, config);
  }
  doc.set('on', on);
}
function scopeConcurrency(holder, project) {
  const value = holder.get('concurrency', true);
  if (!value) return;
  if (isScalar(value)) holder.set('concurrency', `projects-${project}-${value.value}`);
  else if (isMap(value) && value.has('group')) value.set('group', `projects-${project}-${value.get('group')}`);
}
function scopeDefaults(holder, doc, folder, required) {
  const current = holder.getIn(['defaults', 'run', 'working-directory']);
  if (current !== undefined) holder.setIn(['defaults', 'run', 'working-directory'], scopePath(current, folder));
  else if (required) holder.setIn(['defaults', 'run', 'working-directory'], folder);
}
function scopeStep(step, folder, where) {
  if (!isMap(step)) throw new ScopeError('PROJECT_WORKFLOW_SHAPE', `${where} is not a mapping`);
  const directory = step.get('working-directory');
  if (directory !== undefined) step.set('working-directory', scopePath(directory, folder));
  const uses = step.get('uses');
  if (uses === undefined) return;
  if (String(uses).startsWith('./')) throw new ScopeError('PROJECT_WORKFLOW_LOCAL_ACTION', `${where} uses ${uses}; inline it or publish it as a pinned action`);
  const action = String(uses).split('@')[0];
  const inputs = step.get('with', true);
  if (action === 'actions/checkout' && isMap(inputs) && inputs.has('path')) throw new ScopeError('PROJECT_WORKFLOW_UNSCOPED_INPUT', `${where} checkout path`);
  const known = ACTION_PATHS[action] ?? [];
  for (const [key, value] of Object.entries(ACTION_DEFAULTS[action] ?? {})) if (!isMap(inputs) || !inputs.has(key)) step.setIn(['with', key], value);
  if (!isMap(inputs)) return;
  for (const pair of inputs.items) {
    const key = String(pair.key.value ?? pair.key);
    if (known.includes(key)) inputs.set(key, scopeList(inputs.get(key), folder));
    else if (action !== 'actions/checkout' && pathLikeInput.test(key)) throw new ScopeError('PROJECT_WORKFLOW_UNSCOPED_INPUT', `${where} ${action} input ${key}`);
  }
}
function scopeExpressions(doc, folder) {
  visit(doc, {
    Alias() { throw new ScopeError('PROJECT_WORKFLOW_ALIAS', 'YAML anchors and aliases are not supported; repeat the step instead'); },
    Scalar(_, node) {
      if (typeof node.value !== 'string') return;
      if (workspaceReference.test(node.value)) throw new ScopeError('PROJECT_WORKFLOW_WORKSPACE_REFERENCE', 'use paths relative to the project folder instead of the workspace root');
      if (!node.value.includes('hashFiles(')) return;
      node.value = node.value.replace(/hashFiles\(([^)]*)\)/g, (_, args) => `hashFiles(${args.replace(/'([^']*)'/g, (__, path) => `'${scopePath(path, folder)}'`)})`);
    },
  });
}

/** Returns the scoped workflow text; throws a ScopeError naming the first construct that cannot be scoped. */
export function scopeWorkflow(text, { project, file }) {
  const folder = `projects/${project}`, target = syncedName(project, file);
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) throw new ScopeError('PROJECT_WORKFLOW_YAML_INVALID', doc.errors[0].message);
  if (!isMap(doc.contents)) throw new ScopeError('PROJECT_WORKFLOW_SHAPE', 'not a mapping');
  scopeExpressions(doc, folder);
  doc.set('name', `${project}: ${doc.get('name') ?? file}`);
  scopeTriggers(doc, folder, target);
  scopeConcurrency(doc, project);
  scopeDefaults(doc, doc, folder, true);
  const jobs = doc.get('jobs', true);
  if (!isMap(jobs)) throw new ScopeError('PROJECT_WORKFLOW_SHAPE', 'missing jobs');
  for (const { key, value: job } of jobs.items) {
    if (!isMap(job)) throw new ScopeError('PROJECT_WORKFLOW_SHAPE', `job ${key} is not a mapping`);
    if (job.has('uses')) throw new ScopeError('PROJECT_WORKFLOW_REUSABLE_JOB', `job ${key} calls ${job.get('uses')}`);
    scopeConcurrency(job, project);
    scopeDefaults(job, doc, folder, false);
    const steps = job.get('steps', true);
    if (isSeq(steps)) steps.items.forEach((step, index) => scopeStep(step, folder, `job ${key} step ${index + 1}`));
  }
  doc.commentBefore = ` Generated from ${folder}/.github/workflows/${file} by \`npm run projects:sync\`.\n Edit the project's own workflow and re-run the sync; never edit this copy.`;
  const output = doc.toString({ lineWidth: 0 });
  try { inspectWorkflow(output); } catch (error) { throw new ScopeError('PROJECT_WORKFLOW_SECURITY_FLOOR', error.message); }
  return output;
}

/** True when a shell workflow's push/pull_request triggers can never fire for a change that only touches projects/. */
export function excludesProjects(text) {
  const data = parseDocument(text).toJS({ maxAliasCount: -1 }) ?? {};
  const on = typeof data.on === 'string' ? { [data.on]: null } : Array.isArray(data.on) ? Object.fromEntries(data.on.map(event => [event, null])) : (data.on ?? {});
  return PATH_TRIGGERS.filter(event => Object.hasOwn(on, event)).every(event => {
    const filter = on[event] ?? {};
    if (Array.isArray(filter['paths-ignore'])) return filter['paths-ignore'].includes('projects/**');
    if (Array.isArray(filter.paths)) return filter.paths.at(-1) === '!projects/**';
    return false;
  });
}
