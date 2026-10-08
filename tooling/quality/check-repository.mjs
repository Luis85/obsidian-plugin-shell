import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { checkDocsLaunchers } from './check-docs-launchers.mjs';
import { inspectE2eWorkflow, releaseE2eFailures } from './e2e-policy.mjs';
import { callableWorkflow, checkPermissions, inspectJobPrivileges, inspectWorkflowPrivileges, localWorkflowCall, privilegedWorkflows } from './workflow-policy.mjs';

const untrustedInterpolation = /\$\{\{\s*(?:github\.event\.(?:pull_request|issue|comment)|inputs\.)/;
const localActionPrefix = './.github/actions/';
const localAction = /^\.\/\.github\/actions\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
function pinnedAction(value) {
  if (typeof value !== 'string' || !/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(value)) throw new Error('WORKFLOW_ACTION_NOT_PINNED');
}
/** A repository-local composite action: only SHA-pinned external actions, explicit shells and no input interpolation in shell text. */
export function inspectCompositeAction(text) {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length) throw new Error('ACTION_YAML_INVALID');
  const data = document.toJS();
  if (!data || typeof data !== 'object' || !data.name || !data.runs || data.runs.using !== 'composite' || !Array.isArray(data.runs.steps) || !data.runs.steps.length) throw new Error('ACTION_NOT_COMPOSITE');
  for (const step of data.runs.steps) {
    if (!step || typeof step !== 'object' || Boolean(step.uses) === Boolean(step.run)) throw new Error('ACTION_STEP_INVALID');
    if (step.uses) pinnedAction(step.uses);
    if (step.uses?.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) throw new Error('WORKFLOW_PERSISTED_CREDENTIALS');
    if (step.run && !step.shell) throw new Error('ACTION_STEP_INVALID');
    if (step.run && untrustedInterpolation.test(step.run)) throw new Error('WORKFLOW_UNTRUSTED_SHELL_INTERPOLATION');
  }
  return { steps: data.runs.steps.length };
}
/** `file` is the workflow file name; only the scoped allowlist in workflow-policy.mjs may grant job write scopes. */
export function inspectWorkflow(text, file = '') {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length) throw new Error('WORKFLOW_YAML_INVALID');
  const data = document.toJS();
  if (!data || typeof data !== 'object' || !data.name || !data.on || !data.jobs || typeof data.jobs !== 'object' || Array.isArray(data.jobs)) throw new Error('WORKFLOW_SHAPE_INVALID');
  const privileged = privilegedWorkflows.includes(file);
  checkPermissions(data.permissions);
  inspectWorkflowPrivileges(data, privileged);
  if (data.on === 'pull_request_target' || (Array.isArray(data.on) && data.on.includes('pull_request_target')) || (typeof data.on === 'object' && Object.hasOwn(data.on, 'pull_request_target'))) throw new Error('PRIVILEGED_PR_TRIGGER_FORBIDDEN');
  const localActions = new Set(), localWorkflows = new Set();
  const pinned = value => {
    // A repository-local composite action is versioned with this commit; checkRepository inspects it and its own pins.
    if (typeof value === 'string' && localAction.test(value)) { localActions.add(value.slice(localActionPrefix.length)); return; }
    pinnedAction(value);
  };
  const jobs = Object.values(data.jobs);
  if (!jobs.length) throw new Error('WORKFLOW_NO_JOBS');
  for (const job of jobs) {
    if (!job || typeof job !== 'object') throw new Error('WORKFLOW_JOB_INVALID');
    inspectJobPrivileges(job, privileged);
    if (job.uses) {
      const called = localWorkflowCall(job.uses);
      if (called) localWorkflows.add(called); else pinned(job.uses);
      continue;
    }
    if (!job['runs-on'] || !Array.isArray(job.steps) || !job.steps.length) throw new Error('WORKFLOW_JOB_INVALID');
    for (const step of job.steps) {
      if (!step || typeof step !== 'object' || Boolean(step.uses) === Boolean(step.run)) throw new Error('WORKFLOW_STEP_INVALID');
      if (step.uses) {
        pinned(step.uses);
        if (step.uses.startsWith('actions/checkout@') && step.with?.['persist-credentials'] !== false) throw new Error('WORKFLOW_PERSISTED_CREDENTIALS');
      }
      if (step.run && untrustedInterpolation.test(step.run)) throw new Error('WORKFLOW_UNTRUSTED_SHELL_INTERPOLATION');
    }
  }
  return { jobs: jobs.length, localActions: [...localActions].sort(), localWorkflows: [...localWorkflows].sort(), callable: callableWorkflow(data.on) };
}
/**
 * A standalone project's workflow copied by `npm run projects:sync` (tooling/projects/workflows.mjs names it
 * `projects--<project>--<file>.yml`; that module imports this one, so the prefix is matched here). It gets the portable
 * review above but follows its project's own end-to-end model (the generated-project template), not this repository's
 * tiered e2e and release-call rules.
 */
export const syncedProjectWorkflow = name => /^projects--[a-z][a-z0-9]*(?:-[a-z0-9]+)*--.+\.yml$/.test(name);
/**
 * This repository's e2e opt-in policy (e2e-policy.mjs), applied by checkRepository only: inspectWorkflow stays the
 * portable subset that also reviews a generated project's workflows, which have no `tier` input.
 * Returns whether a workflow holds e2e work, its call tier default and its reusable calls for the release rule.
 */
export function e2eFacts(text, file = '') {
  const data = parseDocument(text, { uniqueKeys: true }).toJS(), facts = inspectE2eWorkflow(data);
  const calls = Object.values(data.jobs).flatMap(job => localWorkflowCall(job?.uses) ? [{ workflow: localWorkflowCall(job.uses), tier: job.with?.tier }] : []);
  return { file, ...facts, calls };
}
/** Owned styles only. Full compiled containment remains the artifact gate's job. */
export function inspectOwnedCss(text, name = 'owned.css') {
  const ast = postcss.parse(text, { from: name }); let declarations = 0;
  ast.walkDecls(declaration => {
    declarations++;
    if (!declaration.value.trim()) throw new Error('CSS_EMPTY_DECLARATION');
  });
  ast.walkRules(rule => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    selectorParser(selectors => {
      selectors.each(selector => {
        let owned = false;
        selector.walk(node => { if (node.type === 'class' || (node.type === 'attribute' && node.attribute === 'data-plugin-ui')) owned = true; });
        if (!owned) throw new Error('CSS_UNOWNED_SELECTOR');
      });
    }).processSync(rule.selector);
  });
  return { declarations };
}
export function markdownLinks(text) {
  // Narrow policy: balanced fenced blocks and existing inline local file links.
  // Reference links, anchors, spelling and full Markdown grammar are not claimed.
  const lines = []; let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (match && !fence) { fence = match[1]; continue; }
    if (match && fence && match[1][0] === fence[0] && match[1].length >= fence.length) { fence = null; continue; }
    if (!fence) lines.push(line.replace(/`[^`]*`/g, ''));
  }
  if (fence) throw new Error('MARKDOWN_UNCLOSED_FENCE');
  const links = [];
  for (const match of lines.join('\n').matchAll(/!?\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
    const value = match[1] ?? match[2];
    if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value)) continue;
    const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    if (path) links.push(path);
  }
  return links;
}
export async function checkRepository(root = process.cwd()) {
  root = resolve(root); const files = [];
  async function walk(folder, pattern) {
    for (const entry of await readdir(resolve(root, folder), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('REPOSITORY_INPUT_SYMLINK');
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await walk(path, pattern);
      else if (pattern.test(entry.name)) files.push(path);
    }
  }
  // docs/ is a design working directory (owner decision): its Markdown and links are not a repository gate.
  await walk('.github/workflows', /\.ya?ml$/); await walk('src/plugin/styles', /\.css$/);
  const actions = new Map();
  try { await walk('.github/actions', /^action\.ya?ml$/); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const name of ['README.md', 'AGENTS.md', 'CHANGELOG.md']) { try { await access(join(root, name)); files.push(name); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const counts = { workflows: 0, actions: 0, styles: 0, markdown: 0, localLinks: 0 }; const failures = []; const references = [];
  const callable = new Map(), calls = [], e2e = [];
  for (const file of files) {
    try {
      const text = await readFile(join(root, file), 'utf8');
      const parts = file.split(sep);
      if (parts[0] === '.github' && parts[1] === 'actions') {
        if (parts.length !== 4) throw new Error('ACTION_LAYOUT_INVALID');
        inspectCompositeAction(text); actions.set(parts[2], file); counts.actions++;
      } else if (/\.ya?ml$/.test(file)) {
        const inspected = inspectWorkflow(text, parts.at(-1));
        references.push(...inspected.localActions.map(name => [file, name])); calls.push(...inspected.localWorkflows.map(name => [file, name]));
        callable.set(parts.at(-1), inspected.callable); counts.workflows++;
        if (!syncedProjectWorkflow(parts.at(-1))) e2e.push(e2eFacts(text, parts.at(-1)));
      }
      else if (file.endsWith('.css')) { inspectOwnedCss(text, file); counts.styles++; }
      else {
        for (const link of markdownLinks(text)) {
          const destination = resolve(dirname(join(root, file)), link);
          const local = relative(root, destination);
          if (local === '..' || local.startsWith('..' + sep)) throw new Error(`MARKDOWN_LINK_OUTSIDE_REPOSITORY: ${link}`);
          try { await access(destination); } catch { throw new Error(`MARKDOWN_MISSING_LOCAL_LINK: ${link}`); }
          counts.localLinks++;
        }
        counts.markdown++;
      }
    } catch (error) { failures.push(`${file}: ${error.message}`); }
  }
  for (const [file, name] of references) if (!actions.has(name)) failures.push(`${file}: WORKFLOW_LOCAL_ACTION_MISSING: ${name}`);
  for (const [file, name] of calls) {
    if (!callable.has(name)) failures.push(`${file}: WORKFLOW_LOCAL_WORKFLOW_MISSING: ${name}`);
    else if (!callable.get(name)) failures.push(`${file}: WORKFLOW_LOCAL_WORKFLOW_NOT_CALLABLE: ${name}`);
  }
  const release = e2e.find(item => item.file === 'release.yml');
  failures.push(...releaseE2eFailures(e2e.filter(item => item.e2e), release?.calls ?? []));
  if (failures.length) throw new Error(failures.join('\n'));
  if (!counts.workflows || !counts.styles || !counts.markdown) throw new Error('REPOSITORY_INPUTS_MISSING');
  return { status: 'passed', ...counts, scope: 'read-only workflow (scoped release allowlist), opt-in e2e mandatory in the release tier, local composite action and reusable workflow subset, owned CSS syntax/selectors, Markdown fences/local inline file links' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 2) throw new Error('NO_ARGUMENTS_SUPPORTED'); console.log(JSON.stringify(await checkRepository())); console.log(JSON.stringify(await checkDocsLaunchers())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
